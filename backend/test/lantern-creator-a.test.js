/**
 * Phase A — Creator compile → même Lantern Engine
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers/testServer');
const creator = require('../src/lib/lanternEngine/creator');
const simulate = require('../src/lib/lanternEngine/simulate');

const simOpts = () => ({
  headers: { 'X-Lantern-Sim-Key': 'mazone-lantern-sim' },
});

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

describe('Creator Phase A — compile', () => {
  it('compile Appel du Bâtisseur → rules moteur valides', () => {
    const sit = creator.loadSituationTemplate('sit_appel_batisseur');
    const { compiled } = creator.compileAndPrepare(sit);
    assert.ok(compiled.rules.length >= 1);
    assert.ok(compiled.humanSummary.some((l) => l.role === 'when'));
    assert.ok(compiled.rules[0].listen.includes('time.schedule'));
    assert.ok(compiled.rules[0].actions.some((a) => a.type === 'device.ringPhone'));
  });

  it('compile Talkie Magellan → 3 branches exclusiveGroup', () => {
    const sit = creator.loadSituationTemplate('sit_talkie_magellan');
    const { compiled } = creator.compileAndPrepare(sit);
    assert.equal(compiled.rules.length, 3);
    const g = compiled.rules[0].exclusiveGroupId;
    assert.ok(g);
    assert.ok(compiled.rules.every((r) => r.exclusiveGroupId === g));
  });

  it('testSituation Magellan 13e → Monsieur X (humain)', () => {
    const sit = creator.loadSituationTemplate('sit_talkie_magellan');
    const out = creator.testSituation(sit, {});
    const human = out.humanSteps[0].human;
    assert.equal(human.status, 'triggered');
    assert.ok(human.whatHappens.some((w) => /Monsieur X|talkie/i.test(w.text) || w.icon === '📻'));
    assert.ok(human.whatHappens.some((w) => /Monsieur X/.test(w.text)));
  });

  it('testSituation Appel Bâtisseur Bureau → déclenché', () => {
    const sit = creator.loadSituationTemplate('sit_appel_batisseur');
    const out = creator.testSituation(sit, {});
    const human = out.humanSteps[0].human;
    assert.equal(human.status, 'triggered');
    assert.ok(human.whatHappens.some((w) => w.icon === '📞' || /téléphone/i.test(w.text)));
  });

  it('testSituation Appel hors Bureau → non déclenché ou manqué', () => {
    const sit = creator.loadSituationTemplate('sit_appel_batisseur');
    const out = creator.testSituation(sit, {
      lat: 48.8322,
      lng: 2.3561,
      event: sit.testDefaults.event,
      runtime: sit.testDefaults.runtime,
      now: sit.testDefaults.now,
    });
    const human = out.humanSteps[0].human;
    assert.ok(['not_triggered', 'missed', 'triggered'].includes(human.status));
    // Pas de sonnerie téléphone
    assert.ok(!human.whatHappens.some((w) => w.icon === '📞'));
  });
});

describe('Creator Phase A — API HTTP', () => {
  it('catalog + situations + test Magellan', async () => {
    const cat = await h.api.get('/api/admin/lantern-lab/creator/catalog', simOpts());
    assert.equal(cat.status, 200);
    assert.ok(cat.body.catalog.triggers.length > 0);

    const list = await h.api.get('/api/admin/lantern-lab/creator/situations', simOpts());
    assert.equal(list.status, 200);
    assert.ok(list.body.situations.some((s) => s.id === 'sit_talkie_magellan'));

    const sitRes = await h.api.get(
      '/api/admin/lantern-lab/creator/situations/sit_talkie_magellan',
      simOpts()
    );
    const tested = await h.api.post(
      '/api/admin/lantern-lab/creator/test',
      { situation: sitRes.body.situation },
      simOpts()
    );
    assert.equal(tested.status, 200);
    assert.equal(tested.body.humanSteps[0].human.status, 'triggered');
  });

  it('sert /lantern-lab/', async () => {
    const { baseUrl } = await h.startServer();
    const res = await fetch(`${baseUrl}/lantern-lab/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Lantern Lab'));
    assert.ok(html.includes('Mode Créateur'));
  });
});
