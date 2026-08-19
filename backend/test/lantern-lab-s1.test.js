/**
 * S1 — Simulateur API Lantern Engine
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers/testServer');
const simulate = require('../src/lib/lanternEngine/simulate');

const SIM_KEY = 'mazone-lantern-sim';

function simOpts(extra = {}) {
  return { headers: { 'X-Lantern-Sim-Key': SIM_KEY }, ...extra };
}

before(async () => {
  await h.startServer();
});

after(async () => {
  await h.stopServer();
  h.cleanup();
});

beforeEach(() => {
  h.reset();
  simulate.clearAllSessions();
});

describe('S1 lantern-lab API', () => {
  it('refuse sans auth', async () => {
    const { status } = await h.api.get('/api/admin/lantern-lab/health');
    assert.equal(status, 401);
  });

  it('health + fixtures avec clé sim', async () => {
    const health = await h.api.get('/api/admin/lantern-lab/health', simOpts());
    assert.equal(health.status, 200);
    assert.equal(health.body.engine, 'lanternEngine');
    assert.match(health.body.stage, /^S1/);

    const fixtures = await h.api.get('/api/admin/lantern-lab/fixtures', simOpts());
    assert.equal(fixtures.status, 200);
    const ids = fixtures.body.fixtures.map((f) => f.id);
    assert.ok(ids.includes('magellan'));
    assert.ok(ids.includes('appel20h17'));
    assert.ok(ids.includes('appel_relatif'));
  });

  it('simule Magellan 13e → Monsieur X via POST /simulate', async () => {
    const { status, body } = await h.api.post(
      '/api/admin/lantern-lab/simulate',
      {
        fixtureId: 'magellan',
        event: {
          type: 'media.discovered',
          at: '2026-08-09T15:07:00.000Z',
          payload: { mediaItemId: 'talkie_magellan' },
        },
        lat: 48.8322,
        lng: 2.3561,
        now: '2026-08-09T15:07:00.000Z',
      },
      simOpts()
    );
    assert.equal(status, 200);
    assert.ok(body.sessionId);
    assert.equal(body.steps.length, 1);
    const step = body.steps[0];
    assert.equal(step.kind, 'event');
    assert.equal(step.trace.event.type, 'media.discovered');
    assert.ok(step.trace.candidates.some((c) => c.ruleId === 'rule_talkie_magellan_x' && c.match));
    assert.ok(step.trace.fired.some((f) => f.ruleId === 'rule_talkie_magellan_x'));
    assert.ok(step.uiPlan.some((u) => u.kind === 'ring_talkie'));
    assert.ok(step.uiPlan.some((u) => u.label === 'Monsieur X'));
    assert.equal(step.state.vars.talkie_branch, 'X');
    const x = step.trace.candidates.find((c) => c.ruleId === 'rule_talkie_magellan_x');
    assert.ok(x.conditions.every((c) => c.ok === true));
  });

  it('simule Appel 20h17 Bureau → ring', async () => {
    const { status, body } = await h.api.post(
      '/api/admin/lantern-lab/simulate',
      {
        fixtureId: 'appel20h17',
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
      },
      simOpts()
    );
    assert.equal(status, 200);
    const step = body.steps[0];
    assert.ok(step.uiPlan.some((u) => u.kind === 'ring_phone'));
    assert.equal(step.state.vars.appel_20h17_deja_recu, true);
  });

  it('session + tickSchedules relatif E0b sans attendre', async () => {
    const created = await h.api.post(
      '/api/admin/lantern-lab/sessions',
      { fixtureId: 'appel_relatif' },
      simOpts()
    );
    assert.equal(created.status, 200);
    const sessionId = created.body.sessionId;

    const note = await h.api.post(
      `/api/admin/lantern-lab/sessions/${sessionId}/simulate`,
      {
        event: {
          type: 'media.consumed',
          at: '2026-08-09T16:03:00.000Z',
          payload: { mediaItemId: 'note_batisseur' },
        },
        lat: 48.8606,
        lng: 2.3376,
        now: '2026-08-09T16:03:00.000Z',
      },
      simOpts()
    );
    assert.equal(note.status, 200);
    assert.equal(note.body.steps[0].scheduled.length, 1);
    assert.equal(note.body.state.pendingSchedules[0].status, 'pending');

    const tick = await h.api.post(
      `/api/admin/lantern-lab/sessions/${sessionId}/simulate`,
      {
        tickTo: '2026-08-09T16:20:00.000Z',
        lat: 48.8606,
        lng: 2.3376,
      },
      simOpts()
    );
    assert.equal(tick.status, 200);
    assert.equal(tick.body.steps[0].kind, 'tick');
    assert.equal(tick.body.steps[0].tick.processed[0].status, 'fired');
    assert.ok(
      tick.body.steps[0].tick.processed[0].uiPlan.some((u) => u.kind === 'ring_phone')
    );
    assert.equal(tick.body.state.vars.appel_relatif_deja_recu, true);
  });

  it('sert la page UI /lantern-sim/', async () => {
    const { baseUrl } = await h.startServer();
    const res = await fetch(`${baseUrl}/lantern-sim/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Lantern Sim'));
    assert.ok(html.includes('Simuler'));
  });
});
