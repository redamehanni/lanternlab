/**
 * Simulateur S1 — sessions in-memory + runSimulation.
 * Appelle exclusivement lanternEngine.handleEvent / tickSchedules.
 */

const { randomUUID } = require('crypto');
const { handleEvent } = require('./engine');
const { createRuntime, initMediaFromDefinition } = require('./runtime');
const { validateDefinition } = require('./schemas');
const { tickSchedules: tickSchedulesCore } = require('./relativeScheduler');
const { loadFixture, listFixtures } = require('./fixtureCatalog');

function tickSchedules(definition, runtime, options) {
  return tickSchedulesCore(definition, runtime, handleEvent, options);
}

const lantern = {
  validateDefinition,
  createRuntime,
  initMediaFromDefinition,
  handleEvent,
  tickSchedules,
};

/** @type {Map<string, object>} */
const sessions = new Map();

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function snapshotState(runtime) {
  return {
    runId: runtime.runId,
    channel: runtime.channel,
    playerId: runtime.playerId,
    teamId: runtime.teamId,
    step: runtime.step,
    vars: { ...(runtime.vars || {}) },
    mediaStates: structuredClone(runtime.mediaStates || {}),
    choices: { ...(runtime.choices || {}) },
    objectStates: { ...(runtime.objectStates || {}) },
    beaconsScanned: [...(runtime.beaconsScanned || [])],
    location: structuredClone(runtime.location || {}),
    occurrenceLedger: structuredClone(runtime.occurrenceLedger || {}),
    disabledRules: { ...(runtime.disabledRules || {}) },
    pendingSchedules: (runtime.pendingSchedules || []).map((j) => ({
      id: j.id,
      scheduleId: j.scheduleId,
      status: j.status,
      dueAt: j.dueAt,
      delayMs: j.delayMs,
      missPolicy: j.missPolicy || null,
      createdAt: j.createdAt,
      firedAt: j.firedAt || null,
      missedAt: j.missedAt || null,
      expiredAt: j.expiredAt || null,
    })),
    journalTail: (runtime.journal || []).slice(-20),
    playerJournal: structuredClone(runtime.playerJournal || []),
  };
}

function formatConditionLeaves(trace, out = []) {
  if (!trace) return out;
  if (trace.type) {
    out.push({
      type: trace.type,
      value: trace.value,
      ok: trace.value === true,
      params: trace.params || null,
      reason: trace.reason || null,
    });
  }
  if (trace.children) trace.children.forEach((c) => formatConditionLeaves(c, out));
  if (trace.child) formatConditionLeaves(trace.child, out);
  return out;
}

function formatTrace(handleResult) {
  const t = handleResult.trace || {};
  return {
    event: t.event || null,
    intrinsic: t.intrinsic || [],
    candidates: (t.candidates || []).map((c) => ({
      ruleId: c.ruleId,
      title: c.title,
      priority: c.priority,
      exclusiveGroupId: c.exclusiveGroupId,
      match: c.match,
      conditions: formatConditionLeaves(c.conditionTrace),
      conditionTree: c.conditionTrace,
    })),
    matched: t.matched || [],
    fired: (t.fired || []).map((f) => ({
      ruleId: f.ruleId,
      title: f.title,
      actions: f.actions,
      uiPlan: f.uiPlan,
      scheduled: f.scheduled || [],
      conditions: formatConditionLeaves(f.condition),
    })),
    misses: t.misses || [],
    emitted: t.emitted || [],
    duplicate: handleResult.duplicate || false,
  };
}

function applyRuntimePatch(runtime, patch = {}) {
  if (patch.step != null) runtime.step = patch.step;
  if (patch.vars) Object.assign(runtime.vars, patch.vars);
  if (patch.mediaStates) {
    for (const [id, st] of Object.entries(patch.mediaStates)) {
      runtime.mediaStates[id] = { ...(runtime.mediaStates[id] || {}), ...st };
    }
  }
  if (patch.choices) Object.assign(runtime.choices, patch.choices);
  if (patch.objectStates) Object.assign(runtime.objectStates, patch.objectStates);
  if (patch.beaconsScanned) {
    runtime.beaconsScanned = [...new Set([...(runtime.beaconsScanned || []), ...patch.beaconsScanned])];
  }
  if (patch.location) {
    runtime.location = { ...(runtime.location || {}), ...patch.location };
  }
}

