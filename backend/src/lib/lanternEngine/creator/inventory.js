/**
 * Inventaire créateur — objets, contenus, lieux, balises, interactions.
 * Données d’aventure uniquement ; le moteur n’est pas modifié.
 */

const { randomUUID } = require('crypto');

const CONTENT_KINDS = [
  { id: 'text', label: 'Texte' },
  { id: 'image', label: 'Image' },
  { id: 'audio', label: 'Audio' },
  { id: 'video', label: 'Vidéo' },
];

const ZONE_KINDS = [
  { id: 'circle', label: 'Lieu (cercle GPS)' },
  { id: 'arrondissement', label: 'Arrondissement parisien' },
];

const BEACON_CHANNELS = [
  { id: 'qr', label: 'QR' },
  { id: 'nfc', label: 'NFC' },
];

const INTERACTION_KINDS = [
  { id: 'button', label: 'Bouton' },
  { id: 'code', label: 'Saisie de code' },
];

const CONTAINER_KINDS = [
  {
    id: 'box',
    label: 'Boîte',
    skin: 'box',
    help: 'Objets divers.',
    allowsLinks: false,
    empty: 'Aucune boîte.',
  },
  {
    id: 'usb',
    label: 'Clé USB',
    skin: 'usb',
    help: 'Plusieurs fichiers : texte, image, audio, vidéo.',
    allowsLinks: false,
    empty: 'Aucune clé USB.',
  },
  {
    id: 'pc',
    label: 'PC',
    skin: 'pc',
    help: 'Fichiers + liens vers des pages web (partenariats, sites extérieurs).',
    allowsLinks: true,
    empty: 'Aucun PC.',
  },
  {
    id: 'folder',
    label: 'Pochette cartonnée',
    skin: 'folder',
    help: 'Documents papier (A4, courriers, dossiers…).',
    allowsLinks: false,
    empty: 'Aucune pochette cartonnée.',
  },
  {
    id: 'locker',
    label: 'Casier',
    skin: 'locker',
    help: 'Objets à récupérer plus tard (talkie, clés…).',
    allowsLinks: false,
    empty: 'Aucun casier.',
  },
];

/** Lieux de démonstration (Paris) — le créateur peut les copier, ce n’est pas du métier hardcodé. */
const ZONE_PRESETS = [
  { id: 'rue_paradis', label: 'Rue de Paradis', kind: 'circle', center: { lat: 48.8742, lng: 2.3548 }, radiusM: 120 },
  { id: 'sacre_coeur', label: 'Sacré-Cœur', kind: 'circle', center: { lat: 48.8867, lng: 2.3431 }, radiusM: 150 },
  { id: 'sainte_marie', label: 'Sainte-Marie (17e)', kind: 'circle', center: { lat: 48.8845, lng: 2.3219 }, radiusM: 100 },
  { id: 'pizzeria_oncle', label: 'Pizzeria de l’oncle', kind: 'circle', center: { lat: 48.8745, lng: 2.3552 }, radiusM: 80 },
  { id: 'quai_tournelle', label: 'Quai de la Tournelle', kind: 'circle', center: { lat: 48.8506, lng: 2.3547 }, radiusM: 100 },
  { id: 'pont_neuf', label: 'Pont Neuf', kind: 'circle', center: { lat: 48.8583, lng: 2.3412 }, radiusM: 80 },
];

function slugId(prefix, title) {
  const base = String(title || prefix)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 36);
  return `${prefix}_${base || randomUUID().slice(0, 8)}`;
}

function uniqueId(existing, prefix, title) {
  const ids = new Set((existing || []).map((x) => x.id));
  let id = slugId(prefix, title);
  if (!ids.has(id)) return id;
  let i = 2;
  while (ids.has(`${id}_${i}`)) i += 1;
  return `${id}_${i}`;
}

function ensureInventory(adventure) {
  const a = adventure && typeof adventure === 'object' ? adventure : {};
  if (!Array.isArray(a.mediaItems)) a.mediaItems = [];
  if (!Array.isArray(a.mediaContents)) a.mediaContents = [];
  if (!Array.isArray(a.zones)) a.zones = [];
  if (!Array.isArray(a.beacons)) a.beacons = [];
  if (!Array.isArray(a.interactions)) a.interactions = [];
  if (!Array.isArray(a.containers)) a.containers = [];
  a.containers.forEach((box) => {
    if (!Array.isArray(box.contains)) box.contains = [];
    if (!Array.isArray(box.links)) box.links = [];
    box.containerKind = resolveContainerKind(box);
  });
  if (!Array.isArray(a.variables)) a.variables = [];
  a.mediaItems.forEach(ensureItemExtras);
  (a.floors || []).forEach((f) => {
    if (!Array.isArray(f.analyses)) f.analyses = [];
    (f.situations || []).forEach((s) => {
      if (!Array.isArray(s.analyses)) s.analyses = [];
    });
  });
  return a;
}

