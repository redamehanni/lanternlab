/**
 * World Factory — Registre des recettes de monde.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ PRINCIPE FONDAMENTAL — À NE JAMAIS OUBLIER                               │
 * │                                                                         │
 * │ Le World Factory n'est PAS un second moteur métier.                     │
 * │ Il ne réimplémente JAMAIS la logique d'un organe existant.              │
 * │ Sa mission est UNIQUEMENT d'orchestrer.                                 │
 * │                                                                         │
 * │   - Wallet sait émettre un objet        → la recette appelle Wallet.    │
 * │   - Event Engine (futur) créera un event → la recette appellera Event.  │
 * │   - Marketing (futur) lancera une campagne → la recette appellera Mktg. │
 * │                                                                         │
 * │ Une recette qui contient une règle métier (au lieu d'appeler l'organe   │
 * │ qui la détient) est un bug d'architecture.                              │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Point d'extension unique (Open/Closed) : ajouter un type de monde = déclarer
 * une recette ici, sans jamais modifier le cœur du moteur (`index.js`).
 *
 * Note d'évolution (non implémentée) : ce registre est volontairement conçu pour
 * accueillir plus tard des « évolutions de monde » (avancer le temps, expirer des
 * objets, transformer des billets en souvenirs...). Elles suivront la même règle :
 * orchestrer les organes (ex. wallet.consumeObject), jamais réimplémenter.
 */

const RECIPES = {};

/**
 * Déclare une recette. `run(ctx, params)` reçoit un contexte de création dont les
 * primitives orchestrent les organes et tracent la provenance (voir context.js).
 */
function defineRecipe(def) {
  if (!def || !def.id || typeof def.run !== 'function') {
    throw new Error('[WorldFactory] Recette invalide : `id` et `run(ctx, params)` sont requis.');
  }
  if (RECIPES[def.id]) {
    throw new Error(`[WorldFactory] Recette déjà déclarée : ${def.id}`);
  }
  RECIPES[def.id] = {
    id: def.id,
    label: def.label || def.id,
    description: def.description || '',
    params: def.params || {},
    run: def.run,
  };
  return RECIPES[def.id];
}

function getRecipe(id) {
  return RECIPES[id] || null;
}

/** Métadonnées des recettes (sans la fonction `run`), pour l'API admin. */
function listRecipes() {
  return Object.values(RECIPES).map(({ run, ...meta }) => meta);
}

module.exports = { defineRecipe, getRecipe, listRecipes };
