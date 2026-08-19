/**
 * Validations créateur enrichies (Phase C).
 * Aide le concepteur — n’évalue pas le moteur.
 */

const { humanCondition, humanTrigger, humanAction } = require('./compile');
const { inventoryWarnings } = require('./inventory');

function flattenCondKinds(node, out = []) {
  if (!node) return out;
  if (node.op === 'and' || node.op === 'or') {
    (node.children || []).forEach((c) => flattenCondKinds(c, out));
    return out;
  }
  if (node.op === 'not') {
    flattenCondKinds(node.child, out);
    return out;
  }
  if (node.kind) out.push(node);
  return out;
}

/**
 * @param {object[]} floors — étages normalisés
 * @param {object} [adventure] — pour valider le matériel (objets, lieux, balises)
 * @returns {{ warnings: object[], journey: object }}
 */
function validateAdventureCreator(floors, adventure = null) {
  const warnings = [];
  if (!floors.length) {
    warnings.push({ level: 'error', code: 'NO_FLOORS', message: 'Aucun étage dans l’aventure.' });
    return { warnings, journey: { steps: [] } };
  }

  const byIndex = new Map(floors.map((f) => [f.index, f]));
  const reachable = new Set();
  // Étage 0 toujours considéré comme point d’entrée
  if (byIndex.has(0)) reachable.add(0);
  else if (floors[0]) reachable.add(floors[0].index);

  // Propagation simple : unlockNext ou transition situation → étage cible
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of floors) {
      if (!reachable.has(f.index)) continue;
      const nextIdx = f.index + 1;
      if (f.unlockNext && byIndex.has(nextIdx) && !reachable.has(nextIdx)) {
        reachable.add(nextIdx);
        changed = true;
      }
      for (const sit of f.situations || []) {
        const target = sit.transition?.unlockFloor;
        if (target != null && byIndex.has(Number(target)) && !reachable.has(Number(target))) {
          reachable.add(Number(target));
          changed = true;
        }
        for (const a of sit.thenActions || []) {
          if (a.kind === 'unlock_floor' && a.floorIndex != null) {
            const t = Number(a.floorIndex);
            if (byIndex.has(t) && !reachable.has(t)) {
              reachable.add(t);
              changed = true;
            }
          }
        }
      }
    }
  }

  for (const f of floors) {
    if (!reachable.has(f.index) && f.index !== 0) {
      warnings.push({
        level: 'error',
        code: 'UNREACHABLE_FLOOR',
        floorIndex: f.index,
        message: `L’étage ${f.index} (« ${f.title} ») ne peut probablement jamais être atteint : aucune transition n’y mène.`,
      });
    }

    if (!(f.situations || []).length) {
      warnings.push({
        level: 'warn',
        code: 'EMPTY_FLOOR',
        floorIndex: f.index,
        message: `L’étage ${f.index} ne contient aucune situation.`,
      });
    }

    for (const sit of f.situations || []) {
      if (!sit.trigger) {
        warnings.push({
          level: 'error',
          code: 'NO_TRIGGER',
          floorIndex: f.index,
          situationId: sit.id,
          message: `Situation ${sit.letter} (« ${sit.title} ») sans déclencheur QUAND.`,
        });
      }

      const hasActions =
        (sit.thenActions && sit.thenActions.length > 0) ||
        (sit.elseActions && sit.elseActions.length > 0) ||
        (sit.branches && sit.branches.some((b) => b.thenActions?.length));
      if (!hasActions) {
        warnings.push({
          level: 'error',
          code: 'NO_ACTIONS',
          floorIndex: f.index,
          situationId: sit.id,
          message: `Situation ${sit.letter} (« ${sit.title} ») n’a aucune action ALORS / SINON.`,
        });
      }

      const hasProgress =
        sit.transition?.unlockFloor != null ||
        (sit.thenActions || []).some((a) => a.kind === 'unlock_floor') ||
        f.unlockNext;
      const onlyInternal =
        hasActions &&
        !(sit.thenActions || []).some((a) =>
          ['unlock_floor', 'unlock_media', 'unlock_bureau', 'set_flag', 'add_journal', 'notify', 'show_observation', 'play_media', 'show_button', 'show_code_input', 'set_object_state', 'wait_then'].includes(
            a.kind
          )
        );
      // Orphan = no actions linking outward and no floor unlock — soft warn if literally empty progress path
      if (hasActions && !sit.transition && !(sit.thenActions || []).some((a) => a.kind === 'unlock_floor')) {
        // informational only if floor also has no unlockNext and situation is sole content
        if (!f.unlockNext && (f.situations || []).length === 1) {
          warnings.push({
            level: 'warn',
            code: 'NO_OUTCOME',
            floorIndex: f.index,
            situationId: sit.id,
            message: `Situation ${sit.letter} n’a ni transition d’étage ni déblocage — vérifiez qu’elle a une issue narrative.`,
          });
        }
      }

      // Contradictory AND of flag_true + flag_false same var
      const leaves = [
        ...flattenCondKinds(sit.conditionsGroup),
        ...(sit.conditions || []).flatMap((c) => flattenCondKinds(c)),
      ];
      const trues = new Set(leaves.filter((c) => c.kind === 'flag_true').map((c) => c.varId));
      for (const c of leaves) {
        if (c.kind === 'flag_false' && trues.has(c.varId)) {
          warnings.push({
            level: 'error',
            code: 'CONTRADICTION',
            floorIndex: f.index,
            situationId: sit.id,
            message: `Situation ${sit.letter} : conditions contradictoires sur « ${c.varId} » (vrai ET faux).`,
          });
        }
      }
    }

    const next = byIndex.get(f.index + 1);
    if (next && !f.unlockNext) {
      const hasSitTransition = (f.situations || []).some(
        (s) =>
          s.transition?.unlockFloor === next.index ||
          (s.thenActions || []).some((a) => a.kind === 'unlock_floor' && Number(a.floorIndex) === next.index)
      );
      if (!hasSitTransition) {
        warnings.push({
          level: 'warn',
          code: 'NO_TRANSITION',
          floorIndex: f.index,
          message: `L’étage ${f.index} n’a pas de condition de transition vers l’étage ${next.index}.`,
        });
      }
    }
  }

  // Dead branch: same trigger on exclusive situations with empty else and no mutual exclusion awareness — soft
  for (const f of floors) {
    const byTrigger = new Map();
    for (const sit of f.situations || []) {
      const key = JSON.stringify(sit.trigger || null);
      if (!byTrigger.has(key)) byTrigger.set(key, []);
      byTrigger.get(key).push(sit);
    }
    for (const [, group] of byTrigger) {
      if (group.length < 2) continue;
      // If two situations share trigger and neither has conditions → conflict
      const bare = group.filter(
        (s) => !(s.conditions || []).length && !s.conditionsGroup && !(s.branches || []).length
      );
      if (bare.length >= 2) {
        warnings.push({
          level: 'warn',
          code: 'AMBIGUOUS_BRANCH',
          floorIndex: f.index,
          message: `Étage ${f.index} : plusieurs situations (${bare.map((s) => s.letter).join(', ')}) partagent le même QUAND sans conditions distinctes — risque de branches ambiguës.`,
        });
      }
    }
  }

  const journey = {
    steps: floors.map((f) => ({
      floorIndex: f.index,
      title: f.title,
      reachable: reachable.has(f.index),
      status: f.status,
      letters: (f.situations || []).map((s) => s.letter),
      branchCount: (f.situations || []).length,
      unlockNextHuman: f.unlockNext ? humanCondition(f.unlockNext) : null,
      situations: (f.situations || []).map((s) => ({
        id: s.id,
        letter: s.letter,
        title: s.title,
        when: s.trigger ? humanTrigger(s.trigger) : null,
        then: (s.thenActions || []).map(humanAction),
      })),
    })),
  };

  if (adventure) {
    warnings.push(...inventoryWarnings(adventure));
  }

  return { warnings, journey };
}

module.exports = {
  validateAdventureCreator,
  flattenCondKinds,
};
