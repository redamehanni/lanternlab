/**
 * Registre Open/Closed des Actions + exécution séquentielle (E0 in-memory).
 */

const { ACTION_CRITICALITY } = require('./types');

const handlers = new Map();

function register(type, handler, { criticality = ACTION_CRITICALITY.CRITICAL } = {}) {
  if (handlers.has(type)) throw new Error(`action déjà enregistrée: ${type}`);
  handlers.set(type, { handler, criticality });
}

function get(type) {
  return handlers.get(type) || null;
}

function list() {
  return [...handlers.keys()].sort();
}

function ensureMedia(runtime, mediaItemId) {
  if (!runtime.mediaStates) runtime.mediaStates = {};
  if (!runtime.mediaStates[mediaItemId]) {
    runtime.mediaStates[mediaItemId] = {
      discovered: false,
      unlocked: false,
      opened: false,
      consumed: false,
      visible: false,
    };
  }
  return runtime.mediaStates[mediaItemId];
}

function ensureVars(runtime) {
  if (!runtime.vars) runtime.vars = {};
  return runtime.vars;
}

// ── Catalogue v1 ─────────────────────────────────────────────────────────────

register('media.unlock', (action, ctx) => {
  const id = action.params.mediaItemId;
  ensureMedia(ctx.runtime, id).unlocked = true;
  ensureMedia(ctx.runtime, id).visible = true;
  return { ok: true, effect: { mediaItemId: id, unlocked: true } };
});

register('media.showItem', (action, ctx) => {
  const id = action.params.mediaItemId;
  ensureMedia(ctx.runtime, id).visible = true;
  return { ok: true, effect: { mediaItemId: id, visible: true } };
});

register('media.hideItem', (action, ctx) => {
  const id = action.params.mediaItemId;
  ensureMedia(ctx.runtime, id).visible = false;
  return { ok: true, effect: { mediaItemId: id, visible: false } };
});

register('media.play', (action) => {
  // E0 : plan d'action UI — pas de lecteur réel
  return {
    ok: true,
    ui: {
      kind: 'play_media',
      mediaContentId: action.params.mediaContentId,
      mediaItemId: action.params.mediaItemId,
      label: action.params.label || null,
    },
  };
});

register('device.ringTalkie', (action) => {
  return {
    ok: true,
    ui: {
      kind: 'ring_talkie',
      deviceId: action.params.deviceId || 'talkie',
      label: action.params.label || null,
    },
  };
});

register('device.ringPhone', (action) => {
  return {
    ok: true,
    ui: {
      kind: 'ring_phone',
      deviceId: action.params.deviceId || 'phone',
      label: action.params.label || null,
    },
  };
});

register('device.playRadio', (action) => {
  return {
    ok: true,
    ui: {
      kind: 'play_radio',
      frequency: action.params.frequency,
      mediaContentId: action.params.mediaContentId,
    },
  };
});

register('ui.notify', (action) => {
  return {
    ok: true,
    criticality: ACTION_CRITICALITY.NON_CRITICAL,
    ui: { kind: 'notify', message: action.params.message },
  };
});

register('ui.observe', (action) => {
  return {
    ok: true,
    criticality: ACTION_CRITICALITY.NON_CRITICAL,
    ui: {
      kind: 'observe',
      title: action.params.title || 'Fenêtre d’observation',
      message: action.params.message,
      ephemeral: true,
    },
  };
});

register('journal.addNote', (action, ctx) => {
  if (!ctx.runtime.playerJournal) ctx.runtime.playerJournal = [];
  const note = {
    id: action.params.noteId || `note_${Date.now()}`,
    title: action.params.title || 'Note',
    text: action.params.message,
    at: new Date().toISOString(),
  };
  if (!ctx.runtime.playerJournal.some((n) => n.id === note.id)) {
    ctx.runtime.playerJournal.push(note);
  }
  return {
    ok: true,
    effect: { noteId: note.id },
    ui: { kind: 'journal_note', title: note.title, message: note.text, permanent: true },
  };
});

register('var.set', (action, ctx) => {
  const vars = ensureVars(ctx.runtime);
  vars[action.params.varId] = action.params.value;
  return { ok: true, effect: { varId: action.params.varId, value: action.params.value } };
});

register('var.increment', (action, ctx) => {
  const vars = ensureVars(ctx.runtime);
  const cur = Number(vars[action.params.varId] || 0);
  const next = cur + Number(action.params.by ?? 1);
  vars[action.params.varId] = next;
  return { ok: true, effect: { varId: action.params.varId, value: next } };
});

