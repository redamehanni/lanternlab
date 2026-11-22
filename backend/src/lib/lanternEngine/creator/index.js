/**
 * Lantern Lab Creator — couche sémantique au-dessus du moteur.
 * Phase A : situations · Phase B : étages · Phase C : atelier créateur
 */

const fs = require('fs');
const path = require('path');
const { getCatalog } = require('./catalog');
const {
  compileSituation,
  mergeCompiledIntoDefinition,
  summarizeSituation,
  humanTrigger,
  humanCondition,
  humanAction,
} = require('./compile');
const {
  compileAdventure,
  listViewModel,
  buildAdventureTree,
  validateAdventureStructure,
  adventureJourney,
} = require('./compileAdventure');
const drafts = require('./drafts');
const { validateAdventureCreator } = require('./validateAdventure');
const inventory = require('./inventory');
const e6 = require('./e6');
const { explainSimulation, explainTick } = require('./explain');
const simulate = require('../simulate');

const SIT_DIR = path.join(__dirname, 'situations');
const ADV_DIR = path.join(__dirname, 'adventures');

function listSituationTemplates() {
  return fs
    .readdirSync(SIT_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const sit = JSON.parse(fs.readFileSync(path.join(SIT_DIR, f), 'utf8'));
      return {
        id: sit.id,
        title: sit.title,
        description: sit.description || '',
        fixtureId: sit.fixtureId || null,
        file: f,
      };
    });
}

function loadSituationTemplate(id) {
  const templates = listSituationTemplates();
  const meta = templates.find((t) => t.id === id);
  if (!meta) {
    const err = new Error(`Situation modèle introuvable: ${id}`);
    err.status = 404;
    throw err;
  }
  return JSON.parse(fs.readFileSync(path.join(SIT_DIR, meta.file), 'utf8'));
}

function listAdventures() {
  if (!fs.existsSync(ADV_DIR)) return [];
  return fs
    .readdirSync(ADV_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const adv = JSON.parse(fs.readFileSync(path.join(ADV_DIR, f), 'utf8'));
      return {
        id: adv.id,
        title: adv.title,
        floorCount: (adv.floors || []).length,
        status: adv.status || 'draft',
        kind: 'fixture',
        file: f,
      };
    });
}

function loadAdventure(id) {
  const list = listAdventures();
  const meta = list.find((a) => a.id === id);
  if (!meta) {
    const err = new Error(`Aventure introuvable: ${id}`);
    err.status = 404;
    throw err;
  }
  return JSON.parse(fs.readFileSync(path.join(ADV_DIR, meta.file), 'utf8'));
}

function compileAndPrepare(situation, { fixtureId } = {}) {
  const fid = fixtureId || situation.fixtureId;
  let base = null;
  let context = { timezone: 'Europe/Paris' };

  if (fid) {
    const loaded = simulate.loadFixture(fid);
    base = loaded.definition;
    context = {
      lanternId: base.id,
      timezone: base.timezone || 'Europe/Paris',
      zones: base.zones || [],
      mediaItems: base.mediaItems || [],
      variables: base.variables || [],
    };
  }

  const compiled = compileSituation(situation, context);
  const definition = base
    ? {
        ...structuredClone(base),
        rules: compiled.rules,
      }
    : compiled.compiledDefinitionFragment;

  return { compiled, definition, fixtureId: fid || null };
}

function testSituation(situation, testInput = {}) {
  const { compiled, definition, fixtureId } = compileAndPrepare(situation);
  const defaults = situation.testDefaults || {};
  const body = {
    definition,
    runtime: testInput.runtime || defaults.runtime || {},
    event: testInput.event || defaults.event || null,
    tickTo: testInput.tickTo || defaults.tickTo || null,
    lat: testInput.lat ?? defaults.lat ?? null,
    lng: testInput.lng ?? defaults.lng ?? null,
    now: testInput.now || defaults.now || null,
  };

  const raw = simulate.simulateOnce({
    definition: body.definition,
    runtime: body.runtime,
    event: body.event,
    tickTo: body.tickTo,
    lat: body.lat,
    lng: body.lng,
    now: body.now,
  });

  const humanSteps = (raw.steps || []).map((step) => {
    if (step.kind === 'tick') {
      return { kind: 'tick', human: explainTick(step), technical: step };
    }
    const human = explainSimulation(
      {
        trace: step.trace,
        rulesFired: step.rulesFired,
        uiPlan: step.uiPlan,
        actions: step.actions,
      },
      { situation }
    );
    return { kind: 'event', human, technical: step };
  });

  return {
    situationId: compiled.situationId,
    title: compiled.title,
    fixtureId,
    humanSummary: compiled.humanSummary,
    enginePreview: compiled.enginePreview,
    humanSteps,
    technical: {
      sessionId: raw.sessionId,
      state: raw.state,
      steps: raw.steps,
      compiledRules: compiled.rules,
    },
  };
}

