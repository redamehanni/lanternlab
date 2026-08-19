/**
 * Fabrication / clonage d'un RuntimeState E0 (mémoire).
 */

function createRuntime({
  runId = 'run_test',
  channel = 'lab',
  playerId = 'player_test',
  teamId = null,
  step = 0,
  vars = {},
  mediaStates = {},
} = {}) {
  return {
    runId,
    channel,
    playerId,
    teamId,
    step,
    vars: { ...vars },
    mediaStates: structuredClone(mediaStates),
    choices: {},
    objectStates: {},
    beaconsScanned: [],
    occurrenceLedger: {},
    disabledRules: {},
    location: { lat: null, lng: null, accuracy: null },
    journal: [],
    playerJournal: [],
    pendingSchedules: [],
    processedClientEventIds: new Set(),
  };
}

function cloneRuntime(runtime) {
  const copy = structuredClone({
    ...runtime,
    processedClientEventIds: [...(runtime.processedClientEventIds || [])],
  });
  copy.processedClientEventIds = new Set(copy.processedClientEventIds);
  return copy;
}

function defaultMediaState() {
  return {
    discovered: false,
    unlocked: false,
    opened: false,
    consumed: false,
    visible: false,
  };
}

function initMediaFromDefinition(definition, runtime) {
  for (const item of definition.mediaItems || []) {
    if (!runtime.mediaStates[item.id]) {
      runtime.mediaStates[item.id] = {
        ...defaultMediaState(),
        unlocked: item.policy === 'imposed' || item.policy === 'required' || item.policy === 'displayed',
        visible: item.policy === 'imposed' || item.policy === 'required' || item.policy === 'displayed',
      };
    }
  }
  for (const v of definition.variables || []) {
    if (runtime.vars[v.id] === undefined) {
      runtime.vars[v.id] = v.defaultValue;
    }
  }
}

module.exports = {
  createRuntime,
  cloneRuntime,
  initMediaFromDefinition,
  defaultMediaState,
};
