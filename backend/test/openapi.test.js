/**
 * Le document OpenAPI, vérifié pour lui-même.
 *
 * Écrit à l'étape 1 quand le contrat n'était qu'un squelette, conservé à l'étape 7 quand il
 * est devenu exécutable — mais son périmètre a changé, et la frontière mérite d'être dite :
 *
 *   · ICI : ce que le DOCUMENT doit dire. Aucun serveur n'est démarré, ces tests coûtent
 *     quelques millisecondes et répondent à « le contrat exprime-t-il encore nos lois ? ».
 *   · `test/api-v1.test.js` : la correspondance entre le document et les routes RÉELLES,
 *     puis leur comportement. Il faut un serveur pour cela.
 *
 * Séparés parce qu'ils échouent pour des raisons différentes. Un document qui contredit le
 * CDM est une faute de conception ; une route non documentée est un oubli d'implémentation.
 * Mélanger les deux rendrait chaque échec plus long à comprendre.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const cdm = require('../src/lib/cdm');

const SPEC_PATH = path.join(__dirname, '../openapi/openapi.yaml');
const spec = yaml.load(fs.readFileSync(SPEC_PATH, 'utf8'));

test('le document OpenAPI est valide et versionné', () => {
  assert.equal(spec.openapi, '3.1.0');
  assert.ok(spec.info.title);
  // Plus de suffixe `-draft` depuis l'étape 7 : le contrat est servi, donc il engage.
  assert.match(spec.info.version, /^\d+\.\d+\.\d+$/);
});

test('toutes les routes sont sous /api/v1', () => {
  // `/api` non versionnée n'est pas décrite : elle reste jusqu'à la bascule mobile, mais
  // ce n'est pas un contrat public — c'est un existant qu'on accompagne vers la sortie.
  for (const server of spec.servers) {
    assert.match(server.url, /\/api\/v1$/);
  }
});

test('chaque opération porte un résumé et au moins une réponse de succès', () => {
  for (const [routePath, operations] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(operations)) {
      const where = `${method.toUpperCase()} ${routePath}`;
      assert.ok(operation.summary, `${where} n'a pas de résumé`);
      assert.ok(
        operation.responses && Object.keys(operation.responses).length > 0,
        `${where} ne déclare aucune réponse`
      );
      assert.ok(
        operation.responses['200'] || operation.responses['201'],
        `${where} ne déclare aucun succès`
      );
    }
  }
});

test('la projection client n\'expose jamais le stock physique', () => {
  const publicProduct = spec.components.schemas.ProductPublic;

  // `additionalProperties: false` est le point important : l'absence de `on_hand` est
  // structurelle, pas une simple omission d'écriture.
  assert.equal(publicProduct.additionalProperties, false);
  const fields = Object.keys(publicProduct.properties);
  for (const forbidden of ['on_hand', 'reserved', 'safety_buffer', 'quantity']) {
    assert.equal(fields.includes(forbidden), false, `${forbidden} ne doit pas être exposé au client`);
  }
  assert.ok(fields.includes('available'));
});

test('la projection commerçant expose les quatre valeurs de stock', () => {
  const stock = spec.components.schemas.StockLevel;
  for (const field of ['on_hand', 'reserved', 'safety_buffer', 'available']) {
    assert.ok(stock.properties[field], `${field} manquant`);
  }
  // Loi 11 : la valeur dérivée est en lecture seule dans le contrat lui-même.
  assert.equal(stock.properties.available.readOnly, true);
});

test('l\'exécution d\'une intention exige une clé d\'idempotence', () => {
  const operation = spec.paths['/intents/{intentId}'].post;
  const idempotency = operation.parameters.find((p) => p.name === 'Idempotency-Key');

  assert.ok(idempotency, 'le paramètre est déclaré');
  assert.equal(idempotency.in, 'header');
  assert.equal(idempotency.required, true);
});

test('la seule écriture non-intentionnelle est mono-organe et déclarative', () => {
  // Loi 5 vue depuis le contrat : une écriture qui touche plus d'un organe passe par une
  // intention. Ce test énumère donc les écritures publiées et refuse la troisième — celle
  // qu'on ajoute « juste pour cette fois », et par laquelle une API redevient un miroir de
  // tables.
  const writes = [];
  for (const [routePath, operations] of Object.entries(spec.paths)) {
    for (const method of Object.keys(operations)) {
      if (['post', 'patch', 'put', 'delete'].includes(method)) {
        writes.push(`${method.toUpperCase()} ${routePath}`);
      }
    }
  }

  assert.deepEqual(writes.sort(), [
    'PATCH /inventory/{productId}',
    'POST /intents/{intentId}',
  ]);

  // Déclaratif, donc rejouable sans clé : des valeurs cibles, jamais des deltas.
  const body = spec.paths['/inventory/{productId}'].patch.requestBody.content['application/json'].schema;
  assert.equal(body.additionalProperties, false);
  assert.deepEqual(Object.keys(body.properties).sort(), ['on_hand', 'reason', 'safety_buffer']);
});

test('les statuts de commande du contrat correspondent au CDM', () => {
  const contractStatuses = spec.components.schemas.Order.properties.status.enum;
  const cdmStatuses = cdm.ENTITIES.Order.fields.status.values;

  assert.deepEqual([...contractStatuses].sort(), [...cdmStatuses].sort());
});

test('les modes d\'inventaire du contrat correspondent au CDM', () => {
  const contractModes = spec.components.schemas.StockLevel.properties.inventory_owner.enum;
  assert.deepEqual([...contractModes].sort(), [...cdm.ownership.INVENTORY_MODES].sort());
});

test('les types de mouvement de stock correspondent au CDM', () => {
  const contractKinds = spec.components.schemas.StockMovement.properties.kind.enum;
  const cdmKinds = cdm.ENTITIES.StockMovement.fields.kind.values;

  assert.deepEqual([...contractKinds].sort(), [...cdmKinds].sort());
});

test('une intention peut rapporter des étapes reportées', () => {
  // Loi 12 : une étape est soit exécutée, soit explicitement reportée à l'utilisateur. Le
  // contrat doit porter ce canal, sinon la loi est inapplicable côté interface.
  const result = spec.components.schemas.IntentResult;
  assert.ok(result.properties.deferred);
  assert.deepEqual(result.properties.status.enum, ['completed', 'partially_completed']);
});

test('une intention compensée est un échec, pas un succès nuancé', () => {
  // ÉCART ASSUMÉ AVEC LE SQUELETTE DE L'ÉTAPE 1, qui rangeait `compensated` parmi les
  // statuts de succès. À l'implémentation, cette forme s'est révélée fausse : une exécution
  // compensée n'a produit AUCUN effet net, la réponse est un 422, et un intégrateur qui
  // lirait un corps de succès en conclurait que sa commande existe.
  //
  // Deux schémas plutôt qu'un enum élargi : le code HTTP et la forme du corps disent alors
  // la même chose, et il n'y a pas deux façons de représenter le même événement.
  const failure = spec.components.schemas.IntentFailure;
  assert.deepEqual(failure.properties.status.enum, ['failed', 'compensated']);
  assert.ok(failure.properties.compensated, 'ce qui a été défait doit être nommé');
  assert.ok(spec.paths['/intents/{intentId}'].post.responses['422']);
});
