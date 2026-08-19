/**
 * Compile une Situation créateur → Rules Lantern Engine.
 * Aucune logique d'évaluation ici — uniquement traduction de données.
 */

const { randomUUID } = require('crypto');
const { validateDefinition } = require('../schemas');
const { isBureauMedia, BUREAU_VAR_ID } = require('./inventory');

function fail(msg) {
  const err = new Error(msg);
  err.status = 400;
  err.code = 'CREATOR_COMPILE';
  throw err;
}

function slugId(prefix, title) {
  const base = String(title || 'situation')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
  return `${prefix}_${base || randomUUID().slice(0, 8)}`;
}

function compileTrigger(trigger) {
  if (!trigger || !trigger.kind) fail('Déclencheur (QUAND) requis');
  switch (trigger.kind) {
    case 'media_discovered':
      if (!trigger.mediaItemId) fail('Item média requis pour « découvre »');
      return {
        listen: ['media.discovered'],
        extraConditions: [
          { type: 'event.payloadEquals', key: 'mediaItemId', value: trigger.mediaItemId },
          { type: 'media.discovered', mediaItemId: trigger.mediaItemId },
        ],
      };
    case 'media_consumed':
      if (!trigger.mediaItemId) fail('Item média requis pour « consomme »');
      return {
        listen: ['media.consumed'],
        extraConditions: [
          { type: 'event.payloadEquals', key: 'mediaItemId', value: trigger.mediaItemId },
          { type: 'media.consumed', mediaItemId: trigger.mediaItemId },
        ],
      };
    case 'media_opened':
      if (!trigger.mediaItemId) fail('Item média requis pour « ouvre »');
      return {
        listen: ['media.opened'],
        extraConditions: [
          { type: 'event.payloadEquals', key: 'mediaItemId', value: trigger.mediaItemId },
        ],
      };
    case 'beacon_found': {
      const channel = trigger.channel === 'nfc' ? 'beacon.nfc' : 'beacon.qr';
      if (!trigger.beaconId) fail('Balise requise');
      return {
        listen: [channel],
        extraConditions: [{ type: 'beacon.scanned', beaconId: trigger.beaconId }],
      };
    }
    case 'time_reached':
      if (!trigger.scheduleId) fail('Identifiant horaire requis');
      return {
        listen: ['time.schedule'],
        extraConditions: [
          { type: 'event.payloadEquals', key: 'scheduleId', value: trigger.scheduleId },
        ],
      };
    case 'run_started':
      return { listen: ['run.started'], extraConditions: [] };
    case 'player_choice':
      if (!trigger.choiceId) fail('Identifiant du bouton requis');
      return {
        listen: ['choice.made'],
        extraConditions: [
          { type: 'event.payloadEquals', key: 'choiceId', value: trigger.choiceId },
        ],
      };
    case 'code_submitted': {
      if (!trigger.choiceId) fail('Identifiant de saisie requis');
      if (!trigger.expected) fail('Code attendu requis');
      return {
        listen: ['choice.made'],
        extraConditions: [
          { type: 'event.payloadEquals', key: 'choiceId', value: trigger.choiceId },
          { type: 'event.payloadEquals', key: 'value', value: trigger.expected },
        ],
      };
    }
    case 'player_moves':
      return {
        listen: ['geo.heartbeat', 'player.position_updated', 'geo.enter'],
        extraConditions: [],
      };
    default:
      fail(`Déclencheur inconnu: ${trigger.kind}`);
  }
}

