/**
 * Compile objets recouvrables, analyses contextuelles et mutations d’objet
 * → rules Lantern Engine existantes (pas de second moteur).
 */

const { isRecoverableMedia, isBureauMedia, isImposedMedia } = require('./inventory');

function floorVarId(index) {
  return `etage_${Number(index)}_open`;
}

function analysisActions(analyses, prefix) {
  const actions = [];
  (analyses || []).forEach((an, i) => {
    if (!an || !an.text) return;
    if (an.kind === 'observe') {
      actions.push({
        id: `${prefix}_obs_${i}`,
        type: 'ui.observe',
        params: {
          title: an.title || 'Fenêtre d’observation',
          message: an.text,
        },
      });
    }
    if (an.kind === 'journal') {
      const noteId = an.noteId || `${prefix}_note_${i}`;
      actions.push({
        id: `${prefix}_jvar_${i}`,
        type: 'journal.addNote',
        params: { noteId, message: an.text, title: an.title || 'Note' },
      });
      actions.push({
        id: `${prefix}_jflag_${i}`,
        type: 'var.set',
        params: { varId: `journal_${noteId}`, value: true },
      });
    }
  });
  return actions;
}

function compileItemAnalysisRules(item) {
  const analyses = item.analyses || [];
  if (!analyses.length) return [];
  const actions = analysisActions(analyses, `item_${item.id}`);
  if (!actions.length) return [];
  return [
    {
      id: `analyse_item_${item.id}`,
      title: `Analyse — ${item.label || item.id}`,
      enabled: true,
      priority: 40,
      listen: ['media.consumed', 'media.opened', 'media.discovered'],
      condition: { type: 'event.payloadEquals', key: 'mediaItemId', value: item.id },
      actions,
      occurrence: { kind: 'once_per_run' },
    },
  ];
}

function compileRecoverableUnlockRule(item) {
  const u = item.unlockBy;
  if (!u || !u.kind) return [];
  const unlockActs = [
    { id: `rec_${item.id}_unlock`, type: 'media.unlock', params: { mediaItemId: item.id } },
    { id: `rec_${item.id}_show`, type: 'media.showItem', params: { mediaItemId: item.id } },
    {
      id: `rec_${item.id}_msg`,
      type: 'ui.notify',
      params: { message: `« ${item.label || item.id} » est accessible.` },
    },
  ];

  if (u.kind === 'code' && u.code) {
    const choiceId = u.choiceId || `code_${item.id}`;
    return [
      {
        id: `rec_${item.id}_unlock_code`,
        title: `${item.label || item.id} — code`,
        enabled: true,
        priority: 90,
        listen: ['choice.made'],
        condition: {
          op: 'and',
          children: [
            { type: 'event.payloadEquals', key: 'choiceId', value: choiceId },
            { type: 'event.payloadEquals', key: 'value', value: String(u.code) },
          ],
        },
        actions: unlockActs,
        occurrence: { kind: 'once_per_run' },
      },
    ];
  }

  if (u.kind === 'zone' && u.zoneId) {
    return [
      {
        id: `rec_${item.id}_unlock_zone`,
        title: `${item.label || item.id} — lieu`,
        enabled: true,
        priority: 90,
        listen: ['geo.heartbeat'],
        condition: { type: 'geo.inZone', zoneId: u.zoneId },
        actions: unlockActs,
        occurrence: { kind: 'once_per_run' },
      },
    ];
  }

  if (u.kind === 'beacon' && u.beaconId) {
    return [
      {
        id: `rec_${item.id}_unlock_beacon`,
        title: `${item.label || item.id} — balise`,
        enabled: true,
        priority: 90,
        listen: ['beacon.qr', 'beacon.nfc'],
        condition: { type: 'beacon.scanned', beaconId: u.beaconId },
        actions: unlockActs,
        occurrence: { kind: 'once_per_run' },
      },
    ];
  }

  return [];
}

function compileItemMutationRules(item) {
  const rules = [];
  (item.mutations || []).forEach((mut, i) => {
    if (!mut?.buttonLabel) return;
    const choiceId = mut.id || `mut_${item.id}_${i}`;
    const floorGate =
      mut.floorIndex != null
        ? { type: 'var.equals', varId: floorVarId(mut.floorIndex), value: true }
        : null;
    const condChildren = [{ type: 'event.payloadEquals', key: 'choiceId', value: choiceId }];
    if (floorGate) condChildren.unshift(floorGate);
    rules.push({
      id: `mut_${item.id}_${i}`,
      title: `${item.label || item.id} — ${mut.buttonLabel}`,
      enabled: true,
      priority: 80,
      listen: ['choice.made'],
      condition: { op: 'and', children: condChildren },
      actions: [
        {
          id: `mut_${item.id}_${i}_state`,
          type: 'object.setState',
          params: { objectId: item.id, value: mut.newState || 'changed' },
        },
        {
          id: `mut_${item.id}_${i}_msg`,
          type: 'ui.notify',
          params: { message: mut.buttonLabel },
        },
      ],
      occurrence: { kind: 'once_per_run' },
    });
  });
  return rules;
}

function compileMaterialRules(adventure) {
  const rules = [];
  const variables = [];
  const varIds = new Set();

  function collectJournalVars(analyses, prefix) {
    (analyses || []).forEach((an, i) => {
      if (an.kind !== 'journal' || !(an.noteId || an.text)) return;
      const noteId = an.noteId || `${prefix}_note_${i}`;
      const vid = `journal_${noteId}`;
      if (varIds.has(vid)) return;
      variables.push({
        id: vid,
        label: an.title || `Note ${noteId}`,
        valueType: 'boolean',
        defaultValue: false,
        scope: 'run',
      });
      varIds.add(vid);
    });
  }

  for (const item of adventure.mediaItems || []) {
    rules.push(...compileItemAnalysisRules(item));
    if (isRecoverableMedia(item, adventure) || (!isImposedMedia(item) && !isBureauMedia(item) && item.unlockBy)) {
      rules.push(...compileRecoverableUnlockRule(item));
    }
    rules.push(...compileItemMutationRules(item));
    collectJournalVars(item.analyses, `item_${item.id}`);
  }

  for (const f of adventure.floors || []) {
    collectJournalVars(f.analyses, `floor_${f.index}`);
    for (const s of f.situations || []) {
      collectJournalVars(s.analyses, `sit_${s.id}`);
    }
  }

  return { rules, variables, analysisActions };
}

function injectAnalysesIntoActions(thenActions, analyses, prefix) {
  const extra = [];
  (analyses || []).forEach((an, i) => {
    if (!an?.text) return;
    if (an.kind === 'observe') {
      extra.push({
        kind: 'show_observation',
        title: an.title || 'Fenêtre d’observation',
        message: an.text,
        id: `${prefix}_obs_${i}`,
      });
    }
    if (an.kind === 'journal') {
      extra.push({
        kind: 'add_journal',
        noteId: an.noteId || `${prefix}_note_${i}`,
        message: an.text,
        id: `${prefix}_j_${i}`,
      });
    }
  });
  return [...(thenActions || []), ...extra];
}

module.exports = {
  compileMaterialRules,
  compileRecoverableUnlockRule,
  compileItemAnalysisRules,
  analysisActions,
  injectAnalysesIntoActions,
};