register('step.set', (action, ctx) => {
  ctx.runtime.step = Number(action.params.value);
  return { ok: true, effect: { step: ctx.runtime.step } };
});

register('step.advance', (action, ctx) => {
  ctx.runtime.step = Number(ctx.runtime.step || 0) + Number(action.params.by ?? 1);
  return { ok: true, effect: { step: ctx.runtime.step } };
});

register('choice.record', (action, ctx) => {
  if (!ctx.runtime.choices) ctx.runtime.choices = {};
  ctx.runtime.choices[action.params.choiceId] = action.params.value;
  return { ok: true, effect: { choiceId: action.params.choiceId, value: action.params.value } };
});

register('object.setState', (action, ctx) => {
  if (!ctx.runtime.objectStates) ctx.runtime.objectStates = {};
  ctx.runtime.objectStates[action.params.objectId] = action.params.value;
  return { ok: true, effect: { objectId: action.params.objectId, value: action.params.value } };
});

register('event.emit', (action) => {
  return {
    ok: true,
    emit: {
      type: action.params.type,
      payload: action.params.payload || {},
      source: 'system',
    },
  };
});

/**
 * schedule.after — programme un événement après un délai relatif.
 * Le job est matérialisé par relativeScheduler.enqueue (via executeActions).
 */
register('schedule.after', (action) => {
  const p = action.params || {};
  if (p.afterMs == null && p.afterMinutes == null) {
    throw new Error('schedule.after: afterMs ou afterMinutes requis');
  }
  return {
    ok: true,
    schedule: {
      afterMs: p.afterMs,
      afterMinutes: p.afterMinutes,
      emitEventType: p.emitEventType || 'time.schedule',
      payload: p.payload || {},
      jobId: p.jobId || null,
      scheduleId: p.scheduleId || p.payload?.scheduleId || null,
      missPolicy: p.missPolicy || null,
      graceMs: p.graceMs != null ? p.graceMs : null,
      repeat: p.repeat || null,
      sourceActionId: action.id,
    },
  };
});

register('rule.disable', (action, ctx) => {
  if (!ctx.runtime.disabledRules) ctx.runtime.disabledRules = {};
  ctx.runtime.disabledRules[action.params.ruleId] = true;
  return { ok: true, effect: { ruleId: action.params.ruleId, disabled: true } };
});

register('rule.enable', (action, ctx) => {
  if (!ctx.runtime.disabledRules) ctx.runtime.disabledRules = {};
  delete ctx.runtime.disabledRules[action.params.ruleId];
  return { ok: true, effect: { ruleId: action.params.ruleId, disabled: false } };
});

/**
 * Exécute une liste d'actions ordonnées.
 * @returns {{ results: object[], emitted: object[], uiPlan: object[], schedules: object[] }}
 */
function executeActions(actions, ctx) {
  const results = [];
  const emitted = [];
  const uiPlan = [];
  const schedules = [];

  for (const action of actions || []) {
    const entry = get(action.type);
    const base = {
      actionId: action.id,
      type: action.type,
      delayMs: action.delayMs || 0,
      waitFor: action.waitFor || 'none',
    };

    if (!entry) {
      results.push({
        ...base,
        ok: false,
        skipped: true,
        reason: 'action_unknown',
      });
      continue;
    }

    try {
      const out = entry.handler(action, ctx) || { ok: true };
      const criticality = out.criticality || entry.criticality;
      if (out.ui) uiPlan.push({ ...out.ui, actionId: action.id, delayMs: base.delayMs, waitFor: base.waitFor });
      if (out.emit) emitted.push(out.emit);
      if (out.schedule) schedules.push({ ...out.schedule, sourceActionId: action.id });
      results.push({
        ...base,
        ok: out.ok !== false,
        criticality,
        effect: out.effect || null,
        ui: out.ui || null,
        schedule: out.schedule || null,
      });
    } catch (err) {
      const criticality = entry.criticality;
      results.push({
        ...base,
        ok: false,
        criticality,
        error: err.message,
      });
      if (criticality === ACTION_CRITICALITY.CRITICAL) {
        break;
      }
    }
  }

  return { results, emitted, uiPlan, schedules };
}

module.exports = {
  register,
  get,
  list,
  executeActions,
  ensureMedia,
};
