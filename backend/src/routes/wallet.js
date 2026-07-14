/**
 * Wallet Engine — Routes HTTP (lecture seule, propriétaire uniquement).
 *
 * Les écritures (émettre / consommer / révoquer un objet) ne sont PAS exposées
 * ici : ce sont des opérations inter-organes appelées en interne via
 * `require('../lib/walletEngine')` (même pattern que les autres organes).
 * Exposer l'émission au client ouvrirait une faille (auto-attribution d'objets).
 * La consommation par scan relèvera de l'organe QR Identity (à venir).
 */

const express = require('express');
const { verifyToken } = require('../middleware/auth');
const wallet = require('../lib/walletEngine');

const router = express.Router();

function handle(res, fn) {
  try {
    fn();
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Erreur' });
  }
}

// Vue du Wallet organisée par familles (écran principal).
router.get('/', verifyToken, (req, res) => {
  handle(res, () => {
    const families = wallet.getWalletByFamilies(req.user.id);
    res.json({ families });
  });
});

// Catalogue statique des familles d'objets.
router.get('/families', verifyToken, (req, res) => {
  res.json({ families: wallet.getFamilies() });
});

// Liste plate des objets du propriétaire (filtres : family, kind, status).
router.get('/objects', verifyToken, (req, res) => {
  handle(res, () => {
    const filters = {};
    if (req.query.family) filters.family = req.query.family;
    if (req.query.kind) filters.kind = req.query.kind;
    if (req.query.status) filters.status = req.query.status;
    const objects = wallet.getObjectsByOwner(req.user.id, filters);
    res.json({ objects });
  });
});

// Détail d'un objet numérique.
router.get('/objects/:id', verifyToken, (req, res) => {
  handle(res, () => {
    res.json({ object: wallet.getObjectById(req.params.id, req.user.id) });
  });
});

// Capacités disponibles pour l'objet (menu « Gérer cet objet numérique »).
router.get('/objects/:id/capabilities', verifyToken, (req, res) => {
  handle(res, () => {
    res.json({ capabilities: wallet.getCapabilitiesForObject(req.params.id, req.user.id) });
  });
});

// Biographie de l'objet : journal append-only complet.
router.get('/objects/:id/events', verifyToken, (req, res) => {
  handle(res, () => {
    res.json({ events: wallet.getObjectEvents(req.params.id, req.user.id) });
  });
});

module.exports = router;
