/**
 * Étape 8 — la suite de CONFORMITÉ, appliquée à tous les connecteurs sans exception.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE FICHIER EST LE VRAI LIVRABLE DE L'ÉTAPE 8, PLUS QUE LE PREMIER CONNECTEUR
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Un test écrit pour Shopify vérifie Shopify. Il ne dit rien de Lightspeed, de SumUp, de
 * Zettle, de WooCommerce ni de Sage — et il ne les empêchera pas d'arriver avec leurs propres
 * libertés. Ce fichier fait l'inverse : il énumère les connecteurs ENREGISTRÉS et applique à
 * chacun les mêmes exigences. Le connecteur suivant hérite donc de sa suite de tests le jour
 * où il s'enregistre, sans qu'une ligne soit écrite ici pour lui.
 *
 * C'est aussi ce qui donne un sens mesurable à « le connecteur suivant ne coûte qu'un
 * fichier » : si cette phrase était fausse, elle serait fausse ICI, sous la forme d'un test
 * qu'il faut modifier pour accueillir un nouvel éditeur.
 *
 * CE QUI EST VÉRIFIÉ, ET POURQUOI CHAQUE POINT MÉRITE UN TEST DE FAMILLE :
 *
 *   1. La déclaration est complète et cohérente (le contrat le fait déjà au boot ; ici on
 *      vérifie qu'il l'a fait, car un contrat qu'on peut contourner n'en est pas un).
 *   2. Un connecteur qui exige des identifiants dit COMMENT on les obtient.
 *   3. Aucun nom d'éditeur ne fuit dans le vocabulaire du moteur (secrets, ressources).
 *   4. Un webhook non signé est refusé — par TOUS, pas par le premier qui y a pensé.
 *   5. Le dialecte reste confiné : aucun fichier de connecteur n'importe la base ni un organe.
 *   6. Le formulaire de connexion est dessinable par une surface sans connaissance d'éditeur.
 *
 * Aucun accès réseau : tout ce qui est vérifié ici est de la DÉCLARATION et de la STRUCTURE.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const h = require('./helpers/testServer');
const integration = require('../src/lib/integration');
const registry = require('../src/lib/integration/connectorRegistry');
const contract = require('../src/lib/integration/contract');
const signature = require('../src/lib/integration/signature');

integration.boot({ workers: false });

/**
 * Les connecteurs RÉELS, c'est-à-dire ceux que `connectors/index.js` enregistre.
 *
 * Volontairement pris dans le registre et non écrits à la main : une liste en dur serait une
 * liste qu'on oublierait de compléter, et un connecteur non conforme passerait en se
 * contentant de ne pas s'y inscrire.
 */
const CONNECTORS = registry.ids().map((id) => registry.get(id));

const CONNECTOR_DIR = path.join(__dirname, '..', 'src', 'lib', 'integration', 'connectors');

test('des connecteurs sont enregistrés', () => {
  // Garde-fou du garde-fou : une suite paramétrée par une liste vide passe toujours.
  assert.ok(CONNECTORS.length >= 1, 'aucun connecteur enregistré — cette suite ne vérifierait rien');
});