function createSession({
  fixtureId,
  definition: inlineDefinition = null,
  playerId = 'sim_player',
  teamId = null,
  channel = 'lab',
  runtime: runtimePatch = {},
  label = null,
} = {}) {
  let definition;
  let fixtureMeta = null;

  if (fixtureId) {
    const loaded = loadFixture(fixtureId);
    definition = loaded.definition;
    fixtureMeta = loaded.meta;
  } else if (inlineDefinition) {
    lantern.validateDefinition(inlineDefinition);
    definition = inlineDefinition;
  } else {
    throw httpError(400, 'fixtureId ou definition requis', 'SIM_INPUT');
  }

  if (channel === 'production') {
    throw httpError(400, 'Le simulateur refuse channel=production', 'SIM_CHANNEL');
  }

  const runtime = lantern.createRuntime({
    runId: `sim_${randomUUID().slice(0, 8)}`,
    channel: 'lab',
    playerId,
    teamId,
    step: runtimePatch.step || 0,
    vars: runtimePatch.vars || {},
    mediaStates: runtimePatch.mediaStates || {},
  });
  lantern.initMediaFromDefinition(definition, runtime);
  applyRuntimePatch(runtime, runtimePatch);

  const sessionId = randomUUID();
  const session = {
    id: sessionId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    label: label || fixtureMeta?.title || definition.title || definition.id,
    fixtureId: fixtureId || null,
    definition,
    runtime,
    history: [],
  };
  sessions.set(sessionId, session);

  return {
    sessionId,
    label: session.label,
    fixtureId: session.fixtureId,
    definition: {
      id: definition.id,
      title: definition.title,
      slug: definition.slug,
      timezone: definition.timezone,
      rulesCount: (definition.rules || []).length,
      zones: (definition.zones || []).map((z) => ({ id: z.id, label: z.label, kind: z.kind })),
      mediaItems: (definition.mediaItems || []).map((m) => ({ id: m.id, label: m.label, policy: m.policy })),
      variables: definition.variables || [],
    },
    state: snapshotState(runtime),
  };
}

function getSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) throw httpError(404, 'Session introuvable', 'SESSION_NOT_FOUND');
  return session;
}

function deleteSession(sessionId) {
  return sessions.delete(sessionId);
}

/**
 * Une étape de simulation : event et/ou tick horloge.
 */
function runStep(session, {
  event = null,
  now = null,
  lat = null,
  lng = null,
  runtimePatch = null,
  tickTo = null,
  source = 'lab_sim',
} = {}) {
  if (runtimePatch) applyRuntimePatch(session.runtime, runtimePatch);

  if (lat != null && lng != null) {
    session.runtime.location = {
      ...(session.runtime.location || {}),
      lat,
      lng,
      at: now || new Date().toISOString(),
    };
  }

  const steps = [];

  if (event) {
    const evt = {
      type: event.type,
      source: event.source || source,
      at: event.at || now || new Date().toISOString(),
      actorId: session.runtime.playerId,
      clientEventId: event.clientEventId || `sim:${randomUUID()}`,
      payload: {
        ...(event.payload || {}),
        ...(lat != null ? { lat } : {}),
        ...(lng != null ? { lng } : {}),
      },
    };

    if (session.runtime.channel === 'production') {
      throw httpError(400, 'channel production interdit', 'SIM_CHANNEL');
    }

    const handleResult = lantern.handleEvent(session.definition, session.runtime, evt, {
      now: evt.at,
      lat: lat ?? evt.payload.lat,
      lng: lng ?? evt.payload.lng,
    });

    const stepOut = {
      kind: 'event',
      injected: evt,
      rulesFired: handleResult.rulesFired,
      actions: handleResult.actions,
      uiPlan: handleResult.uiPlan,
      scheduled: handleResult.scheduled || [],
      duplicate: handleResult.duplicate || false,
      trace: formatTrace(handleResult),
      state: snapshotState(session.runtime),
    };
    steps.push(stepOut);
    session.history.push({ at: new Date().toISOString(), ...stepOut });
  }

  if (tickTo) {
    const tickResult = lantern.tickSchedules(session.definition, session.runtime, {
      now: tickTo,
      lat: lat ?? session.runtime.location?.lat,
      lng: lng ?? session.runtime.location?.lng,
    });

    const tickOut = {
      kind: 'tick',
      injected: { tickTo, lat, lng },
      tick: {
        now: tickResult.now,
        processed: (tickResult.processed || []).map((p) => ({
          jobId: p.jobId,
          scheduleId: p.scheduleId,
          status: p.status,
          nextJobId: p.nextJobId,
          rulesFired: p.handleResult?.rulesFired || [],
          actions: p.handleResult?.actions || [],
          uiPlan: p.handleResult?.uiPlan || [],
          trace: p.handleResult ? formatTrace(p.handleResult) : null,
        })),
        expired: tickResult.expired || [],
        pending: tickResult.pending || [],
      },
      state: snapshotState(session.runtime),
    };
    steps.push(tickOut);
    session.history.push({ at: new Date().toISOString(), ...tickOut });
  }

  if (!event && !tickTo) {
    throw httpError(400, 'event ou tickTo requis', 'SIM_INPUT');
  }

  session.updatedAt = new Date().toISOString();

  return {
    sessionId: session.id,
    fixtureId: session.fixtureId,
    steps,
    state: snapshotState(session.runtime),
    historyCount: session.history.length,
  };
}

