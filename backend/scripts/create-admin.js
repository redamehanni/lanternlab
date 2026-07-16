/**
 * Outil de développement — Crée le premier administrateur Ma Zone.
 *
 * Nécessaire car aucun rôle admin n'existe dans l'écosystème citoyen : les
 * administrateurs vivent dans la table séparée `admin_users`.
 *
 * Usage :
 *   node scripts/create-admin.js [email] [motDePasse] [nom]
 * Défauts (dev) : admin@mazone.local / admin1234 / "Admin Ma Zone"
 * Idempotent sur l'email.
 */

const bcrypt = require('bcrypt');
const db = require('../src/db');

async function main() {
  const email = process.argv[2] || 'admin@mazone.local';
  const password = process.argv[3] || 'admin1234';
  const name = process.argv[4] || 'Admin Ma Zone';

  const existing = db.prepare('SELECT id FROM admin_users WHERE email = ?').get(email);
  if (existing) {
    console.log(`Admin déjà existant : ${email}`);
    process.exit(0);
  }

  const hash = await bcrypt.hash(password, 10);
  const id = db.generateId();
  db.prepare(
    "INSERT INTO admin_users (id, email, password, name, level) VALUES (?, ?, ?, ?, 'superadmin')"
  ).run(id, email, hash, name);

  console.log(`Admin créé : ${email}  (mot de passe : ${password})`);
  process.exit(0);
}

main();