function compileAdventureFull(adventure) {
  return compileAdventure(adventure);
}

function testAdventureSituation(adventure, situationId, testInput = {}) {
  const compiled = compileAdventure(adventure);
  const sit = compiled.floors
    .flatMap((f) => f.situations.map((s) => ({ ...s, floorIndex: f.index })))
    .find((s) => s.id === situationId);
  if (!sit) {
    const err = new Error(`Situation introuvable dans l’aventure: ${situationId}`);
    err.status = 404;
    throw err;
  }

  const runtime = {
    ...(compiled.initialRuntime || {}),
    ...(testInput.runtime || {}),
    vars: {
      ...(compiled.initialRuntime?.vars || {}),
      ...(testInput.runtime?.vars || {}),
    },
    mediaStates: testInput.runtime?.mediaStates || {},
    objectStates: testInput.runtime?.objectStates || {},
    choices: testInput.runtime?.choices || {},
    beaconsScanned: testInput.runtime?.beaconsScanned || [],
  };

  const floorKey = `etage_${sit.floorIndex}_open`;
  if (runtime.vars[floorKey] == null) runtime.vars[floorKey] = true;

  const raw = simulate.simulateOnce({
    definition: compiled.definition,
    runtime,
    event: testInput.event || null,
    tickTo: testInput.tickTo || null,
    lat: testInput.lat ?? null,
    lng: testInput.lng ?? null,
    now: testInput.now || null,
  });

  const humanSteps = (raw.steps || []).map((step) => {
    if (step.kind === 'tick') {
      return { kind: 'tick', human: explainTick(step), technical: step };
    }
    const human = explainSimulation(
      {
        trace: step.trace,
        rulesFired: step.rulesFired,
        uiPlan: step.uiPlan,
        actions: step.actions,
      },
      { situation: sit }
    );
    return { kind: 'event', human, technical: step };
  });

  return {
    adventureId: adventure.id,
    situationId: sit.id,
    letter: sit.letter,
    floorIndex: sit.floorIndex,
    title: sit.title,
    warnings: compiled.warnings,
    humanSteps,
    technical: {
      sessionId: raw.sessionId,
      state: raw.state,
      steps: raw.steps,
      rulesFiredIds: (raw.steps || []).flatMap((s) =>
        (s.rulesFired || []).map((r) => r.ruleId || r.id)
      ),
    },
  };
}

/**
 * Ouvre une session de parcours joueur (multi-étapes) sur l’aventure compilée.
 * Réutilise le simulateur S1 — pas de second moteur.
 */
function startJourneySession(adventure, { runtime = {}, label = null } = {}) {
  const compiled = compileAdventure(adventure);
  const session = simulate.createSession({
    definition: compiled.definition,
    runtime: {
      ...(compiled.initialRuntime || {}),
      ...runtime,
      vars: {
        ...(compiled.initialRuntime?.vars || {}),
        ...(runtime.vars || {}),
      },
    },
    label: label || `Parcours — ${adventure.title}`,
  });
  return {
    sessionId: session.sessionId,
    label: session.label,
    journey: compiled.journey,
    warnings: compiled.warnings,
    state: session.state,
    floorsOpen: Object.keys(session.state.vars || {})
      .filter((k) => /^etage_\d+_open$/.test(k) && session.state.vars[k] === true)
      .map((k) => Number(k.match(/^etage_(\d+)_open$/)[1]))
      .sort((a, b) => a - b),
  };
}

