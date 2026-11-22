/**
 * Stockage sandbox des fichiers Lab (E6 Médias).
 * Jamais en production : la route est derrière authSim + isSandbox.
 */

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const ALLOWED = {
  'image/jpeg': { ext: '.jpg', kind: 'image' },
  'image/png': { ext: '.png', kind: 'image' },
  'image/webp': { ext: '.webp', kind: 'image' },
  'image/gif': { ext: '.gif', kind: 'image' },
  'audio/mpeg': { ext: '.mp3', kind: 'audio' },
  'audio/mp3': { ext: '.mp3', kind: 'audio' },
  'audio/wav': { ext: '.wav', kind: 'audio' },
  'audio/x-wav': { ext: '.wav', kind: 'audio' },
  'audio/ogg': { ext: '.ogg', kind: 'audio' },
  'audio/mp4': { ext: '.m4a', kind: 'audio' },
  'video/mp4': { ext: '.mp4', kind: 'video' },
  'video/webm': { ext: '.webm', kind: 'video' },
  'video/quicktime': { ext: '.mov', kind: 'video' },
  'text/plain': { ext: '.txt', kind: 'text' },
};

const MAX_BYTES = 20 * 1024 * 1024;

function uploadRoot() {
  return (
    process.env.LANTERN_LAB_UPLOAD_DIR ||
    path.join(__dirname, '../../../../uploads/lantern-lab')
  );
}

function safeId(id) {
  const s = String(id || '').replace(/[^a-zA-Z0-9_-]/g, '');
  return s.slice(0, 80) || randomUUID().slice(0, 8);
}

function manifestPath() {
  return path.join(uploadRoot(), 'manifest.json');
}

function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(manifestPath(), 'utf8'));
  } catch {
    return {};
  }
}

function writeManifest(man) {
  const root = uploadRoot();
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(manifestPath(), JSON.stringify(man, null, 2));
}

function kindFromMime(mime) {
  return ALLOWED[mime]?.kind || null;
}

function saveBuffer({ buffer, mime, originalName, adventureId, contentId }) {
  if (!buffer || !buffer.length) {
    const err = new Error('Fichier vide');
    err.status = 400;
    throw err;
  }
  if (buffer.length > MAX_BYTES) {
    const err = new Error('Fichier trop volumineux (20 Mo max)');
    err.status = 400;
    throw err;
  }
  const spec = ALLOWED[mime];
  if (!spec) {
    const err = new Error(`Type de fichier non autorisé: ${mime || 'inconnu'}`);
    err.status = 400;
    throw err;
  }
  const fileId = randomUUID().replace(/-/g, '').slice(0, 16);
  const dir = path.join(uploadRoot(), safeId(adventureId || 'draft'));
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${fileId}${spec.ext}`;
  const abs = path.join(dir, filename);
  fs.writeFileSync(abs, buffer);

  const rel = path.relative(uploadRoot(), abs);
  const man = readManifest();
  man[fileId] = {
    rel,
    mime,
    originalName: String(originalName || filename).slice(0, 180),
    adventureId: adventureId || null,
    contentId: contentId || null,
    size: buffer.length,
    createdAt: new Date().toISOString(),
  };
  writeManifest(man);

  return {
    fileId,
    mime,
    kind: spec.kind,
    originalName: man[fileId].originalName,
    size: buffer.length,
    uri: `/api/admin/lantern-lab/creator/media/file/${fileId}`,
  };
}

function resolveFile(fileId) {
  const id = safeId(fileId);
  const rec = readManifest()[id];
  if (!rec) return null;
  const abs = path.join(uploadRoot(), rec.rel);
  const root = path.resolve(uploadRoot());
  if (!path.resolve(abs).startsWith(root + path.sep) && path.resolve(abs) !== root) return null;
  if (!fs.existsSync(abs)) return null;
  return { abs, mime: rec.mime, originalName: rec.originalName };
}

module.exports = {
  ALLOWED,
  MAX_BYTES,
  uploadRoot,
  kindFromMime,
  saveBuffer,
  resolveFile,
};
