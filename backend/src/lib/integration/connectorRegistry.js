/**
 * Integration Engine — registre des connecteurs.
 *
 * Sixième registre de Ma Zone, sur le modèle exact des cinq autres
 * (`eventRegistry.registerType`, `walletRegistry.defineKind`, `identityRegistry`,
 * `recipeRegistry`, `lab/actionRegistry`) : un point d'extension unique, validé au boot,
 * que le reste du code lit sans jamais contenir de `if (connector === ...)`.
 *
 * LOI 15 — toute variabilité nouvelle passe par un registre. Les logiciels du marché
 * sont la variabilité la plus forte que Ma Zone rencontrera : il y en a des centaines,
 * ils changent sans prévenir, et aucun ne ressemble au précédent. C'est exactement ce
 * qu'un registre existe pour absorber.
 *
 * LOI 6 — TEST DE SUBSTITUTION. Retirer un connecteur ne doit modifier aucun fichier
 * hors de `lib/integration/`. Ce registre est ce qui rend la promesse vraie : un
 * connecteur se déclare, il ne se câble pas.
 */

const { defineConnector, supports, ConnectorDeclarationError } = require('./contract');

const CONNECTORS = {};

/**
 * Déclare un connecteur. Appelé par chaque fichier de `connectors/`.
 *
 * Fail-fast : un doublon ou une capacité sans mécanique empêche le serveur de démarrer.
 */
function register(def) {
  const connector = defineConnector(def);
  if (CONNECTORS[connector.id]) {
    throw new ConnectorDeclarationError(`connecteur déjà déclaré : ${connector.id}`);
  }
  CONNECTORS[connector.id] = connector;
  return connector;
}

function get(id) {
  return CONNECTORS[id] || null;
}

function has(id) {
  return Object.prototype.hasOwnProperty.call(CONNECTORS, id);
}

function ids() {
  return Object.keys(CONNECTORS);
}

/**
 * Métadonnées destinées aux surfaces. Les fonctions du contrat ne sortent jamais du
 * moteur : une route qui pourrait appeler `push()` directement contournerait l'Outbox,
 * et donc toute garantie de livraison.
 */
function describe(id) {
  const connector = get(id);
  if (!connector) return null;
  return {
    id: connector.id,
    label: connector.label,
    requiresAuth: connector.requiresAuth,
    capabilities: connector.capabilities,
    resources: connector.resources,
  };
}

function list() {
  return ids().map(describe);
}

/** Connecteurs sachant faire une chose donnée. */
function supporting(capability) {
  return Object.values(CONNECTORS).filter((c) => supports(c, capability)).map((c) => c.id);
}

/**
 * Retire un connecteur du registre.
 *
 * Existe pour éprouver la Loi 6, et c'est son seul usage légitime : un test doit pouvoir
 * simuler un connecteur retiré du code alors que des boutiques l'ont encore branché en
 * base. C'est l'état réel d'un déploiement où l'on a supprimé un fichier de connecteur, et
 * le système doit continuer à vendre — les capacités disparaissent, rien ne casse.
 */
function forget(id) {
  const existed = has(id);
  delete CONNECTORS[id];
  return existed;
}

/** Remise à zéro — tests uniquement. */
function reset() {
  for (const id of Object.keys(CONNECTORS)) delete CONNECTORS[id];
}

module.exports = { register, get, has, ids, describe, list, supporting, forget, reset };
