/**
 * Integration Engine — quel connecteur est branché sur quelle boutique.
 *
 * Un connecteur DÉCLARÉ n'est pas un connecteur BRANCHÉ. La distinction porte tout le
 * reste : le registre dit ce que Ma Zone sait faire en général, cette table dit ce que
 * la boutique de ce commerçant sait faire en particulier. C'est cette table qui répond,
 * in fine, à la seule question que l'orchestration a le droit de poser : « cette
 * boutique peut-elle pousser ses ventes ? »
 *
 * TABLE NON PRÉVUE PAR LA ROADMAP, ET AJOUTÉE EN CONNAISSANCE DE CAUSE. L'étape 6
 * listait quatre tables (`external_bindings`, `sync_conflicts`, outbox, inbox). Aucune ne
 * sait dire *par boutique* ce qui est branché. Sans cette cinquième, le résolveur de
 * capacités branché depuis l'étape 5 ne peut répondre que globalement — donc mentir dès
 * qu'un commerçant sur deux a un connecteur.
 *
 * LOI 16 — aucun secret d'éditeur n'est stocké ici en V1, et ce n'est pas un oubli :
 * voir `assertInstallable()`.
 */

const db = require('../../db');
const registry = require('./connectorRegistry');
const secrets = require('./secrets');
const cursors = require('./cursors');
const { IntegrationError } = require('./errors');

const STATUS = {
  /** Branché et actif : ses capacités comptent. */
  ACTIVE: 'active',
  /** Branché mais suspendu par le commerçant ou par un incident. */
  PAUSED: 'paused',
};

db.exec(`
  CREATE TABLE IF NOT EXISTS integration_installations (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL REFERENCES stores(id),
    connector_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    -- Réglages NON SECRETS uniquement (séparateur CSV, identifiant d'outlet…).
    -- Un jeton d'éditeur n'a rien à faire ici : voir assertInstallable().
    config TEXT,
    installed_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    -- Une boutique n'a qu'une installation par connecteur. Deux installations du même
    -- connecteur sur la même boutique produiraient deux pushs pour une seule vente.
    UNIQUE (store_id, connector_id)
  );

  CREATE INDEX IF NOT EXISTS idx_integration_install_store
    ON integration_installations(store_id, status);
`);

/**
 * Un connecteur exigeant des identifiants ne se branche qu'une fois ses identifiants rangés.
 *
 * ÉVOLUTION DE L'ÉTAPE 8, ET L'INVARIANT S'EST DÉPLACÉ SANS S'AFFAIBLIR. L'étape 6 refusait
 * net tout connecteur exigeant un secret, faute de coffre : « l'étape 8 devra d'abord
 * répondre à *où vivent les secrets* ». La réponse existe (`secrets.js`), le refus
 * disparaît donc — mais il est remplacé par une condition plus utile, pas par un
 * blanc-seing.
 *
 * La règle : le coffre doit être utilisable, ET tous les secrets déclarés par le connecteur
 * doivent déjà s'y trouver pour cette boutique.
 *
 * Ce que cette formulation obtient gratuitement, et qui aurait sinon demandé du code
 * spécifique : la route générique de branchement devient inutilisable pour un connecteur
 * authentifié. Un commerçant — ou un script — ne peut pas déclarer « Shopify est branché »
 * sans avoir traversé le flux d'autorisation, puisque `install()` vérifie la présence des
 * jetons et non l'intention de les obtenir. Aucun cas particulier, aucun `if (connectorId
 * === ...)` : l'ordre des opérations est imposé par l'invariant lui-même.
 */
function assertInstallable(connector, { storeId = null } = {}) {
  if (!connector.requiresAuth) return;

  // 503 avec un message pour l'exploitant : la configuration est incomplète, pas le geste
  // du commerçant.
  secrets.assertUsable();

  if (!storeId) {
    throw new IntegrationError(
      `« ${connector.label} » exige des identifiants : le branchement doit nommer la boutique.`,
      400
    );
  }

  const missing = (connector.secrets || []).filter(
    (name) => !secrets.has({ storeId, connectorId: connector.id, name })
  );

  if (missing.length) {
    throw new IntegrationError(
      `Les identifiants de « ${connector.label} » ne sont pas enregistrés pour cette `
      + 'boutique : passez par la connexion du logiciel plutôt que par un branchement direct.',
      409
    );
  }
}

