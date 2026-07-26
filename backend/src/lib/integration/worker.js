/**
 * Integration Engine — la mécanique des workers, et son verrou d'unicité.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EXACTEMENT UN WORKER PAR FILE. CE N'EST PAS UNE PRÉFÉRENCE, C'EST SQLITE.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * SQLite n'accepte qu'un écrivain à la fois. Deux workers qui consomment la même file
 * ne vont pas « aller deux fois plus vite » : ils vont se disputer le verrou d'écriture,
 * et surtout traiter le même message en double — parce que « lire les messages dus » et
 * « les marquer envoyés » ne sont pas le même instant. Le commerçant verrait sa vente
 * partir deux fois chez son éditeur.
 *
 * Le verrou est en BASE et non en mémoire, volontairement. Un booléen de module protège
 * contre un double démarrage dans le même processus, ce qui n'est pas le risque : le
 * risque est un deuxième processus Node lancé par erreur, un redémarrage qui chevauche
 * l'ancien, ou demain deux instances derrière un load balancer. Seul un verrou partagé
 * voit ces cas.
 *
 * Le bail EXPIRE, et c'est indispensable. Un worker tué par un `kill -9` ne rend pas son
 * bail ; sans expiration, la file serait bloquée pour toujours et il faudrait aller
 * supprimer une ligne à la main pour redémarrer.
 *
 * LOI 16 — ce fichier fait tourner une boucle et tient un verrou. Il ne sait rien d'un
 * protocole, d'un format ni d'un éditeur : ce qu'il exécute lui est fourni.
 */

const db = require('../../db');
const logger = require('../logger');

/**
 * Durée du bail. Un worker qui n'a pas donné signe de vie depuis 30 secondes est
 * considéré comme mort : assez long pour survivre à un lot d'écritures lent, assez court
 * pour qu'un redémarrage n'attende pas.
 */
const LEASE_SECONDS = 30;
const DEFAULT_INTERVAL_MS = 5000;
const DEFAULT_BATCH = 50;

