/**
 * Compile une aventure (étages → situations → rules) vers une LanternDefinition.
 * Couche conception uniquement — évaluation = StoryStateEngine existant.
 */

const {
  compileSituation,
  compileCreatorExpr,
  floorVarId,
  humanCondition,
  humanAction,
  humanTrigger,
} = require('./compile');
const { validateDefinition } = require('../schemas');
const { validateAdventureCreator } = require('./validateAdventure');
const { compileContainerRules, containerVariables } = require('./compileContainers');
const { isBureauMedia, BUREAU_VAR_ID } = require('./inventory');
const { compileMaterialRules, injectAnalysesIntoActions, analysisActions } = require('./compileRecoverables');

const UNLOCK_LISTEN = [
  'media.consumed',
  'media.discovered',
  'media.opened',
  'choice.made',
  'beacon.qr',
  'beacon.nfc',
  'geo.heartbeat',
  'player.position_updated',
  'geo.enter',
  'time.schedule',
  'run.started',
];

function fail(msg) {
  const err = new Error(msg);
  err.status = 400;
  err.code = 'ADVENTURE_COMPILE';
  throw err;
}

function letterForIndex(i) {
  return String.fromCharCode(65 + i); // A, B, C…
}

function normalizeFloor(floor, floorIndex) {
  const index = floor.index != null ? Number(floor.index) : floorIndex;
  const situations = (floor.situations || []).map((sit, i) => ({
    ...sit,
    letter: sit.letter || letterForIndex(i),
    id: sit.id || `f${index}_${(sit.letter || letterForIndex(i)).toLowerCase()}`,
    floorIndex: index,
  }));
  return {
    ...floor,
    index,
    id: floor.id || `floor_${index}`,
    title: floor.title || `Étage ${String(index).padStart(2, '0')}`,
    status: floor.status || 'designing',
    situations,
  };
}

function injectFloorGate(situation, floorIndex) {
  const gate = { kind: 'floor_open', floorIndex, label: `Étage ${floorIndex} accessible` };
  let next = { ...situation };

  if (situation.conditionsGroup) {
    next.conditionsGroup = {
      op: 'and',
      children: [gate, situation.conditionsGroup],
    };
  } else {
    const conditions = [...(situation.conditions || [])];
    if (!conditions.some((c) => c.kind === 'floor_open' && Number(c.floorIndex) === floorIndex)) {
      conditions.unshift(gate);
    }
    next.conditions = conditions;
  }

  let thenActions = [...(situation.thenActions || [])];
  if (situation.transition?.unlockFloor != null) {
    const target = Number(situation.transition.unlockFloor);
    const already = thenActions.some(
      (a) => a.kind === 'unlock_floor' && Number(a.floorIndex) === target
    );
    if (!already) {
      thenActions.push({
        kind: 'unlock_floor',
        floorIndex: target,
        label: situation.transition.label || `Débloquer l’étage ${target}`,
      });
    }
  }
  next.thenActions = thenActions;
  return next;
}

function compileUnlockRule(floor, nextIndex) {
  if (!floor.unlockNext) return null;
  const cond = compileCreatorExpr(floor.unlockNext);
  const openThis = { type: 'var.equals', varId: floorVarId(floor.index), value: true };
  const notNext = {
    op: 'not',
    child: { type: 'var.equals', varId: floorVarId(nextIndex), value: true },
  };
  return {
    id: `unlock_floor_${floor.index}_to_${nextIndex}`,
    title: `Transition — Étage ${floor.index} → ${nextIndex}`,
    enabled: true,
    priority: 50,
    listen: UNLOCK_LISTEN,
    condition: {
      op: 'and',
      children: [openThis, notNext, cond],
    },
    actions: [
      {
        id: `act_unlock_${nextIndex}`,
        type: 'var.set',
        params: { varId: floorVarId(nextIndex), value: true },
      },
      {
        id: `act_unlock_${nextIndex}_msg`,
        type: 'ui.notify',
        params: {
          message: floor.unlockNextLabel || `Étage ${nextIndex} accessible`,
        },
      },
    ],
    occurrence: { kind: 'once_per_run' },
  };
}

/**
 * @param {object} adventure — modèle créateur étages
 * @returns {{ definition, floors, tree, humanSummary, warnings }}
 */