/** Branche un connecteur sur une boutique. Idempotent : rebrancher réactive. */
function install({ storeId, connectorId, config = null, actor = null }) {
  const connector = registry.get(connectorId);
  if (!connector) {
    throw new IntegrationError(`Connecteur inconnu « ${connectorId} ».`, 404);
  }
  assertInstallable(connector, { storeId });

  const existing = find(storeId, connectorId);
  if (existing) {
    db.prepare(`
      UPDATE integration_installations
      SET status = ?, config = COALESCE(?, config), updated_at = datetime('now')
      WHERE id = ?
    `).run(STATUS.ACTIVE, config === null ? null : JSON.stringify(config), existing.id);
    return find(storeId, connectorId);
  }

  const id = db.generateId();
  db.prepare(`
    INSERT INTO integration_installations (id, store_id, connector_id, status, config, installed_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, storeId, connectorId, STATUS.ACTIVE, config === null ? null : JSON.stringify(config), actor);

  return find(storeId, connectorId);
}

/**
 * Débranche un connecteur.
 *
 * Les `external_bindings` sont CONSERVÉS. Un commerçant qui suspend puis rebranche son
 * logiciel ne doit pas voir Ma Zone recréer des doublons chez l'éditeur parce qu'elle a
 * oublié la correspondance. L'oubli délibéré est une opération distincte et explicite.
 */
function pause({ storeId, connectorId }) {
  const existing = find(storeId, connectorId);
  if (!existing) throw new IntegrationError('Ce connecteur n\'est pas branché.', 404);

  db.prepare(`
    UPDATE integration_installations SET status = ?, updated_at = datetime('now') WHERE id = ?
  `).run(STATUS.PAUSED, existing.id);

  return find(storeId, connectorId);
}

/**
 * Complète la configuration NON SECRÈTE d'une installation, sans écraser le reste.
 *
 * Un connecteur apprend souvent quelque chose au moment de la connexion : l'établissement par
 * défaut, la devise du compte, l'identifiant interne de la boutique chez l'éditeur. Ces
 * valeurs ne sont pas des secrets, elles sont indispensables aux appels suivants, et le
 * connecteur ne peut pas les écrire lui-même — il ne touche jamais la base (Loi 2).
 *
 * FUSION ET NON REMPLACEMENT. `install()` remplace la configuration quand on lui en donne une,
 * ce qui est juste pour un branchement. Ici, écraser ferait perdre le domaine de boutique
 * enregistré à l'échange du jeton dès qu'un connecteur ajoute une précision.
 */
function updateConfig({ storeId, connectorId, patch = {} }) {
  const existing = find(storeId, connectorId);
  if (!existing) throw new IntegrationError('Ce connecteur n\'est pas branché.', 404);

  const merged = { ...(existing.config || {}), ...patch };
  db.prepare(`
    UPDATE integration_installations
    SET config = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(JSON.stringify(merged), existing.id);

  return find(storeId, connectorId);
}

/**
 * Débranche définitivement : suspend, PURGE LES IDENTIFIANTS, et oublie les curseurs.
 *
 * Trois gestes, et la différence avec `pause()` porte tout le sens.
 *
 * · LES IDENTIFIANTS PARTENT. Un jeton d'éditeur est une procuration : le commerçant qui
 *   retire son logiciel retire aussi notre droit d'agir dedans. Le garder « au cas où il
 *   revienne » serait conserver une clé de chez lui après avoir rendu le trousseau.
 * · LES CURSEURS PARTENT. Ils disent « j'ai déjà lu jusqu'ici ». Après une coupure de trois
 *   semaines, s'y fier ferait manquer tout ce qui a changé entre-temps : la reconnexion
 *   doit repartir d'une lecture complète.
 * · LES CORRESPONDANCES RESTENT. Décision de l'étape 6, et elle tient : sans elles, une
 *   reconnexion recréerait des doublons chez l'éditeur pour des produits déjà appariés.
 *   Les oublier est une opération distincte, explicite, et qui n'appartient pas à ce geste.
 */
function disconnect({ storeId, connectorId }) {
  const existing = find(storeId, connectorId);
  if (!existing) throw new IntegrationError('Ce connecteur n\'est pas branché.', 404);

  const paused = pause({ storeId, connectorId });
  const purged = secrets.forget({ storeId, connectorId });
  cursors.reset({ storeId, connectorId });

  return { installation: paused, secretsPurged: purged };
}

function find(storeId, connectorId) {
  const row = db
    .prepare('SELECT * FROM integration_installations WHERE store_id = ? AND connector_id = ?')
    .get(storeId, connectorId);
  return row ? parse(row) : null;
}

/**
 * Retrouve une installation par une valeur de sa configuration.
 *
 * Nécessaire pour le sens ENTRANT : un éditeur qui nous notifie s'identifie par ce qu'il
 * connaît de lui-même — un domaine de boutique, un identifiant de compte, un numéro
 * d'établissement — et jamais par l'identifiant Ma Zone de la boutique, qu'il ignore.
 *
 * La comparaison a lieu en SQL sur le JSON stocké plutôt qu'en mémoire sur toutes les
 * installations : à mille boutiques branchées, un webhook ne doit pas déclencher la lecture
 * de mille lignes. `json_extract` est disponible dans SQLite depuis longtemps et n'engage
 * rien de propre à un éditeur.
 */
function findByConfig(connectorId, key, value) {
  if (!connectorId || !key || value === undefined || value === null) return null;

  const row = db.prepare(`
    SELECT * FROM integration_installations
    WHERE connector_id = ? AND json_extract(config, '$.' || ?) = ?
    LIMIT 1
  `).get(connectorId, key, String(value));

  return row ? parse(row) : null;
}

/** Installations d'une boutique. `activeOnly` par défaut : une pause doit se voir. */
function forStore(storeId, { activeOnly = true } = {}) {
  const rows = activeOnly
    ? db.prepare('SELECT * FROM integration_installations WHERE store_id = ? AND status = ?')
      .all(storeId, STATUS.ACTIVE)
    : db.prepare('SELECT * FROM integration_installations WHERE store_id = ?').all(storeId);
  return rows.map(parse);
}

/**
 * Capacités effectives d'une boutique : union des capacités de ses connecteurs actifs.
 *
 * Union et non intersection : si un connecteur sait pousser les ventes, la boutique sait
 * pousser ses ventes, même si un second connecteur ne sait que lire le catalogue.
 */
function capabilitiesForStore(storeId) {
  const capabilities = new Set();
  for (const installation of forStore(storeId)) {
    const connector = registry.get(installation.connector_id);
    if (!connector) continue; // connecteur retiré du code : ses capacités disparaissent
    for (const capability of connector.capabilities) capabilities.add(capability);
  }
  return [...capabilities];
}

/** Boutiques où un connecteur donné est actif. Utilisé par les workers. */
function storesFor(connectorId) {
  return db
    .prepare('SELECT store_id FROM integration_installations WHERE connector_id = ? AND status = ?')
    .all(connectorId, STATUS.ACTIVE)
    .map((r) => r.store_id);
}

function parse(row) {
  let config = null;
  if (row.config) {
    try {
      config = JSON.parse(row.config);
    } catch {
      config = null;
    }
  }
  return { ...row, config };
}

module.exports = {
  STATUS,
  install,
  pause,
  disconnect,
  updateConfig,
  find,
  findByConfig,
  forStore,
  capabilitiesForStore,
  storesFor,
  assertInstallable,
};
