/**
 * Scheduler relatif E0b — jobs in-memory liés au Runtime.
 *
 * Action schedule.after → enqueue
 * tickSchedules(now) → émet time.schedule / time.relative_due via handleEvent
 *
 * Pas de cron OS : l'horloge est injectée (tests / futur job serveur).
 */

const { randomUUID } = require('crypto');
const { MISS_POLICIES } = require('./types');
const time = require('./time');

function ensureQueue(runtime) {
  if (!runtime.pendingSchedules) runtime.pendingSchedules = [];
  return runtime.pendingSchedules;
}

function resolveDelayMs(params = {}) {
  if (params.afterMs != null) return Number(params.afterMs);
  if (params.afterMinutes != null) return Number(params.afterMinutes) * 60 * 1000;
  throw new Error('schedule.after: afterMs ou afterMinutes requis');
}

/**
 * Enfile un job relatif.
 * @returns {object} job
 */
function enqueue(runtime, {
  afterMs,
  afterMinutes,
  emitEventType = 'time.schedule',
  payload = {},
  jobId,
  scheduleId,
  missPolicy = null,
  graceMs = null,
  repeat = null,
  sourceActionId = null,
  sourceRuleId = null,
  createdAt,
} = {}) {
  const delay = resolveDelayMs({ afterMs, afterMinutes });
  if (!Number.isFinite(delay) || delay < 0) {
    throw new Error('schedule.after: délai invalide');
  }

  const created = time.toDate(createdAt || new Date()).getTime();
  const dueAt = new Date(created + delay).toISOString();
  const id = jobId || `sched_${randomUUID()}`;
  const queue = ensureQueue(runtime);

  // Remplace un job pending de même jobId / scheduleId si demandé
  if (jobId) {
    for (const j of queue) {
      if (j.id === jobId && j.status === 'pending') j.status = 'cancelled';
    }
  }

  const job = {
    id,
    scheduleId: scheduleId || payload.scheduleId || id,
    runId: runtime.runId,
    status: 'pending',
    createdAt: new Date(created).toISOString(),
    dueAt,
    delayMs: delay,
    emitEventType,
    payload: { ...payload, scheduleId: scheduleId || payload.scheduleId || id },
    missPolicy,
    graceMs,
    repeat: repeat
      ? {
          everyMs:
            repeat.everyMs != null
              ? Number(repeat.everyMs)
              : Number(repeat.everyMinutes) * 60 * 1000,
          maxRepeats: repeat.maxRepeats != null ? Number(repeat.maxRepeats) : null,
          firedCount: Number(repeat.firedCount || 0),
          missCycles: Number(repeat.missCycles || 0),
        }
      : null,
    sourceActionId,
    sourceRuleId,
    firedAt: null,
    missedAt: null,
    expiredAt: null,
  };

  queue.push(job);
  return job;
}

function listPending(runtime) {
  return ensureQueue(runtime).filter((j) => j.status === 'pending');
}

function listAll(runtime) {
  return [...ensureQueue(runtime)];
}

function cancelJob(runtime, jobId) {
  const job = ensureQueue(runtime).find((j) => j.id === jobId);
  if (!job) return false;
  if (job.status === 'pending') job.status = 'cancelled';
  return true;
}

/**
 * Jobs dont dueAt <= now, encore pending.
 * Si missPolicy=expire + graceMs dépassée sans tick à l'heure → expire sans emit.
 */
function collectDueJobs(runtime, now) {
  const nowMs = time.toDate(now).getTime();
  const due = [];
  const expired = [];

  for (const job of ensureQueue(runtime)) {
    if (job.status !== 'pending') continue;
    const dueMs = time.toDate(job.dueAt).getTime();
    if (nowMs < dueMs) continue;

    const policy = job.missPolicy;
    if (policy === MISS_POLICIES.EXPIRE && job.graceMs != null) {
      const graceEnd = dueMs + Number(job.graceMs);
      if (nowMs > graceEnd) {
        job.status = 'expired';
        job.expiredAt = time.toDate(now).toISOString();
        expired.push(job);
        continue;
      }
    }

    // deliver_late / skip_wait_next / expire sans grace / null → émettre dès que now >= dueAt
    due.push(job);
  }

  return { due, expired };
}

function markJobFired(job, now) {
  job.status = 'fired';
  job.firedAt = time.toDate(now).toISOString();
  if (job.repeat) job.repeat.firedCount += 1;
}

function markJobMissed(job, now, reason = 'conditions_unmet') {
  job.status = 'missed';
  job.missedAt = time.toDate(now).toISOString();
  job.missReason = reason;
}

/**
 * Après un fire réussi : replanifie si repeat actif.
 */
function maybeRepeat(runtime, job, now) {
  if (!job.repeat) return null;
  const { everyMs, maxRepeats, firedCount } = job.repeat;
  if (!Number.isFinite(everyMs) || everyMs <= 0) return null;
  if (maxRepeats != null && firedCount >= maxRepeats) return null;

  return enqueue(runtime, {
    afterMs: everyMs,
    emitEventType: job.emitEventType,
    payload: { ...job.payload },
    scheduleId: job.scheduleId,
    missPolicy: job.missPolicy,
    graceMs: job.graceMs,
    repeat: {
      everyMs,
      maxRepeats,
      firedCount,
      missCycles: job.repeat.missCycles || 0,
    },
    sourceActionId: job.sourceActionId,
    sourceRuleId: job.sourceRuleId,
    createdAt: now,
    jobId: `${job.scheduleId}__rep_${firedCount}`,
  });
}