function ensureItemExtras(item) {
  if (!item || typeof item !== 'object') return item;
  if (!Array.isArray(item.details)) item.details = [];
  if (!Array.isArray(item.analyses)) item.analyses = [];
  if (!Array.isArray(item.mutations)) item.mutations = [];
  return item;
}

function addMediaContent(adventure, { id, label, kind, body } = {}) {
  const a = ensureInventory(adventure);
  const k = kind || 'text';
  if (!CONTENT_KINDS.some((c) => c.id === k)) {
    const err = new Error(`Type de contenu inconnu: ${k}`);
    err.status = 400;
    throw err;
  }
  const item = {
    id: id || uniqueId(a.mediaContents, 'content', label || 'media'),
    kind: k,
    label: label || 'Nouveau contenu',
  };
  if (body) item.body = String(body);
  a.mediaContents.push(item);
  return item;
}

const BUREAU_VAR_ID = 'bureau_accessible';

function isImposedMedia(item) {
  if (!item) return false;
  return item.role === 'imposed' || item.policy === 'imposed' || item.policy === 'required';
}

function isBureauMedia(item) {
  if (!item || isImposedMedia(item)) return false;
  return item.role === 'bureau' || item.slot === 'bureau';
}

function addMediaItem(adventure, { id, label, skin, contentId, policy, role, slot, floorHint } = {}) {
  const a = ensureInventory(adventure);
  const imposed = role === 'imposed' || policy === 'imposed' || policy === 'required';
  const bureau = !imposed && (role === 'bureau' || slot === 'bureau');
  const prefix = imposed ? 'impose' : bureau ? 'bureau' : 'item';
  const item = {
    id: id || uniqueId(a.mediaItems, prefix, label || (imposed ? 'media_impose' : bureau ? 'objet_bureau' : 'objet')),
    label: label || (imposed ? 'Média imposé' : bureau ? 'Objet du bureau' : 'Nouvel objet'),
    skin: skin || (imposed ? 'vhs' : 'letter'),
    contentId: contentId || null,
    policy: imposed ? 'imposed' : (policy || 'unlockable'),
    role: imposed ? 'imposed' : bureau ? 'bureau' : (role || 'recoverable'),
    details: [],
    analyses: [],
    mutations: [],
  };
  if (bureau) item.slot = 'bureau';
  if (!imposed && !bureau && role !== 'container') item.role = role || 'recoverable';
  if (floorHint != null && floorHint !== '') item.floorHint = Number(floorHint);
  a.mediaItems.push(ensureItemExtras(item));
  return item;
}

function addImposedMedia(adventure, input = {}) {
  return addMediaItem(adventure, {
    ...input,
    label: input.label || 'Média imposé',
    skin: input.skin || 'vhs',
    policy: 'imposed',
    role: 'imposed',
  });
}

function addBureauMedia(adventure, input = {}) {
  return addMediaItem(adventure, {
    ...input,
    label: input.label || 'Objet du bureau',
    skin: input.skin || 'letter',
    policy: 'unlockable',
    role: 'bureau',
    slot: 'bureau',
  });
}

function isContainerMedia(item, adventure) {
  if (!item) return false;
  if (item.role === 'container') return true;
  const boxes = adventure?.containers || [];
  return boxes.some((c) => c.id === item.id || c.mediaItemId === item.id);
}

function isRecoverableMedia(item, adventure) {
  if (!item || isImposedMedia(item) || isBureauMedia(item) || isContainerMedia(item, adventure)) return false;
  return item.role === 'recoverable' || item.role === 'media' || !item.role;
}

function objectFamily(item, adventure) {
  if (isImposedMedia(item)) return 'imposed';
  if (isContainerMedia(item, adventure)) return 'container';
  if (isBureauMedia(item)) return 'bureau';
  return 'recoverable';
}

function findContainer(adventure, boxId) {
  const a = ensureInventory(adventure);
  return a.containers.find((c) => c.id === boxId || c.mediaItemId === boxId) || null;
}

function containersHolding(adventure, itemId) {
  const a = ensureInventory(adventure);
  return a.containers.filter((c) => (c.contains || []).includes(itemId));
}

function addRecoverableMedia(adventure, input = {}) {
  const item = addMediaItem(adventure, {
    ...input,
    label: input.label || 'Objet recouvrable',
    skin: input.skin || 'letter',
    policy: 'unlockable',
    role: 'recoverable',
  });
  if (input.unlockBy) item.unlockBy = normalizeUnlockBy(input.unlockBy);
  if (input.floorHint != null && input.floorHint !== '') item.floorHint = Number(input.floorHint);
  ensureCodeUnlockInteraction(adventure, item);
  return item;
}

