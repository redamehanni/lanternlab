/**
 * Story / State Engine — boucle d'évaluation générique.
 *
 * Événement → mise à jour intrinsèque → Rules candidates → Conditions → Actions
 * Aucune branche if (lanternId === …).
 */

const { MATCH_POLICIES } = require('./types');
const { validateDefinition, validateEvent } = require('./schemas');
const { evaluateCondition } = require('./condition');
const { executeActions, ensureMedia } = require('./actions');
const occurrence = require('./occurrence');
const { resolveZones } = require('./zones');
const { initMediaFromDefinition } = require('./runtime');
const relativeScheduler = require('./relativeScheduler');
const time = require('./time');

const DEFAULT_DEPTH_MAX = 8;
const DEFAULT_RULE_FIRE_BUDGET = 32;

function buildContext(definition, runtime, event, overrides = {}) {
  const now = overrides.now ?? event.at ?? new Date().toISOString();
  const lat = overrides.lat ?? event.payload?.lat ?? runtime.location?.lat ?? null;
  const lng = overrides.lng ?? event.payload?.lng ?? runtime.location?.lng ?? null;
  const resolvedZones =
    overrides.resolvedZones ??
    (lat != null && lng != null ? resolveZones(definition.zones || [], lat, lng) : runtime.location?.resolvedZones || []);

  return {
    definition,
    runtime,
    event,
    now,
    lat,
    lng,
    resolvedZones,
  };
}

/**
 * Mises à jour d'état intrinsèques avant évaluation des Rules.
 */
function intrinsicUpdate(event, runtime, ctx) {
  const notes = [];
  const p = event.payload || {};

  if (event.type === 'media.discovered' && p.mediaItemId) {
    ensureMedia(runtime, p.mediaItemId).discovered = true;
    ensureMedia(runtime, p.mediaItemId).visible = true;
    notes.push({ kind: 'media.discovered', mediaItemId: p.mediaItemId });
  }
  if (event.type === 'media.opened' && p.mediaItemId) {
    ensureMedia(runtime, p.mediaItemId).opened = true;
    notes.push({ kind: 'media.opened', mediaItemId: p.mediaItemId });
  }
  if (event.type === 'media.consumed' && p.mediaItemId) {
    ensureMedia(runtime, p.mediaItemId).consumed = true;
    notes.push({ kind: 'media.consumed', mediaItemId: p.mediaItemId });
  }
  if ((event.type === 'beacon.qr' || event.type === 'beacon.nfc') && p.beaconId) {
    if (!runtime.beaconsScanned.includes(p.beaconId)) {
      runtime.beaconsScanned.push(p.beaconId);
    }
    notes.push({ kind: event.type, beaconId: p.beaconId });
  }
  if (event.type === 'geo.enter' || event.type === 'geo.heartbeat' || event.type === 'player.position_updated') {
    if (ctx.lat != null && ctx.lng != null) {
      runtime.location = {
        lat: ctx.lat,
        lng: ctx.lng,
        accuracy: p.accuracy ?? runtime.location?.accuracy ?? null,
        resolvedZones: ctx.resolvedZones,
        at: time.toDate(ctx.now).toISOString(),
      };
      notes.push({ kind: 'location', zones: ctx.resolvedZones });
    }
  }
  if (event.type === 'choice.made' && p.choiceId != null) {
    if (!runtime.choices) runtime.choices = {};
    runtime.choices[p.choiceId] = p.value;
    notes.push({ kind: 'choice.made', choiceId: p.choiceId });
  }

  return notes;
}

function ruleIsEnabled(rule, runtime) {
  if (rule.enabled === false) return false;
  if (runtime.disabledRules?.[rule.id]) return false;
  return true;
}

function listenMatches(rule, event) {
  return (rule.listen || []).includes(event.type);
}

/**
 * Sélection des Rules à exécuter selon matchPolicy / exclusiveGroupId.
 */