/**
 * Après un miss avec skip_wait_next : prochain créneau relatif.
 */
function maybeRescheduleAfterMiss(runtime, job, now) {
  if (job.missPolicy !== MISS_POLICIES.SKIP_WAIT_NEXT) return null;
  if (!job.repeat) return null;
  const { everyMs, maxRepeats } = job.repeat;
  // Compte le miss comme une occurrence de cycle sans incrémenter firedCount succès
  const cycle = (job.repeat.missCycles || 0) + 1;
  job.repeat.missCycles = cycle;
  if (maxRepeats != null && cycle >= maxRepeats) return null;

  return enqueue(runtime, {
    afterMs: everyMs,
    emitEventType: job.emitEventType,
    payload: { ...job.payload },
    scheduleId: job.scheduleId,
    missPolicy: job.missPolicy,
    graceMs: job.graceMs,
    repeat: { everyMs, maxRepeats },
    sourceActionId: job.sourceActionId,
    sourceRuleId: job.sourceRuleId,
    createdAt: now,
    jobId: `${job.scheduleId}__missrep_${cycle}`,
  });
}

/**
 * Avance l'horloge du scheduler et traite les jobs dus.
 * @param {Function} handleEventFn — lanternEngine.handleEvent (injecté pour éviter cycle)
 */
function tickSchedules(definition, runtime, handleEventFn, options = {}) {
  const now = options.now || new Date().toISOString();
  const { due, expired } = collectDueJobs(runtime, now);

  const results = [];
  const expiredJobs = expired.map((j) => ({
    jobId: j.id,
    scheduleId: j.scheduleId,
    status: 'expired',
    dueAt: j.dueAt,
    expiredAt: j.expiredAt,
  }));

  for (const job of due) {
    // Snapshot position runtime dans le payload si absent
    const payload = {
      ...job.payload,
      lat: job.payload.lat ?? runtime.location?.lat ?? options.lat,
      lng: job.payload.lng ?? runtime.location?.lng ?? options.lng,
      _scheduleJobId: job.id,
      _relative: true,
    };

    const event = {
      type: job.emitEventType || 'time.schedule',
      source: 'scheduler',
      at: now,
      actorId: runtime.playerId,
      clientEventId: `schedjob:${job.id}:${now}`,
      payload,
    };

    const handleResult = handleEventFn(definition, runtime, event, { ...options, now });

    const relatedMiss = (handleResult.trace?.misses || []).some((m) => m.missed);
    const firedRules = handleResult.rulesFired || [];
    // Succès = au moins une Rule a matché, sans miss geo sur une Rule à missPolicy.
    // (un seul flag var.set "missed" avec relatedMiss → échec du job)
    const success = firedRules.length > 0 && !relatedMiss;

    if (success) {
      markJobFired(job, now);
      const next = maybeRepeat(runtime, job, now);
      results.push({
        jobId: job.id,
        scheduleId: job.scheduleId,
        status: 'fired',
        handleResult,
        nextJobId: next?.id || null,
      });
    } else {
      // Aucune Rule n'a matché
      const policy = job.missPolicy;
      if (policy === MISS_POLICIES.EXPIRE || relatedMiss) {
        markJobMissed(job, now, relatedMiss ? 'geo_absence_or_conditions' : 'no_rule_matched');
        results.push({
          jobId: job.id,
          scheduleId: job.scheduleId,
          status: 'missed',
          handleResult,
          nextJobId: null,
        });
      } else if (policy === MISS_POLICIES.SKIP_WAIT_NEXT) {
        markJobMissed(job, now, 'no_rule_matched');
        const next = maybeRescheduleAfterMiss(runtime, job, now);
        results.push({
          jobId: job.id,
          scheduleId: job.scheduleId,
          status: 'missed',
          handleResult,
          nextJobId: next?.id || null,
        });
      } else if (policy === MISS_POLICIES.DELIVER_LATE) {
        // Conditions pas prêtes : garder pending pour un prochain tick
        // (ne marque pas fired). Évite boucle infinie : si déjà due, on laisse pending
        // mais on ne re-traite qu'au prochain tickSchedules avec clientEventId différent.
        // Pour E0b : repasser en pending explicite et décaler d'un epsilon via lastAttemptAt.
        job.lastAttemptAt = time.toDate(now).toISOString();
        // Reste pending — le même dueAt sera retenté. Idempotence via clientEventId unique par tick.
        results.push({
          jobId: job.id,
          scheduleId: job.scheduleId,
          status: 'pending_retry',
          handleResult,
          nextJobId: job.id,
        });
      } else {
        // Pas de missPolicy job : considérer le créneau consommé (fired vide)
        markJobFired(job, now);
        results.push({
          jobId: job.id,
          scheduleId: job.scheduleId,
          status: 'fired_empty',
          handleResult,
          nextJobId: null,
        });
      }
    }
  }

  return {
    ok: true,
    now: time.toDate(now).toISOString(),
    processed: results,
    expired: expiredJobs,
    pending: listPending(runtime),
  };
}

module.exports = {
  enqueue,
  listPending,
  listAll,
  cancelJob,
  collectDueJobs,
  tickSchedules,
  resolveDelayMs,
};