function compileCondition(c) {
  if (!c || !c.kind) fail('Condition invalide');
  switch (c.kind) {
    case 'player_in_place':
      if (!c.zoneId) fail('Lieu requis');
      return { type: 'geo.inZone', zoneId: c.zoneId };
    case 'player_in_any_place':
      if (!c.zoneIds?.length) fail('Lieux requis');
      return { type: 'geo.inAnyZone', zoneIds: c.zoneIds };
    case 'clock_is':
      if (!c.at) fail('Heure requise');
      return { type: 'time.equalsMinute', at: c.at, timezone: c.timezone || 'Europe/Paris' };
    case 'clock_between':
      if (!c.start || !c.end) fail('Fenêtre horaire incomplète');
      return {
        type: 'time.inWindow',
        start: c.start,
        end: c.end,
        timezone: c.timezone || 'Europe/Paris',
      };
    case 'media_discovered':
      return { type: 'media.discovered', mediaItemId: c.mediaItemId };
    case 'media_consumed':
      return { type: 'media.consumed', mediaItemId: c.mediaItemId };
    case 'flag_false':
      return { type: 'var.equals', varId: c.varId, value: false };
    case 'flag_true':
      return { type: 'var.equals', varId: c.varId, value: true };
    case 'media_unlocked':
      return { type: 'media.unlocked', mediaItemId: c.mediaItemId };
    case 'choice_equals':
      return { type: 'choice.equals', choiceId: c.choiceId, value: c.value };
    case 'floor_open':
      return { type: 'var.equals', varId: floorVarId(c.floorIndex), value: true };
    case 'object_state':
      return { type: 'object.stateEquals', objectId: c.objectId, value: c.value };
    default:
      fail(`Condition inconnue: ${c.kind}`);
  }
}

function floorVarId(index) {
  return `etage_${Number(index)}_open`;
}

/**
 * Compile une expression créateur (feuille kind OU groupe AND/OR/NOT).
 */
function compileCreatorExpr(node) {
  if (!node) return { op: 'true' };
  if (node.op === 'and' || node.op === 'or') {
    const children = (node.children || []).map(compileCreatorExpr).filter(Boolean);
    if (children.length === 0) return { op: 'true' };
    if (children.length === 1) return children[0];
    return { op: node.op, children };
  }
  if (node.op === 'not') {
    return { op: 'not', child: compileCreatorExpr(node.child) };
  }
  if (node.kind) return compileCondition(node);
  fail('Expression de condition invalide');
}

/**
 * Normalise conditions situation : tableau plat → AND, ou groupe déjà formé.
 * Si conditionsGroup ET conditions : AND des deux.
 */
function compileSituationConditions(situation) {
  const parts = [];
  if (situation.conditionsGroup) {
    parts.push(compileCreatorExpr(situation.conditionsGroup));
  }
  const list = situation.conditions || [];
  if (list.length > 0) {
    if (list.some((c) => c && (c.op === 'and' || c.op === 'or' || c.op === 'not'))) {
      parts.push(compileCreatorExpr({ op: 'and', children: list }));
    } else {
      parts.push(buildConditionExpr(list.map(compileCondition)));
    }
  }
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return { op: 'and', children: parts };
}

