/**
 * Identity Engine — Routes HTTP.
 *
 * - GET  /token   : le citoyen obtient un jeton de présentation frais (rotatif).
 *                   Le bord client l'encode dans un canal (QR en V1).
 * - POST /verify  : un vérificateur autorisé (rôle) résout une identité à partir
 *                   d'un handle présenté, et reçoit une revendication minimale.
 * - GET  /history : le citoyen consulte l'historique de ses identifications.
 *
 * L'émission et la révocation en masse ne sont pas des actions client libres :
 * `revokeAll` est une primitive interne (déconnexion / incident), appelée via
 * `require('../lib/identityEngine')` — jamais exposée en écriture publique.
 */

const express = require('express');
const { verifyToken } = require('../middleware/auth');
const identity = require('../lib/identityEngine');

const router = express.Router();

function handle(res, fn) {
  try {
    fn();
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Erreur' });
  }
}

// Le citoyen obtient (ou fait tourner) son jeton de présentation d'identité.
router.get('/token', verifyToken, (req, res) => {
  handle(res, () => {
    const io = req.app.get('io');
    const token = identity.issuePresentation({ userId: req.user.id, purpose: 'identity' }, io);
    res.json(token);
  });
});

// Un vérificateur autorisé résout une identité à partir d'un handle présenté.
router.post('/verify', verifyToken, (req, res) => {
  handle(res, () => {
    const io = req.app.get('io');
    const claim = identity.verifyPresentation(
      {
        handle: req.body.handle,
        verifierId: req.user.id,
        verifierRole: req.user.role,
        purpose: req.body.purpose || 'identity',
        channel: req.body.channel || 'qr',
        idempotencyKey: req.body.idempotencyKey || null,
      },
      io
    );
    res.json({ claim });
  });
});

// Le citoyen consulte l'historique de ses identifications réussies.
router.get('/history', verifyToken, (req, res) => {
  handle(res, () => {
    const events = identity.getVerificationHistory(req.user.id);
    res.json({ events });
  });
});

module.exports = router;
