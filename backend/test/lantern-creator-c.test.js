/**
 * Creator Phase C — Atelier créateur (éditeur, validations, brouillons, parcours)
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
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

describe('Creator Phase C — validations', () => {
  it('détecte un étage inatteignable', () => {
    const adv = {
      id: 'adv_test_unreachable',
      title: 'Test inatteignable',
      floors: [
        {
          index: 0,
          title: 'Entrée',
          situations: [
            {
              id: 'f0_a',
              letter: 'A',
              title: 'Start',
              trigger: { kind: 'run_started' },
              thenActions: [{ kind: 'notify', message: 'hi' }],
            },
          ],
          // pas de unlockNext
        },
        {
          index: 5,
          title: 'Orphelin',
          situations: [
            {
              id: 'f5_a',
              letter: 'A',
              title: 'Jamais',
              trigger: { kind: 'run_started' },
              thenActions: [{ kind: 'notify', message: 'x' }],
            },
          ],
        },
      ],
    };
    const out = creator.validateAdventureOnly(adv);
    assert.ok(out.warnings.some((w) => w.code === 'UNREACHABLE_FLOOR'));
  });

  it('détecte contradiction flag true/false', () => {
    const adv = {
      id: 'adv_contra',
      title: 'Contra',
      floors: [
        {
          index: 0,
          title: 'E0',
          situations: [
            {
              id: 'f0_a',
              letter: 'A',
              title: 'Bad',
              trigger: { kind: 'run_started' },
              conditions: [
                { kind: 'flag_true', varId: 'x' },
                { kind: 'flag_false', varId: 'x' },
              ],
              thenActions: [{ kind: 'notify', message: 'nope' }],
            },
          ],
        },
      ],
    };
    const out = creator.validateAdventureOnly(adv);
    assert.ok(out.warnings.some((w) => w.code === 'CONTRADICTION'));
  });
});

describe('Creator Phase C — brouillons', () => {
  it('sauve et recharge un brouillon', () => {
    const adv = creator.loadAdventure('lanterne_de_mira');
    const mini = {
      ...adv,
      id: 'draft_test_mira_mini',
      title: 'Brouillon test Mira',
      floors: adv.floors.slice(0, 2),
    };
    const saved = creator.drafts.saveDraft({
      adventure: mini,
      title: mini.title,
      sourceAdventureId: adv.id,
    });
    assert.ok(saved.id);
    const loaded = creator.drafts.loadDraft(saved.id);
    assert.equal(loaded.adventure.floors.length, 2);
    creator.drafts.deleteDraft(saved.id);
  });

  it('API drafts GET/POST', async () => {
    const adv = {
      id: 'adv_api_draft',
      title: 'API Draft',
      floors: [
        {
          index: 0,
          title: 'E0',
          situations: [
            {
              id: 'f0_a',
              letter: 'A',
              title: 'Go',
              trigger: { kind: 'run_started' },
              thenActions: [{ kind: 'notify', message: 'ok' }],
            },
          ],
        },
      ],
    };
    const post = await h.api.post(
      '/api/admin/lantern-lab/creator/drafts',
      { adventure: adv, title: 'API Draft' },
      simOpts()
    );
    assert.equal(post.status, 200);
    assert.ok(post.body.draft.id);

    const list = await h.api.get('/api/admin/lantern-lab/creator/drafts', simOpts());
    assert.equal(list.status, 200);
    assert.ok(list.body.drafts.some((d) => d.id === post.body.draft.id));

    const one = await h.api.get(
      `/api/admin/lantern-lab/creator/drafts/${post.body.draft.id}`,
      simOpts()
    );
    assert.equal(one.status, 200);
    assert.equal(one.body.adventure.title, 'API Draft');

    creator.drafts.deleteDraft(post.body.draft.id);
  });

  it('POST adventures/blank crée une aventure compilable', async () => {
    const res = await h.api.post('/api/admin/lantern-lab/creator/adventures/blank', {}, simOpts());
    assert.equal(res.status, 200);
    assert.ok(res.body.adventure.id);
    assert.ok(res.body.adventure.mediaItems.some((m) => m.role === 'imposed'));
    assert.equal(res.body.adventure.floors[0].situations[0].thenActions[0].kind, 'unlock_bureau');
    assert.ok(!res.body.warnings.some((w) => w.level === 'error'));
  });

  it('POST adventures/blank accepte un titre', async () => {
    const res = await h.api.post('/api/admin/lantern-lab/creator/adventures/blank', { title: 'La lanterne de Mira' }, simOpts());
    assert.equal(res.status, 200);
    assert.equal(res.body.adventure.title, 'La lanterne de Mira');
  });
});

describe('Creator Phase C — parcours session', () => {
  it('start + step conserve l’état (étage 0 → média imposé)', () => {
    const adv = creator.loadAdventure('lanterne_de_mira');
    const start = creator.startJourneySession(adv);
    assert.ok(start.sessionId);
    assert.ok(start.floorsOpen.includes(0));

    const step = creator.stepJourneySession(start.sessionId, {
      now: '2026-08-12T12:00:00+02:00',
      event: {
        type: 'media.consumed',
        source: 'lab_sim',
        payload: { mediaItemId: 'media_impose' },
        at: '2026-08-12T12:00:00+02:00',
      },
      runtime: {
        mediaStates: {
          media_impose: { discovered: true, unlocked: true, opened: true, consumed: true },
        },
      },
    });
    assert.ok(step.humanSteps.length >= 1);
    assert.equal(step.humanSteps[0].human.status, 'triggered');
  });

  it('API journey start/step', async () => {
    const adv = creator.loadAdventure('lanterne_de_mira');
    const start = await h.api.post(
      '/api/admin/lantern-lab/creator/adventures/journey/start',
      { adventure: adv },
      simOpts()
    );
    assert.equal(start.status, 200);
    assert.ok(start.body.sessionId);

    const step = await h.api.post(
      '/api/admin/lantern-lab/creator/adventures/journey/step',
      {
        sessionId: start.body.sessionId,
        event: {
          type: 'media.consumed',
          source: 'lab_sim',
          payload: { mediaItemId: 'lettre' },
          at: '2026-08-12T12:00:00+02:00',
        },
        now: '2026-08-12T12:00:00+02:00',
        runtime: {
          vars: { etage_0_open: true, etage_1_open: true },
          mediaStates: {
            lettre: { consumed: true, discovered: true, unlocked: true, opened: true },
          },
        },
      },
      simOpts()
    );
    assert.equal(step.status, 200);
    assert.ok(Array.isArray(step.body.floorsOpen));
  });
});

describe('Creator Phase C — UI', () => {
  it('sert atelier avec onglets Éditer / Parcours', async () => {
    const { baseUrl } = await h.startServer();
    const res = await fetch(`${baseUrl}/lantern-lab/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Atelier'));
    assert.ok(html.includes('QUAND'));
    assert.ok(html.includes('Sauver brouillon'));
    assert.ok(html.includes('Parcours'));
    assert.ok(html.includes('Ontologie'));
  });

  it('health stage CreatorC', async () => {
    const res = await h.api.get('/api/admin/lantern-lab/health', simOpts());
    assert.equal(res.status, 200);
    assert.match(res.body.stage, /Creator[CD]|E6/);
  });
});

describe('Creator Phase C — compile OR groups', () => {
  it('compile situation avec groupe OU', () => {
    const sit = {
      id: 'sit_or',
      title: 'OU test',
      trigger: { kind: 'run_started' },
      conditions: [
        {
          op: 'or',
          children: [
            { kind: 'flag_true', varId: 'a' },
            { kind: 'flag_true', varId: 'b' },
          ],
        },
      ],
      thenActions: [{ kind: 'notify', message: 'ok' }],
    };
    const { compiled } = creator.compileAndPrepare(sit);
    assert.equal(compiled.rules.length, 1);
    const cond = compiled.rules[0].condition;
    // Should contain an or somewhere
    const hasOr = JSON.stringify(cond).includes('"op":"or"');
    assert.ok(hasOr);
  });
});