function selectWinners(matched) {
  // matched: [{ rule, conditionTrace }]
  const winners = [];
  const claimedGroups = new Set();

  // Tri déjà fait par priority desc, id asc
  for (const m of matched) {
    const group = m.rule.exclusiveGroupId;
    if (group) {
      if (claimedGroups.has(group)) continue;
      claimedGroups.add(group);
      winners.push(m);
      continue;
    }
    const policy = m.rule.matchPolicy || MATCH_POLICIES.ALL;
    if (policy === MATCH_POLICIES.FIRST) {
      // first sans groupe : première Rule globale "first" gagne parmi les first ;
      // on traite comme exclusive implicite par id de policy bucket
      const bucket = '__first__';
      if (claimedGroups.has(bucket)) continue;
      claimedGroups.add(bucket);
      winners.push(m);
      continue;
    }
    winners.push(m);
  }
  return winners;
}

/**
 * Heuristique E0/E0b : miss d'occurrence temporelle =
 * créneau horaire dû (predicate time.* OK, ou event time.schedule / relative_due)
 * + présence geo échouée.
 */
function shouldMissForPresence(conditionTrace, event) {
  const leaves = [];
  (function walk(node) {
    if (!node) return;
    if (node.type) leaves.push(node);
    if (node.children) node.children.forEach(walk);
    if (node.child) walk(node.child);
  })(conditionTrace);

  const timePredOk = leaves.some((l) => String(l.type).startsWith('time.') && l.value === true);
  const scheduleEvent =
    event?.type === 'time.schedule' ||
    event?.type === 'time.reached' ||
    event?.type === 'time.relative_due';
  const timeOk = timePredOk || (scheduleEvent && Boolean(event?.payload?._relative || event?.payload?.scheduleId));
  const geoFailed = leaves.some((l) => String(l.type).startsWith('geo.') && l.value === false);
  return timeOk && geoFailed;
}

/**
 * Pour un time.schedule : missPolicy si absence géographique à l'heure due.
 */
function applyMissPolicies(candidatesFailed, runtime, ctx, trace) {
  for (const c of candidatesFailed) {
    const occ = c.rule.occurrence || {};
    const miss = occ.missPolicy || occ.schedule?.missPolicy;
    if (!miss) continue;
    if (
      ctx.event.type !== 'time.schedule' &&
      ctx.event.type !== 'time.reached' &&
      ctx.event.type !== 'time.relative_due'
    ) {
      continue;
    }
    if (!shouldMissForPresence(c.conditionTrace, ctx.event)) continue;
    const result = occurrence.markMissed(c.rule, runtime, ctx, 'geo_absence');
    trace.misses.push({
      ruleId: c.rule.id,
      ...result,
      condition: c.conditionTrace,
    });
  }
}

/**
 * handleEvent — API pure E0.
 *
 * @param {object} definition — LanternDefinition validée
 * @param {object} runtime — RuntimeState mutable
 * @param {object} event — LanternEvent
 * @param {object} [options]
 * @returns {object} résultat + trace
 */