function compileAction(a, index, context = {}) {
  if (!a || !a.kind) fail('Action invalide');
  const id = a.id || `act_${index}_${a.kind}`;
  switch (String(a.kind).trim()) {
    case 'ring_phone':
      return {
        id,
        type: 'device.ringPhone',
        params: { deviceId: 'phone', label: a.label || null },
      };
    case 'ring_talkie':
      return {
        id,
        type: 'device.ringTalkie',
        params: { deviceId: a.deviceId || 'talkie', label: a.label || null },
      };
    case 'play_media':
      if (!a.mediaContentId) fail('Média (contenu) requis pour « Lire »');
      return {
        id,
        type: 'media.play',
        params: {
          mediaContentId: a.mediaContentId,
          label: a.label || a.mediaContentId,
        },
        delayMs: a.delayMs || 500,
        waitFor: a.waitFor || 'ui_ack',
      };
    case 'unlock_media':
      return { id, type: 'media.unlock', params: { mediaItemId: a.mediaItemId } };
    case 'unlock_bureau': {
      const items = (context.mediaItems || []).filter(isBureauMedia);
      return {
        id,
        type: 'var.set',
        params: { varId: BUREAU_VAR_ID, value: true },
        _expandBureau: items.map((m) => m.id),
        _creatorMeta: { kind: 'unlock_bureau', count: items.length },
      };
    }
    case 'show_item':
      return { id, type: 'media.showItem', params: { mediaItemId: a.mediaItemId } };
    case 'hide_item':
      return { id, type: 'media.hideItem', params: { mediaItemId: a.mediaItemId } };
    case 'set_flag':
      return {
        id,
        type: 'var.set',
        params: { varId: a.varId, value: a.value },
      };
    case 'wait_then':
      return {
        id,
        type: 'schedule.after',
        params: {
          afterMinutes: Number(a.afterMinutes),
          scheduleId: a.scheduleId,
          emitEventType: 'time.schedule',
          missPolicy: a.missPolicy || 'expire',
          payload: { scheduleId: a.scheduleId },
        },
      };
    case 'notify':
      return { id, type: 'ui.notify', params: { message: a.message } };
    case 'show_observation':
      return {
        id,
        type: 'ui.observe',
        params: { title: a.title || 'Fenêtre d’observation', message: a.message || a.text },
      };
    case 'unlock_floor': {
      const idx = Number(a.floorIndex);
      if (Number.isNaN(idx)) fail('N° étage requis pour débloquer');
      return {
        id,
        type: 'var.set',
        params: { varId: floorVarId(idx), value: true },
        _creatorMeta: { kind: 'unlock_floor', floorIndex: idx, label: a.label },
      };
    }
    case 'add_journal': {
      if (!a.noteId) fail('Identifiant de note journal requis');
      return {
        id,
        type: 'journal.addNote',
        params: { noteId: a.noteId, message: a.message, title: a.label || 'Note' },
        _alsoNotify: null,
        _alsoFlag: `journal_${a.noteId}`,
        _creatorMeta: { kind: 'add_journal', message: a.message, noteId: a.noteId },
      };
    }
    case 'set_object_state':
      return {
        id,
        type: 'object.setState',
        params: { objectId: a.objectId, value: a.value },
      };
    case 'show_code_input':
      return {
        id,
        type: 'ui.notify',
        params: {
          message: a.message || `Saisie de code disponible (${a.choiceId || 'code_input'})`,
        },
      };
    case 'show_button':
      return {
        id,
        type: 'ui.notify',
        params: {
          message: a.label
            ? `Bouton disponible : « ${a.label} »`
            : `Bouton disponible (${a.choiceId})`,
        },
      };
    default:
      fail(`Action inconnue: ${a.kind}`);
  }
}

function expandCompiledActions(rawActions, context = {}) {
  const out = [];
  rawActions.forEach((a, index) => {
    const compiled = typeof a.type === 'string' && a.id ? a : compileAction(a, index, context);
    if (compiled._expandBureau) {
      const { _expandBureau, _creatorMeta, ...rest } = compiled;
      out.push(rest);
      _expandBureau.forEach((mid, i) => {
        out.push({
          id: `${compiled.id}_unlock_${i}`,
          type: 'media.unlock',
          params: { mediaItemId: mid },
        });
        out.push({
          id: `${compiled.id}_show_${i}`,
          type: 'media.showItem',
          params: { mediaItemId: mid },
        });
      });
      out.push({
        id: `${compiled.id}_msg`,
        type: 'ui.notify',
        params: {
          message:
            _expandBureau.length > 0
              ? `Le Bureau est déverrouillé. ${_expandBureau.length} objet(s) accessible(s).`
              : 'Le Bureau est déverrouillé.',
        },
      });
      return;
    }
    // Strip meta then expand journal → var.set + notify
    if (compiled._alsoNotify) {
      const { _alsoNotify, _creatorMeta, _alsoFlag, ...rest } = compiled;
      out.push(rest);
      if (_alsoFlag) {
        out.push({
          id: `${compiled.id}_flag`,
          type: 'var.set',
          params: { varId: _alsoFlag, value: true },
        });
      }
      if (_alsoNotify) {
        out.push({
          id: `${compiled.id}_msg`,
          type: 'ui.notify',
          params: { message: _alsoNotify },
        });
      }
      return;
    }
    if (compiled._alsoFlag) {
      const { _alsoFlag, _creatorMeta, ...rest } = compiled;
      out.push(rest);
      out.push({
        id: `${compiled.id}_flag`,
        type: 'var.set',
        params: { varId: _alsoFlag, value: true },
      });
      return;
    }
    if (compiled._creatorMeta) {
      const { _creatorMeta, ...rest } = compiled;
      out.push(rest);
      if (_creatorMeta.kind === 'unlock_floor') {
        out.push({
          id: `${compiled.id}_msg`,
          type: 'ui.notify',
          params: {
            message:
              _creatorMeta.label ||
              `Étage ${_creatorMeta.floorIndex} débloqué`,
          },
        });
      }
      return;
    }
    out.push(compiled);
  });
  return out;
}

