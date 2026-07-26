#!/usr/bin/env node
/**
 * Sauvegarde de la base SQLite — sûre en mode WAL.
 *
 * Copier `mazone.db` avec `cp` pendant que le serveur tourne produit une
 * sauvegarde CORROMPUE : les écritures récentes vivent dans le fichier `-wal`
 * séparé, et rien ne garantit la cohérence entre les deux au moment de la copie.
 *
 * `db.backup()` de better-sqlite3 utilise l'API de sauvegarde en ligne de
 * SQLite : elle produit un fichier unique et cohérent, sans arrêter le serveur.
 *
 * Usage :
 *   node scripts/backup-db.js                 # → data/backups/mazone-<horodatage>.db
 *   node scripts/backup-db.js /chemin/cible.db
 *   BACKUP_RETENTION=14 node scripts/backup-db.js
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '../data');
const SOURCE = path.join(DATA_DIR, 'mazone.db');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const RETENTION = Number.parseInt(process.env.BACKUP_RETENTION || '7', 10);

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('Z', '');
}

/** Ne garde que les N sauvegardes automatiques les plus récentes. */
function pruneOldBackups() {
  if (!Number.isFinite(RETENTION) || RETENTION <= 0) return;
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('mazone-') && f.endsWith('.db'))
    .sort()
    .reverse();

  for (const file of files.slice(RETENTION)) {
    fs.unlinkSync(path.join(BACKUP_DIR, file));
    console.log(`Supprimé (rétention ${RETENTION}) : ${file}`);
  }
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Base introuvable : ${SOURCE}`);
    process.exit(1);
  }

  const target = process.argv[2] || path.join(BACKUP_DIR, `mazone-${timestamp()}.db`);
  const targetDir = path.dirname(target);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  // Ouverture en lecture seule : impossible de perturber le serveur en cours.
  const db = new Database(SOURCE, { readonly: true });
  try {
    await db.backup(target);
  } finally {
    db.close();
  }

  const sizeMb = (fs.statSync(target).size / 1024 / 1024).toFixed(2);
  console.log(`Sauvegarde écrite : ${target} (${sizeMb} Mo)`);

  // Vérification immédiate : une sauvegarde qu'on n'ouvre pas est une sauvegarde
  // dont on ignore la validité.
  const check = new Database(target, { readonly: true });
  try {
    const result = check.pragma('integrity_check', { simple: true });
    if (result !== 'ok') {
      console.error(`Sauvegarde CORROMPUE (integrity_check = ${result})`);
      process.exit(1);
    }
    const { count } = check.prepare('SELECT COUNT(*) AS count FROM users').get();
    console.log(`Vérification OK — ${count} utilisateur(s) dans la sauvegarde.`);
  } finally {
    check.close();
  }

  if (!process.argv[2]) pruneOldBackups();
}

main().catch((err) => {
  console.error('Sauvegarde échouée :', err.message);
  process.exit(1);
});
