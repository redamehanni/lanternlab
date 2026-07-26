/**
 * Routes intentions — formuler ce qu'on veut, sans dire comment.
 *
 * Une seule route d'exécution pour toutes les intentions. Ce n'est pas de la
 * paresse : c'est la forme que `POST /api/v1/intents/:id` prendra à l'étape 7. La
 * tester dès maintenant sur `/api/intents` évite de découvrir à l'étape 7 que le
 * contrôle d'accès ou l'idempotence ne tiennent pas.
 *
 * Les routes métier historiques (`POST /api/orders`) ne disparaissent pas : elles
 * restent la porte des applications mobiles, avec leur forme de réponse à elles.
 */

const express = require('express');
const { verifyToken } = require('../middleware/auth');
const orchestration = require('../lib/orchestration');

const router = express.Router();

// GET /api/intents — intentions que MON rôle peut formuler, avec leurs paramètres
router.get('/', verifyToken, (req, res) => {
  res.json({ intents: orchestration.forActor(req.user.role) });
});

// GET /api/intents/:id — plan complet d'une intention
//
// Répond au critère de l'étape 5 : comprendre tous les effets d'une intention en
// lisant un seul endroit. Sans authentification particulière : un plan décrit ce que
// Ma Zone fait, ce n'est pas un secret.
router.get('/:id', verifyToken, (req, res) => {
  const described = orchestration.describe(req.params.id);
  if (!described) return res.status(404).json({ error: 'Intention inconnue' });
  res.json({ intent: described });
});

// POST /api/intents/:id — formuler une intention
router.post('/:id', verifyToken, (req, res) => {
  try {
    const run = orchestration.run(req.params.id, req.body?.params || {}, {
      actor: req.user.id,
      actorRole: req.user.role,
      io: req.app.get('io'),
      idempotencyKey: req.get('Idempotency-Key') || req.body?.idempotency_key || null,
    });

    res.status(run.replayed ? 200 : 201).json({
      runId: run.runId,
      intent: run.intent,
      results: run.results,
      // Ce qui n'a pas pu être fait, nommé et expliqué (Loi 12).
      pending: run.report,
      replayed: run.replayed,
    });
  } catch (err) {
    if (err?.status) {
      return res.status(err.status).json({
        error: err.message,
        runId: err.runId || null,
        pending: err.report || [],
      });
    }
    throw err;
  }
});

// GET /api/intents/runs/:runId — déroulé journalisé d'une exécution
router.get('/runs/:runId', verifyToken, (req, res) => {
  const entries = orchestration.history(req.params.runId);
  if (!entries.length) return res.status(404).json({ error: 'Exécution introuvable' });

  // Une exécution n'est lisible que par son auteur ou par un administrateur : elle
  // contient l'enchaînement des décisions prises en son nom.
  const owner = entries[0].actor;
  if (req.user.role !== 'admin' && owner !== req.user.id) {
    return res.status(404).json({ error: 'Exécution introuvable' });
  }

  res.json({ run: entries });
});

module.exports = router;