function buildConditionExpr(parts) {
  const children = parts.filter(Boolean);
  if (children.length === 0) return { op: 'true' };
  if (children.length === 1) return children[0];
  return { op: 'and', children };
}

function occurrenceFromSituation(situation) {
  const occ = situation.occurrence || {};
  const out = {
    kind: occ.once === false ? 'always' : 'once_per_run',
  };
  if (occ.missExpire) out.missPolicy = 'expire';
  return out;
}

/**
 * Compile une branche (conditions + then) en une Rule.
 */
function compileBranchRule({
  situation,
  branch,
  triggerCompiled,
  sharedConditionExpr,
  exclusiveGroupId,
  priority,
  suffix,
  context,
}) {
  const branchConds = (branch.conditions || []).map((c) =>
    c.op ? compileCreatorExpr(c) : compileCondition(c)
  );
  const parts = [];
  if (triggerCompiled.extraConditions?.length) {
    parts.push(...triggerCompiled.extraConditions);
  }
  if (sharedConditionExpr && sharedConditionExpr.op !== 'true') {
    parts.push(sharedConditionExpr);
  }
  parts.push(...branchConds);
  const condition = buildConditionExpr(parts);
  const actions = expandCompiledActions(branch.thenActions || branch.actions || [], context);
  if (actions.length === 0) fail(`Branche « ${branch.label || suffix} » : au moins une action ALORS`);

  return {
    id: branch.ruleId || `${situation.id || 'sit'}_${suffix}`,
    title: branch.label
      ? `${situation.title} — ${branch.label}`
      : situation.title || 'Situation',
    enabled: situation.enabled !== false,
    priority: priority ?? 100,
    exclusiveGroupId: exclusiveGroupId || undefined,
    listen: triggerCompiled.listen,
    condition,
    actions,
    occurrence: occurrenceFromSituation(situation),
  };
}

/**
 * @param {object} situation — modèle créateur
 * @param {object} [context] — lantern draft (zones, media…) pour validation douce
 * @returns {{ rules, elseRule, humanSummary, enginePreview }}
 */