function normalizeUnlockBy(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const kind = raw.kind;
  if (!['code', 'zone', 'beacon'].includes(kind)) return null;
  const out = { kind };
  if (kind === 'code') {
    out.code = String(raw.code || '').trim();
    out.choiceId = raw.choiceId || null;
    if (!out.code) return null;
  }
  if (kind === 'zone') out.zoneId = raw.zoneId || null;
  if (kind === 'beacon') out.beaconId = raw.beaconId || null;
  return out;
}

function ensureCodeUnlockInteraction(adventure, item) {
  const u = item.unlockBy;
  if (!u || u.kind !== 'code' || !u.code) return;
  const choiceId = u.choiceId || `code_${item.id}`;
  u.choiceId = choiceId;
  const existing = (adventure.interactions || []).find((x) => x.id === choiceId);
  if (existing) {
    existing.expected = u.code;
    if (!existing.label) existing.label = `Code — ${item.label}`;
    return;
  }
  addInteraction(adventure, {
    id: choiceId,
    kind: 'code',
    label: `Code — ${item.label}`,
    expected: u.code,
  });
}

function normalizeAnalysis(raw, prefix = 'an') {
  if (!raw || typeof raw !== 'object') return null;
  const kind = raw.kind === 'journal' ? 'journal' : raw.kind === 'observe' ? 'observe' : null;
  if (!kind) return null;
  const text = String(raw.text || raw.message || '').trim();
  if (!text) return null;
  return {
    id: raw.id || `${prefix}_${kind}_${randomUUID().slice(0, 8)}`,
    kind,
    text,
    title: raw.title || (kind === 'observe' ? 'Fenêtre d’observation' : 'Note du journal'),
    noteId: raw.noteId || null,
  };
}

function inferItemFloor(adventure, item) {
  if (!item) return null;
  if (item.floorHint != null && item.floorHint !== '') return Number(item.floorHint);
  if (isImposedMedia(item)) return 0;
  if (isBureauMedia(item)) return 1;
  const id = item.id;
  for (const f of adventure.floors || []) {
    if ((f.situations || []).some((s) => situationMentionsItem(s, id))) return f.index;
    const unlock = f.unlockNext;
    if (unlock && JSON.stringify(unlock).includes(id)) return f.index;
  }
  return null;
}

function situationMentionsItem(sit, itemId) {
  if (!sit || !itemId) return false;
  const blob = JSON.stringify({
    t: sit.trigger,
    c: sit.conditions || sit.conditionsGroup,
    a: [...(sit.thenActions || []), ...(sit.elseActions || [])],
    tr: sit.transition,
  });
  return blob.includes(`"${itemId}"`);
}

function listBureauItems(adventure) {
  const a = ensureInventory(adventure);
  return a.mediaItems.filter(isBureauMedia);
}

/**
 * Classe un objet déjà créé dans une famille (bureau / recouvrable / imposé).
 * Ce n’est pas une copie : même id, même contenu, toujours listé dans « tous les objets ».
 */
function assignMediaItemFamily(adventure, id, family) {
  const a = ensureInventory(adventure);
  const item = a.mediaItems.find((m) => m.id === id);
  if (!item) {
    const err = new Error(`Objet introuvable: ${id}`);
    err.status = 404;
    throw err;
  }
  if (!['bureau', 'recoverable', 'imposed'].includes(family)) {
    const err = new Error(`Famille inconnue: ${family}`);
    err.status = 400;
    throw err;
  }
  ensureItemExtras(item);
  const box = findContainer(a, item.id);
  if (box && family === 'imposed') {
    const err = new Error('Une boîte ne peut pas devenir le média imposé');
    err.status = 400;
    throw err;
  }
  if (family === 'bureau') {
    item.role = 'bureau';
    item.slot = 'bureau';
    if (item.policy === 'imposed' || item.policy === 'required') item.policy = 'unlockable';
    else if (!item.policy) item.policy = 'unlockable';
    if (item.floorHint == null) item.floorHint = 1;
    if (box) box.placement = 'bureau';
  } else if (family === 'recoverable') {
    item.role = 'recoverable';
    delete item.slot;
    if (item.policy === 'imposed' || item.policy === 'required') item.policy = 'unlockable';
    else if (!item.policy) item.policy = 'unlockable';
    if (box) box.placement = 'recoverable';
  } else {
    item.role = 'imposed';
    item.policy = 'imposed';
    delete item.slot;
    item.floorHint = 0;
  }
  return item;
}

