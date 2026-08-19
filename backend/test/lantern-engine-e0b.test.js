/**
 * Lantern Engine E0b — schedule.after / tickSchedules
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const lantern = require('../src/lib/lanternEngine');

function loadFixture(name) {
  const p = path.join(__dirname, '../src/lib/lanternEngine/fixtures', name);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const T0 = '2026-08-09T16:03:00.000Z'; // 18:03 Paris
const T_PLUS_16 = '2026-08-09T16:19:00.000Z'; // +16 min — pas encore dû
const T_PLUS_17 = '2026-08-09T16:20:00.000Z'; // +17 min — dû
const BUREAU = { lat: 48.8606, lng: 2.3376 };
const FAR = { lat: 48.8322, lng: 2.3561 };

function uiKinds(result) {
  return (result.uiPlan || []).map((u) => u.kind);
}

describe('E0b — schedule.after enqueue', () => {
  const def = loadFixture('appel_relatif.json');

  it('media.consumed note → job pending due dans 17 minutes', () => {
    const runtime = lantern.createRuntime({ channel: 'lab' });
    const r = lantern.handleEvent(def, runtime, {
      type: 'media.consumed',
      source: 'mobile',
      at: T0,
      clientEventId: 'note-1',
      payload: { mediaItemId: 'note_batisseur', ...BUREAU },
    });

    assert.equal(r.scheduled.length, 1);
    assert.equal(r.scheduled[0].scheduleId, 'appel_relatif_17');
    assert.equal(r.scheduled[0].delayMs, 17 * 60 * 1000);
    assert.equal(r.scheduled[0].dueAt, T_PLUS_17);

    const pending = lantern.listPendingSchedules(runtime);
    assert.equal(pending.length, 1);
    assert.equal(pending[0].status, 'pending');
    assert.equal(pending[0].missPolicy, 'expire');
  });

  it('tick avant dueAt → aucune activation', () => {
    const runtime = lantern.createRuntime();
    lantern.handleEvent(def, runtime, {
      type: 'media.consumed',
      at: T0,
      payload: { mediaItemId: 'note_batisseur', ...BUREAU },
    });

    runtime.location = { lat: BUREAU.lat, lng: BUREAU.lng, accuracy: 5 };
    const tick = lantern.tickSchedules(def, runtime, { now: T_PLUS_16 });
    assert.equal(tick.processed.length, 0);
    assert.equal(lantern.listPendingSchedules(runtime).length, 1);
    assert.equal(runtime.vars.appel_relatif_deja_recu, false);
  });
});

describe('E0b — activation après délai (Appel relatif / esprit 20h17)', () => {
  const def = loadFixture('appel_relatif.json');

  it('au Bureau @ T+17 → téléphone + audio + var (once)', () => {
    const runtime = lantern.createRuntime();
    lantern.handleEvent(def, runtime, {
      type: 'media.consumed',
      at: T0,
      payload: { mediaItemId: 'note_batisseur', ...BUREAU },
    });
    runtime.location = { lat: BUREAU.lat, lng: BUREAU.lng, accuracy: 5 };

    const tick = lantern.tickSchedules(def, runtime, { now: T_PLUS_17, ...BUREAU });
    assert.equal(tick.processed.length, 1);
    assert.equal(tick.processed[0].status, 'fired');

    const hr = tick.processed[0].handleResult;
    assert.ok(uiKinds(hr).includes('ring_phone'));
    assert.ok(uiKinds(hr).includes('play_media'));
    assert.equal(runtime.vars.appel_relatif_deja_recu, true);
    assert.equal(runtime.vars.appel_relatif_missed, false);
    assert.equal(lantern.listPendingSchedules(runtime).length, 0);

    // Unique : second tick ne re-sonne pas
    const tick2 = lantern.tickSchedules(def, runtime, { now: T_PLUS_17, ...BUREAU });
    assert.equal(tick2.processed.length, 0);
  });

  it('hors Bureau @ T+17 → miss/expire + flag, pas de sonnerie ultérieure', () => {
    const runtime = lantern.createRuntime();
    lantern.handleEvent(def, runtime, {
      type: 'media.consumed',
      at: T0,
      payload: { mediaItemId: 'note_batisseur', ...FAR },
    });
    runtime.location = { lat: FAR.lat, lng: FAR.lng, accuracy: 8 };

    const tick = lantern.tickSchedules(def, runtime, { now: T_PLUS_17, ...FAR });
    assert.equal(tick.processed[0].status, 'missed');
    assert.ok(!uiKinds(tick.processed[0].handleResult).includes('ring_phone'));
    assert.equal(runtime.vars.appel_relatif_missed, true);
    assert.equal(runtime.vars.appel_relatif_deja_recu, false);
    assert.equal(runtime.occurrenceLedger.rule_appel_relatif_ring.exhausted, true);

    // Même en entrant au Bureau ensuite : occurrence unique expirée
    runtime.location = { lat: BUREAU.lat, lng: BUREAU.lng };
    const later = '2026-08-09T16:25:00.000Z';
    const tick2 = lantern.tickSchedules(def, runtime, { now: later, ...BUREAU });
    assert.equal(tick2.processed.length, 0);
    assert.ok(!runtime.vars.appel_relatif_deja_recu);
  });
});

describe('E0b — graceMs expire sans emit', () => {
  it('tick après dueAt+grace → job expired, pas de handleEvent utile', () => {
    const def = {
      id: 'lantern_grace',
      engineSchemaVersion: 1,
      timezone: 'Europe/Paris',
      rules: [
        {
          id: 'r_sched',
          title: 'schedule',
          enabled: true,
          priority: 1,
          listen: ['run.started'],
          condition: { op: 'true' },
          actions: [
            {
              id: 'a1',
              type: 'schedule.after',
              params: {
                afterMs: 60_000,
                scheduleId: 'grace_job',
                missPolicy: 'expire',
                graceMs: 30_000,
                payload: { scheduleId: 'grace_job' },
              },
            },
          ],
          occurrence: { kind: 'once_per_run' },
        },
        {
          id: 'r_fire',
          title: 'fire',
          enabled: true,
          priority: 1,
          listen: ['time.schedule'],
          condition: {
            op: 'and',
            children: [{ type: 'event.payloadEquals', 'key': 'scheduleId', value: 'grace_job' }],
          },
          actions: [{ id: 'ring', type: 'device.ringPhone', params: {} }],
          occurrence: { kind: 'once_per_run' },
        },
      ],
    };

    const runtime = lantern.createRuntime();
    const t0 = '2026-08-09T10:00:00.000Z';
    lantern.handleEvent(def, runtime, { type: 'run.started', at: t0, payload: {} });

    // dueAt = 10:01, grace jusqu'à 10:01:30 — tick à 10:02 → expired
    const tick = lantern.tickSchedules(def, runtime, { now: '2026-08-09T10:02:00.000Z' });
    assert.equal(tick.expired.length, 1);
    assert.equal(tick.expired[0].scheduleId, 'grace_job');
    assert.equal(tick.processed.length, 0);
    assert.equal(runtime.pendingSchedules[0].status, 'expired');
  });
});

describe('E0b — récurrence relative (repeat)', () => {
  it('après fire, replanifie everyMs jusqu’à maxRepeats', () => {
    const def = {
      id: 'lantern_repeat',
      engineSchemaVersion: 1,
      timezone: 'Europe/Paris',
      zones: [{ id: 'bureau', kind: 'circle', center: BUREAU, radiusM: 80 }],
      rules: [
        {
          id: 'r_start',
          enabled: true,
          priority: 1,
          listen: ['run.started'],
          condition: { op: 'true' },
          actions: [
            {
              id: 'a_rep',
              type: 'schedule.after',
              params: {
                afterMs: 1000,
                scheduleId: 'pulse',
                emitEventType: 'time.schedule',
                payload: { scheduleId: 'pulse' },
                repeat: { everyMs: 1000, maxRepeats: 3 },
              },
            },
          ],
          occurrence: { kind: 'once_per_run' },
        },
        {
          id: 'r_pulse',
          enabled: true,
          priority: 1,
          listen: ['time.schedule'],
          condition: {
            op: 'and',
            children: [
              { type: 'event.payloadEquals', key: 'scheduleId', value: 'pulse' },
              { type: 'geo.inZone', zoneId: 'bureau' },
            ],
          },
          actions: [
            { id: 'inc', type: 'var.increment', params: { varId: 'pulses', by: 1 } },
          ],
          occurrence: { kind: 'always' },
        },
      ],
      variables: [{ id: 'pulses', valueType: 'number', defaultValue: 0, scope: 'run' }],
    };

    const runtime = lantern.createRuntime();
    runtime.location = { lat: BUREAU.lat, lng: BUREAU.lng };
    const t0 = '2026-08-09T12:00:00.000Z';
    lantern.handleEvent(def, runtime, { type: 'run.started', at: t0, payload: {} });

    let now = Date.parse(t0);
    for (let i = 0; i < 3; i++) {
      now += 1000;
      const tick = lantern.tickSchedules(def, runtime, {
        now: new Date(now).toISOString(),
        ...BUREAU,
      });
      assert.equal(tick.processed[0].status, 'fired');
    }
    assert.equal(runtime.vars.pulses, 3);

    // maxRepeats atteint — plus de pending
    now += 1000;
    const last = lantern.tickSchedules(def, runtime, {
      now: new Date(now).toISOString(),
      ...BUREAU,
    });
    assert.equal(last.processed.length, 0);
    assert.equal(lantern.listPendingSchedules(runtime).length, 0);
  });

  it('skip_wait_next remets un job après miss', () => {
    const def = {
      id: 'lantern_skip',
      engineSchemaVersion: 1,
      timezone: 'Europe/Paris',
      zones: [{ id: 'bureau', kind: 'circle', center: BUREAU, radiusM: 80 }],
      rules: [
        {
          id: 'r_start',
          enabled: true,
          priority: 1,
          listen: ['run.started'],
          condition: { op: 'true' },
          actions: [
            {
              id: 'a',
              type: 'schedule.after',
              params: {
                afterMs: 1000,
                scheduleId: 'dailyish',
                missPolicy: 'skip_wait_next',
                payload: { scheduleId: 'dailyish' },
                repeat: { everyMs: 1000, maxRepeats: 2 },
              },
            },
          ],
          occurrence: { kind: 'once_per_run' },
        },
        {
          id: 'r_need_bureau',
          enabled: true,
          priority: 1,
          listen: ['time.schedule'],
          condition: {
            op: 'and',
            children: [
              { type: 'event.payloadEquals', key: 'scheduleId', value: 'dailyish' },
              { type: 'geo.inZone', zoneId: 'bureau' },
            ],
          },
          actions: [{ id: 'ring', type: 'device.ringPhone', params: {} }],
          occurrence: { kind: 'always' },
        },
      ],
    };

    const runtime = lantern.createRuntime();
    runtime.location = { lat: FAR.lat, lng: FAR.lng };
    const t0 = '2026-08-09T12:00:00.000Z';
    lantern.handleEvent(def, runtime, { type: 'run.started', at: t0, payload: {} });

    const t1 = '2026-08-09T12:00:01.000Z';
    const miss = lantern.tickSchedules(def, runtime, { now: t1, ...FAR });
    assert.equal(miss.processed[0].status, 'missed');
    assert.ok(miss.processed[0].nextJobId);
    assert.equal(lantern.listPendingSchedules(runtime).length, 1);

    // Prochaine occurrence au Bureau → succès
    runtime.location = { lat: BUREAU.lat, lng: BUREAU.lng };
    const t2 = '2026-08-09T12:00:02.000Z';
    const ok = lantern.tickSchedules(def, runtime, { now: t2, ...BUREAU });
    assert.equal(ok.processed[0].status, 'fired');
    assert.ok(uiKinds(ok.processed[0].handleResult).includes('ring_phone'));
  });
});

describe('E0b — catalogue + non-régression E0', () => {
  it('expose schedule.after dans le catalogue actions', () => {
    assert.ok(lantern.actions.list().includes('schedule.after'));
  });

  it('fixture Appel 20h17 absolu toujours valide', () => {
    const def = loadFixture('appel20h17.json');
    lantern.validateDefinition(def);
    const runtime = lantern.createRuntime();
    runtime.mediaStates.cassette = {
      discovered: true,
      unlocked: true,
      opened: true,
      consumed: true,
      visible: true,
    };
    const r = lantern.handleEvent(def, runtime, {
      type: 'time.schedule',
      at: '2026-08-09T18:17:00.000Z',
      payload: { scheduleId: 'appel_20h17', ...BUREAU },
    });
    assert.ok(uiKinds(r).includes('ring_phone'));
  });
});