function compileSituation(situation, context = {}) {
  if (!situation || typeof situation !== 'object') fail('Situation invalide');
  if (!situation.title) fail('Titre de situation requis');

  const sitId = situation.id || slugId('sit', situation.title);
  situation = { ...situation, id: sitId };

  const triggerCompiled = compileTrigger(situation.trigger);
  const sharedConditionExpr = compileSituationConditions(situation);

  const rules = [];
  let elseRule = null;

  if (situation.branches && situation.branches.length > 0) {
    const groupId = situation.exclusiveGroupId || `${sitId}_branches`;
    situation.branches.forEach((br, i) => {
      rules.push(
        compileBranchRule({
          situation,
          branch: br,
          triggerCompiled,
          sharedConditionExpr,
          exclusiveGroupId: groupId,
          priority: 100 - i,
          suffix: `br_${i}`,
          context,
        })
      );
    });
  } else {
    rules.push(
        compileBranchRule({
          situation,
          branch: {
            label: null,
            conditions: [],
            thenActions: situation.thenActions || [],
          },
          triggerCompiled,
          sharedConditionExpr,
          priority: situation.priority || 100,
          suffix: 'main',
          context,
        })
    );
  }

  if (situation.elseActions && situation.elseActions.length > 0) {
    // SINON : même déclencheur, conditions SI non remplies
    if (!situation.branches?.length && sharedConditionExpr && sharedConditionExpr.op !== 'true') {
      elseRule = {
        id: `${sitId}_else`,
        title: `${situation.title} — Sinon`,
        enabled: situation.enabled !== false,
        priority: (situation.priority || 100) - 50,
        listen: triggerCompiled.listen,
        condition: {
          op: 'and',
          children: [
            ...triggerCompiled.extraConditions,
            { op: 'not', child: sharedConditionExpr },
          ],
        },
        actions: expandCompiledActions(situation.elseActions, context),
        occurrence: occurrenceFromSituation(situation),
      };
      rules.push(elseRule);
    }
  }

  const humanSummary = summarizeSituation(situation);

  // Preview fragment definition (rules only) — validable si contexte fourni
  const preview = {
    id: context.lanternId || 'lantern_creator_draft',
    engineSchemaVersion: 1,
    timezone: context.timezone || 'Europe/Paris',
    rules,
    zones: context.zones || [],
    mediaItems: context.mediaItems || [],
    variables: context.variables || [],
  };

  try {
    validateDefinition(preview);
  } catch (e) {
    // Si zones/media absents du contexte, la validation structurelle rules OK
    // mais refs peuvent manquer — on valide au minimum la forme des rules
    if (!e.message.includes('listen') && !String(e.message).includes('condition')) {
      // garder soft : compile réussit, warning
      preview._validationWarning = e.message;
    } else {
      throw e;
    }
  }

  return {
    situationId: sitId,
    title: situation.title,
    rules,
    humanSummary,
    enginePreview: {
      rules: rules.map((r) => ({
        id: r.id,
        title: r.title,
        listen: r.listen,
        exclusiveGroupId: r.exclusiveGroupId || null,
        actionsCount: r.actions.length,
      })),
    },
    compiledDefinitionFragment: preview,
  };
}

function summarizeSituation(situation) {
  const lines = [];
  lines.push({ role: 'title', text: situation.title });
  if (situation.letter) {
    lines.push({ role: 'letter', text: `Situation ${situation.letter}` });
  }
  if (situation.trigger) {
    lines.push({
      role: 'when',
      text: humanTrigger(situation.trigger),
    });
  }
  const condNodes = situation.conditionsGroup
    ? [situation.conditionsGroup]
    : situation.conditions || [];
  for (const c of condNodes) {
    lines.push({ role: 'if', text: humanCondition(c) });
  }
  if (situation.branches) {
    for (const br of situation.branches) {
      lines.push({ role: 'branch', text: br.label || 'Branche' });
      for (const c of br.conditions || []) {
        lines.push({ role: 'if', text: `  ${humanCondition(c)}` });
      }
      for (const a of br.thenActions || []) {
        lines.push({ role: 'then', text: `  ${humanAction(a)}` });
      }
    }
  } else {
    for (const a of situation.thenActions || []) {
      lines.push({ role: 'then', text: humanAction(a) });
    }
  }
  for (const a of situation.elseActions || []) {
    lines.push({ role: 'else', text: humanAction(a) });
  }
  if (situation.transition?.unlockFloor != null) {
    lines.push({
      role: 'transition',
      text: `DONC débloquer l’étage ${situation.transition.unlockFloor}`,
    });
  }
  return lines;
}

function humanTrigger(t) {
  const map = {
    media_discovered: `Le joueur découvre « ${t.label || t.mediaItemId} »`,
    media_consumed: `Le joueur consomme « ${t.label || t.mediaItemId} »`,
    media_opened: `Le joueur ouvre « ${t.label || t.mediaItemId} »`,
    beacon_found: `Le joueur trouve la balise « ${t.label || t.beaconId} »`,
    time_reached: `L’heure prévue arrive (${t.scheduleId})`,
    run_started: 'L’aventure commence',
    player_choice: `Le joueur appuie sur « ${t.label || t.choiceId} »`,
    code_submitted: `Le joueur entre le code « ${t.expected} »`,
    player_moves: 'Le joueur se déplace',
  };
  return map[t.kind] || t.kind;
}

