/**
 * Outil de développement — Crée / met à jour l'administrateur Ma Zone.
 *
 * Usage :
 *   node scripts/create-admin.js [email] [motDePasse] [nom]
 *   node scripts/create-admin.js --reset [email] [motDePasse] [nom]
 * Défauts (dev) : admin@mazone.local / admin1234 / "Admin Ma Zone"
 */

const bcrypt = require('bcrypt');
const db = require('../src/db');

async function main() {
  const args = process.argv.slice(2);
  const reset = args[0] === '--reset';
  if (reset) args.shift();

  const email = args[0] || 'admin@mazone.local';
  const password = args[1] || 'admin1234';
  const name = args[2] || 'Admin Ma Zone';
  const hash = await bcrypt.hash(password, 10);

  const existing = db.prepare('SELECT id FROM admin_users WHERE email = ?').get(email);
  if (existing) {
    if (!reset) {
      console.log(`Admin déjà existant : ${email} (passe --reset pour forcer le mot de passe)`);
      process.exit(0);
    }
    db.prepare('UPDATE admin_users SET password = ?, name = ? WHERE email = ?').run(hash, name, email);
    console.log(`Admin mis à jour : ${email}  (mot de passe : ${password})`);
    process.exit(0);
  }

  const id = db.generateId();
  db.prepare(
    "INSERT INTO admin_users (id, email, password, name, level) VALUES (?, ?, ?, ?, 'superadmin')"
  ).run(id, email, hash, name);

  console.log(`Admin créé : ${email}  (mot de passe : ${password})`);
  process.exit(0);
}

main();
