/**
 * Integration Engine — mémoire des lectures déjà faites.
 *
 * Le contrat de connecteur prévoit `pull(resource, cursor)` depuis l'étape 6, mais rien ne
 * gardait ce curseur : chaque lecture repartait de zéro. Tant que le seul connecteur était
 * un fichier déposé par un commerçant, cela ne coûtait rien. Face à un éditeur, cela coûte
 * trois choses, et la troisième est la plus grave.
 *
 *   · Le quota. Relire un catalogue de quatre mille articles toutes les dix minutes
 *     consomme l'autorisation d'appel de la boutique, puis la fait limiter.
 *   · Le temps. Une réconciliation complète est lente, donc rare, donc en retard.
 *   · LE PIÉTINEMENT DES CONFLITS. Une relecture complète repropose des valeurs déjà
 *     appliquées ou déjà refusées. Le journal de conflits du commerçant se remplit de
 *     lignes identiques, et le jour où un vrai conflit s'y produit, il est invisible au
 *     milieu du bruit. Un journal qu'on n'ouvre plus ne protège plus personne.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LE CURSEUR EST OPAQUE, ET C'EST TOUTE SON UTILITÉ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Ce module ne sait pas ce qu'il garde : une date, un numéro de page, un identifiant de
 * dernier élément vu, un jeton de pagination signé. Il stocke une CHAÎNE que le connecteur
 * a produite et qu'il relira lui-même. C'est ce qui permet à un éditeur paginant par
 * curseur et à un éditeur filtrant par date de partager exactement le même mécanisme.
 *
 * Le jour où une interprétation du curseur remonterait ici — « si c'est une date alors… » —
 * ce fichier aurait cessé d'être générique.
 */

const db = require('../../db');

db.exec(`
  CREATE TABLE IF NOT EXISTS integration_cursors (
    store_id TEXT NOT NULL,
    connector_id TEXT NOT NULL,
    resource TEXT NOT NULL,
    -- Chaîne opaque produite par le connecteur.
    cursor TEXT,
    -- Dernière lecture ACHEVÉE. Sert à décider quand réconcilier, et à dire au commerçant
    -- depuis quand son stock n'a pas été confronté à celui de son logiciel.
    last_pulled_at TEXT,
    last_item_count INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (store_id, connector_id, resource)
  );
`);

function get({ storeId, connectorId, resource }) {
  const row = db.prepare(`
    SELECT * FROM integration_cursors
    WHERE store_id = ? AND connector_id = ? AND resource = ?
  `).get(storeId, connectorId, resource);
  return row || null;
}

/** Curseur brut, ou `null` : ce que le connecteur attend en second argument de `pull`. */
function value({ storeId, connectorId, resource }) {
  return get({ storeId, connectorId, resource })?.cursor ?? null;
}

/**
 * Enregistre l'avancement d'une lecture.
 *
 * Écrit APRÈS que les éléments ont été mis en file, jamais avant. L'ordre est ce qui rend
 * une panne inoffensive : interrompu au milieu, le moteur relira une page déjà lue, et la
 * clé d'idempotence de la file écartera les doublons. L'ordre inverse ferait perdre
 * définitivement les éléments d'une page dont l'enfilement a échoué.
 */
function save({ storeId, connectorId, resource, cursor, itemCount = 0 }) {
  db.prepare(`
    INSERT INTO integration_cursors
      (store_id, connector_id, resource, cursor, last_pulled_at, last_item_count, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'), ?, datetime('now'))
    ON CONFLICT(store_id, connector_id, resource) DO UPDATE SET
      cursor = excluded.cursor,
      last_pulled_at = excluded.last_pulled_at,
      last_item_count = excluded.last_item_count,
      updated_at = datetime('now')
  `).run(storeId, connectorId, resource, cursor ?? null, itemCount);

  return get({ storeId, connectorId, resource });
}

/**
 * Oublie le curseur d'une ressource, ou de tout un connecteur.
 *
 * Sert à provoquer une relecture complète : c'est le geste d'exploitation qui répare un
 * mapping corrigé après coup, quand des éléments ont été refusés à tort.
 */
function reset({ storeId, connectorId, resource = null }) {
  const info = resource
    ? db.prepare(`
        DELETE FROM integration_cursors
        WHERE store_id = ? AND connector_id = ? AND resource = ?
      `).run(storeId, connectorId, resource)
    : db.prepare(`
        DELETE FROM integration_cursors WHERE store_id = ? AND connector_id = ?
      `).run(storeId, connectorId);

  return info.changes;
}

/** État des lectures d'une boutique, pour l'écran « Mes intégrations ». */
function forStore(storeId) {
  return db.prepare(`
    SELECT connector_id, resource, last_pulled_at, last_item_count
    FROM integration_cursors WHERE store_id = ?
    ORDER BY connector_id, resource
  `).all(storeId);
}

module.exports = { get, value, save, reset, forStore };