function updateMediaItem(adventure, id, patch = {}) {
  const a = ensureInventory(adventure);
  const item = a.mediaItems.find((m) => m.id === id);
  if (!item) {
    const err = new Error(`Objet introuvable: ${id}`);
    err.status = 404;
    throw err;
  }
  ensureItemExtras(item);
  if (patch.label != null && String(patch.label).trim()) item.label = String(patch.label).trim();
  if (patch.skin != null && patch.skin !== '') item.skin = String(patch.skin);
  if (patch.contentId !== undefined) item.contentId = patch.contentId || null;
  if (patch.floorHint !== undefined) {
    item.floorHint = patch.floorHint === '' || patch.floorHint == null ? null : Number(patch.floorHint);
  }
  if (patch.unlockBy !== undefined) {
    item.unlockBy = normalizeUnlockBy(patch.unlockBy);
    ensureCodeUnlockInteraction(a, item);
  }
  if (Array.isArray(patch.details)) {
    item.details = patch.details
      .map((d, i) => ({
        id: d.id || `det_${item.id}_${i}`,
        text: String(d.text || '').trim(),
      }))
      .filter((d) => d.text);
  }
  if (Array.isArray(patch.analyses)) {
    item.analyses = patch.analyses.map((x) => normalizeAnalysis(x, item.id)).filter(Boolean);
  }
  if (Array.isArray(patch.mutations)) {
    item.mutations = patch.mutations
      .map((m, i) => ({
        id: m.id || `mut_${item.id}_${i}`,
        floorIndex: m.floorIndex != null ? Number(m.floorIndex) : null,
        buttonLabel: String(m.buttonLabel || m.label || '').trim(),
        newState: String(m.newState || m.value || '').trim() || 'changed',
      }))
      .filter((m) => m.buttonLabel);
  }
  if (patch.contentKind || patch.contentBody !== undefined) {
    let content = item.contentId ? a.mediaContents.find((c) => c.id === item.contentId) : null;
    if (!content) {
      content = addMediaContent(a, {
        label: item.label,
        kind: patch.contentKind || 'text',
        body: patch.contentBody,
      });
      item.contentId = content.id;
    } else {
      if (patch.contentKind) content.kind = patch.contentKind;
      if (patch.contentBody !== undefined) content.body = patch.contentBody;
    }
  }
  if (isContainerMedia(item, a) && (patch.code !== undefined || patch.lockWithCode !== undefined || patch.contains)) {
    const box = findContainer(a, item.id);
    if (box) {
      if (patch.contains) box.contains = Array.isArray(patch.contains) ? patch.contains.filter(Boolean) : [];
      if (patch.lockWithCode !== undefined) {
        box.lockWithCode = patch.lockWithCode === true || patch.lockWithCode === 'yes' || patch.lockWithCode === 'true';
      }
      if (patch.code !== undefined) box.code = String(patch.code || '').trim() || null;
      if (box.lockWithCode === false || !box.code) {
        box.lockWithCode = false;
        box.code = null;
      }
      syncContainerCodeInteraction(a, box, item.label);
    }
  }
  return item;
}

function addItemDetail(adventure, itemId, text) {
  const a = ensureInventory(adventure);
  const item = a.mediaItems.find((m) => m.id === itemId);
  if (!item) {
    const err = new Error(`Objet introuvable: ${itemId}`);
    err.status = 404;
    throw err;
  }
  ensureItemExtras(item);
  const detail = { id: uniqueId(item.details, 'det', 'note'), text: String(text || '').trim() };
  if (!detail.text) {
    const err = new Error('Texte du détail requis');
    err.status = 400;
    throw err;
  }
  item.details.push(detail);
  return detail;
}

function collectItemMutationsFromStory(adventure, itemId) {
  const hits = [];
  for (const f of adventure.floors || []) {
    for (const s of f.situations || []) {
      const actions = [...(s.thenActions || []), ...(s.elseActions || [])];
      for (const a of actions) {
        const touches =
          a.mediaItemId === itemId ||
          a.objectId === itemId ||
          (a.kind === 'set_object_state' && a.objectId === itemId) ||
          (a.kind === 'show_button' && JSON.stringify(s).includes(itemId));
        if (a.kind === 'set_object_state' && a.objectId === itemId) {
          hits.push({
            floorIndex: f.index,
            source: s.title || s.letter,
            buttonLabel: a.label || a.value,
            kind: 'set_object_state',
          });
        }
        if (a.kind === 'show_button' && touches) {
          hits.push({
            floorIndex: f.index,
            source: s.title || s.letter,
            buttonLabel: a.label || a.choiceId,
            kind: 'show_button',
          });
        }
      }
      if (s.trigger?.kind === 'player_choice' && JSON.stringify(s).includes(itemId)) {
        hits.push({
          floorIndex: f.index,
          source: s.title || s.letter,
          buttonLabel: s.trigger.label || s.trigger.choiceId,
          kind: 'player_choice',
        });
      }
    }
  }
  return hits;
}

/**
 * Contenant : objet dans lequel on range des items média.
 * Optionnellement protégé par un code — compilé en rules moteur, pas en 2e moteur.
 */
function resolveContainerKind(input = {}) {
  const raw = input.containerKind;
  if (raw && CONTAINER_KINDS.some((k) => k.id === raw)) return raw;
  const skin = input.skin;
  const bySkin = CONTAINER_KINDS.find((k) => k.skin === skin || k.id === skin);
  return bySkin ? bySkin.id : 'box';
}