/**
 * One-shot sans session persistée (pratique pour tests HTTP).
 */
function simulateOnce(body = {}) {
  const created = createSession(body);
  const session = getSession(created.sessionId);
  const result = runStep(session, body);
  // garder la session pour enchaîner depuis l'UI ; tests peuvent ignorer sessionId
  return { ...created, ...result };
}

/** Presets prêts à envoyer depuis l'UI */
function listPresets() {
  return [
    {
      id: 'magellan_13_1707',
      fixtureId: 'magellan',
      title: 'Magellan — Paris 13e @ 17:07 → Monsieur X',
      event: {
        type: 'media.discovered',
        at: '2026-08-09T15:07:00.000Z',
        payload: { mediaItemId: 'talkie_magellan' },
      },
      lat: 48.8322,
      lng: 2.3561,
      now: '2026-08-09T15:07:00.000Z',
    },
    {
      id: 'magellan_1_1707',
      fixtureId: 'magellan',
      title: 'Magellan — Paris 1er @ 17:07 → Monsieur Y',
      event: {
        type: 'media.discovered',
        at: '2026-08-09T15:07:00.000Z',
        payload: { mediaItemId: 'talkie_magellan' },
      },
      lat: 48.8606,
      lng: 2.3376,
      now: '2026-08-09T15:07:00.000Z',
    },
    {
      id: 'magellan_7_1707',
      fixtureId: 'magellan',
      title: 'Magellan — Paris 7e @ 17:07 → Madame V',
      event: {
        type: 'media.discovered',
        at: '2026-08-09T15:07:00.000Z',
        payload: { mediaItemId: 'talkie_magellan' },
      },
      lat: 48.8566,
      lng: 2.3122,
      now: '2026-08-09T15:07:00.000Z',
    },
    {
      id: 'magellan_hors_fenetre',
      fixtureId: 'magellan',
      title: 'Magellan — 13e @ 16:00 (hors fenêtre)',
      event: {
        type: 'media.discovered',
        at: '2026-08-09T14:00:00.000Z',
        payload: { mediaItemId: 'talkie_magellan' },
      },
      lat: 48.8322,
      lng: 2.3561,
      now: '2026-08-09T14:00:00.000Z',
    },
    {
      id: 'appel_20h17_ok',
      fixtureId: 'appel20h17',
      title: 'Appel 20h17 — Bureau + cassette → ring',
      runtime: {
        mediaStates: {
          cassette: {
            discovered: true,
            unlocked: true,
            opened: true,
            consumed: true,
            visible: true,
          },
        },
      },
      event: {
        type: 'time.schedule',
        at: '2026-08-09T18:17:00.000Z',
        payload: { scheduleId: 'appel_20h17' },
      },
      lat: 48.8606,
      lng: 2.3376,
      now: '2026-08-09T18:17:00.000Z',
    },
    {
      id: 'appel_20h17_miss',
      fixtureId: 'appel20h17',
      title: 'Appel 20h17 — hors Bureau → miss',
      runtime: {
        mediaStates: {
          cassette: {
            discovered: true,
            unlocked: true,
            opened: true,
            consumed: true,
            visible: true,
          },
        },
      },
      event: {
        type: 'time.schedule',
        at: '2026-08-09T18:17:00.000Z',
        payload: { scheduleId: 'appel_20h17' },
      },
      lat: 48.8322,
      lng: 2.3561,
      now: '2026-08-09T18:17:00.000Z',
    },
    {
      id: 'appel_relatif_note',
      fixtureId: 'appel_relatif',
      title: 'E0b — Consommer la note (planifie +17 min)',
      event: {
        type: 'media.consumed',
        at: '2026-08-09T16:03:00.000Z',
        payload: { mediaItemId: 'note_batisseur' },
      },
      lat: 48.8606,
      lng: 2.3376,
      now: '2026-08-09T16:03:00.000Z',
    },
    {
      id: 'appel_relatif_tick',
      fixtureId: 'appel_relatif',
      title: 'E0b — Tick +17 min (après note, même session)',
      tickTo: '2026-08-09T16:20:00.000Z',
      lat: 48.8606,
      lng: 2.3376,
      now: '2026-08-09T16:20:00.000Z',
      requiresSession: true,
    },
  ];
}

function clearAllSessions() {
  sessions.clear();
}

module.exports = {
  listFixtures,
  loadFixture,
  listPresets,
  createSession,
  getSession,
  deleteSession,
  runStep,
  simulateOnce,
  snapshotState,
  formatTrace,
  clearAllSessions,
  _sessions: sessions,
};