for (const connector of CONNECTORS) {
  const scope = `[${connector.id}]`;

  test(`${scope} déclare des capacités connues et fournit leur mécanique`, () => {
    assert.ok(connector.capabilities.length >= 1);

    for (const capability of connector.capabilities) {
      const spec = contract.CONNECTOR_CAPABILITIES[capability];
      assert.ok(spec, `capacité inconnue « ${capability} »`);

      for (const method of spec.methods) {
        assert.equal(
          typeof connector[method], 'function',
          `« ${capability} » est annoncée sans ${method}() — promesse non tenue au commerçant`
        );
      }
    }

    for (const resource of connector.resources) {
      assert.ok(
        contract.RESOURCES.includes(resource),
        `ressource « ${resource} » hors du CDM — un connecteur ne l'étend pas en silence`
      );
    }
  });

  test(`${scope} dit comment on obtient ses identifiants`, () => {
    if (!connector.requiresAuth) {
      assert.equal(connector.connectionMode, contract.CONNECTION_MODE.NONE);
      assert.equal(connector.secrets.length, 0);
      return;
    }

    assert.notEqual(
      connector.connectionMode, contract.CONNECTION_MODE.NONE,
      'exige des identifiants sans mode de connexion : impossible à brancher'
    );
    assert.ok(connector.secrets.length >= 1, 'exige des identifiants sans dire lesquels ranger');

    if (connector.connectionMode === contract.CONNECTION_MODE.DELEGATED) {
      for (const fn of ['authorizeUrl', 'tokenRequest', 'parseToken']) {
        assert.equal(typeof connector.oauth[fn], 'function', `descripteur sans ${fn}()`);
      }
      // Une portée non déclarée est une portée que le commerçant ne peut pas lire avant
      // d'accepter. « Tout » ne doit jamais être une valeur par défaut silencieuse.
      assert.ok(
        Array.isArray(connector.oauth.scopes) && connector.oauth.scopes.length >= 1,
        'connexion déléguée sans portée déclarée'
      );
      for (const param of connector.oauth.params || []) {
        assert.ok(param.name && param.label, 'paramètre de connexion sans nom ni libellé');
      }
    }

    if (connector.connectionMode === contract.CONNECTION_MODE.CREDENTIALS) {
      assert.ok(connector.credentialFields.length >= 1);
      for (const field of connector.credentialFields) {
        assert.ok(field.name && field.label);
        assert.ok(
          connector.secrets.includes(field.name),
          `« ${field.name} » est demandé au commerçant mais n'est pas déclaré dans \`secrets\` : `
          + 'il serait saisi puis jamais exigé au branchement'
        );
      }
    }
  });

  test(`${scope} n'impose son nom nulle part dans le vocabulaire du moteur`, () => {
    // Un nom d'éditeur dans un nom de secret est le premier pas vers un coffre qui connaît
    // ses éditeurs, puis vers un moteur qui les connaît.
    for (const name of connector.secrets) {
      assert.ok(
        !name.includes(connector.id),
        `le secret « ${name} » porte le nom du connecteur — attendu un nom canonique `
        + '(access_token, api_key, refresh_token…)'
      );
    }

    for (const param of connector.oauth?.params || []) {
      assert.ok(contract.RESOURCES.includes(param.name) === false);
    }
  });

  test(`${scope} refuse une notification non signée`, () => {
    if (!contract.supports(connector, 'webhooks')) return;

    // Une requête nue : ni signature, ni identifiants d'application. C'est exactement ce
    // qu'enverrait quelqu'un qui a trouvé l'URL, et c'est le seul scénario qu'un connecteur
    // ne peut PAS se permettre d'accepter.
    const verdict = connector.verifyWebhook({
      headers: {},
      rawBody: Buffer.from('{"any":"thing"}'),
      payload: { any: 'thing' },
      app: null,
      resolveStore: () => null,
    });

    assert.notEqual(verdict?.valid, true, 'notification sans signature acceptée');
  });

  test(`${scope} refuse une notification signée avec la mauvaise clé`, () => {
    if (!contract.supports(connector, 'webhooks')) return;

    const body = Buffer.from('{"any":"thing"}');
    // Signature valide en soi, produite avec un secret qui n'est pas le nôtre : le cas d'un
    // attaquant qui connaît l'algorithme. Vérifier l'algorithme sans vérifier la CLÉ est une
    // erreur qu'on ne voit jamais en lisant un connecteur.
    const forged = signature.sign({ payload: body, secret: 'secret-de-quelqu-un-d-autre' });

    let verdict = null;
    for (const header of headerCandidates(connector)) {
      verdict = connector.verifyWebhook({
        headers: { [header]: forged },
        rawBody: body,
        payload: { any: 'thing' },
        app: { client_id: 'app', client_secret: 'le-notre' },
        resolveStore: () => ({ store_id: 'boutique' }),
      });
      assert.notEqual(verdict?.valid, true, `signature étrangère acceptée via ${header}`);
    }
  });

  test(`${scope} présente un formulaire de connexion dessinable sans le connaître`, () => {
    const form = integration.connectionForm(connector.id);

    assert.equal(form.connectorId, connector.id);
    assert.ok(form.label);
    assert.ok(Object.values(contract.CONNECTION_MODE).includes(form.mode));
    for (const field of form.fields) {
      assert.ok(field.name && field.label, 'champ sans libellé : rien à afficher au commerçant');
    }
    // Sérialisable : la surface reçoit du JSON, pas des fonctions.
    assert.doesNotThrow(() => JSON.stringify(form));
    assert.equal(JSON.stringify(form).includes('function'), false);
  });

  test(`${scope} ne laisse aucun identifiant sortir de sa description`, () => {
    const described = JSON.stringify(registry.describe(connector.id));

    // La description est publique (elle alimente un écran) : elle nomme des secrets, elle
    // n'en contient jamais la valeur, et surtout aucune fonction du descripteur d'autorisation.
    for (const forbidden of ['client_secret', 'authorizeUrl', 'tokenRequest']) {
      assert.equal(described.includes(forbidden), false, `« ${forbidden} » exposé dans la description`);
    }
  });
}