function humanCondition(c) {
  if (!c) return '';
  if (c.op === 'and') {
    return (c.children || []).map(humanCondition).join(' ET ');
  }
  if (c.op === 'or') {
    return `(${(c.children || []).map(humanCondition).join(' OU ')})`;
  }
  if (c.op === 'not') {
    return `PAS (${humanCondition(c.child)})`;
  }
  switch (c.kind) {
    case 'player_in_place':
      return `Le joueur est dans « ${c.label || c.zoneId} »`;
    case 'player_in_any_place':
      return `Le joueur est dans l’un de : ${(c.labels || c.zoneIds || []).join(', ')}`;
    case 'clock_is':
      return `Il est ${c.at}`;
    case 'clock_between':
      return `Il est entre ${c.start} et ${c.end}`;
    case 'media_discovered':
      return `Le joueur a découvert « ${c.label || c.mediaItemId} »`;
    case 'media_consumed':
      return `Le joueur a consommé « ${c.label || c.mediaItemId} »`;
    case 'media_unlocked':
      return `« ${c.label || c.mediaItemId} » est déverrouillé`;
    case 'flag_false':
      return c.label || `« ${c.varId} » n’est pas encore arrivé`;
    case 'flag_true':
      return c.label || `« ${c.varId} » est déjà arrivé`;
    case 'choice_equals':
      return `Choix « ${c.choiceId} » = ${c.value}`;
    case 'floor_open':
      return `L’étage ${c.floorIndex} est accessible`;
    case 'object_state':
      return `« ${c.objectId} » est « ${c.value} »`;
    default:
      return c.kind || JSON.stringify(c);
  }
}

function humanAction(a) {
  switch (a.kind) {
    case 'ring_phone':
      return `Faire sonner le téléphone${a.label ? ` (« ${a.label} »)` : ''}`;
    case 'ring_talkie':
      return `Faire sonner le talkie-walkie${a.label ? ` (« ${a.label} »)` : ''}`;
    case 'play_media':
      return `Lire « ${a.label || a.mediaContentId} »`;
    case 'unlock_media':
      return `Débloquer « ${a.label || a.mediaItemId} »`;
    case 'unlock_bureau':
      return 'Déverrouiller le Bureau (tous ses objets)';
    case 'show_item':
      return `Afficher « ${a.label || a.mediaItemId} »`;
    case 'hide_item':
      return `Masquer « ${a.label || a.mediaItemId} »`;
    case 'set_flag':
      return a.label || `Modifier l’état « ${a.varId} » → ${JSON.stringify(a.value)}`;
    case 'wait_then':
      return a.label || `Attendre ${a.afterMinutes} min puis déclencher`;
    case 'notify':
      return `Message : ${a.message}`;
    case 'show_observation':
      return `Fenêtre d’observation : ${(a.message || a.text || '').slice(0, 80)}`;
    case 'unlock_floor':
      return a.label || `Débloquer l’étage ${a.floorIndex}`;
    case 'add_journal':
      return `Note journal : ${a.message || a.noteId}`;
    case 'set_object_state':
      return a.label || `« ${a.objectId} » → « ${a.value} »`;
    case 'show_code_input':
      return `Afficher saisie de code (${a.choiceId || 'code'})`;
    case 'show_button':
      return `Afficher le bouton « ${a.label || a.choiceId} »`;
    default:
      return a.kind;
  }
}

/**
 * Fusionne les rules compilées dans une definition de base (fixture ou draft).
 */
function mergeCompiledIntoDefinition(baseDefinition, compileResult) {
  const def = structuredClone(baseDefinition);
  const newIds = new Set(compileResult.rules.map((r) => r.id));
  def.rules = (def.rules || []).filter((r) => !newIds.has(r.id));
  def.rules.push(...compileResult.rules);
  return def;
}

module.exports = {
  compileSituation,
  compileTrigger,
  compileCondition,
  compileAction,
  compileCreatorExpr,
  compileSituationConditions,
  floorVarId,
  humanTrigger,
  humanCondition,
  humanAction,
  summarizeSituation,
  mergeCompiledIntoDefinition,
  expandCompiledActions,
};