function compileAdventure(adventure) {
  if (!adventure || typeof adventure !== 'object') fail('Aventure invalide');
  if (!adventure.id) fail('Identifiant d’aventure requis');
  if (!adventure.title) fail('Titre d’aventure requis');

  const floors = (adventure.floors || []).map(normalizeFloor);
  floors.sort((a, b) => a.index - b.index);

  const rules = [];
  const humanSummary = [];
  const variables = [
    ...(adventure.variables || []),
  ];
  const varIds = new Set(variables.map((v) => v.id));

  // Vars d’accessibilité d’étage
  for (const f of floors) {
    const vid = floorVarId(f.index);
    if (!varIds.has(vid)) {
      variables.push({
        id: vid,
        label: `Étage ${f.index} accessible`,
        valueType: 'boolean',
        defaultValue: f.index === 0,
        scope: 'run',
      });
      varIds.add(vid);
    }
  }

  // Collect journal_* / custom flags referenced
  for (const f of floors) {
    for (const sit of f.situations) {
      for (const a of [...(sit.thenActions || []), ...(sit.elseActions || [])]) {
        if (a.kind === 'add_journal' && a.noteId) {
          const jid = `journal_${a.noteId}`;
          if (!varIds.has(jid)) {
            variables.push({
              id: jid,
              label: a.message || `Note ${a.noteId}`,
              valueType: 'boolean',
              defaultValue: false,
              scope: 'run',
            });
            varIds.add(jid);
          }
        }
        if (a.kind === 'set_flag' && a.varId && !varIds.has(a.varId)) {
          variables.push({
            id: a.varId,
            label: a.label || a.varId,
            valueType: typeof a.value === 'boolean' ? 'boolean' : 'string',
            defaultValue: typeof a.value === 'boolean' ? false : null,
            scope: 'run',
          });
          varIds.add(a.varId);
        }
        if (a.kind === 'unlock_bureau' && !varIds.has(BUREAU_VAR_ID)) {
          variables.push({
            id: BUREAU_VAR_ID,
            label: 'Bureau déverrouillé',
            valueType: 'boolean',
            defaultValue: false,
            scope: 'run',
          });
          varIds.add(BUREAU_VAR_ID);
        }
      }
    }
  }

  for (const box of adventure.containers || []) {
    for (const v of containerVariables(box)) {
      if (!varIds.has(v.id)) {
        variables.push(v);
        varIds.add(v.id);
      }
    }
  }

  if ((adventure.mediaItems || []).some(isBureauMedia) && !varIds.has(BUREAU_VAR_ID)) {
    variables.push({
      id: BUREAU_VAR_ID,
      label: 'Bureau déverrouillé',
      valueType: 'boolean',
      defaultValue: false,
      scope: 'run',
    });
    varIds.add(BUREAU_VAR_ID);
  }

  for (const floor of floors) {
    humanSummary.push({
      role: 'floor',
      index: floor.index,
      text: `ÉTAGE ${String(floor.index).padStart(2, '0')} — ${floor.title}`,
    });

    for (const rawSit of floor.situations) {
      const sit = injectFloorGate(rawSit, floor.index);
      sit.thenActions = injectAnalysesIntoActions(sit.thenActions, rawSit.analyses, `sit_${rawSit.id || 'x'}`);
      const compiled = compileSituation(sit, {
        lanternId: adventure.id,
        timezone: adventure.timezone || 'Europe/Paris',
        zones: adventure.zones || [],
        mediaItems: adventure.mediaItems || [],
        variables,
      });
      rules.push(...compiled.rules);
      humanSummary.push(...compiled.humanSummary);
    }

    const next = floors.find((f) => f.index === floor.index + 1);
    if (next && floor.unlockNext) {
      const unlockRule = compileUnlockRule(floor, next.index);
      if (unlockRule) {
        const extra = analysisActions(floor.analyses, `floor_${floor.index}`);
        if (extra.length) unlockRule.actions.push(...extra);
        rules.push(unlockRule);
        humanSummary.push({
          role: 'transition',
          text: `🔗 Condition pour l’étage ${next.index} : ${humanCondition(floor.unlockNext)}`,
        });
      }
    }
  }

  for (const box of adventure.containers || []) {
    const boxRules = compileContainerRules(box);
    rules.push(...boxRules);
    humanSummary.push({
      role: 'container',
      text: box.lockWithCode
        ? `📦 ${box.label || box.id} — contenant protégé par un code, range : ${(box.contains || []).join(', ') || 'rien'}`
        : `📦 ${box.label || box.id} — contenant, range : ${(box.contains || []).join(', ') || 'rien'}`,
    });
  }

  const material = compileMaterialRules(adventure);
  rules.push(...material.rules);
  for (const v of material.variables || []) {
    if (!variables.some((x) => x.id === v.id)) variables.push(v);
  }

  const initialVars = { [floorVarId(0)]: true };
  for (const f of floors) {
    if (f.index !== 0) initialVars[floorVarId(f.index)] = false;
  }
  // defaults from variable declarations
  for (const v of variables) {
    if (v.defaultValue != null && initialVars[v.id] === undefined) {
      initialVars[v.id] = v.defaultValue;
    }
  }

  const definition = {
    id: adventure.id,
    slug: adventure.slug || adventure.id,
    kind: adventure.kind || 'main',
    engineSchemaVersion: 1,
    contentVersion: adventure.contentVersion || 1,
    status: adventure.status || 'draft',
    timezone: adventure.timezone || 'Europe/Paris',
    title: adventure.title,
    mediaItems: adventure.mediaItems || [],
    mediaContents: adventure.mediaContents || [],
    variables,
    zones: adventure.zones || [],
    beacons: adventure.beacons || [],
    rules,
    creatorMeta: {
      model: 'floors',
      adventureId: adventure.id,
      floorCount: floors.length,
    },
  };

  validateDefinition(definition);

  const tree = buildAdventureTree(floors);
  const validated = validateAdventureCreator(floors, adventure);
  const warnings = validated.warnings;
  const journey = validated.journey;

  return {
    definition,
    floors,
    tree,
    journey,
    humanSummary,
    warnings,
    initialRuntime: {
      vars: initialVars,
      step: 0,
    },
  };
}