function containerKindSpec(id) {
  return CONTAINER_KINDS.find((k) => k.id === id) || CONTAINER_KINDS[0];
}

function normalizeHttpUrl(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    const err = new Error('URL requise');
    err.status = 400;
    throw err;
  }
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed;
  try {
    parsed = new URL(withScheme);
  } catch {
    const err = new Error('URL invalide');
    err.status = 400;
    throw err;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    const err = new Error('Seuls les liens http(s) sont acceptés');
    err.status = 400;
    throw err;
  }
  return parsed.toString();
}

function containerPlacementOf(input = {}) {
  if (input.placement === 'bureau' || input.role === 'bureau' || input.slot === 'bureau' || input.family === 'bureau') {
    return 'bureau';
  }
  return 'recoverable';
}

function syncContainerCodeInteraction(adventure, box, label) {
  const a = ensureInventory(adventure);
  if (box.lockWithCode && box.code) {
    if (!box.codeChoiceId) {
      const inter = addInteraction(a, { kind: 'code', label: `Code — ${label || box.label}`, expected: box.code });
      box.codeChoiceId = inter.id;
    } else {
      const inter = a.interactions.find((x) => x.id === box.codeChoiceId);
      if (inter) inter.expected = box.code;
    }
    return;
  }
  box.lockWithCode = false;
  box.code = null;
}

function assertStashable(adventure, box, itemId) {
  const a = ensureInventory(adventure);
  if (!itemId) {
    const err = new Error('Objet à ranger requis');
    err.status = 400;
    throw err;
  }
  if (itemId === box.id || itemId === box.mediaItemId) {
    const err = new Error('Une boîte ne peut pas se contenir elle-même');
    err.status = 400;
    throw err;
  }
  if (findContainer(a, itemId)) {
    const err = new Error('Un contenant ne peut pas ranger un autre contenant');
    err.status = 400;
    throw err;
  }
  const item = a.mediaItems.find((m) => m.id === itemId);
  if (!item) {
    const err = new Error(`Objet introuvable: ${itemId}`);
    err.status = 404;
    throw err;
  }
  return item;
}

function stashInContainer(adventure, boxId, itemId) {
  const a = ensureInventory(adventure);
  const box = findContainer(a, boxId);
  if (!box) {
    const err = new Error(`Boîte introuvable: ${boxId}`);
    err.status = 404;
    throw err;
  }
  const item = assertStashable(a, box, itemId);
  item.policy = 'unlockable';
  for (const other of a.containers) {
    if (other !== box) {
      other.contains = (other.contains || []).filter((id) => id !== itemId);
    }
  }
  if (!Array.isArray(box.contains)) box.contains = [];
  if (!box.contains.includes(itemId)) box.contains.push(itemId);
  return box;
}

function unstashFromContainer(adventure, boxId, itemId) {
  const a = ensureInventory(adventure);
  const box = findContainer(a, boxId);
  if (!box) {
    const err = new Error(`Boîte introuvable: ${boxId}`);
    err.status = 404;
    throw err;
  }
  box.contains = (box.contains || []).filter((id) => id !== itemId);
  return box;
}

function setContainerCode(adventure, boxId, code) {
  const a = ensureInventory(adventure);
  const box = findContainer(a, boxId);
  if (!box) {
    const err = new Error(`Boîte introuvable: ${boxId}`);
    err.status = 404;
    throw err;
  }
  const trimmed = String(code || '').trim();
  if (!trimmed) {
    box.lockWithCode = false;
    box.code = null;
  } else {
    box.lockWithCode = true;
    box.code = trimmed;
  }
  const media = a.mediaItems.find((m) => m.id === box.mediaItemId || m.id === box.id);
  syncContainerCodeInteraction(a, box, media?.label || box.label);
  return box;
}

