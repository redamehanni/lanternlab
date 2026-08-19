/**
 * Compile les contenants créateur → Rules Lantern Engine.
 * Pas d’évaluation ici : ouvrir une boîte / entrer un code = rules existantes.
 */

function containerOpenVar(id) {
  return `container_${id}_open`;
}

function compileContainerRules(container) {
  const itemId = container.mediaItemId || container.id;
  const label = container.label || itemId;
  const contains = (container.contains || []).filter(Boolean);
  const rules = [];

  const unlockContents = [];
  contains.forEach((cid, i) => {
    unlockContents.push({
      id: `act_${itemId}_unlock_${i}`,
      type: 'media.unlock',
      params: { mediaItemId: cid },
    });
    unlockContents.push({
      id: `act_${itemId}_show_${i}`,
      type: 'media.showItem',
      params: { mediaItemId: cid },
    });
  });
  (container.links || []).forEach((link, i) => {
    if (!link || !link.url) return;
    unlockContents.push({
      id: `act_${itemId}_link_note_${i}`,
      type: 'journal.addNote',
      params: {
        noteId: `link_${itemId}_${link.id || i}`,
        title: link.label || 'Lien',
        message: `${link.label || 'Lien'} : ${link.url}`,
      },
    });
    unlockContents.push({
      id: `act_${itemId}_link_msg_${i}`,
      type: 'ui.notify',
      params: { message: `Lien : ${link.label || 'Page'} — ${link.url}` },
    });
  });

  if (container.lockWithCode && container.code) {
    const choiceId = container.codeChoiceId || `code_${itemId}`;
    const openVar = containerOpenVar(itemId);

    rules.push({
      id: `container_${itemId}_ask_code`,
      title: `${label} — demander le code`,
      enabled: true,
      priority: 90,
      listen: ['media.consumed', 'media.opened'],
      condition: {
        op: 'and',
        children: [
          { type: 'event.payloadEquals', key: 'mediaItemId', value: itemId },
          {
            op: 'not',
            child: { type: 'var.equals', varId: openVar, value: true },
          },
        ],
      },
      actions: [
        {
          id: `act_${itemId}_prompt`,
          type: 'ui.notify',
          params: {
            message: `« ${label} » est verrouillée. Saisie de code disponible (${choiceId}).`,
          },
        },
      ],
      occurrence: { kind: 'always' },
    });

    rules.push({
      id: `container_${itemId}_unlock`,
      title: `${label} — code correct`,
      enabled: true,
      priority: 100,
      listen: ['choice.made'],
      condition: {
        op: 'and',
        children: [
          { type: 'event.payloadEquals', key: 'choiceId', value: choiceId },
          { type: 'event.payloadEquals', key: 'value', value: String(container.code) },
        ],
      },
      actions: [
        {
          id: `act_${itemId}_opened`,
          type: 'var.set',
          params: { varId: openVar, value: true },
        },
        ...unlockContents,
        {
          id: `act_${itemId}_open_msg`,
          type: 'ui.notify',
          params: {
            message: `« ${label} » s’ouvre.${contains.length ? ' Son contenu est accessible.' : ''}`,
          },
        },
      ],
      occurrence: { kind: 'once_per_run' },
    });

    rules.push({
      id: `container_${itemId}_wrong`,
      title: `${label} — code incorrect`,
      enabled: true,
      priority: 80,
      listen: ['choice.made'],
      condition: {
        op: 'and',
        children: [
          { type: 'event.payloadEquals', key: 'choiceId', value: choiceId },
          {
            op: 'not',
            child: { type: 'event.payloadEquals', key: 'value', value: String(container.code) },
          },
          {
            op: 'not',
            child: { type: 'var.equals', varId: openVar, value: true },
          },
        ],
      },
      actions: [
        {
          id: `act_${itemId}_wrong`,
          type: 'ui.notify',
          params: { message: `Mauvais code. « ${label} » reste fermée.` },
        },
      ],
      occurrence: { kind: 'always' },
    });
  } else {
    rules.push({
      id: `container_${itemId}_open`,
      title: `${label} — ouvrir`,
      enabled: true,
      priority: 90,
      listen: ['media.consumed', 'media.opened'],
      condition: { type: 'event.payloadEquals', key: 'mediaItemId', value: itemId },
      actions: [
        ...unlockContents,
        {
          id: `act_${itemId}_open_msg`,
          type: 'ui.notify',
          params: {
            message: `Vous ouvrez « ${label} ».${contains.length ? ' Son contenu est accessible.' : ''}`,
          },
        },
      ],
      occurrence: { kind: 'once_per_run' },
    });
  }

  return rules;
}

function containerVariables(container) {
  if (!(container.lockWithCode && container.code)) return [];
  const itemId = container.mediaItemId || container.id;
  return [
    {
      id: containerOpenVar(itemId),
      label: `${container.label || itemId} ouverte`,
      valueType: 'boolean',
      defaultValue: false,
      scope: 'run',
    },
  ];
}

module.exports = {
  compileContainerRules,
  containerVariables,
  containerOpenVar,
};