function buildAdventureTree(floors) {
  const nodes = [];
  const edges = [];

  for (const floor of floors) {
    nodes.push({
      id: floor.id,
      kind: 'floor',
      floorIndex: floor.index,
      title: floor.title,
      status: floor.status,
      letter: null,
    });

    for (const sit of floor.situations) {
      const sid = sit.id;
      nodes.push({
        id: sid,
        kind: 'situation',
        floorIndex: floor.index,
        letter: sit.letter,
        title: sit.title,
        parentFloorId: floor.id,
      });
      edges.push({
        id: `e_${floor.id}_${sid}`,
        from: floor.id,
        to: sid,
        label: sit.letter || 'SI',
        kind: 'contains',
      });

      // Action nodes (visual)
      const actions = sit.thenActions || [];
      actions.forEach((a, i) => {
        const aid = `${sid}_act_${i}`;
        nodes.push({
          id: aid,
          kind: 'action',
          floorIndex: floor.index,
          title: humanAction(a),
          parentSituationId: sid,
        });
        edges.push({
          id: `e_${sid}_${aid}`,
          from: sid,
          to: aid,
          label: i === 0 ? 'ALORS' : 'PUIS',
          kind: 'then',
        });
      });

      if (sit.elseActions?.length) {
        sit.elseActions.forEach((a, i) => {
          const aid = `${sid}_else_${i}`;
          nodes.push({
            id: aid,
            kind: 'action',
            floorIndex: floor.index,
            title: humanAction(a),
            parentSituationId: sid,
          });
          edges.push({
            id: `e_${sid}_${aid}`,
            from: sid,
            to: aid,
            label: 'SINON',
            kind: 'else',
          });
        });
      }
    }

    const next = floors.find((f) => f.index === floor.index + 1);
    if (next && floor.unlockNext) {
      edges.push({
        id: `e_unlock_${floor.index}_${next.index}`,
        from: floor.id,
        to: next.id,
        label: 'DONC',
        kind: 'transition',
        conditionHuman: humanCondition(floor.unlockNext),
      });
    }
  }

  return { nodes, edges };
}

function validateAdventureStructure(floors) {
  return validateAdventureCreator(floors).warnings;
}

function adventureJourney(floors) {
  return validateAdventureCreator(floors).journey;
}

function listViewModel(adventure, compiled) {
  const floors = compiled?.floors || (adventure.floors || []).map(normalizeFloor);
  return {
    id: adventure.id,
    title: adventure.title,
    floors: floors.map((f) => ({
      index: f.index,
      id: f.id,
      title: f.title,
      status: f.status,
      situationLetters: f.situations.map((s) => s.letter),
      situations: f.situations.map((s) => ({
        id: s.id,
        letter: s.letter,
        title: s.title,
        when: s.trigger ? humanTrigger(s.trigger) : null,
        conditions: (s.conditions || []).map(humanCondition),
        then: (s.thenActions || []).map(humanAction),
        else: (s.elseActions || []).map(humanAction),
        transition: s.transition || null,
      })),
      unlockNextHuman: f.unlockNext ? humanCondition(f.unlockNext) : null,
      unlockTarget: floors.find((x) => x.index === f.index + 1)?.index ?? null,
    })),
  };
}

module.exports = {
  compileAdventure,
  buildAdventureTree,
  validateAdventureStructure,
  adventureJourney,
  normalizeFloor,
  listViewModel,
  floorVarId,
  UNLOCK_LISTEN,
};
