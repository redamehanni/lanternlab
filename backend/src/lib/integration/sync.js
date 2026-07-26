/**
 * Integration Engine — traitement des deux files.
 *
 * Le point de rencontre entre trois mondes qui ne doivent pas se connaître : les organes
 * de Ma Zone, les files durables, et le dialecte d'un éditeur. Ce fichier est le seul à
 * les voir tous les trois.
 *
 * RÉPARTITION DES RÔLES, DANS LES DEUX SENS :
 *
 *   Sortant  organe décide → outbox.enqueue (canonique) → ICI → connector.fromCanonical
 *            → connector.push → binding mis à jour
 *
 *   Entrant  connecteur reçoit → inbox.accept (brut) → ICI → connector.toCanonical
 *            → binding résolu → ORGANE décide s'il accepte → conflit si refus
 *
 * La dissymétrie est volontaire et c'est le point le plus important du fichier. Dans le
 * sens sortant, Ma Zone a déjà décidé : il ne reste qu'à traduire et transporter. Dans le
 * sens entrant, la décision n'est PAS prise : ce fichier ne l'invente pas, il la demande à
 * l'organe propriétaire. Un connecteur ne crée, n'annule et ne valide jamais une entité
 * métier (Loi 2) — et le moteur non plus.
 *
 * LOI 7 — aucun appel réseau n'a lieu dans une transaction ici. `push()` est appelé nu,
 * et seul le résultat est écrit ensuite.
 */

const logger = require('../logger');
const registry = require('./connectorRegistry');
const installations = require('./installations');
const bindings = require('./bindings');
const conflicts = require('./conflicts');
const outbox = require('./outbox');
const inbox = require('./inbox');
const context = require('./context');
const declare = require('./declare');
const { SyncRejectedError } = require('./errors');

/** Résolu à l'appel : Inventory ne doit pas être figé au chargement du module. */
const inventory = () => require('../inventory');

// ── Sens sortant ──────────────────────────────────────────────────────────────

/**
 * Traite un message sortant.
 *
 * Ne lève jamais : un échec se traduit en réessai programmé ou en lettre morte. Laisser
 * une exception remonter jusqu'au worker ferait perdre l'information de la tentative.
 *
 * ASYNCHRONE DEPUIS L'ÉTAPE 8, ET IL FAUT LE DIRE PLUTÔT QUE LE CACHER. Tant que le seul
 * connecteur écrivait dans une file, `push` rendait la main immédiatement. Un éditeur, lui,
 * répond au bout d'un temps qu'il choisit. Faire semblable — envelopper l'appel réseau dans
 * une façade synchrone — aurait produit un système qui marque des messages « envoyés » avant
 * de savoir s'ils l'ont été. La file, le worker et `drain()` attendent donc désormais, et
 * c'est la seule forme honnête.
 */
async function deliver(message) {
  const connector = registry.get(message.connector_id);

  if (!connector) {
    // Connecteur retiré du code : aucun réessai ne le fera revenir.
    outbox.bury(message.id, `connecteur « ${message.connector_id} » absent du code`);
    return { delivered: false, buried: true };
  }

  const installation = installations.find(message.store_id, message.connector_id);
  if (!installation || installation.status !== installations.STATUS.ACTIVE) {
    outbox.bury(message.id, 'connecteur débranché par la boutique');
    return { delivered: false, buried: true };
  }

  try {
    const external = connector.fromCanonical(message.resource, message.payload);
    // Contexte construit par le moteur : transport, identifiants déchiffrés à la demande,
    // réglages non secrets. Le connecteur ne va rien chercher lui-même — voir `context.js`.
    const result = await connector.push(message.resource, external, context.forInstallation({
      connector,
      installation,
      extra: {
        operation: message.operation,
        idempotencyKey: message.idempotency_key,
        // Reste `config` en plus du contexte pour ne pas casser les connecteurs de
        // l'étape 6, qui le lisaient déjà à cette place.
        config: installation.config,
      },
    }));

    const externalRef = result?.externalRef ?? null;
    outbox.markSent(message.id, externalRef);

    // Le retour d'un push est la seule occasion d'apprendre l'identifiant qu'un éditeur
    // vient d'attribuer. Ne pas l'enregistrer condamnerait à recréer la même entité au
    // message suivant.
    if (externalRef && message.payload?.entityType && message.payload?.entityId) {
      bindings.bind({
        entityType: message.payload.entityType,
        mazoneId: message.payload.entityId,
        connectorId: message.connector_id,
        externalId: externalRef,
        externalLocationId: result?.externalLocationId ?? null,
      });
    }

    return { delivered: true, externalRef };
  } catch (err) {
    const outcome = outbox.markFailed(message.id, err);
    return { delivered: false, ...outcome };
  }
}

// ── Sens entrant ──────────────────────────────────────────────────────────────

