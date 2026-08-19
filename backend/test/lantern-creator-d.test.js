/**
 * Creator Phase D — Inventaire (objets, lieux, balises, interactions)
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

function emptyAdventure() {
  return {
    id: 'adv_inventaire_test',
    title: 'Aventure neuve',
    timezone: 'Europe/Paris',
    floors: [
      {
        index: 0,
        title: 'Entrée',
        situations: [],
      },
    ],
  };
}

describe('Creator Phase D — helpers inventaire', () => {
  it('ajoute objet + contenu + lieu + balise + bouton', () => {
    const adv = emptyAdventure();
    const content = creator.inventory.addMediaContent(adv, { label: 'Texte lettre', kind: 'text', body: 'Cher ami…' });
    const item = creator.inventory.addMediaItem(adv, {
      label: 'Lettre d’adieu',
      skin: 'letter',
      contentId: content.id,
    });
    const zone = creator.inventory.addZone(adv, { presetId: 'quai_tournelle' });
    const beacon = creator.inventory.addBeacon(adv, { label: 'Pont Neuf', channel: 'qr' });
    const btn = creator.inventory.addInteraction(adv, { kind: 'button', label: 'Ouvrir' });
    assert.ok(item.id);
    assert.equal(item.skin, 'letter');
    assert.equal(zone.label, 'Quai de la Tournelle');
    assert.ok(zone.center.lat);
    assert.equal(beacon.channel, 'qr');
    assert.equal(btn.kind, 'button');
    assert.equal(creator.inventory.inventorySummary(adv).mediaItems, 1);
  });

  it('média imposé est une nature distincte des items média', () => {
    const adv = emptyAdventure();
    const imposed = creator.inventory.addImposedMedia(adv, { label: 'Média imposé' });
    const letter = creator.inventory.addMediaItem(adv, { label: 'Lettre d’adieu', skin: 'letter' });
    assert.equal(imposed.policy, 'imposed');
    assert.equal(imposed.role, 'imposed');
    assert.equal(imposed.skin, 'vhs');
    assert.equal(creator.inventory.isImposedMedia(imposed), true);
    assert.equal(creator.inventory.isImposedMedia(letter), false);
    const sum = creator.inventory.inventorySummary(adv);
    assert.equal(sum.imposedMedia, 1);
    assert.equal(sum.mediaItems, 2);

    const viaApi = creator.applyInventoryAdd(emptyAdventure(), 'imposed', { label: 'Cassette de départ' });
    assert.equal(viaApi.added.role, 'imposed');
    assert.equal(viaApi.added.policy, 'imposed');
    assert.equal(viaApi.summary.imposedMedia, 1);
  });

  it('Mira : media_impose est reconnu comme média imposé (policy required)', () => {
    const adv = creator.loadAdventure('lanterne_de_mira');
    const imposed = (adv.mediaItems || []).find((m) => m.id === 'media_impose');
    assert.ok(imposed);
    assert.equal(creator.inventory.isImposedMedia(imposed), true);
    assert.equal(creator.inventory.inventorySummary(adv).imposedMedia, 1);
  });

  it('objets du bureau : CRUD + déverrouillage groupé', () => {
    const adv = emptyAdventure();
    creator.inventory.addImposedMedia(adv, { id: 'media_impose', label: 'Média imposé' });
    const lettre = creator.inventory.addBureauMedia(adv, { id: 'lettre', label: 'Lettre d’adieu', skin: 'letter' });
    const usb = creator.inventory.addBureauMedia(adv, { id: 'cle_usb', label: 'Clé USB', skin: 'usb' });
    assert.equal(lettre.role, 'bureau');
    assert.equal(usb.slot, 'bureau');
    assert.equal(creator.inventory.isBureauMedia(lettre), true);
    assert.equal(creator.inventory.isBureauMedia(adv.mediaItems.find((m) => m.id === 'media_impose')), false);
    assert.equal(creator.inventory.inventorySummary(adv).bureauMedia, 2);

    const renamed = creator.inventory.updateMediaItem(adv, 'lettre', { label: 'Lettre de la tante' });
    assert.equal(renamed.label, 'Lettre de la tante');

    adv.floors[0].situations.push({
      id: 'f0_a',
      letter: 'A',
      title: 'Sas',
      trigger: { kind: 'media_consumed', mediaItemId: 'media_impose', label: 'Média imposé' },
      thenActions: [{ kind: 'unlock_bureau' }],
    });
    const compiled = creator.compileAdventureFull(adv);
    const main = compiled.definition.rules.find((r) => r.id && r.id.includes('f0_a'));
    assert.ok(main, 'règle étage 0');
    assert.ok(main.actions.some((a) => a.type === 'media.unlock' && a.params.mediaItemId === 'lettre'));
    assert.ok(main.actions.some((a) => a.type === 'media.showItem' && a.params.mediaItemId === 'cle_usb'));
    assert.ok(main.actions.some((a) => a.type === 'var.set' && a.params.varId === 'bureau_accessible'));
    assert.ok(compiled.definition.variables.some((v) => v.id === 'bureau_accessible'));

    const now = '2026-08-14T12:00:00+02:00';
    const session = creator.startJourneySession(adv, { label: 'test bureau' });
    const out = creator.stepJourneySession(session.sessionId, {
      now,
      event: {
        type: 'media.consumed',
        at: now,
        payload: { mediaItemId: 'media_impose' },
      },
    });
    assert.equal(out.state.mediaStates.lettre?.unlocked, true);
    assert.equal(out.state.mediaStates.lettre?.visible, true);
    assert.equal(out.state.mediaStates.cle_usb?.unlocked, true);
    assert.equal(out.state.vars.bureau_accessible, true);
  });

  it('compile une situation qui consomme un objet créé (pas Mira)', () => {
    const adv = emptyAdventure();
    creator.inventory.addMediaItem(adv, { id: 'lettre_adieu', label: 'Lettre d’adieu', skin: 'letter' });
    adv.floors[0].situations.push({
      id: 'f0_a',
      letter: 'A',
      title: 'Lire la lettre',
      trigger: { kind: 'media_consumed', mediaItemId: 'lettre_adieu', label: 'Lettre d’adieu' },
      thenActions: [{ kind: 'notify', message: 'La lettre est lue.' }],
    });
    const compiled = creator.compileAdventureFull(adv);
    assert.ok(compiled.definition.mediaItems.some((m) => m.id === 'lettre_adieu'));
    assert.ok(compiled.definition.rules.length >= 1);

    const out = creator.testAdventureSituation(adv, 'f0_a', {
      now: '2026-08-13T12:00:00+02:00',
      runtime: {
        vars: { etage_0_open: true },
        mediaStates: {
          lettre_adieu: { consumed: true, discovered: true, unlocked: true, opened: true },
        },
      },
      event: {
        type: 'media.consumed',
        source: 'lab_sim',
        payload: { mediaItemId: 'lettre_adieu' },
        at: '2026-08-13T12:00:00+02:00',
      },
    });
    assert.equal(out.humanSteps[0].human.status, 'triggered');
  });

  it('signale un objet référencé mais absent du matériel', () => {
    const adv = emptyAdventure();
    adv.floors[0].situations.push({
      id: 'f0_a',
      letter: 'A',
      title: 'Fantôme',
      trigger: { kind: 'media_consumed', mediaItemId: 'nexiste_pas' },
      thenActions: [{ kind: 'notify', message: 'x' }],
    });
    const out = creator.validateAdventureOnly(adv);
    assert.ok(out.warnings.some((w) => w.code === 'MISSING_MEDIA_ITEM'));
  });

  it('Mira n’a pas d’erreur de matériel manquant', () => {
    const adv = creator.loadAdventure('lanterne_de_mira');
    const out = creator.validateAdventureOnly(adv);
    assert.ok(!out.warnings.some((w) => w.code === 'MISSING_MEDIA_ITEM'));
    assert.ok(!out.warnings.some((w) => w.code === 'MISSING_ZONE'));
  });

  it('ajoute un contenant protégé par code et le compile sans situation manuelle', () => {
    const adv = emptyAdventure();
    creator.inventory.addMediaItem(adv, {
      id: 'lettre_tante',
      label: 'Lettre de la tante',
      skin: 'letter',
    });
    const box = creator.inventory.addContainer(adv, {
      id: 'boite_lea',
      label: 'Boîte de Léa',
      contains: ['lettre_tante'],
      lockWithCode: true,
      code: 'LEA7',
    });
    assert.equal(box.lockWithCode, true);
    assert.equal(box.code, 'LEA7');
    assert.equal(creator.inventory.inventorySummary(adv).containers, 1);
    const letter = adv.mediaItems.find((m) => m.id === 'lettre_tante');
    assert.equal(letter.policy, 'unlockable');

    const compiled = creator.compileAdventureFull(adv);
    assert.ok(compiled.definition.rules.some((r) => r.id === 'container_boite_lea_ask_code'));
    assert.ok(compiled.definition.rules.some((r) => r.id === 'container_boite_lea_unlock'));
    assert.ok(compiled.definition.variables.some((v) => v.id === 'container_boite_lea_open'));
    assert.ok(!compiled.warnings.some((w) => w.level === 'error'));
  });

  it('ouvrir la boîte + bon code déverrouille la lettre (mauvais code : non)', () => {
    const adv = emptyAdventure();
    creator.inventory.addMediaItem(adv, {
      id: 'lettre_tante',
      label: 'Lettre de la tante',
      skin: 'letter',
    });
    const box = creator.inventory.addContainer(adv, {
      id: 'boite_lea',
      label: 'Boîte de Léa',
      contains: ['lettre_tante'],
      lockWithCode: true,
      code: 'LEA7',
    });
    const now = '2026-08-14T12:00:00+02:00';
    const session = creator.startJourneySession(adv, { label: 'test contenant' });

    const asked = creator.stepJourneySession(session.sessionId, {
      now,
      event: {
        type: 'media.consumed',
        at: now,
        payload: { mediaItemId: 'boite_lea' },
      },
    });
    const firedAsk = asked.humanSteps?.[0]?.technical?.rulesFired || asked.technical.steps?.[0]?.rulesFired || [];
    assert.ok(
      firedAsk.some((r) => (r.ruleId || r.id) === 'container_boite_lea_ask_code'),
      `attendu ask_code, reçu ${JSON.stringify(firedAsk)}`
    );
    assert.equal(asked.state.mediaStates.lettre_tante?.unlocked, false);

    const wrong = creator.stepJourneySession(session.sessionId, {
      now,
      event: {
        type: 'choice.made',
        at: now,
        payload: { choiceId: box.codeChoiceId, value: 'XXXX' },
      },
    });
    const firedWrong = wrong.humanSteps?.[0]?.technical?.rulesFired || wrong.technical.steps?.[0]?.rulesFired || [];
    assert.ok(firedWrong.some((r) => (r.ruleId || r.id) === 'container_boite_lea_wrong'));
    assert.equal(wrong.state.mediaStates.lettre_tante?.unlocked, false);

    const ok = creator.stepJourneySession(session.sessionId, {
      now,
      event: {
        type: 'choice.made',
        at: now,
        payload: { choiceId: box.codeChoiceId, value: 'LEA7' },
      },
    });
    const firedOk = ok.humanSteps?.[0]?.technical?.rulesFired || ok.technical.steps?.[0]?.rulesFired || [];
    assert.ok(firedOk.some((r) => (r.ruleId || r.id) === 'container_boite_lea_unlock'));
    assert.equal(ok.state.mediaStates.lettre_tante?.unlocked, true);
    assert.equal(ok.state.mediaStates.lettre_tante?.visible, true);
    assert.equal(ok.state.vars.container_boite_lea_open, true);
  });

  it('contenant sans code s’ouvre à la consommation', () => {
    const adv = emptyAdventure();
    creator.inventory.addMediaItem(adv, { id: 'polaroid_1', label: 'Polaroid', skin: 'polaroid' });
    creator.inventory.addContainer(adv, {
      id: 'coffret',
      label: 'Coffret',
      contains: ['polaroid_1'],
      lockWithCode: false,
    });
    const now = '2026-08-14T12:00:00+02:00';
    const session = creator.startJourneySession(adv);
    const out = creator.stepJourneySession(session.sessionId, {
      now,
      event: { type: 'media.consumed', at: now, payload: { mediaItemId: 'coffret' } },
    });
    assert.equal(out.state.mediaStates.polaroid_1?.unlocked, true);
  });

  it('boîte au bureau : ranger un objet sans le retirer de sa famille', () => {
    const adv = emptyAdventure();
    const letter = creator.inventory.addBureauMedia(adv, { id: 'lettre', label: 'Lettre d’adieu' });
    const box = creator.inventory.addContainer(adv, {
      id: 'boite_bureau',
      label: 'Boîte du bureau',
      placement: 'bureau',
      code: '12',
    });
    const media = adv.mediaItems.find((m) => m.id === 'boite_bureau');
    assert.equal(creator.inventory.isBureauMedia(media), true);
    assert.equal(creator.inventory.isContainerMedia(media, adv), true);
    assert.equal(creator.inventory.objectFamily(media, adv), 'container');
    assert.equal(creator.inventory.listBureauItems(adv).some((m) => m.id === 'boite_bureau'), true);

    creator.inventory.stashInContainer(adv, box.id, letter.id);
    assert.deepEqual(box.contains, ['lettre']);
    assert.equal(creator.inventory.isBureauMedia(letter), true);
    assert.equal(creator.inventory.objectFamily(letter, adv), 'bureau');
    assert.equal(creator.inventory.containersHolding(adv, 'lettre')[0].id, box.id);

    creator.inventory.setContainerCode(adv, box.id, '');
    assert.equal(box.lockWithCode, false);
    assert.equal(box.code, null);
  });

  it('objet recouvrable rangé dans une boîte reste recouvrable', () => {
    const adv = emptyAdventure();
    const talkie = creator.inventory.addRecoverableMedia(adv, { id: 'talkie', label: 'Talkie' });
    const box = creator.inventory.addContainer(adv, {
      id: 'sac',
      label: 'Sac',
      placement: 'recoverable',
      floorHint: 3,
    });
    creator.inventory.stashInContainer(adv, box.id, talkie.id);
    assert.equal(creator.inventory.isRecoverableMedia(talkie, adv), true);
    assert.equal(creator.inventory.objectFamily(talkie, adv), 'recoverable');
    assert.equal(creator.inventory.objectFamily(adv.mediaItems.find((m) => m.id === 'sac'), adv), 'container');
    assert.equal(creator.inventory.inferItemFloor(adv, adv.mediaItems.find((m) => m.id === 'sac')), 3);
  });

  it('clé USB, PC, pochette et casier sont des contenants ; le PC range des liens http', () => {
    const adv = emptyAdventure();
    const talkie = creator.inventory.addRecoverableMedia(adv, { id: 'talkie', label: 'Talkie' });
    const usb = creator.inventory.addContainer(adv, {
      id: 'cle_usb',
      label: 'Clé USB de Tiffany',
      containerKind: 'usb',
      placement: 'bureau',
    });
    assert.equal(usb.containerKind, 'usb');
    assert.equal(usb.lockWithCode, false);
    assert.equal(creator.inventory.isContainerMedia(adv.mediaItems.find((m) => m.id === 'cle_usb'), adv), true);

    const pc = creator.inventory.addContainer(adv, {
      id: 'pc_bureau',
      label: 'PC du bureau',
      containerKind: 'pc',
      placement: 'bureau',
      code: 'AZERTY',
    });
    const link = creator.inventory.addContainerLink(adv, pc.id, {
      label: 'Partenaire',
      url: 'exemple.com/lanterne',
    });
    assert.match(link.url, /^https:\/\/exemple.com\/lanterne/);
    assert.equal(pc.links.length, 1);
    assert.throws(() => creator.inventory.addContainerLink(adv, usb.id, { url: 'https://x.test' }));

    const folder = creator.inventory.addContainer(adv, {
      id: 'pochette',
      label: 'Dossier A4',
      containerKind: 'folder',
    });
    const locker = creator.inventory.addContainer(adv, {
      id: 'casier_1',
      label: 'Casier 12',
      containerKind: 'locker',
      floorHint: 2,
    });
    creator.inventory.stashInContainer(adv, locker.id, talkie.id);
    assert.equal(creator.inventory.objectFamily(talkie, adv), 'recoverable');
    assert.equal(locker.contains[0], 'talkie');

    const compiled = creator.compileAdventureFull(adv);
    assert.ok(compiled.definition.rules.some((r) => r.id === 'container_pc_bureau_ask_code'));
    assert.ok(
      compiled.definition.rules.some((r) =>
        (r.actions || []).some((a) => a.type === 'journal.addNote' && String(a.params.message || '').includes(link.url))
      )
    );
    assert.equal(folder.containerKind, 'folder');
    assert.equal(creator.inventory.resolveContainerKind(locker), 'locker');
  });

  it('objet recouvrable : déblocage par code + détails + analyses', () => {
    const adv = emptyAdventure();
    const item = creator.inventory.addRecoverableMedia(adv, {
      id: 'talkie_mag',
      label: 'Talkie Magellan',
      skin: 'talkie',
      floorHint: 2,
      unlockBy: { kind: 'code', code: 'MAG' },
      analyses: [],
    });
    assert.equal(item.role, 'recoverable');
    assert.equal(creator.inventory.isRecoverableMedia(item, adv), true);
    assert.equal(item.unlockBy.kind, 'code');
    assert.equal(item.unlockBy.code, 'MAG');
    assert.ok(adv.interactions.some((i) => i.id === item.unlockBy.choiceId && i.expected === 'MAG'));
    assert.equal(creator.inventory.inferItemFloor(adv, item), 2);

    creator.inventory.addItemDetail(adv, 'talkie_mag', 'C’est dans cette vidéo que le joueur trouve le code MAG.');
    creator.inventory.updateMediaItem(adv, 'talkie_mag', {
      details: [
        { text: 'C’est dans cette vidéo que le joueur trouve le code MAG.' },
        { text: 'Le talkie sonne à l’étage 2.' },
      ],
      analyses: [
        { kind: 'observe', text: 'Le talkie s’allume. Écoute.' },
        { kind: 'journal', text: 'Le talkie a parlé d’un rendez-vous.' },
      ],
      mutations: [{ buttonLabel: 'Casser la clé USB', floorIndex: 5, newState: 'broken' }],
    });
    assert.equal(adv.mediaItems.find((m) => m.id === 'talkie_mag').details.length, 2);
    assert.equal(adv.mediaItems.find((m) => m.id === 'talkie_mag').analyses.length, 2);

    const compiled = creator.compileAdventureFull(adv);
    assert.ok(compiled.definition.rules.some((r) => r.id === 'rec_talkie_mag_unlock_code'));
    const analyse = compiled.definition.rules.find((r) => r.id === 'analyse_item_talkie_mag');
    assert.ok(analyse);
    assert.ok(analyse.actions.some((a) => a.type === 'ui.observe'));
    assert.ok(analyse.actions.some((a) => a.type === 'journal.addNote'));
    assert.ok(compiled.definition.rules.some((r) => r.id === 'mut_talkie_mag_0'));

    const now = '2026-08-14T12:00:00+02:00';
    const session = creator.startJourneySession(adv);
    assert.equal(session.state.mediaStates.talkie_mag?.unlocked, false);

    const bad = creator.stepJourneySession(session.sessionId, {
      now,
      event: { type: 'choice.made', at: now, payload: { choiceId: item.unlockBy.choiceId, value: 'NON' } },
    });
    assert.equal(bad.state.mediaStates.talkie_mag?.unlocked, false);

    const ok = creator.stepJourneySession(session.sessionId, {
      now,
      event: { type: 'choice.made', at: now, payload: { choiceId: item.unlockBy.choiceId, value: 'MAG' } },
    });
    assert.equal(ok.state.mediaStates.talkie_mag?.unlocked, true);
    assert.equal(ok.state.mediaStates.talkie_mag?.visible, true);

    const observed = creator.stepJourneySession(session.sessionId, {
      now,
      event: { type: 'media.consumed', at: now, payload: { mediaItemId: 'talkie_mag' } },
    });
    const uiKinds = (observed.technical.steps || []).flatMap((s) => (s.uiPlan || []).map((u) => u.kind));
    assert.ok(uiKinds.includes('observe'));
    assert.ok(uiKinds.includes('journal_note'));
    assert.ok((observed.state.playerJournal || []).some((n) => /rendez-vous/.test(n.text)));
  });

  it('situation : analyses observation + journal compilées dans ALORS', () => {
    const adv = emptyAdventure();
    creator.inventory.addImposedMedia(adv, { id: 'media_impose', label: 'Média imposé' });
    adv.floors[0].situations.push({
      id: 'f0_a',
      letter: 'A',
      title: 'Départ',
      trigger: { kind: 'media_consumed', mediaItemId: 'media_impose' },
      thenActions: [{ kind: 'notify', message: 'C’est parti.' }],
      analyses: [
        { kind: 'observe', text: 'Tu viens de regarder le média imposé.' },
        { kind: 'journal', text: 'Note : le départ a eu lieu.' },
      ],
    });
    adv.floors[0].unlockNext = { kind: 'flag_true' };
    adv.floors.push({ index: 1, title: 'Bureau', situations: [] });
    adv.floors[0].analyses = [{ kind: 'observe', text: 'L’étage 1 s’ouvre.' }];

    const compiled = creator.compileAdventureFull(adv);
    const sitRule = compiled.definition.rules.find((r) => r.id && r.id.includes('f0_a'));
    assert.ok(sitRule.actions.some((a) => a.type === 'ui.observe' && /média imposé/.test(a.params.message)));
    assert.ok(sitRule.actions.some((a) => a.type === 'journal.addNote'));
    const unlock = compiled.definition.rules.find((r) => r.id === 'unlock_floor_0_to_1');
    assert.ok(unlock);
    assert.ok(unlock.actions.some((a) => a.type === 'ui.observe' && /étage 1/.test(a.params.message || '')));
  });

  it('importer un objet Mira au bureau ne le duplique pas', () => {
    const adv = creator.loadAdventure('lanterne_de_mira');
    const n = adv.mediaItems.length;
    const lettre = adv.mediaItems.find((m) => m.id === 'lettre');
    assert.ok(lettre);
    assert.equal(creator.inventory.isBureauMedia(lettre), false);
    const assigned = creator.inventory.assignMediaItemFamily(adv, 'lettre', 'bureau');
    assert.equal(assigned.id, 'lettre');
    assert.equal(assigned.contentId, lettre.contentId);
    assert.equal(adv.mediaItems.length, n);
    assert.equal(creator.inventory.isBureauMedia(assigned), true);
    assert.equal(creator.inventory.objectFamily(assigned, adv), 'bureau');
    assert.ok(adv.mediaItems.some((m) => m.id === 'lettre'));
    assert.equal(creator.inventory.inventorySummary(adv).bureauMedia, 1);

    creator.inventory.assignMediaItemFamily(adv, 'cle_usb', 'bureau');
    const compiled = creator.compileAdventureFull(adv);
    assert.ok(compiled.definition.mediaItems.some((m) => m.id === 'lettre' && m.role === 'bureau'));
    assert.ok(!compiled.warnings.some((w) => w.code === 'MISSING_MEDIA_ITEM'));
  });

  it('importer un objet du bureau vers recouvrables conserve l’id', () => {
    const adv = emptyAdventure();
    const item = creator.inventory.addBureauMedia(adv, { id: 'polaroid_1', label: 'Polaroid' });
    assert.equal(creator.inventory.isBureauMedia(item), true);
    const moved = creator.inventory.assignMediaItemFamily(adv, 'polaroid_1', 'recoverable');
    assert.equal(moved.id, 'polaroid_1');
    assert.equal(adv.mediaItems.length, 1);
    assert.equal(creator.inventory.isRecoverableMedia(moved, adv), true);
    assert.equal(creator.inventory.isBureauMedia(moved), false);
  });

  it('nouvelle aventure vide compile (média imposé + unlock_bureau)', () => {
    const adv = creator.newBlankAdventure();
    assert.equal(creator.inventory.isImposedMedia(adv.mediaItems[0]), true);
    const compiled = creator.compileAdventureFull(adv);
    assert.ok(compiled.definition.rules.length >= 1);
    assert.ok(compiled.definition.variables.some((v) => v.id === 'bureau_accessible'));
    assert.ok(!compiled.warnings.some((w) => w.level === 'error'));
  });

  it('nouvelle aventure accepte un titre affiché', () => {
    const adv = creator.newBlankAdventure('La lanterne de Mira');
    assert.equal(adv.title, 'La lanterne de Mira');
    const unnamed = creator.newBlankAdventure('   ');
    assert.equal(unnamed.title, 'Nouvelle aventure');
  });
});

describe('Creator Phase D — API HTTP', () => {
  it('catalog expose skins, lieux prédéfinis, types de contenu', async () => {
    const cat = await h.api.get('/api/admin/lantern-lab/creator/catalog', simOpts());
    assert.equal(cat.status, 200);
    assert.ok(cat.body.catalog.mediaItemSkins.some((s) => s.id === 'polaroid'));
    assert.ok(cat.body.catalog.mediaItemSkins.some((s) => s.id === 'pc'));
    assert.ok(cat.body.catalog.mediaItemSkins.some((s) => s.id === 'folder'));
    assert.ok(cat.body.catalog.mediaItemSkins.some((s) => s.id === 'locker'));
    assert.ok(cat.body.catalog.containerKinds.some((k) => k.id === 'usb' && k.skin === 'usb'));
    assert.ok(cat.body.catalog.containerKinds.some((k) => k.id === 'pc' && k.allowsLinks));
    assert.ok(cat.body.catalog.containerKinds.some((k) => k.id === 'locker'));
    assert.ok(cat.body.catalog.objectKinds.some((k) => k.id === 'container'));
    assert.ok(cat.body.catalog.objectKinds.some((k) => k.id === 'imposed'));
    assert.ok(cat.body.catalog.objectKinds.some((k) => k.id === 'bureau'));
    assert.ok(cat.body.catalog.objectKinds.some((k) => k.id === 'recoverable'));
    assert.ok(cat.body.catalog.analysisKinds.some((k) => k.id === 'observe'));
    assert.ok(cat.body.catalog.unlockKinds.some((k) => k.id === 'code'));
    assert.ok(cat.body.catalog.actions.some((a) => a.kind === 'unlock_bureau'));
    assert.ok(cat.body.catalog.zonePresets.some((z) => z.id === 'sacre_coeur'));
    assert.ok(cat.body.catalog.contentKinds.some((c) => c.id === 'audio'));
  });

  it('POST inventory/add ajoute un objet à l’aventure', async () => {
    const res = await h.api.post(
      '/api/admin/lantern-lab/creator/inventory/add',
      {
        adventure: emptyAdventure(),
        kind: 'item',
        payload: { label: 'Polaroid souvenir', skin: 'polaroid' },
      },
      simOpts()
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.added.skin, 'polaroid');
    assert.equal(res.body.summary.mediaItems, 1);
    assert.ok(res.body.adventure.mediaItems[0].label.includes('Polaroid'));
  });

  it('POST inventory/add ajoute un média imposé (nature distincte)', async () => {
    const res = await h.api.post(
      '/api/admin/lantern-lab/creator/inventory/add',
      {
        adventure: emptyAdventure(),
        kind: 'imposed',
        payload: { label: 'Média imposé', skin: 'vhs' },
      },
      simOpts()
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.added.policy, 'imposed');
    assert.equal(res.body.added.role, 'imposed');
    assert.equal(res.body.summary.imposedMedia, 1);
    assert.equal(res.body.summary.mediaItems, 1);
  });

  it('POST inventory/add + update objet du bureau', async () => {
    const added = await h.api.post(
      '/api/admin/lantern-lab/creator/inventory/add',
      {
        adventure: emptyAdventure(),
        kind: 'bureau',
        payload: { label: 'Polaroid bureau', skin: 'polaroid' },
      },
      simOpts()
    );
    assert.equal(added.status, 200);
    assert.equal(added.body.added.role, 'bureau');
    assert.equal(added.body.summary.bureauMedia, 1);
    const updated = await h.api.post(
      '/api/admin/lantern-lab/creator/inventory/update',
      {
        adventure: added.body.adventure,
        kind: 'bureau',
        payload: { id: added.body.added.id, label: 'Polaroid Rue de Paradis' },
      },
      simOpts()
    );
    assert.equal(updated.status, 200);
    assert.equal(updated.body.updated.label, 'Polaroid Rue de Paradis');
    assert.equal(updated.body.updated.role, 'bureau');
  });

  it('POST inventory/update assign importe un objet au bureau sans doublon', async () => {
    const created = await h.api.post(
      '/api/admin/lantern-lab/creator/inventory/add',
      {
        adventure: emptyAdventure(),
        kind: 'item',
        payload: { label: 'Lettre d’adieu', skin: 'letter' },
      },
      simOpts()
    );
    assert.equal(created.status, 200);
    const id = created.body.added.id;
    const n = created.body.adventure.mediaItems.length;
    const assigned = await h.api.post(
      '/api/admin/lantern-lab/creator/inventory/update',
      {
        adventure: created.body.adventure,
        kind: 'assign',
        payload: { id, family: 'bureau' },
      },
      simOpts()
    );
    assert.equal(assigned.status, 200);
    assert.equal(assigned.body.updated.id, id);
    assert.equal(assigned.body.updated.role, 'bureau');
    assert.equal(assigned.body.adventure.mediaItems.length, n);
    assert.equal(assigned.body.summary.bureauMedia, 1);
  });

  it('POST inventory/add ajoute un contenant protégé', async () => {
    let adv = emptyAdventure();
    const letter = await h.api.post(
      '/api/admin/lantern-lab/creator/inventory/add',
      {
        adventure: adv,
        kind: 'item',
        payload: { id: 'lettre_tante', label: 'Lettre de la tante', skin: 'letter' },
      },
      simOpts()
    );
    assert.equal(letter.status, 200);
    const res = await h.api.post(
      '/api/admin/lantern-lab/creator/inventory/add',
      {
        adventure: letter.body.adventure,
        kind: 'container',
        payload: {
          label: 'Boîte de Léa',
          contains: ['lettre_tante'],
          lockWithCode: true,
          code: 'LEA7',
        },
      },
      simOpts()
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.added.lockWithCode, true);
    assert.equal(res.body.added.code, 'LEA7');
    assert.equal(res.body.summary.containers, 1);
  });

  it('POST inventory/update stash range un objet dans une boîte du bureau', async () => {
    let adv = emptyAdventure();
    const letter = await h.api.post(
      '/api/admin/lantern-lab/creator/inventory/add',
      { adventure: adv, kind: 'bureau', payload: { id: 'usb', label: 'Clé USB', skin: 'usb' } },
      simOpts()
    );
    assert.equal(letter.status, 200);
    const box = await h.api.post(
      '/api/admin/lantern-lab/creator/inventory/add',
      {
        adventure: letter.body.adventure,
        kind: 'container',
        payload: { label: 'Boîte bureau', placement: 'bureau', code: 'OK' },
      },
      simOpts()
    );
    assert.equal(box.status, 200);
    assert.equal(box.body.added.placement, 'bureau');
    const stashed = await h.api.post(
      '/api/admin/lantern-lab/creator/inventory/update',
      {
        adventure: box.body.adventure,
        kind: 'stash',
        payload: { id: box.body.added.id, itemId: 'usb' },
      },
      simOpts()
    );
    assert.equal(stashed.status, 200);
    const found = stashed.body.adventure.containers.find((c) => c.id === box.body.added.id);
    assert.ok(found.contains.includes('usb'));
    const usb = stashed.body.adventure.mediaItems.find((m) => m.id === 'usb');
    assert.equal(usb.role, 'bureau');
  });

  it('POST inventory/add copie un preset de lieu', async () => {
    const res = await h.api.post(
      '/api/admin/lantern-lab/creator/inventory/add',
      {
        adventure: emptyAdventure(),
        kind: 'zone',
        payload: { presetId: 'sacre_coeur' },
      },
      simOpts()
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.added.label, 'Sacré-Cœur');
    assert.ok(res.body.added.center.lat);
  });

  it('health stage CreatorD', async () => {
    const res = await h.api.get('/api/admin/lantern-lab/health', simOpts());
    assert.equal(res.status, 200);
    assert.match(res.body.stage, /CreatorD/);
  });

  it('UI contient la vue Matériel', async () => {
    const { baseUrl } = await h.startServer();
    const res = await fetch(`${baseUrl}/lantern-lab/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Matériel'));
    assert.ok(html.includes('worldTab') || html.includes('viewWorld'));
    assert.ok(html.includes('Contenant'));
    assert.ok(html.includes('Créer un contenant') || html.includes('Créer une boîte'));
    assert.ok(html.includes('Ranger un objet') || html.includes('Ranger cet objet'));
    assert.ok(html.includes('contenu dans la boîte') || html.includes('contenu dans le casier') || html.includes('containedPhrase'));
    assert.ok(html.includes('data-open-box') || html.includes('Ouvrir la boîte') || html.includes('Ouvrir le PC'));
    assert.ok(html.includes('Casier'));
    assert.ok(html.includes('Pochette cartonnée'));
    assert.ok(html.includes('containerKind') || html.includes('Type de contenant'));
    assert.ok(html.includes('containerLock') || html.includes('Supprimer le code'));
    assert.ok(html.includes('Média imposé'));
    assert.ok(html.includes('isImposedMedia'));
    assert.ok(html.includes('isBureauMedia'));
    assert.ok(html.includes('Déverrouiller le Bureau') || html.includes('unlock_bureau') || html.includes('01 · Bureau'));
    assert.ok(html.includes("optgroup label=\"Média imposé\"") || html.includes("optgroup label=\\\"Média imposé\\\"") || html.includes("label=\"Média imposé\""));
    assert.ok(html.includes('02 · Recouvrables'));
    assert.ok(html.includes('Tous les objets'));
    assert.ok(html.includes('family-block') || html.includes('world-list'));
    assert.ok(html.includes('Voir les objets du bureau') || html.includes('Objets du bureau'));
    assert.ok(html.includes('objectSheet'));
    assert.ok(html.includes('isRecoverableMedia'));
    assert.ok(html.includes('Valider les détails'));
    assert.ok(html.includes('Fenêtre d’observation') || html.includes("Fenêtre d'observation"));
    assert.ok(html.includes('Condition de déblocage'));
    assert.ok(html.includes('/creator/adventures/blank') || html.includes('newBlankAdventure') || html.includes('btnNewAdv'));
    assert.ok(html.includes('id="storyTitle"'));
    assert.ok(html.includes('Nom de l’aventure') || html.includes("Nom de l'aventure"));
    assert.ok(html.includes('newAdvTitle') || html.includes('newAdvCreate'));
    assert.ok(html.includes('Importer depuis'));
    assert.ok(html.includes('tous les objets'));
    assert.ok(html.includes('importObjectToFamily') || html.includes('data-import-ask') || html.includes('data-import-yes'));
    assert.ok(html.includes('Importer cet objet'));
    assert.ok(html.includes('au bureau'));
  });
});
