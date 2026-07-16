/**
 * Laboratoire — Registre déclaratif des ACTIONS de labo.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ PRINCIPE — À NE JAMAIS OUBLIER                                            │
 * │                                                                          │
 * │ Le Laboratoire ne possède aucun super-pouvoir. Une action de labo se     │
 * │ contente de DEMANDER à un organe de faire son travail :                  │
 * │   - créditer un Wallet   → Wallet Engine                                 │
 * │   - (demain) un événement → Event Engine                                 │
 * │   - (demain) une promo    → Marketing Engine                            │
 * │                                                                          │
 * │ Une action qui écrit en base directement (au lieu d'appeler l'organe)    │
 * │ est un bug d'architecture.                                                │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Point d'extension unique (Open/Closed) : ajouter une capacité au labo = déclarer
 * une action ici, sans jamais modifier le cœur (routes, registre).
 */

const ACTIONS = {};

function defineAction(def) {
  if (!def || !def.id || typeof def.run !== 'function') {
    throw new Error('[Lab] Action invalide : `id` et `run(args)` sont requis.');
  }
  if (ACTIONS[def.id]) {
    throw new Error(`[Lab] Action déjà déclarée : ${def.id}`);
  }
  ACTIONS[def.id] = {
    id: def.id,
    label: def.label || def.id,
    description: def.description || '',
    organ: def.organ || null,
    params: def.params || {},
    run: def.run,
  };
  return ACTIONS[def.id];
}

function getAction(id) {
  return ACTIONS[id] || null;
}

function listActions() {
  return Object.values(ACTIONS).map(({ run, ...meta }) => meta);
}

module.exports = { defineAction, getAction, listActions };
