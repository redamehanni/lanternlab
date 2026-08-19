/**
 * Lantern Engine — organe ARG générique (E0 + E0b).
 *
 * Surface publique :
 *  - validateDefinition / validateEvent
 *  - createRuntime
 *  - handleEvent
 *  - tickSchedules (E0b — délais relatifs)
 *  - explainAction
 *  - catalogues predicates / actions
 *
 * Pas de DB, pas de HTTP, pas de UI — évaluation pure + Runtime in-memory.
 * Distinct de l'Event Engine (QR→badge).
 */

const types = require('./types');
const schemas = require('./schemas');
const runtime = require('./runtime');
const engine = require('./engine');
const predicates = require('./predicates');
const actions = require('./actions');
const zones = require('./zones');
const time = require('./time');
const occurrence = require('./occurrence');
const relativeScheduler = require('./relativeScheduler');

function tickSchedules(definition, runtimeState, options = {}) {
  return relativeScheduler.tickSchedules(
    definition,
    runtimeState,
    engine.handleEvent,
    options
  );
}

module.exports = {
  ENGINE_SCHEMA_VERSION: types.ENGINE_SCHEMA_VERSION,
  types,
  validateDefinition: schemas.validateDefinition,
  validateEvent: schemas.validateEvent,
  createRuntime: runtime.createRuntime,
  cloneRuntime: runtime.cloneRuntime,
  initMediaFromDefinition: runtime.initMediaFromDefinition,
  handleEvent: engine.handleEvent,
  tickSchedules,
  explainAction: engine.explainAction,
  buildContext: engine.buildContext,
  predicates: { register: predicates.register, list: predicates.list, get: predicates.get },
  actions: { register: actions.register, list: actions.list, get: actions.get },
  resolveZones: zones.resolveZones,
  listPendingSchedules: relativeScheduler.listPending,
  listSchedules: relativeScheduler.listAll,
  cancelSchedule: relativeScheduler.cancelJob,
  time,
  occurrence,
  relativeScheduler,
  simulate: require('./simulate'),
  fixtureCatalog: require('./fixtureCatalog'),
};
