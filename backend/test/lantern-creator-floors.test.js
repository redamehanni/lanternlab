/**
 * Creator Phase B — Étages de situation → même Lantern Engine
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

describe('Creator Phase B — étages Mira', () => {
  it('charge Lanterne de Mira avec plusieurs étages et situations', () => {
    const adv = creator.loadAdventure('lanterne_de_mira');
    assert.equal(adv.title, 'Lanterne de Mira');
    assert.ok(adv.floors.length >= 10);
    const f1 = adv.floors.find((f) => f.index === 1);
    assert.equal(f1.situations.length, 3);
    assert.deepEqual(
      f1.situations.map((s) => s.letter),
      ['A', 'B', 'C']
    );
  });

  it('compile aventure → definition moteur valide (rules > 0)', () => {
    const adv = creator.loadAdventure('lanterne_de_mira');
    const compiled = creator.compileAdventureFull(adv);
    assert.ok(compiled.definition.rules.length > 15);
    assert.ok(compiled.definition.variables.some((v) => v.id === 'etage_0_open'));
    assert.ok(compiled.definition.variables.some((v) => v.id === 'etage_2_open'));
    assert.ok(compiled.tree.nodes.some((n) => n.kind === 'floor'));
    assert.ok(compiled.tree.edges.some((e) => e.kind === 'transition'));
  });

  it('liste et arbre partagent les mêmes situations', () => {
    const bundle = creator.getAdventureBundle('lanterne_de_mira');
    const listIds = bundle.list.floors.flatMap((f) => f.situations.map((s) => s.id));
    const treeSit = bundle.tree.nodes.filter((n) => n.kind === 'situation').map((n) => n.id);
    for (const id of listIds) {
      assert.ok(treeSit.includes(id), `arbre doit contenir ${id}`);
    }
  });

  it('test étage 0 — média imposé → bureau', () => {
    const adv = creator.loadAdventure('lanterne_de_mira');
    const out = creator.testAdventureSituation(adv, 'f0_a', {
      now: '2026-08-10T12:00:00+02:00',
      runtime: {
        vars: { etage_0_open: true },
        mediaStates: {
          media_impose: { discovered: true, unlocked: true, opened: true, consumed: true },
        },
      },
      event: {
        type: 'media.consumed',
        source: 'lab_sim',
        payload: { mediaItemId: 'media_impose' },
        at: '2026-08-10T12:00:00+02:00',
      },
    });
    assert.equal(out.humanSteps[0].human.status, 'triggered');
    assert.ok(
      out.humanSteps[0].human.whatHappens.some(
        (w) => /Bureau|bureau|Message/i.test(w.text) || w.icon === '💬'
      )
    );
  });

  it('test étage 2 — Rue de Paradis + médias → journal', () => {
    const adv = creator.loadAdventure('lanterne_de_mira');
    const out = creator.testAdventureSituation(adv, 'f2_a', {
      now: '2026-08-10T18:00:00+02:00',
      lat: 48.8742,
      lng: 2.3548,
      runtime: {
        vars: { etage_0_open: true, etage_1_open: true, etage_2_open: true },
        mediaStates: {
          media_impose: { consumed: true, discovered: true, unlocked: true, opened: true },
          lettre: { consumed: true, discovered: true, unlocked: true, opened: true },
          polaroid: { consumed: true, discovered: true, unlocked: true, opened: true },
          cle_usb: { consumed: true, discovered: true, unlocked: true, opened: true },
        },
      },
      event: {
        type: 'geo.heartbeat',
        source: 'lab_sim',
        payload: { lat: 48.8742, lng: 2.3548 },
        at: '2026-08-10T18:00:00+02:00',
      },
    });
    assert.equal(out.humanSteps[0].human.status, 'triggered');
    assert.ok(
      out.humanSteps[0].human.whatHappens.some((w) => /journal|PIZZA|note/i.test(w.text))
    );
  });

  it('test étage 8 — branches destruction (trop tôt vs OK)', () => {
    const adv = creator.loadAdventure('lanterne_de_mira');
    const early = creator.testAdventureSituation(adv, 'f8_a', {
      now: '2026-08-10T20:00:00+02:00',
      runtime: {
        vars: {
          etage_0_open: true,
          etage_8_open: true,
        },
        mediaStates: {
          usb_video: { consumed: false },
        },
      },
      event: {
        type: 'choice.made',
        source: 'lab_sim',
        payload: { choiceId: 'detruire_cle_usb', value: true },
        at: '2026-08-10T20:00:00+02:00',
      },
    });
    assert.equal(early.humanSteps[0].human.status, 'triggered');
    assert.ok(
      early.humanSteps[0].human.whatHappens.some((w) => /visionné|détruire/i.test(w.text))
    );

    const ok = creator.testAdventureSituation(adv, 'f8_b', {
      now: '2026-08-10T20:00:00+02:00',
      runtime: {
        vars: { etage_0_open: true, etage_8_open: true },
        mediaStates: {
          usb_video: { consumed: true, discovered: true, unlocked: true, opened: true },
          usb_lettre_mira: { consumed: true, discovered: true, unlocked: true, opened: true },
          carte_collection: { consumed: true, discovered: true, unlocked: true, opened: true },
        },
      },
      event: {
        type: 'choice.made',
        source: 'lab_sim',
        payload: { choiceId: 'detruire_cle_usb', value: true },
        at: '2026-08-10T20:00:00+02:00',
      },
    });
    assert.equal(ok.humanSteps[0].human.status, 'triggered');
    assert.ok(ok.technical.state.vars.cle_usb_detruite === true);
  });

  it('code PIZZA déverrouille contenus USB', () => {
    const adv = creator.loadAdventure('lanterne_de_mira');
    const out = creator.testAdventureSituation(adv, 'f4_a', {
      now: '2026-08-10T19:00:00+02:00',
      runtime: {
        vars: {
          etage_0_open: true,
          etage_4_open: true,
          code_pizza_attendu: true,
        },
      },
      event: {
        type: 'choice.made',
        source: 'lab_sim',
        payload: { choiceId: 'usb_code', value: 'PIZZA' },
        at: '2026-08-10T19:00:00+02:00',
      },
    });
    assert.equal(out.humanSteps[0].human.status, 'triggered');
    assert.equal(out.technical.state.vars.ordinateur_deverrouille, true);
  });
});

describe('Creator Phase B — API HTTP', () => {
  it('GET adventures + GET mira bundle', async () => {
    const list = await h.api.get('/api/admin/lantern-lab/creator/adventures', simOpts());
    assert.equal(list.status, 200);
    assert.ok(list.body.adventures.some((a) => a.id === 'lanterne_de_mira'));

    const one = await h.api.get(
      '/api/admin/lantern-lab/creator/adventures/lanterne_de_mira',
      simOpts()
    );
    assert.equal(one.status, 200);
    assert.equal(one.body.adventure.id, 'lanterne_de_mira');
    assert.ok(one.body.list.floors.length >= 10);
    assert.ok(one.body.tree.nodes.length > 0);
  });

  it('POST compile adventure', async () => {
    const adv = creator.loadAdventure('lanterne_de_mira');
    const res = await h.api.post(
      '/api/admin/lantern-lab/creator/adventures/compile',
      { adventure: adv },
      simOpts()
    );
    assert.equal(res.status, 200);
    assert.ok(res.body.enginePreview.rulesCount > 10);
  });

  it('POST test-situation sans JSON créateur brut côté client', async () => {
    const adv = creator.loadAdventure('lanterne_de_mira');
    const res = await h.api.post(
      '/api/admin/lantern-lab/creator/adventures/test-situation',
      {
        adventure: adv,
        situationId: 'f1_a',
        test: {
          now: '2026-08-10T12:00:00+02:00',
          runtime: {
            vars: { etage_0_open: true, etage_1_open: true },
            mediaStates: {
              lettre: { consumed: true, discovered: true, unlocked: true, opened: true },
            },
          },
          event: {
            type: 'media.consumed',
            source: 'lab_sim',
            payload: { mediaItemId: 'lettre' },
            at: '2026-08-10T12:00:00+02:00',
          },
        },
      },
      simOpts()
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.humanSteps[0].human.status, 'triggered');
  });

  it('sert UI étages /lantern-lab/', async () => {
    const { baseUrl } = await h.startServer();
    const res = await fetch(`${baseUrl}/lantern-lab/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Étages'));
    assert.ok(html.includes('Mode Créateur'));
  });
});