db.exec(`
  CREATE TABLE IF NOT EXISTS integration_workers (
    name TEXT PRIMARY KEY,
    holder TEXT NOT NULL,
    acquired_at TEXT NOT NULL DEFAULT (datetime('now')),
    heartbeat_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

class WorkerBusyError extends Error {
  constructor(name, holder) {
    super(
      `[Integration] le worker « ${name} » tourne déjà (détenteur ${holder}). `
      + 'Deux workers sur la même file enverraient chaque message deux fois.'
    );
    this.name = 'WorkerBusyError';
    this.status = 409;
  }
}

/**
 * Tente de prendre le bail.
 *
 * L'upsert conditionnel fait tout le travail en une seule instruction : soit personne ne
 * détient le bail, soit son détenteur est mort. Faire un SELECT puis un INSERT laisserait
 * une fenêtre où deux workers s'autoriseraient mutuellement.
 */
function acquire(name, holder) {
  const info = db.prepare(`
    INSERT INTO integration_workers (name, holder, acquired_at, heartbeat_at)
    VALUES (?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(name) DO UPDATE SET
      holder = excluded.holder,
      acquired_at = excluded.acquired_at,
      heartbeat_at = excluded.heartbeat_at
    WHERE datetime(integration_workers.heartbeat_at) < datetime('now', ?)
  `).run(name, holder, `-${LEASE_SECONDS} seconds`);

  return info.changes > 0;
}

function heartbeat(name, holder) {
  const info = db.prepare(`
    UPDATE integration_workers SET heartbeat_at = datetime('now')
    WHERE name = ? AND holder = ?
  `).run(name, holder);
  // Bail perdu (un autre worker l'a repris parce qu'on a été trop lent) : on s'arrête.
  return info.changes > 0;
}

function release(name, holder) {
  db.prepare('DELETE FROM integration_workers WHERE name = ? AND holder = ?').run(name, holder);
}

function holderOf(name) {
  const row = db.prepare('SELECT * FROM integration_workers WHERE name = ?').get(name);
  return row || null;
}

/** Libère tous les baux — tests et redémarrage propre uniquement. */
function releaseAll() {
  db.prepare('DELETE FROM integration_workers').run();
}

/**
 * Crée un worker.
 *
 * @param {object} options
 * @param {string} options.name        nom de file (`outbox`, `inbox`)
 * @param {() => object[]} options.due messages à traiter
 * @param {(message: object) => void} options.handle traitement d'un message
 */
function createWorker({ name, due, handle, intervalMs = DEFAULT_INTERVAL_MS, batch = DEFAULT_BATCH }) {
  const holder = `${process.pid}-${db.generateId().slice(0, 8)}`;
  let timer = null;
  let running = false;

  /**
   * Traite un lot.
   *
   * Chaque message est isolé : un message qui casse ne doit pas empêcher les suivants de
   * partir. C'est la différence entre « un produit mal mappé » et « plus rien ne sort ».
   *
   * ASYNCHRONE DEPUIS L'ÉTAPE 8 : livrer un message à un vrai éditeur est un appel réseau.
   * `await` sur un `handle` synchrone ne coûte rien, et le garde-fou `running` prend ici
   * toute son importance — sans lui, un intervalle plus court que la durée d'un lot
   * lancerait un second lot sur les mêmes messages, et l'éditeur recevrait deux fois la
   * même vente. Le bail protège des autres PROCESSUS ; ce booléen protège de nous-mêmes.
   *
   * SÉQUENTIEL ET NON EN PARALLÈLE, VOLONTAIREMENT. Un `Promise.all` sur le lot serait plus
   * rapide et ferait trois dégâts : il perdrait l'ordre — qui est significatif quand deux
   * messages touchent le même produit —, il ferait dépasser les quotas de l'éditeur, et il
   * mettrait plusieurs écritures SQLite en concurrence sur un moteur qui n'en accepte qu'une.
   */
  async function tick() {
    if (running) return { processed: 0, skipped: true }; // lot précédent pas fini
    if (!heartbeat(name, holder)) {
      logger.warn('Bail de worker perdu, arrêt', { worker: name, holder });
      stop();
      return { processed: 0, lost: true };
    }

    running = true;
    let processed = 0;
    try {
      for (const message of due(batch)) {
        try {
          await handle(message);
        } catch (err) {
          // `handle` est censé gérer ses propres échecs (retry, DLQ). Arriver ici
          // signifie qu'il a lui-même échoué : on le journalise sans arrêter le lot.
          logger.reportError('Message non traité par le worker', err, {
            worker: name, messageId: message.id,
          });
        }
        processed += 1;
      }
    } finally {
      running = false;
    }
    return { processed };
  }

  function start() {
    if (timer) return { started: false, reason: 'déjà démarré dans ce processus' };

    if (!acquire(name, holder)) {
      throw new WorkerBusyError(name, holderOf(name)?.holder || 'inconnu');
    }

    // `tick` rend une promesse depuis l'étape 8 : un `setInterval(tick)` nu laisserait
    // remonter un rejet en dehors de toute pile d'appel, ce que Node signale par un
    // avertissement — puis, sur les versions récentes, par l'arrêt du processus. Un worker
    // qui tue le serveur parce qu'un éditeur a mal répondu serait une panne bien plus grave
    // que le message qu'il n'a pas su livrer.
    timer = setInterval(() => {
      tick().catch((err) => logger.reportError('Lot de worker interrompu', err, { worker: name }));
    }, intervalMs);
    // `unref` : le worker ne doit pas empêcher le processus de s'arrêter. Sans cela, une
    // suite de tests ne rend jamais la main et un arrêt propre attend indéfiniment.
    if (typeof timer.unref === 'function') timer.unref();

    logger.info('Worker de synchronisation démarré', { worker: name, holder, intervalMs });
    return { started: true, holder };
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    release(name, holder);
    return { stopped: true };
  }

  return { name, holder, start, stop, tick, isRunning: () => timer !== null };
}

module.exports = {
  LEASE_SECONDS,
  createWorker,
  acquire,
  heartbeat,
  release,
  releaseAll,
  holderOf,
  WorkerBusyError,
};