function addContainer(adventure, input = {}) {
  const a = ensureInventory(adventure);
  const containerKind = resolveContainerKind(input);
  const spec = containerKindSpec(containerKind);
  const label = input.label || spec.label || 'Nouveau contenant';
  const contains = Array.isArray(input.contains)
    ? input.contains.filter(Boolean)
    : String(input.contains || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
  const typedCode = String(input.code || '').trim();
  const lockWithCode = typedCode
    ? true
    : input.lockWithCode === true || input.lockWithCode === 'yes' || input.lockWithCode === 'true';
  const code = lockWithCode ? typedCode : '';
  if (lockWithCode && !code) {
    const err = new Error('Code requis si le contenant est protégé');
    err.status = 400;
    throw err;
  }

  const placement = containerPlacementOf(input);
  for (const cid of contains) {
    if (findContainer(a, cid)) {
      const err = new Error('Un contenant ne peut pas ranger un autre contenant');
      err.status = 400;
      throw err;
    }
    const item = a.mediaItems.find((m) => m.id === cid);
    if (item) item.policy = 'unlockable';
  }

  const media = addMediaItem(a, {
    id: input.id,
    label,
    skin: input.skin || spec.skin,
    policy: input.policy || 'displayed',
    role: placement,
    slot: placement === 'bureau' ? 'bureau' : undefined,
    floorHint: placement === 'bureau' ? (input.floorHint != null && input.floorHint !== '' ? input.floorHint : 1) : input.floorHint,
  });

  const container = {
    id: media.id,
    mediaItemId: media.id,
    label,
    skin: media.skin,
    containerKind,
    contains: [],
    links: [],
    lockWithCode: false,
    code: null,
    codeChoiceId: null,
    placement,
  };
  a.containers.push(container);
  if (lockWithCode) setContainerCode(a, container.id, code);
  for (const cid of contains) stashInContainer(a, container.id, cid);
  const initialLinks = Array.isArray(input.links) ? input.links : [];
  for (const link of initialLinks) {
    addContainerLink(a, container.id, link);
  }
  return container;
}

function addContainerLink(adventure, boxId, input = {}) {
  const a = ensureInventory(adventure);
  const box = findContainer(a, boxId);
  if (!box) {
    const err = new Error(`Contenant introuvable: ${boxId}`);
    err.status = 404;
    throw err;
  }
  const spec = containerKindSpec(resolveContainerKind(box));
  if (!spec.allowsLinks) {
    const err = new Error(`« ${spec.label} » ne range pas de liens web — utilisez un PC`);
    err.status = 400;
    throw err;
  }
  if (!Array.isArray(box.links)) box.links = [];
  const url = normalizeHttpUrl(input.url);
  const link = {
    id: input.id || uniqueId(box.links, 'link', input.label || 'lien'),
    label: String(input.label || '').trim() || url,
    url,
  };
  box.links.push(link);
  return link;
}

function removeContainerLink(adventure, boxId, linkId) {
  const a = ensureInventory(adventure);
  const box = findContainer(a, boxId);
  if (!box) {
    const err = new Error(`Contenant introuvable: ${boxId}`);
    err.status = 404;
    throw err;
  }
  box.links = (box.links || []).filter((l) => l.id !== linkId);
  return box;
}

function addZone(adventure, input = {}) {
  const a = ensureInventory(adventure);
  let spec = { ...input };
  if (spec.presetId) {
    const preset = ZONE_PRESETS.find((p) => p.id === spec.presetId);
    if (!preset) {
      const err = new Error(`Lieu prédéfini inconnu: ${spec.presetId}`);
      err.status = 400;
      throw err;
    }
    spec = {
      label: spec.label || preset.label,
      kind: preset.kind,
      center: preset.center,
      radiusM: preset.radiusM,
      code: preset.code,
    };
  }
  const kind = spec.kind || 'circle';
  const zone = {
    id: spec.id || uniqueId(a.zones, 'zone', spec.label || 'lieu'),
    label: spec.label || 'Nouveau lieu',
    kind,
  };
  if (kind === 'circle') {
    const lat = Number(spec.center?.lat ?? spec.lat);
    const lng = Number(spec.center?.lng ?? spec.lng);
    const radiusM = Number(spec.radiusM ?? 100);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      const err = new Error('Latitude et longitude requises pour un lieu cercle');
      err.status = 400;
      throw err;
    }
    zone.center = { lat, lng };
    zone.radiusM = radiusM;
  } else if (kind === 'arrondissement') {
    const code = Number(spec.code);
    if (!code || code < 1 || code > 20) {
      const err = new Error('Arrondissement : code 1 à 20 requis');
      err.status = 400;
      throw err;
    }
    zone.code = code;
  } else {
    const err = new Error(`Type de lieu inconnu: ${kind}`);
    err.status = 400;
    throw err;
  }
  a.zones.push(zone);
  return zone;
}

function addBeacon(adventure, { id, label, channel, tokenId } = {}) {
  const a = ensureInventory(adventure);
  const ch = channel === 'nfc' ? 'nfc' : 'qr';
  const beacon = {
    id: id || uniqueId(a.beacons, 'beacon', label || 'balise'),
    label: label || 'Nouvelle balise',
    channel: ch,
    tokenId: tokenId || `TOKEN_${randomUUID().slice(0, 8).toUpperCase()}`,
  };
  a.beacons.push(beacon);
  return beacon;
}

function addInteraction(adventure, { id, kind, label, expected } = {}) {
  const a = ensureInventory(adventure);
  const k = kind === 'code' ? 'code' : 'button';
  const inter = {
    id: id || uniqueId(a.interactions, k === 'code' ? 'code' : 'btn', label || k),
    kind: k,
    label: label || (k === 'code' ? 'Nouveau code' : 'Nouveau bouton'),
  };
  if (k === 'code' && expected) inter.expected = String(expected);
  a.interactions.push(inter);
  return inter;
}