function handleEvent(definition, runtime, event, options = {}) {
  validateDefinition(definition);
  validateEvent(event);

  initMediaFromDefinition(definition, runtime);

  // Idempotence
  if (event.clientEventId) {
    if (!runtime.processedClientEventIds) runtime.processedClientEventIds = new Set();
    if (runtime.processedClientEventIds.has(event.clientEventId)) {
      return {
        ok: true,
        duplicate: true,
        clientEventId: event.clientEventId,
        uiPlan: [],
        actions: [],
        rulesFired: [],
        trace: { duplicate: true, clientEventId: event.clientEventId },
      };
    }
  }

  // Canal : forcer / lab_sim refusés en production
  if (runtime.channel === 'production' && (event.source === 'forced' || event.source === 'lab_sim')) {
    const err = new Error('event source interdit sur channel production');
    err.code = 'LANTERN_SOURCE_FORBIDDEN';
    throw err;
  }

  const depthMax = options.depthMax ?? DEFAULT_DEPTH_MAX;
  const ruleFireBudget = options.ruleFireBudget ?? DEFAULT_RULE_FIRE_BUDGET;

  const rootTrace = {
    event: {
      type: event.type,
      source: event.source || null,
      clientEventId: event.clientEventId || null,
      payload: event.payload || {},
      at: event.at || null,
    },
    intrinsic: [],
    candidates: [],
    matched: [],
    fired: [],
    misses: [],
    emitted: [],
    depth: 0,
  };

  const allUiPlan = [];
  const allActions = [];
  const allRulesFired = [];
  const allScheduled = [];

  const queue = [{ event, depth: 0 }];
  let fires = 0;

  while (queue.length > 0) {
    const { event: current, depth } = queue.shift();
    if (depth > depthMax) {
      rootTrace.emitted.push({ truncated: true, reason: 'depthMax', depth });
      break;
    }

    const ctx = buildContext(definition, runtime, current, options);
    const intrinsic = intrinsicUpdate(current, runtime, ctx);
    if (depth === 0) rootTrace.intrinsic = intrinsic;

    const candidates = (definition.rules || [])
      .filter((r) => ruleIsEnabled(r, runtime))
      .filter((r) => listenMatches(r, current))
      .filter((r) => occurrence.isEligible(r, runtime, ctx))
      .slice()
      .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));

    const matched = [];
    const failed = [];

    for (const rule of candidates) {
      const { value, trace: conditionTrace } = evaluateCondition(rule.condition, ctx);
      const entry = {
        ruleId: rule.id,
        title: rule.title,
        priority: rule.priority,
        exclusiveGroupId: rule.exclusiveGroupId || null,
        conditionTrace,
        match: value,
      };
      if (depth === 0) rootTrace.candidates.push(entry);
      if (value) matched.push({ rule, conditionTrace });
      else failed.push({ rule, conditionTrace });
    }

    applyMissPolicies(failed, runtime, ctx, rootTrace);

    const winners = selectWinners(matched);
    if (depth === 0) {
      rootTrace.matched = winners.map((w) => w.rule.id);
    }

    for (const w of winners) {
      if (fires >= ruleFireBudget) {
        rootTrace.emitted.push({ truncated: true, reason: 'ruleFireBudget' });
        break;
      }
      occurrence.markFired(w.rule, runtime, ctx);
      const exec = executeActions(w.rule.actions, ctx);
      fires += 1;

      const enqueued = [];
      for (const sched of exec.schedules || []) {
        const job = relativeScheduler.enqueue(runtime, {
          ...sched,
          sourceRuleId: w.rule.id,
          sourceActionId: sched.sourceActionId || null,
          createdAt: ctx.now,
        });
        enqueued.push(job);
        allScheduled.push(job);
      }

      const fireRecord = {
        ruleId: w.rule.id,
        title: w.rule.title,
        condition: w.conditionTrace,
        actions: exec.results,
        uiPlan: exec.uiPlan,
        scheduled: enqueued.map((j) => ({
          jobId: j.id,
          scheduleId: j.scheduleId,
          dueAt: j.dueAt,
          delayMs: j.delayMs,
        })),
      };
      allRulesFired.push(fireRecord);
      allActions.push(...exec.results);
      allUiPlan.push(...exec.uiPlan);
      if (depth === 0) rootTrace.fired.push(fireRecord);

      for (const em of exec.emitted) {
        rootTrace.emitted.push(em);
        queue.push({
          event: {
            type: em.type,
            payload: em.payload || {},
            source: 'system',
            at: time.toDate(ctx.now).toISOString(),
            actorId: runtime.playerId,
          },
          depth: depth + 1,
        });
      }
    }

    // Journal append-only in-memory
    runtime.journal.push({
      at: time.toDate(ctx.now).toISOString(),
      eventType: current.type,
      source: current.source || null,
      clientEventId: current.clientEventId || null,
      rulesFired: winners.map((w) => w.rule.id),
      resolvedZones: ctx.resolvedZones,
    });
  }

  if (event.clientEventId) {
    runtime.processedClientEventIds.add(event.clientEventId);
  }

  return {
    ok: true,
    duplicate: false,
    uiPlan: allUiPlan,
    actions: allActions,
    rulesFired: allRulesFired,
    scheduled: allScheduled,
    runtime,
    trace: rootTrace,
  };
}

/**
 * Pourquoi une action s'est-elle déclenchée ? (dernière fire contenant actionId)
 */
function explainAction(handleResult, actionId) {
  for (const fire of handleResult.rulesFired || []) {
    const action = (fire.actions || []).find((a) => a.actionId === actionId);
    if (action) {
      return {
        found: true,
        ruleId: fire.ruleId,
        title: fire.title,
        condition: fire.condition,
        action,
        event: handleResult.trace?.event || null,
      };
    }
  }
  return { found: false, actionId };
}

module.exports = {
  handleEvent,
  buildContext,
  intrinsicUpdate,
  selectWinners,
  explainAction,
};
