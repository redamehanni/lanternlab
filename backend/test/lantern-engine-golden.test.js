/**
 * Golden Tests Lantern Engine E0
 * — Talkie Magellan (branches X/Y/V)
 * — Appel 20h17 (succès + miss)
 *
 * Aucun if (lanternId === …) dans le moteur : uniquement des fixtures JSON.
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

/** 17:07 Europe/Paris le 9 août 2026 (CEST = UTC+2) */
const AT_1707 = '2026-08-09T15:07:00.000Z';
/** 20:17 Europe/Paris */
const AT_2017 = '2026-08-09T18:17:00.000Z';
/** Hors fenêtre talkie — 16:00 Paris */
const AT_1600 = '2026-08-09T14:00:00.000Z';

const COORDS = {
  arr13: { lat: 48.8322, lng: 2.3561 },
  arr11: { lat: 48.8584, lng: 2.379 },
  arr1: { lat: 48.8606, lng: 2.3376 },
  arr3: { lat: 48.8637, lng: 2.3615 },
  arr7: { lat: 48.8566, lng: 2.3122 },
  arr17: { lat: 48.8845, lng: 2.3219 },
  bureau: { lat: 48.8606, lng: 2.3376 },
  far: { lat: 48.8322, lng: 2.3561 },
};

function discoverTalkie(def, runtime, { lat, lng, at = AT_1707, clientEventId }) {
  return lantern.handleEvent(def, runtime, {
    type: 'media.discovered',
    source: 'mobile',
    at,
    clientEventId,
    payload: { mediaItemId: 'talkie_magellan', lat, lng },
  });
}

function uiKinds(result) {
  return (result.uiPlan || []).map((u) => u.kind);
}

function playedLabel(result) {
  const play = (result.uiPlan || []).find((u) => u.kind === 'play_media');
  return play?.label || play?.mediaContentId || null;
}

describe('Golden #1 — Talkie Magellan', () => {
  const def = loadFixture('magellan.json');

  it('Paris 13e @ 17:07 → Monsieur X (exclusive group)', () => {
    const runtime = lantern.createRuntime({ channel: 'lab' });
    const r = discoverTalkie(def, runtime, { ...COORDS.arr13, clientEventId: 'm-13' });
    assert.deepEqual(uiKinds(r), ['ring_talkie', 'play_media']);
    assert.equal(playedLabel(r), 'Monsieur X');
    assert.equal(runtime.vars.talkie_branch, 'X');
    assert.equal(r.rulesFired.length, 1);
    assert.equal(r.rulesFired[0].ruleId, 'rule_talkie_magellan_x');
    assert.ok(r.trace.matched.includes('rule_talkie_magellan_x'));
    assert.ok(!r.trace.matched.includes('rule_talkie_magellan_y'));
  });

  it('Paris 11e @ 17:07 → Monsieur X', () => {
    const runtime = lantern.createRuntime();
    const r = discoverTalkie(def, runtime, { ...COORDS.arr11, clientEventId: 'm-11' });
    assert.equal(playedLabel(r), 'Monsieur X');
    assert.equal(runtime.vars.talkie_branch, 'X');
  });

  it('Paris 1er @ 17:07 → Monsieur Y', () => {
    const runtime = lantern.createRuntime();
    const r = discoverTalkie(def, runtime, { ...COORDS.arr1, clientEventId: 'm-1' });
    assert.equal(playedLabel(r), 'Monsieur Y');
    assert.equal(runtime.vars.talkie_branch, 'Y');
  });

  it('Paris 3e @ 17:07 → Monsieur Y', () => {
    const runtime = lantern.createRuntime();
    const r = discoverTalkie(def, runtime, { ...COORDS.arr3, clientEventId: 'm-3' });
    assert.equal(playedLabel(r), 'Monsieur Y');
  });

  it('Paris 7e @ 17:07 → Madame V', () => {
    const runtime = lantern.createRuntime();
    const r = discoverTalkie(def, runtime, { ...COORDS.arr7, clientEventId: 'm-7' });
    assert.equal(playedLabel(r), 'Madame V');
    assert.equal(runtime.vars.talkie_branch, 'V');
  });

  it('Paris 17e @ 17:07 → Madame V', () => {
    const runtime = lantern.createRuntime();
    const r = discoverTalkie(def, runtime, { ...COORDS.arr17, clientEventId: 'm-17' });
    assert.equal(playedLabel(r), 'Madame V');
  });

  it('hors fenêtre horaire → aucune action talkie', () => {
    const runtime = lantern.createRuntime();
    const r = discoverTalkie(def, runtime, { ...COORDS.arr13, at: AT_1600, clientEventId: 'm-late' });
    assert.equal(r.rulesFired.length, 0);
    assert.equal(runtime.vars.talkie_branch, null);
    assert.equal(runtime.mediaStates.talkie_magellan.discovered, true);
  });

  it('explainAction retrouve la Rule Magellan X', () => {
    const runtime = lantern.createRuntime();
    const r = discoverTalkie(def, runtime, { ...COORDS.arr13, clientEventId: 'm-why' });
    const why = lantern.explainAction(r, 'act_play_x');
    assert.equal(why.found, true);
    assert.equal(why.ruleId, 'rule_talkie_magellan_x');
    assert.equal(why.event.type, 'media.discovered');
  });
});