test('le dialecte d\'un éditeur ne sort pas de son dossier', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // LOI 17 — CONFINEMENT DU DIALECTE, vérifiée sur les FICHIERS et pas sur les intentions.
  // ─────────────────────────────────────────────────────────────────────────
  //
  // Un connecteur qui importerait la base contournerait le CDM ; un connecteur qui
  // importerait un organe déciderait au lieu de traduire (Loi 2). Les deux se lisent dans
  // ses `require`, et c'est la seule vérification qui ne dépend pas de la bonne volonté.
  const FORBIDDEN = [
    { pattern: /require\(['"][^'"]*\/db['"]\)/, why: 'importe la base : il contournerait le CDM' },
    { pattern: /require\(['"][^'"]*lib\/(orders|inventory|catalog|orchestration|kernel)/, why: 'importe un organe : il déciderait au lieu de traduire (Loi 2)' },
    { pattern: /require\(['"][^'"]*\/secrets['"]\)/, why: 'lit le coffre lui-même : ses identifiants lui sont fournis par le contexte' },
    { pattern: /\bfetch\s*\(/, why: 'appelle le réseau directement : le transport passe par ctx.request' },
  ];

  for (const file of walk(CONNECTOR_DIR)) {
    const source = stripComments(fs.readFileSync(file, 'utf8'));
    const shown = path.relative(CONNECTOR_DIR, file);

    for (const { pattern, why } of FORBIDDEN) {
      assert.equal(
        pattern.test(source), false,
        `connectors/${shown} ${why}`
      );
    }
  }
});

test('aucun nom d\'éditeur n\'apparaît dans le cœur de l\'Integration Engine', () => {
  // La vérification la plus importante de l'étape, et la plus simple : les identifiants des
  // connecteurs — donc les noms d'éditeurs — ne doivent apparaître dans AUCUN fichier du
  // moteur. Le moteur n'a pas d'éditeurs, il a des connecteurs.
  //
  // `manual` est exclu : ce n'est pas un éditeur, c'est l'absence de logiciel, et le moteur a
  // le droit de savoir qu'un chemin de repli existe.
  const editors = registry.ids().filter((id) => id !== 'manual');
  const engineDir = path.join(__dirname, '..', 'src', 'lib', 'integration');

  for (const file of walk(engineDir)) {
    if (file.startsWith(CONNECTOR_DIR)) continue;
    const source = stripComments(fs.readFileSync(file, 'utf8')).toLowerCase();

    for (const editor of editors) {
      assert.equal(
        source.includes(editor), false,
        `${path.relative(engineDir, file)} nomme « ${editor} » — le moteur ne connaît pas `
        + 'ses éditeurs, il ne connaît que le contrat'
      );
    }
  }
});

test('un connecteur ne peut pas s\'enregistrer deux fois', () => {
  const existing = CONNECTORS[0];
  assert.throws(
    () => registry.register({
      id: existing.id,
      label: 'Doublon',
      capabilities: ['push_sales'],
      push: () => ({}),
      fromCanonical: (r, c) => c,
    }),
    // Deux déclarations pour un même identifiant, c'est une installation dont on ne sait plus
    // quel code la sert. Le refus doit être au boot, pas à la première vente.
    /déjà/i
  );
});

/** Tous les fichiers `.js` d'une arborescence. */
function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

/**
 * Retire commentaires et chaînes de caractères.
 *
 * Sans cela, la vérification punirait la documentation : un commentaire qui EXPLIQUE
 * pourquoi un connecteur n'importe pas la base contient les mots « require » et « db ».
 * Une règle qui décourage d'expliquer finit par être contournée par le silence.
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * En-têtes de signature plausibles pour ce connecteur.
 *
 * Tirés du MODULE du connecteur quand il les expose, faute de quoi d'une liste des en-têtes
 * courants du marché. Ce n'est pas un détail de commodité : présenter une signature dans un
 * en-tête que le connecteur ne lit pas rendrait le test toujours vert, et il ne prouverait
 * plus qu'une clé étrangère est refusée — seulement qu'une signature absente l'est.
 *
 * Le contrat, lui, n'a pas à connaître les en-têtes : c'est du dialecte.
 */
function headerCandidates(connector) {
  const declared = Object.values(connectorModule(connector.id)?.webhooks?.HEADER || {});
  return declared.length ? declared : [
    'X-Signature', 'X-Hub-Signature-256', 'X-Webhook-Signature', 'Signature',
  ];
}

function connectorModule(id) {
  try {
    return require(path.join(CONNECTOR_DIR, id));
  } catch {
    return null;
  }
}
