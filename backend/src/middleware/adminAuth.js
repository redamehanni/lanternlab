/**
 * Authentification administrateur (Bac à Sable / Back Office).
 *
 * Séparée de l'auth citoyenne : secret distinct + claim `type: 'admin'`.
 * Un token citoyen ne peut donc JAMAIS être accepté sur une route admin, et un
 * administrateur n'existe jamais dans l'écosystème citoyen (table `admin_users`).
 */

const jwt = require('jsonwebtoken');
const db = require('../db');

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'mazone-admin-secret-dev-2024';

function signAdminToken(admin) {
  return jwt.sign(
    { adminId: admin.id, email: admin.email, type: 'admin' },
    ADMIN_JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function verifyAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token admin manquant' });
  }
  try {
    const payload = jwt.verify(header.slice(7), ADMIN_JWT_SECRET);
    if (payload.type !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }
    const admin = db
      .prepare('SELECT id, email, name, level, active FROM admin_users WHERE id = ?')
      .get(payload.adminId);
    if (!admin || !admin.active) {
      return res.status(403).json({ error: 'Administrateur inactif ou introuvable' });
    }
    req.admin = admin;
    next();
  } catch {
    return res.status(401).json({ error: 'Token admin invalide ou expiré' });
  }
}

module.exports = { verifyAdmin, signAdminToken, ADMIN_JWT_SECRET };
