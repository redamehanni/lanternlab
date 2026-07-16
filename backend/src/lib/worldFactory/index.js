/**
 * World Factory — Moteur d'orchestration du monde de démonstration.
 *
 * Rôle : peupler un monde cohérent en ORCHESTRANT les organes existants, tracer
 * sa provenance, et le réinitialiser proprement. Il ne connaît pas à l'avance
 * les types de mondes : ceux-ci sont déclarés dans le registre de recettes.
 *
 * PRINCIPE FONDAMENTAL (voir recipeRegistry.js) : orchestrer, jamais
 * réimplémenter la logique d'un organe.
 *
 * Ouvert à l'évolution (non implémenté aujourd'hui) : au-delà de créer/tracer/
 * réinitialiser, ce moteur pourra un jour faire ÉVOLUER un monde (avancer le
 * temps, expirer des objets, transformer des billets en souvenirs). L'ordre de
 * suppression basé sur `demo_entities` et l'orchestration d'organes rendent cette
 * évolution possible sans refonte.
 */

const db = require('../../db');
const registry = require('./recipeRegistry');
const { createContext } = require('./context');
const { purgeUsers } = require('./demoWorld');

// Enregistre les recettes disponibles (chaque fichier s'auto-déclare).
require('./recipes/quartierAnime');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function listRecipes() {
  return registry.listRecipes();
}

/**
 * Exécute une recette : crée un batch, lance la recette avec un contexte de
 * création auto-tagué, et retourne un résumé.
 *
 * Note : on n'enveloppe PAS toute la recette dans une transaction SQLite —
 * les organes (Wallet…) ont déjà les leurs, et better-sqlite3 refuse les
 * transactions imbriquées. En cas d'échec, on tente un reset du batch partiel.
 */
function runRecipe(recipeId, params = {}) {
  const recipe = registry.getRecipe(recipeId);
  if (!recipe) throw httpError(404, `Recette inconnue : ${recipeId}`);

  const batchId = db.generateId();
  db.prepare(
    "INSERT INTO demo_batches (id, recipe_id, label, params, status) VALUES (?, ?, ?, ?, 'active')"
  ).run(batchId, recipeId, recipe.label, JSON.stringify(params || {}));

  try {
    const ctx = createContext(batchId);
    const summary = recipe.run(ctx, params || {}) || {};
    return { batchId, recipeId, label: recipe.label, summary, counts: ctx.counts() };
  } catch (e) {
    try {
      resetBatch(batchId);
    } catch {
      // Le batch partiel reste tracé pour inspection admin.
    }
    throw e;
  }
}

function listBatches() {
  return db
    .prepare('SELECT id, recipe_id, label, params, status, created_at FROM demo_batches ORDER BY created_at DESC')
    .all()
    .map((b) => ({
      id: b.id,
      recipeId: b.recipe_id,
      label: b.label,
      params: b.params ? JSON.parse(b.params) : {},
      status: b.status,
      createdAt: b.created_at,
      entityCount: db.prepare('SELECT COUNT(*) c FROM demo_entities WHERE batch_id = ?').get(b.id).c,
    }));
}

// Ordre de suppression : dépendances inverses (enfants avant parents).
function removeEntities(entities) {
  const byType = (type) => entities.filter((e) => e.entity_type === type);

  // Objets Wallet (+ leur journal append-only).
  for (const e of byType('wallet_object')) {
    db.prepare('DELETE FROM digital_object_events WHERE object_id = ?').run(e.entity_id);
    db.prepare('DELETE FROM digital_objects WHERE id = ?').run(e.entity_id);
  }
  for (const e of byType('favorite')) {
    db.prepare('DELETE FROM store_favorites WHERE id = ?').run(e.entity_id);
  }
  for (const e of byType('product')) {
    db.prepare('DELETE FROM products WHERE id = ?').run(e.entity_id);
  }
  for (const e of byType('store')) {
    db.prepare('DELETE FROM store_members WHERE store_id = ?').run(e.entity_id);
    db.prepare('DELETE FROM stores WHERE id = ?').run(e.entity_id);
  }
  for (const e of byType('user')) {
    db.prepare('DELETE FROM users WHERE id = ?').run(e.entity_id);
  }
}

/**
 * Réinitialise un batch : supprime tout ce qui appartient à ses acteurs démo
 * (y compris ce qui a été créé pendant l'impersonation, via la purge par
 * appartenance), puis nettoie les entités tracées restantes et marque le batch
 * `reverted`. Les comptes réels hors démo sont intacts.
 */
function resetBatch(batchId) {
  const batch = db.prepare('SELECT * FROM demo_batches WHERE id = ?').get(batchId);
  if (!batch) throw httpError(404, 'Batch introuvable');

  const entities = db.prepare('SELECT * FROM demo_entities WHERE batch_id = ?').all(batchId);
  const userIds = entities.filter((e) => e.entity_type === 'user').map((e) => e.entity_id);

  // 1) Purge par appartenance : clôture des acteurs démo (commandes, objets,
  //    conversations… créés au fil des simulations). Transaction interne.
  purgeUsers(userIds);

  // 2) Nettoyage idempotent des entités tracées éventuellement non couvertes
  //    (recettes futures ajoutant des objets à des acteurs préexistants).
  db.transaction(() => {
    removeEntities(entities);
    db.prepare('DELETE FROM demo_entities WHERE batch_id = ?').run(batchId);
    db.prepare("UPDATE demo_batches SET status = 'reverted' WHERE id = ?").run(batchId);
  })();

  return { batchId, removed: entities.length };
}

/** Réinitialise tous les batches actifs (remise à zéro du monde de démo). */
function resetAllDemo() {
  const active = db.prepare("SELECT id FROM demo_batches WHERE status = 'active'").all();
  let total = 0;
  for (const b of active) total += resetBatch(b.id).removed;
  return { batches: active.length, removed: total };
}

module.exports = {
  listRecipes,
  runRecipe,
  listBatches,
  resetBatch,
  resetAllDemo,
};
