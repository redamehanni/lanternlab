/**
 * Traduit une trace moteur en récit créateur (humain).
 */

const { humanCondition, humanAction } = require('./compile');

function explainSimulation(handleResult, { situation = null } = {}) {
  const trace = handleResult.trace || {};
  const fired = handleResult.rulesFired || [];
  const uiPlan = handleResult.uiPlan || [];
  const misses = trace.misses || [];

  const whatHappens = [];
  for (const u of uiPlan) {
    if (u.kind === 'ring_phone') whatHappens.push({ icon: '📞', text: 'Le téléphone sonne' });
    else if (u.kind === 'ring_talkie') whatHappens.push({ icon: '📻', text: 'Le talkie-walkie sonne' });
    else if (u.kind === 'play_media') {
      whatHappens.push({ icon: '🎧', text: `Lecture : « ${u.label || u.mediaContentId} »` });
    } else if (u.kind === 'notify') {
      whatHappens.push({ icon: '💬', text: u.message || 'Message affiché' });
    } else if (u.kind === 'observe') {
      whatHappens.push({ icon: '🔎', text: `Fenêtre d’observation : ${u.message || u.title || ''}` });
    } else if (u.kind === 'journal_note') {
      whatHappens.push({ icon: '📓', text: `Note journal : ${u.message || u.title || ''}` });
    } else {
      whatHappens.push({ icon: '•', text: u.kind });
    }
  }
  for (const f of fired) {
    for (const a of f.actions || []) {
      if (a.type === 'var.set' && a.ok) {
        const v = a.effect?.varId;
        const val = a.effect?.value;
        if (String(v || '').includes('miss')) {
          whatHappens.push({ icon: '🟠', text: 'Situation marquée comme manquée' });
        } else if (val === true) {
          whatHappens.push({ icon: '✓', text: `État enregistré : ${v}` });
        }
      }
      if (a.type === 'schedule.after' && a.ok) {
        whatHappens.push({
          icon: '⏳',
          text: `Action programmée (${a.schedule?.dueAt || 'délai relatif'})`,
        });
      }
    }
  }

  const why = [];
  const matched = (trace.candidates || []).filter((c) => c.match);
  const unmatched = (trace.candidates || []).filter((c) => !c.match);

  if (matched.length) {
    for (const c of matched[0].conditions || []) {
      if (c.ok) why.push({ ok: true, text: humanizePredicate(c) });
    }
  } else if (unmatched.length) {
    // Expliquer la première candidate liée à la situation si possible
    const focus =
      unmatched.find((c) => situation && String(c.ruleId).includes(situation.id)) ||
      unmatched[0];
    for (const c of focus.conditions || []) {
      why.push({
        ok: c.ok,
        text: humanizePredicate(c),
      });
    }
  }

  let status = 'none';
  let headline = 'Situation non déclenchée';
  if (misses.length && !uiPlan.some((u) => u.kind === 'ring_phone' || u.kind === 'ring_talkie')) {
    status = 'missed';
    headline = 'Situation manquée / expirée';
  } else if (fired.length && whatHappens.length) {
    status = 'triggered';
    headline = 'Situation déclenchée';
  } else if (fired.length) {
    status = 'triggered';
    headline = 'Situation déclenchée';
  } else {
    status = 'not_triggered';
    headline = 'Situation non déclenchée';
  }

  return {
    status, // triggered | not_triggered | missed
    headline,
    whatHappens,
    why,
    technicalAvailable: true,
  };
}

function humanizePredicate(c) {
  const t = c.type;
  const p = c.params || {};
  if (t === 'geo.inZone') return `Le joueur est dans le lieu « ${p.zoneId} »`;
  if (t === 'geo.inAnyZone') return `Le joueur est dans l’une des zones : ${(p.zoneIds || []).join(', ')}`;
  if (t === 'time.equalsMinute') return `Il est ${p.at}`;
  if (t === 'time.inWindow') return `Il est entre ${p.start} et ${p.end}`;
  if (t === 'media.discovered') return `Le joueur a découvert « ${p.mediaItemId} »`;
  if (t === 'media.consumed') return `Le joueur a consommé « ${p.mediaItemId} »`;
  if (t === 'var.equals') {
    if (p.value === false) return `« ${p.varId} » n’est pas encore arrivé`;
    if (p.value === true) return `« ${p.varId} » est déjà arrivé`;
    return `État « ${p.varId} » = ${JSON.stringify(p.value)}`;
  }
  if (t === 'event.payloadEquals') return `Événement concerne « ${p.value} »`;
  return t;
}

function explainTick(tickStep) {
  const processed = tickStep?.tick?.processed || [];
  const parts = processed.map((p) => {
    const inner = p.handleResult
      ? explainSimulation(p.handleResult)
      : { status: p.status, headline: p.status, whatHappens: [], why: [] };
    return {
      scheduleId: p.scheduleId,
      jobStatus: p.status,
      ...inner,
    };
  });
  return { kind: 'tick', parts };
}

module.exports = {
  explainSimulation,
  explainTick,
  humanizePredicate,
  humanCondition,
  humanAction,
};