/**
 * Traite un message entrant.
 *
 * Trois issues, et la distinction compte : traité, refusé (définitif, journalisé en
 * conflit), ou échoué (technique, réessayé). Confondre les deux dernières ferait réessayer
 * en boucle un message que Ma Zone refusera toujours.
 */
function ingest(message) {
  const connector = registry.get(message.connector_id);
  if (!connector) {
    inbox.markRejected(message.id, `connecteur « ${message.connector_id} » absent du code`);
    return { ingested: false, rejected: true };
  }

  try {
    const canonical = connector.toCanonical(message.resource, message.payload);
    apply(message, canonical);
    inbox.markProcessed(message.id);
    return { ingested: true };
  } catch (err) {
    if (err instanceof SyncRejectedError) {
      inbox.markRejected(message.id, err.message);
      return { ingested: false, rejected: true, reason: err.reason };
    }
    const outcome = inbox.markFailed(message.id, err);
    return { ingested: false, ...outcome };
  }
}

/**
 * Applique une déclaration canonique à l'organe concerné.
 *
 * Deux ressources sont branchées : `inventory` (étape 6) et `product` (étape 8). Les autres
 * lèvent, et c'est volontaire — un `switch` avec des branches vides laisse croire que le
 * chemin existe.
 */
function apply(message, canonical) {
  if (message.resource === 'inventory') return applyInventory(message, canonical);
  if (message.resource === 'product') return applyProduct(message, canonical);

  throw new SyncRejectedError(
    `Ma Zone ne sait pas encore recevoir « ${message.resource} » depuis un logiciel tiers.`,
    conflicts.REASON.ORGAN_REFUSED
  );
}

/**
 * Applique une fiche produit déclarée par un logiciel tiers.
 *
 * Ouvert à l'étape 8 pour une raison d'usage précise : un commerçant qui corrige un prix ou
 * un libellé dans son logiciel s'attend à le voir dans Ma Zone sans refaire un import. Sans
 * ce chemin, le catalogue divergeait dès la première correction, et la seule réparation
 * était manuelle.
 *
 * LA BOUTIQUE EST OBLIGATOIRE, ET SON ABSENCE EST UN REFUS DÉFINITIF. Une fiche produit sans
 * boutique identifiée ne peut pas être appliquée « quelque part » : Ma Zone n'a aucun moyen
 * de deviner à qui appartient ce produit, et créer un produit dans la mauvaise boutique est
 * un dégât qu'aucun réessai ne réparerait. C'est au connecteur, qui seul sait comment son
 * éditeur identifie un compte, de résoudre la boutique au moment de la vérification.
 */
function applyProduct(message, canonical) {
  if (!message.store_id) {
    throw new SyncRejectedError(
      'Fiche produit reçue sans boutique identifiable : Ma Zone ne devine pas à qui elle '
      + 'appartient.',
      conflicts.REASON.ORGAN_REFUSED
    );
  }

  const connector = registry.get(message.connector_id);
  const result = declare.declareProducts({
    storeId: message.store_id,
    connector,
    items: [canonical],
  });

  if (result.rejected.length) {
    // Le refus vient d'un organe : il est définitif tant que la déclaration est la même.
    // Le journaliser en conflit donne au commerçant la seule chose exploitable — quel
    // produit, et pourquoi.
    conflicts.record({
      connectorId: message.connector_id,
      storeId: message.store_id,
      entityType: bindings.ENTITY_TYPE.PRODUCT,
      externalId: canonical.externalId ?? canonical.reference ?? null,
      attribute: 'product',
      proposedValue: { reference: canonical.reference, name: canonical.name },
      losingSource: message.connector_id,
      reason: conflicts.REASON.ORGAN_REFUSED,
      payloadSummary: { organError: result.rejected[0].reason },
      sourceUpdatedAt: canonical.sourceUpdatedAt ?? null,
    });
    throw new SyncRejectedError(result.rejected[0].reason, conflicts.REASON.ORGAN_REFUSED);
  }

  return result;
}

/**
 * Applique une déclaration de stock physique.
 *
 * Ce que ce code NE FAIT PAS, et qui est le plus important : il ne décide pas si le stock
 * externe fait autorité. C'est `inventory_owner` qui le dit (étape 4), et l'organe
 * Inventory qui refuse le cas échéant. Rejouer cette règle ici créerait une deuxième
 * vérité sur la même question.
 */