describe('Golden #2 — Appel 20h17', () => {
  const def = loadFixture('appel20h17.json');

  function prepareCassetteConsumed(runtime) {
    runtime.mediaStates.cassette = {
      discovered: true,
      unlocked: true,
      opened: true,
      consumed: true,
      visible: true,
    };
  }

  it('Bureau @ 20:17 + cassette consommée → téléphone + audio + var', () => {
    const runtime = lantern.createRuntime({ channel: 'lab' });
    prepareCassetteConsumed(runtime);

    const r = lantern.handleEvent(def, runtime, {
      type: 'time.schedule',
      source: 'scheduler',
      at: AT_2017,
      clientEventId: 'sched-ok',
      payload: {
        scheduleId: 'appel_20h17',
        lat: COORDS.bureau.lat,
        lng: COORDS.bureau.lng,
      },
    });

    assert.ok(uiKinds(r).includes('ring_phone'));
    assert.ok(uiKinds(r).includes('play_media'));
    assert.equal(playedLabel(r), 'Appel_20h17');
    assert.equal(runtime.vars.appel_20h17_deja_recu, true);
    assert.equal(runtime.vars.phone_call_01_missed, false);
    assert.equal(r.rulesFired.some((f) => f.ruleId === 'rule_appel_20h17'), true);
    assert.equal(runtime.occurrenceLedger.rule_appel_20h17.exhausted, true);
  });

  it('hors Bureau @ 20:17 → appel manqué (expire) + flag', () => {
    const runtime = lantern.createRuntime({ channel: 'lab' });
    prepareCassetteConsumed(runtime);

    const r = lantern.handleEvent(def, runtime, {
      type: 'time.schedule',
      source: 'scheduler',
      at: AT_2017,
      clientEventId: 'sched-miss',
      payload: {
        scheduleId: 'appel_20h17',
        lat: COORDS.far.lat,
        lng: COORDS.far.lng,
      },
    });

    assert.ok(!uiKinds(r).includes('ring_phone'));
    assert.equal(runtime.vars.phone_call_01_missed, true);
    assert.equal(runtime.vars.appel_20h17_deja_recu, false);
    assert.equal(runtime.occurrenceLedger.rule_appel_20h17.exhausted, true);
    assert.ok(r.trace.misses.some((m) => m.ruleId === 'rule_appel_20h17'));

    // Unique : un second schedule ne sonne plus
    const r2 = lantern.handleEvent(def, runtime, {
      type: 'time.schedule',
      source: 'scheduler',
      at: AT_2017,
      clientEventId: 'sched-miss-2',
      payload: {
        scheduleId: 'appel_20h17',
        lat: COORDS.bureau.lat,
        lng: COORDS.bureau.lng,
      },
    });
    assert.ok(!uiKinds(r2).includes('ring_phone'));
  });

  it('Bureau @ 20:17 sans cassette → pas de sonnerie (pas de miss geo)', () => {
    const runtime = lantern.createRuntime();
    // cassette non consommée
    const r = lantern.handleEvent(def, runtime, {
      type: 'time.schedule',
      source: 'scheduler',
      at: AT_2017,
      clientEventId: 'sched-nocass',
      payload: {
        scheduleId: 'appel_20h17',
        lat: COORDS.bureau.lat,
        lng: COORDS.bureau.lng,
      },
    });
    assert.ok(!uiKinds(r).includes('ring_phone'));
    assert.equal(runtime.vars.phone_call_01_missed, false);
    // pas d'exhaust par miss geo
    assert.notEqual(runtime.occurrenceLedger.rule_appel_20h17?.exhausted, true);
  });
});

describe('Golden — même moteur, deux aventures sans code spécifique', () => {
  it('charge Magellan puis Appel 20h17 via le même handleEvent', () => {
    const mag = loadFixture('magellan.json');
    const appel = loadFixture('appel20h17.json');

    const rt1 = lantern.createRuntime();
    const a = lantern.handleEvent(mag, rt1, {
      type: 'media.discovered',
      at: AT_1707,
      payload: { mediaItemId: 'talkie_magellan', ...COORDS.arr13 },
    });
    assert.equal(playedLabel(a), 'Monsieur X');

    const rt2 = lantern.createRuntime();
    rt2.mediaStates.cassette = {
      discovered: true,
      unlocked: true,
      opened: true,
      consumed: true,
      visible: true,
    };
    const b = lantern.handleEvent(appel, rt2, {
      type: 'time.schedule',
      at: AT_2017,
      payload: { scheduleId: 'appel_20h17', ...COORDS.bureau },
    });
    assert.ok(uiKinds(b).includes('ring_phone'));
  });
});
