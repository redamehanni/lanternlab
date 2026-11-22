/**
 * E6 — projections Lab (Timeline, Carte, Médias).
 * Lecture / patch du brouillon d’aventure. Pas un second moteur :
 * l’évaluation reste lanternEngine.handleEvent via simulate.
 */

const { ensureInventory, collectRefs, CONTENT_KINDS, addMediaContent } = require('./inventory');
const { PARIS_ARRONDISSEMENT_CENTERS } = require('../zones');

function hhmmToMin(s) {
  const m = String(s || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function walkCreatorNode(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  if (node.op === 'and' || node.op === 'or') {
    (node.children || []).forEach((c) => walkCreatorNode(c, visit));
  }
  if (node.op === 'not') walkCreatorNode(node.child, visit);
}

function eachSituation(adventure, fn) {
  for (const floor of adventure.floors || []) {
    for (const sit of floor.situations || []) fn(floor, sit);
  }
}

function findSituation(adventure, situationId) {
  for (const floor of adventure.floors || []) {
    const sit = (floor.situations || []).find((s) => s.id === situationId);
    if (sit) return { floor, sit };
  }
  return null;
}

function collectConditionNodes(sit) {
  const nodes = [];
  if (sit.conditionsGroup) walkCreatorNode(sit.conditionsGroup, (n) => nodes.push(n));
  for (const c of sit.conditions || []) walkCreatorNode(c, (n) => nodes.push(n));
  return nodes;
}

function sitLabel(sit) {
  return sit.title || sit.label || sit.letter || sit.id;
}

function mentionsId(obj, id) {
  if (!id || obj == null) return false;
  const blob = JSON.stringify(obj);
  return typeof blob === 'string' && blob.includes(`"${id}"`);
}

function buildTimeline(adventure) {
  const a = ensureInventory(adventure);
  const cues = [];
  eachSituation(a, (floor, sit) => {
    const base = {
      situationId: sit.id,
      situationLabel: sitLabel(sit),
      floorIndex: floor.index,
      floorTitle: floor.title || `Étage ${floor.index}`,
    };
    if (sit.trigger?.kind === 'time_reached') {
      cues.push({
        id: `${sit.id}:trigger`,
        kind: 'schedule',
        family: 'call',
        label: sit.trigger.label || `Heure prévue (${sit.trigger.scheduleId || '?'})`,
        scheduleId: sit.trigger.scheduleId || '',
        editable: ['scheduleId'],
        ...base,
      });
    }
    collectConditionNodes(sit).forEach((c, i) => {
      if (c.kind === 'clock_is' && c.at) {
        cues.push({
          id: `${sit.id}:clock_is:${i}`,
          kind: 'instant',
          family: 'window',
          at: c.at,
          startMin: hhmmToMin(c.at),
          durationMin: 1,
          label: `Il est ${c.at}`,
          editable: ['at'],
          ...base,
        });
      }
      if (c.kind === 'clock_between' && c.start && c.end) {
        const startMin = hhmmToMin(c.start);
        const endMin = hhmmToMin(c.end);
        cues.push({
          id: `${sit.id}:clock_between:${i}`,
          kind: 'window',
          family: 'window',
          start: c.start,
          end: c.end,
          startMin,
          durationMin: startMin != null && endMin != null ? Math.max(1, endMin - startMin) : null,
          label: `Entre ${c.start} et ${c.end}`,
          editable: ['start', 'end'],
          ...base,
        });
      }
    });
    const actions = [...(sit.thenActions || []), ...(sit.elseActions || [])];
    actions.forEach((act, i) => {
      if (act.kind === 'wait_then') {
        cues.push({
          id: `${sit.id}:wait:${i}`,
          kind: 'relative',
          family: 'expiry',
          afterMinutes: Number(act.afterMinutes) || 0,
          scheduleId: act.scheduleId || '',
          label: act.label || `Attendre ${act.afterMinutes || 0} min`,
          editable: ['afterMinutes', 'scheduleId'],
          ...base,
        });
      }
      if (act.kind === 'ring_phone' || act.kind === 'ring_talkie') {
        cues.push({
          id: `${sit.id}:${act.kind}:${i}`,
          kind: 'device',
          family: act.kind === 'ring_phone' ? 'call' : 'talkie',
          label: act.label || (act.kind === 'ring_phone' ? 'Sonnerie téléphone' : 'Sonnerie talkie'),
          editable: [],
          ...base,
        });
      }
    });
  });
  const timed = cues.filter((c) => c.startMin != null).sort((a, b) => a.startMin - b.startMin);
  const rest = cues.filter((c) => c.startMin == null);
  return {
    timezone: a.timezone || 'Europe/Paris',
    cues: [...timed, ...rest],
  };
}

function zonePoint(zone) {
  if (!zone) return null;
  if (zone.kind === 'circle' && zone.center) {
    return {
      lat: Number(zone.center.lat),
      lng: Number(zone.center.lng),
      radiusM: Number(zone.radiusM) || 100,
    };
  }
  if (zone.kind === 'arrondissement') {
    const approx = PARIS_ARRONDISSEMENT_CENTERS[Number(zone.code)];
    if (!approx) return null;
    return { lat: approx.lat, lng: approx.lng, radiusM: approx.radiusM };
  }
  return null;
}

function situationUsages(adventure, id) {
  const out = [];
  eachSituation(adventure, (floor, sit) => {
    if (mentionsId(sit, id) || mentionsId(floor.unlockNext, id)) {
      out.push({
        id: sit.id,
        label: sitLabel(sit),
        floorIndex: floor.index,
      });
    }
  });
  return out;
}

function buildMap(adventure) {
  const a = ensureInventory(adventure);
  const zones = a.zones.map((z) => ({
    ...z,
    point: zonePoint(z),
    usedBy: situationUsages(a, z.id),
  }));
  const beacons = a.beacons.map((b) => {
    const point =
      b.lat != null && b.lng != null
        ? { lat: Number(b.lat), lng: Number(b.lng) }
        : zonePoint(a.zones.find((z) => z.id === b.zoneId));
    return {
      ...b,
      point: point || null,
      usedBy: situationUsages(a, b.id),
    };
  });
  return {
    bounds: { west: 2.24, east: 2.47, south: 48.815, north: 48.905 },
    zones,
    beacons,
  };
}

function buildMediaGraph(adventure) {
  const a = ensureInventory(adventure);
  const items = a.mediaItems.map((item) => {
    const content = item.contentId ? a.mediaContents.find((c) => c.id === item.contentId) || null : null;
    return {
      itemId: item.id,
      label: item.label,
      skin: item.skin,
      role: item.role || null,
      policy: item.policy || null,
      content: content
        ? {
            id: content.id,
            kind: content.kind,
            label: content.label,
            body: content.body || null,
            uri: content.uri || null,
            mime: content.mime || null,
            originalName: content.originalName || null,
            hasFile: Boolean(content.uri),
          }
        : null,
      situations: situationUsages(a, item.id).concat(
        content ? situationUsages(a, content.id).filter((u) => u.id) : []
      ),
    };
  });
  const used = new Set(a.mediaItems.map((i) => i.contentId).filter(Boolean));
  const orphanContents = a.mediaContents
    .filter((c) => !used.has(c.id))
    .map((c) => ({
      id: c.id,
      kind: c.kind,
      label: c.label,
      body: c.body || null,
      uri: c.uri || null,
      hasFile: Boolean(c.uri),
    }));
  return { items, orphanContents, contentKinds: CONTENT_KINDS };
}

function buildE6(adventure) {
  const a = ensureInventory(adventure);
  return {
    timeline: buildTimeline(a),
    map: buildMap(a),
    media: buildMediaGraph(a),
    refs: {
      situationCount: (a.floors || []).reduce((n, f) => n + (f.situations || []).length, 0),
      ...(() => {
        const r = collectRefs(a);
        return {
          mediaItemIds: [...r.mediaItemIds],
          zoneIds: [...r.zoneIds],
          beaconIds: [...r.beaconIds],
        };
      })(),
    },
  };
}

function matchNode(node, kind, match = {}) {
  if (!node || node.kind !== kind) return false;
  for (const [k, v] of Object.entries(match)) {
    if (v != null && v !== '' && node[k] !== v) return false;
  }
  return true;
}

function patchFirst(nodes, kind, match, patch) {
  const node = nodes.find((n) => matchNode(n, kind, match));
  if (!node) return false;
  Object.assign(node, patch);
  return true;
}

function addClockBetween(sit, start, end) {
  const cond = { kind: 'clock_between', start, end, label: `Entre ${start} et ${end}` };
  if (sit.conditionsGroup) {
    if (sit.conditionsGroup.op === 'and') {
      sit.conditionsGroup.children = [...(sit.conditionsGroup.children || []), cond];
    } else {
      sit.conditionsGroup = { op: 'and', children: [sit.conditionsGroup, cond] };
    }
    return cond;
  }
  if (!Array.isArray(sit.conditions)) sit.conditions = [];
  sit.conditions.push(cond);
  return cond;
}

function applyCuePatch(adventure, payload = {}) {
  const a = ensureInventory(adventure);
  const found = findSituation(a, payload.situationId);
  if (!found) {
    const err = new Error(`Situation introuvable: ${payload.situationId}`);
    err.status = 404;
    throw err;
  }
  const { sit } = found;
  const kind = payload.kind;
  const match = payload.match || {};
  const patch = payload.patch || {};

  if (payload.add === 'clock_between') {
    const start = String(payload.start || patch.start || '').trim();
    const end = String(payload.end || patch.end || '').trim();
    if (hhmmToMin(start) == null || hhmmToMin(end) == null) {
      const err = new Error('Heures début et fin requises (HH:mm)');
      err.status = 400;
      throw err;
    }
    addClockBetween(sit, start, end);
    return { adventure: a, situation: sit };
  }

  if (kind === 'time_reached' || kind === 'schedule') {
    if (!sit.trigger || sit.trigger.kind !== 'time_reached') {
      const err = new Error('Cette situation n’est pas déclenchée par une heure prévue');
      err.status = 400;
      throw err;
    }
    if (patch.scheduleId != null) sit.trigger.scheduleId = String(patch.scheduleId).trim();
    return { adventure: a, situation: sit };
  }

  const conds = collectConditionNodes(sit);
  if (kind === 'clock_is' || kind === 'instant') {
    if (patch.at && hhmmToMin(patch.at) == null) {
      const err = new Error('Heure invalide (HH:mm)');
      err.status = 400;
      throw err;
    }
    if (!patchFirst(conds, 'clock_is', match.at ? { at: match.at } : {}, patch)) {
      const err = new Error('Condition « il est » introuvable');
      err.status = 404;
      throw err;
    }
    return { adventure: a, situation: sit };
  }
  if (kind === 'clock_between' || kind === 'window') {
    if ((patch.start && hhmmToMin(patch.start) == null) || (patch.end && hhmmToMin(patch.end) == null)) {
      const err = new Error('Heure invalide (HH:mm)');
      err.status = 400;
      throw err;
    }
    const m = {};
    if (match.start) m.start = match.start;
    if (match.end) m.end = match.end;
    if (!patchFirst(conds, 'clock_between', m, patch)) {
      const err = new Error('Fenêtre horaire introuvable');
      err.status = 404;
      throw err;
    }
    return { adventure: a, situation: sit };
  }
  if (kind === 'wait_then' || kind === 'relative') {
    const actions = [...(sit.thenActions || []), ...(sit.elseActions || [])];
    const act = actions.find(
      (x) => x.kind === 'wait_then' && (!match.scheduleId || x.scheduleId === match.scheduleId)
    );
    if (!act) {
      const err = new Error('Délai relatif introuvable');
      err.status = 404;
      throw err;
    }
    if (patch.afterMinutes != null) act.afterMinutes = Number(patch.afterMinutes);
    if (patch.scheduleId != null) act.scheduleId = String(patch.scheduleId).trim();
    return { adventure: a, situation: sit };
  }

  const err = new Error(`Type de cue inconnu: ${kind}`);
  err.status = 400;
  throw err;
}

function updateZone(adventure, id, patch = {}) {
  const a = ensureInventory(adventure);
  const zone = a.zones.find((z) => z.id === id);
  if (!zone) {
    const err = new Error(`Lieu introuvable: ${id}`);
    err.status = 404;
    throw err;
  }
  if (patch.label != null && String(patch.label).trim()) zone.label = String(patch.label).trim();
  if (zone.kind === 'circle') {
    const lat = patch.lat ?? patch.center?.lat;
    const lng = patch.lng ?? patch.center?.lng;
    if (lat != null && lng != null) {
      zone.center = { lat: Number(lat), lng: Number(lng) };
    }
    if (patch.radiusM != null) zone.radiusM = Number(patch.radiusM);
  }
  if (zone.kind === 'arrondissement' && patch.code != null) {
    const code = Number(patch.code);
    if (!code || code < 1 || code > 20) {
      const err = new Error('Arrondissement : code 1 à 20');
      err.status = 400;
      throw err;
    }
    zone.code = code;
  }
  return zone;
}

function updateBeacon(adventure, id, patch = {}) {
  const a = ensureInventory(adventure);
  const beacon = a.beacons.find((b) => b.id === id);
  if (!beacon) {
    const err = new Error(`Balise introuvable: ${id}`);
    err.status = 404;
    throw err;
  }
  if (patch.label != null && String(patch.label).trim()) beacon.label = String(patch.label).trim();
  if (patch.channel === 'qr' || patch.channel === 'nfc') beacon.channel = patch.channel;
  if (patch.tokenId != null && String(patch.tokenId).trim()) beacon.tokenId = String(patch.tokenId).trim();
  if (patch.zoneId !== undefined) beacon.zoneId = patch.zoneId || null;
  if (patch.lat != null && patch.lng != null) {
    beacon.lat = Number(patch.lat);
    beacon.lng = Number(patch.lng);
  }
  if (patch.lat === null && patch.lng === null) {
    delete beacon.lat;
    delete beacon.lng;
  }
  return beacon;
}

function updateMediaContent(adventure, id, patch = {}) {
  const a = ensureInventory(adventure);
  let content = a.mediaContents.find((c) => c.id === id);
  if (!content && patch.create) {
    content = addMediaContent(a, {
      id,
      label: patch.label,
      kind: patch.kind,
      body: patch.body,
    });
  }
  if (!content) {
    const err = new Error(`Contenu introuvable: ${id}`);
    err.status = 404;
    throw err;
  }
  if (patch.label != null && String(patch.label).trim()) content.label = String(patch.label).trim();
  if (patch.kind && CONTENT_KINDS.some((k) => k.id === patch.kind)) content.kind = patch.kind;
  if (patch.body !== undefined) content.body = patch.body == null ? '' : String(patch.body);
  if (patch.uri !== undefined) content.uri = patch.uri || null;
  if (patch.mime !== undefined) content.mime = patch.mime || null;
  if (patch.originalName !== undefined) content.originalName = patch.originalName || null;
  if (patch.fileId !== undefined) content.fileId = patch.fileId || null;
  if (patch.clearFile) {
    content.uri = null;
    content.mime = null;
    content.originalName = null;
    content.fileId = null;
  }
  return content;
}

function bindItemContent(adventure, itemId, contentId) {
  const a = ensureInventory(adventure);
  const item = a.mediaItems.find((m) => m.id === itemId);
  if (!item) {
    const err = new Error(`Objet introuvable: ${itemId}`);
    err.status = 404;
    throw err;
  }
  if (contentId) {
    const content = a.mediaContents.find((c) => c.id === contentId);
    if (!content) {
      const err = new Error(`Contenu introuvable: ${contentId}`);
      err.status = 404;
      throw err;
    }
    item.contentId = contentId;
  } else {
    item.contentId = null;
  }
  return item;
}

function ensureContentForItem(adventure, itemId, { kind, label } = {}) {
  const a = ensureInventory(adventure);
  const item = a.mediaItems.find((m) => m.id === itemId);
  if (!item) {
    const err = new Error(`Objet introuvable: ${itemId}`);
    err.status = 404;
    throw err;
  }
  if (item.contentId) {
    const existing = a.mediaContents.find((c) => c.id === item.contentId);
    if (existing) return existing;
  }
  const content = addMediaContent(a, {
    label: label || item.label || 'Nouveau contenu',
    kind: kind || 'text',
  });
  item.contentId = content.id;
  return content;
}

module.exports = {
  hhmmToMin,
  buildTimeline,
  buildMap,
  buildMediaGraph,
  buildE6,
  zonePoint,
  findSituation,
  applyCuePatch,
  updateZone,
  updateBeacon,
  updateMediaContent,
  bindItemContent,
  ensureContentForItem,
};