function walkNodes(adventure, visit) {
  for (const f of adventure.floors || []) {
    if (f.unlockNext) visit(f.unlockNext);
    for (const sit of f.situations || []) {
      if (sit.trigger) visit(sit.trigger);
      for (const c of sit.conditions || []) visit(c);
      if (sit.conditionsGroup) visit(sit.conditionsGroup);
      for (const a of sit.thenActions || []) visit(a);
      for (const a of sit.elseActions || []) visit(a);
      for (const br of sit.branches || []) {
        for (const c of br.conditions || []) visit(c);
        for (const a of br.thenActions || []) visit(a);
      }
    }
  }
}

function collectRefs(adventure) {
  const mediaItemIds = new Set();
  const mediaContentIds = new Set();
  const zoneIds = new Set();
  const beaconIds = new Set();
  const choiceIds = new Set();
  const varIds = new Set();

  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.op === 'and' || node.op === 'or') {
      (node.children || []).forEach(visit);
      return;
    }
    if (node.op === 'not') {
      visit(node.child);
      return;
    }
    if (node.mediaItemId) mediaItemIds.add(node.mediaItemId);
    if (node.mediaContentId) mediaContentIds.add(node.mediaContentId);
    if (node.zoneId) zoneIds.add(node.zoneId);
    if (Array.isArray(node.zoneIds)) node.zoneIds.forEach((z) => zoneIds.add(z));
    if (node.beaconId) beaconIds.add(node.beaconId);
    if (node.choiceId) choiceIds.add(node.choiceId);
    if (node.varId) varIds.add(node.varId);
  }

  walkNodes(adventure, visit);
  return { mediaItemIds, mediaContentIds, zoneIds, beaconIds, choiceIds, varIds };
}

/**
 * Boutons / codes déclarés + ceux déjà utilisés dans les situations.
 */
function listInteractions(adventure) {
  const a = ensureInventory(adventure);
  const byId = new Map();
  for (const it of a.interactions) byId.set(it.id, { ...it, declared: true });

  walkNodes(a, (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.kind === 'player_choice' && node.choiceId && !byId.has(node.choiceId)) {
      byId.set(node.choiceId, {
        id: node.choiceId,
        kind: 'button',
        label: node.label || node.choiceId,
        inferred: true,
      });
    }
    if (node.kind === 'code_submitted' && node.choiceId && !byId.has(node.choiceId)) {
      byId.set(node.choiceId, {
        id: node.choiceId,
        kind: 'code',
        label: node.label || node.choiceId,
        expected: node.expected || null,
        inferred: true,
      });
    }
    if (node.kind === 'show_button' && node.choiceId && !byId.has(node.choiceId)) {
      byId.set(node.choiceId, {
        id: node.choiceId,
        kind: 'button',
        label: node.label || node.choiceId,
        inferred: true,
      });
    }
    if (node.kind === 'show_code_input' && node.choiceId && !byId.has(node.choiceId)) {
      byId.set(node.choiceId, {
        id: node.choiceId,
        kind: 'code',
        label: node.label || node.choiceId,
        inferred: true,
      });
    }
  });

  return [...byId.values()];
}

function inventorySummary(adventure) {
  const a = ensureInventory(adventure);
  return {
    mediaItems: a.mediaItems.length,
    imposedMedia: a.mediaItems.filter(isImposedMedia).length,
    bureauMedia: a.mediaItems.filter(isBureauMedia).length,
    recoverableMedia: a.mediaItems.filter((m) => isRecoverableMedia(m, a)).length,
    mediaContents: a.mediaContents.length,
    zones: a.zones.length,
    beacons: a.beacons.length,
    interactions: listInteractions(a).length,
    containers: a.containers.length,
  };
}

