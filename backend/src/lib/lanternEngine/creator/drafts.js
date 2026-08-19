/**
 * Brouillons d’aventure — persistance sandbox locale (fichiers).
 * Pas de prod : écrit uniquement sous data/lantern-drafts.
 */

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const DRAFTS_DIR = path.join(__dirname, '../../../../data/lantern-drafts');

function ensureDir() {
  if (!fs.existsSync(DRAFTS_DIR)) {
    fs.mkdirSync(DRAFTS_DIR, { recursive: true });
  }
}

function draftPath(id) {
  const safe = String(id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  return path.join(DRAFTS_DIR, `${safe}.json`);
}

function listDrafts() {
  ensureDir();
  return fs
    .readdirSync(DRAFTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(DRAFTS_DIR, f), 'utf8'));
        return {
          id: raw.id,
          title: raw.title || raw.adventure?.title || raw.id,
          updatedAt: raw.updatedAt || null,
          sourceAdventureId: raw.sourceAdventureId || raw.adventure?.id || null,
          floorCount: (raw.adventure?.floors || []).length,
          file: f,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

function loadDraft(id) {
  ensureDir();
  const p = draftPath(id);
  if (!fs.existsSync(p)) {
    const err = new Error(`Brouillon introuvable: ${id}`);
    err.status = 404;
    throw err;
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function saveDraft({ id, title, adventure, sourceAdventureId }) {
  if (!adventure || typeof adventure !== 'object') {
    const err = new Error('adventure requise');
    err.status = 400;
    throw err;
  }
  ensureDir();
  const draftId = id || `draft_${randomUUID().slice(0, 8)}`;
  const payload = {
    id: draftId,
    title: title || adventure.title || draftId,
    sourceAdventureId: sourceAdventureId || adventure.id || null,
    updatedAt: new Date().toISOString(),
    adventure: {
      ...adventure,
      id: adventure.id || draftId,
      status: adventure.status || 'draft',
    },
  };
  fs.writeFileSync(draftPath(draftId), JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

function deleteDraft(id) {
  ensureDir();
  const p = draftPath(id);
  if (!fs.existsSync(p)) {
    const err = new Error(`Brouillon introuvable: ${id}`);
    err.status = 404;
    throw err;
  }
  fs.unlinkSync(p);
  return { ok: true, id };
}

function newBlankAdventure(title = 'Nouvelle aventure') {
  const id = `aventure_${Date.now().toString(36).slice(-6)}`;
  const name = String(title || '').trim() || 'Nouvelle aventure';
  return {
    id,
    title: name,
    status: 'draft',
    timezone: 'Europe/Paris',
    mediaItems: [
      {
        id: 'media_impose',
        label: 'Média imposé',
        skin: 'vhs',
        contentId: null,
        policy: 'imposed',
        role: 'imposed',
        details: [],
        analyses: [],
        mutations: [],
      },
    ],
    mediaContents: [],
    zones: [],
    beacons: [],
    interactions: [],
    variables: [],
    containers: [],
    floors: [
      {
        index: 0,
        title: 'Déverrouillage',
        status: 'designing',
        analyses: [],
        situations: [
          {
            id: 'f0_a',
            letter: 'A',
            title: 'Consommer le média imposé',
            trigger: { kind: 'media_consumed', mediaItemId: 'media_impose', label: 'Média imposé' },
            conditions: [],
            thenActions: [{ kind: 'unlock_bureau' }],
            analyses: [],
          },
        ],
        unlockNext: {
          op: 'and',
          children: [{ kind: 'media_consumed', mediaItemId: 'media_impose', label: 'Média imposé' }],
        },
        unlockNextLabel: 'Étage 1 — Bureau',
      },
      { index: 1, title: 'Bureau', status: 'designing', situations: [], analyses: [] },
    ],
  };
}

module.exports = {
  listDrafts,
  loadDraft,
  saveDraft,
  deleteDraft,
  newBlankAdventure,
  DRAFTS_DIR,
};
