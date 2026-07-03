const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'mazone-secret-dev-2024';

function verifyToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: `Accès réservé aux ${roles.join('/')}` });
    }
    next();
  };
}

module.exports = { verifyToken, requireRole, JWT_SECRET };