function inventoryWarnings(adventure) {
  const warnings = [];
  const a = ensureInventory(adventure);
  const refs = collectRefs(a);
  const itemIds = new Set(a.mediaItems.map((m) => m.id));
  const contentIds = new Set(a.mediaContents.map((m) => m.id));
  const zoneIds = new Set(a.zones.map((z) => z.id));
  const beaconIds = new Set(a.beacons.map((b) => b.id));

  if (
    a.mediaItems.length === 0 &&
    a.zones.length === 0 &&
    a.beacons.length === 0 &&
    (a.floors || []).some((f) => (f.situations || []).length > 0)
  ) {
    warnings.push({
      level: 'warn',
      code: 'EMPTY_INVENTORY',
      message:
        'Aucun objet, lieu ni balise dans le matériel. Créez-les dans la vue Matériel avant de relier les situations.',
    });
  }

  for (const id of refs.mediaItemIds) {
    if (!itemIds.has(id)) {
      warnings.push({
        level: 'error',
        code: 'MISSING_MEDIA_ITEM',
        message: `Une situation référence l’objet « ${id} » qui n’existe pas dans le matériel.`,
      });
    }
  }
  for (const id of refs.mediaContentIds) {
    if (!contentIds.has(id)) {
      warnings.push({
        level: 'warn',
        code: 'MISSING_MEDIA_CONTENT',
        message: `Une action référence le contenu « ${id} » absent du matériel.`,
      });
    }
  }
  for (const id of refs.zoneIds) {
    if (!zoneIds.has(id)) {
      warnings.push({
        level: 'error',
        code: 'MISSING_ZONE',
        message: `Une situation référence le lieu « ${id} » qui n’existe pas dans le matériel.`,
      });
    }
  }
  for (const id of refs.beaconIds) {
    if (!beaconIds.has(id)) {
      warnings.push({
        level: 'error',
        code: 'MISSING_BEACON',
        message: `Une situation référence la balise « ${id} » qui n’existe pas dans le matériel.`,
      });
    }
  }

  for (const item of a.mediaItems) {
    if (item.contentId && !contentIds.has(item.contentId)) {
      warnings.push({
        level: 'warn',
        code: 'ITEM_WITHOUT_CONTENT',
        message: `L’objet « ${item.label || item.id} » pointe vers un contenu introuvable.`,
      });
    }
  }

  const usesUnlockBureau = (a.floors || []).some((f) =>
    (f.situations || []).some((s) =>
      [...(s.thenActions || []), ...(s.elseActions || [])].some((act) => act.kind === 'unlock_bureau')
    )
  );
  if (usesUnlockBureau && a.mediaItems.filter(isBureauMedia).length === 0) {
    warnings.push({
      level: 'warn',
      code: 'BUREAU_EMPTY',
      message:
        'ALORS déverrouille le Bureau, mais aucun objet n’y est rangé. Ajoutez-les dans Matériel → Bureau.',
    });
  }

  for (const box of a.containers || []) {
    if (box.lockWithCode && !box.code) {
      warnings.push({
        level: 'error',
        code: 'CONTAINER_CODE_MISSING',
        message: `Le contenant « ${box.label || box.id} » est protégé mais aucun code n’est défini.`,
      });
    }
    for (const cid of box.contains || []) {
      if (!itemIds.has(cid)) {
        warnings.push({
          level: 'error',
          code: 'CONTAINER_MISSING_ITEM',
          message: `Le contenant « ${box.label || box.id} » range « ${cid} », absent du matériel.`,
        });
      }
      if (cid === box.id || cid === box.mediaItemId) {
        warnings.push({
          level: 'error',
          code: 'CONTAINER_SELF',
          message: `Le contenant « ${box.label || box.id} » ne peut pas se contenir lui-même.`,
        });
      }
    }
  }

  return warnings;
}

function getInventoryCatalog() {
  return {
    contentKinds: CONTENT_KINDS,
    zoneKinds: ZONE_KINDS,
    zonePresets: ZONE_PRESETS.map((z) => ({
      id: z.id,
      label: z.label,
      kind: z.kind,
      radiusM: z.radiusM || null,
    })),
    beaconChannels: BEACON_CHANNELS,
    interactionKinds: INTERACTION_KINDS,
    objectKinds: [
      { id: 'imposed', label: 'Média imposé' },
      { id: 'bureau', label: 'Objet du bureau' },
      { id: 'recoverable', label: 'Objet recouvrable' },
      { id: 'container', label: 'Contenant' },
    ],
    containerKinds: CONTAINER_KINDS,
    analysisKinds: [
      { id: 'observe', label: 'Fenêtre d’observation (éphémère)' },
      { id: 'journal', label: 'Note dans le journal (permanente)' },
    ],
    unlockKinds: [
      { id: 'code', label: 'Code' },
      { id: 'zone', label: 'Lieu' },
      { id: 'beacon', label: 'Balise' },
    ],
  };
}

module.exports = {
  CONTENT_KINDS,
  ZONE_KINDS,
  ZONE_PRESETS,
  BEACON_CHANNELS,
  INTERACTION_KINDS,
  BUREAU_VAR_ID,
  slugId,
  uniqueId,
  ensureInventory,
  addMediaContent,
  addMediaItem,
  addImposedMedia,
  isImposedMedia,
  isBureauMedia,
  isRecoverableMedia,
  isContainerMedia,
  objectFamily,
  inferItemFloor,
  addBureauMedia,
  addRecoverableMedia,
  listBureauItems,
  assignMediaItemFamily,
  updateMediaItem,
  addItemDetail,
  collectItemMutationsFromStory,
  normalizeUnlockBy,
  normalizeAnalysis,
  ensureCodeUnlockInteraction,
  CONTAINER_KINDS,
  resolveContainerKind,
  containerKindSpec,
  addContainer,
  addContainerLink,
  removeContainerLink,
  findContainer,
  containersHolding,
  stashInContainer,
  unstashFromContainer,
  setContainerCode,
  addZone,
  addBeacon,
  addInteraction,
  collectRefs,
  listInteractions,
  inventorySummary,
  inventoryWarnings,
  getInventoryCatalog,
};