function stepJourneySession(sessionId, stepInput = {}) {
  const session = simulate.getSession(sessionId);
  const result = simulate.runStep(session, {
    event: stepInput.event || null,
    now: stepInput.now || null,
    lat: stepInput.lat ?? null,
    lng: stepInput.lng ?? null,
    runtimePatch: stepInput.runtime || null,
    tickTo: stepInput.tickTo || null,
    source: 'lab_sim',
  });

  const humanSteps = (result.steps || []).map((step) => {
    if (step.kind === 'tick') {
      return { kind: 'tick', human: explainTick(step), technical: step };
    }
    return {
      kind: 'event',
      human: explainSimulation({
        trace: step.trace,
        rulesFired: step.rulesFired,
        uiPlan: step.uiPlan,
        actions: step.actions,
      }),
      technical: step,
    };
  });

  const vars = result.state?.vars || {};
  const floorsOpen = Object.keys(vars)
    .filter((k) => /^etage_\d+_open$/.test(k) && vars[k] === true)
    .map((k) => Number(k.match(/^etage_(\d+)_open$/)[1]))
    .sort((a, b) => a - b);

  return {
    sessionId,
    humanSteps,
    floorsOpen,
    state: result.state,
    technical: result,
  };
}

function getAdventureBundle(id) {
  const adventure = loadAdventure(id);
  const compiled = compileAdventure(adventure);
  return {
    adventure,
    list: listViewModel(adventure, compiled),
    tree: compiled.tree,
    journey: compiled.journey,
    warnings: compiled.warnings,
    humanSummary: compiled.humanSummary,
    enginePreview: {
      id: compiled.definition.id,
      rulesCount: compiled.definition.rules.length,
      floors: compiled.floors.length,
      variables: compiled.definition.variables.map((v) => v.id),
    },
    definition: compiled.definition,
    initialRuntime: compiled.initialRuntime,
    e6: e6.buildE6(adventure),
  };
}

function validateAdventureOnly(adventure) {
  const compiled = compileAdventure(adventure);
  return {
    warnings: compiled.warnings,
    journey: compiled.journey,
    list: listViewModel(adventure, compiled),
    tree: compiled.tree,
    enginePreview: {
      rulesCount: compiled.definition.rules.length,
      floors: compiled.floors.length,
    },
    e6: e6.buildE6(adventure),
  };
}

function simulateAdventure(adventure, testInput = {}) {
  if (!adventure) {
    const err = new Error('adventure requise');
    err.status = 400;
    throw err;
  }
  const compiled = compileAdventure(adventure);
  const runtime = {
    ...(compiled.initialRuntime || {}),
    ...(testInput.runtime || {}),
    vars: {
      ...(compiled.initialRuntime?.vars || {}),
      ...(testInput.runtime?.vars || {}),
    },
    mediaStates: testInput.runtime?.mediaStates || {},
    objectStates: testInput.runtime?.objectStates || {},
    choices: testInput.runtime?.choices || {},
    beaconsScanned: testInput.runtime?.beaconsScanned || [],
  };
  const raw = simulate.simulateOnce({
    definition: compiled.definition,
    runtime,
    event: testInput.event || null,
    tickTo: testInput.tickTo || null,
    lat: testInput.lat ?? null,
    lng: testInput.lng ?? null,
    now: testInput.now || null,
  });
  const humanSteps = (raw.steps || []).map((step) => {
    if (step.kind === 'tick') {
      return { kind: 'tick', human: explainTick(step), technical: step };
    }
    return {
      kind: step.kind || 'event',
      human: explainSimulation(
        {
          trace: step.trace,
          rulesFired: step.rulesFired,
          uiPlan: step.uiPlan,
          actions: step.actions,
        },
        { situation: null }
      ),
      technical: step,
    };
  });
  return {
    ...raw,
    humanSteps,
    enginePreview: {
      rulesCount: compiled.definition.rules.length,
      floors: compiled.floors.length,
    },
  };
}