function applyInventory(message, canonical) {
  const { externalId, externalLocationId = null, onHand, sourceUpdatedAt = null } = canonical;

  // Refus par nature : aucune source externe n'écrit ces attributs, quelle que soit la
  // boutique et quel que soit son mode.
  for (const attribute of Object.keys(canonical)) {
    const reason = conflicts.refusalFor(attribute);
    if (!reason) continue;

    conflicts.record({
      connectorId: message.connector_id,
      storeId: message.store_id,
      attribute,
      proposedValue: canonical[attribute],
      losingSource: message.connector_id,
      reason,
      payloadSummary: { externalId, resource: message.resource },
      sourceUpdatedAt,
    });
    throw new SyncRejectedError(
      `Un logiciel tiers ne peut pas déclarer « ${attribute} ».`,
      reason
    );
  }

  // Résolution TOLÉRANTE À L'ÉTABLISSEMENT : un stock parle toujours d'un magasin, un
  // catalogue jamais. Voir `bindings.resolveForOutlet` — la règle vaut pour tout éditeur qui
  // tient plusieurs points de vente, pas pour un cas particulier.
  const binding = bindings.resolveForOutlet({
    connectorId: message.connector_id,
    externalId,
    entityType: bindings.ENTITY_TYPE.PRODUCT,
    externalLocationId,
  });

  if (!binding) {
    // Pas une panne : un produit existe chez l'éditeur et pas encore chez nous. Le
    // commerçant doit le voir pour décider s'il l'importe.
    conflicts.record({
      connectorId: message.connector_id,
      storeId: message.store_id,
      externalId,
      attribute: 'on_hand',
      proposedValue: onHand,
      losingSource: message.connector_id,
      reason: conflicts.REASON.UNMAPPED_ENTITY,
      payloadSummary: { externalId, externalLocationId },
      sourceUpdatedAt,
    });
    throw new SyncRejectedError(
      `Aucun produit Ma Zone n'est associé à « ${externalId} ».`,
      conflicts.REASON.UNMAPPED_ENTITY
    );
  }

  if (!bindings.isFresh(binding, sourceUpdatedAt)) {
    conflicts.record({
      connectorId: message.connector_id,
      storeId: message.store_id,
      entityType: bindings.ENTITY_TYPE.PRODUCT,
      mazoneId: binding.mazone_id,
      externalId,
      attribute: 'on_hand',
      proposedValue: onHand,
      retainedValue: inventory().getLevel(binding.mazone_id)?.on_hand ?? null,
      losingSource: message.connector_id,
      reason: conflicts.REASON.STALE_TIMESTAMP,
      payloadSummary: { lastApplied: binding.last_source_updated_at },
      sourceUpdatedAt,
    });
    throw new SyncRejectedError(
      'Ce message est plus ancien que la dernière valeur appliquée.',
      conflicts.REASON.STALE_TIMESTAMP
    );
  }

  try {
    inventory().syncOnHand({
      productId: binding.mazone_id,
      onHand,
      origin: inventory().MOVEMENT_ORIGIN.CONNECTOR,
      actor: message.connector_id,
      reason: 'déclaré par le logiciel du commerçant',
    });
  } catch (err) {
    // L'organe a refusé. La raison lui appartient ; on ne fait que la raconter.
    //
    // `err.ownership` est la seule qualification que l'organe nous donne explicitement : il
    // dit « ce n'est pas une panne, c'est une question de propriété ». On la transmet telle
    // quelle. Ce module ne rejuge JAMAIS un arbitrage de propriété — il n'a pas la matrice,
    // et c'est très bien ainsi (Loi 2).
    const reason = err.ownership ? conflicts.REASON.OWNER_PRIORITY : conflicts.REASON.ORGAN_REFUSED;

    conflicts.record({
      connectorId: message.connector_id,
      storeId: message.store_id,
      entityType: bindings.ENTITY_TYPE.PRODUCT,
      mazoneId: binding.mazone_id,
      externalId,
      attribute: 'on_hand',
      proposedValue: onHand,
      retainedValue: inventory().getLevel(binding.mazone_id)?.on_hand ?? null,
      losingSource: message.connector_id,
      reason,
      payloadSummary: { organError: err.message },
      sourceUpdatedAt,
    });
    throw new SyncRejectedError(err.message, reason);
  }

  bindings.bind({
    entityType: bindings.ENTITY_TYPE.PRODUCT,
    mazoneId: binding.mazone_id,
    connectorId: message.connector_id,
    externalId,
    // L'établissement de la CORRESPONDANCE TROUVÉE, pas celui du message. La nuance évite de
    // fabriquer une seconde correspondance par magasin à la première notification de stock :
    // deux lignes pour un même produit rendraient l'horodatage de fraîcheur ambigu, et la
    // comparaison « ce message est-il plus récent » perdrait son sens.
    externalLocationId: binding.external_location_id ?? null,
    sourceUpdatedAt,
  });

  logger.debug('Stock déclaré par un connecteur', {
    connectorId: message.connector_id, productId: binding.mazone_id, onHand,
  });

  return { productId: binding.mazone_id, onHand };
}

module.exports = { deliver, ingest, applyInventory };