function applyInventoryAdd(adventure, kind, payload = {}) {
  const a = inventory.ensureInventory(structuredClone(adventure || {}));
  let added = null;
  switch (kind) {
    case 'content':
      added = inventory.addMediaContent(a, payload);
      break;
    case 'item':
      added = inventory.addMediaItem(a, payload);
      break;
    case 'imposed':
      added = inventory.addImposedMedia(a, payload);
      break;
    case 'bureau':
      added = inventory.addBureauMedia(a, payload);
      break;
    case 'recoverable':
      added = inventory.addRecoverableMedia(a, payload);
      break;
    case 'container':
      added = inventory.addContainer(a, payload);
      break;
    case 'zone':
      added = inventory.addZone(a, payload);
      break;
    case 'beacon':
      added = inventory.addBeacon(a, payload);
      break;
    case 'interaction':
      added = inventory.addInteraction(a, payload);
      break;
    default: {
      const err = new Error(`Type de matériel inconnu: ${kind}`);
      err.status = 400;
      throw err;
    }
  }
  return packInventory(a, { added });
}

function packInventory(a, extra = {}) {
  return {
    adventure: a,
    summary: inventory.inventorySummary(a),
    e6: e6.buildE6(a),
    ...extra,
  };
}

function applyInventoryUpdate(adventure, kind, payload = {}) {
  const a = inventory.ensureInventory(structuredClone(adventure || {}));
  if (kind === 'cue') {
    const out = e6.applyCuePatch(a, payload);
    return packInventory(out.adventure, { updated: out.situation });
  }
  const id = payload.id;
  if (!id) {
    const err = new Error('id requis pour modifier un objet');
    err.status = 400;
    throw err;
  }
  if (kind === 'zone') {
    const updated = e6.updateZone(a, id, payload);
    return packInventory(a, { updated });
  }
  if (kind === 'beacon') {
    const updated = e6.updateBeacon(a, id, payload);
    return packInventory(a, { updated });
  }
  if (kind === 'content') {
    const updated = e6.updateMediaContent(a, id, payload);
    return packInventory(a, { updated });
  }
  if (kind === 'bindContent') {
    const updated = e6.bindItemContent(a, id, payload.contentId);
    return packInventory(a, { updated });
  }
  if (kind === 'ensureContent') {
    const updated = e6.ensureContentForItem(a, id, payload);
    return packInventory(a, { updated });
  }
  if (kind === 'assign' || payload.assignFamily) {
    const family = payload.family || payload.assignFamily;
    const updated = inventory.assignMediaItemFamily(a, id, family);
    return packInventory(a, { updated });
  }
  if (kind === 'stash') {
    const updated = inventory.stashInContainer(a, id, payload.itemId);
    return packInventory(a, { updated });
  }
  if (kind === 'unstash') {
    const updated = inventory.unstashFromContainer(a, id, payload.itemId);
    return packInventory(a, { updated });
  }
  if (kind === 'containerLock') {
    const updated = inventory.setContainerCode(a, id, payload.code);
    return packInventory(a, { updated });
  }
  if (kind === 'addLink') {
    const updated = inventory.addContainerLink(a, id, payload);
    return packInventory(a, { updated });
  }
  if (kind === 'removeLink') {
    const updated = inventory.removeContainerLink(a, id, payload.linkId);
    return packInventory(a, { updated });
  }
  if (!['item', 'bureau', 'imposed', 'recoverable', 'container'].includes(kind)) {
    const err = new Error(`Modification non supportée pour: ${kind}`);
    err.status = 400;
    throw err;
  }
  const updated = inventory.updateMediaItem(a, id, payload);
  return packInventory(a, { updated });
}

module.exports = {
  getCatalog,
  listSituationTemplates,
  loadSituationTemplate,
  compileSituation,
  compileAndPrepare,
  testSituation,
  mergeCompiledIntoDefinition,
  summarizeSituation,
  humanTrigger,
  humanCondition,
  humanAction,
  explainSimulation,
  listAdventures,
  loadAdventure,
  compileAdventureFull,
  testAdventureSituation,
  getAdventureBundle,
  buildAdventureTree,
  validateAdventureStructure,
  validateAdventureCreator,
  validateAdventureOnly,
  adventureJourney,
  listViewModel,
  startJourneySession,
  stepJourneySession,
  drafts,
  inventory,
  applyInventoryAdd,
  applyInventoryUpdate,
  simulateAdventure,
  e6,
  newBlankAdventure: drafts.newBlankAdventure,
};
