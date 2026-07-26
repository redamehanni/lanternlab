/**
 * API v1 — les intentions.
 *
 * La seule route d'écriture multi-organe de toute la surface publique. Ce n'est pas une
 * économie de code : c'est ce qui empêche `/api/v1` de redevenir ce que `/api` est
 * aujourd'hui — dix-huit fichiers qui exposent des tables.
 *
 * Une route qui écrit et touche plus d'un organe passe par ici, sans exception. Une
 * route qui écrit et ne touche qu'un organe s'adresse à cet organe (Loi 5) : c'est le
 * cas de `PATCH /api/v1/inventory/:productId`, et il n'y en a pas d'autre aujourd'hui.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI `Idempotency-Key` EST OBLIGATOIRE ICI ET NULLE PART AILLEURS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Sur `/api`, la clé est acceptée mais optionnelle. Le résultat est connu : personne ne
 * l'envoie, et le jour où un réseau mobile coupe entre l'envoi et la réponse, le client
 * réessaie et achète deux fois. La faute est partagée, mais la double vente est chez
 * nous.
 *
 * Une API publique ne peut pas se permettre cette politesse. Un intégrateur qui reçoit
 * un timeout n'a que deux options : réessayer, ou perdre la commande. Exiger la clé, ce
 * n'est pas lui compliquer la vie, c'est lui rendre le réessai sûr — et c'est le seul
 * moment où on peut l'exiger, avant que du code existe qui s'en passe.
 *
 * 400 et non 422 : la requête est mal formée au sens du contrat, elle n'a pas atteint le
 * métier.
 */

const express = require('express');
const { verifyToken } = require('../../middleware/auth');
const orchestration = require('../../lib/orchestration');

const router = express.Router();

/** Longueur minimale d'une clé, alignée sur le contrat OpenAPI. */
const MIN_KEY_LENGTH = 8;

/**
 * Traduit un résultat d'orchestration en réponse de contrat.
 *
 * Le moteur renvoie `report` — le vocabulaire interne de la Loi 12. Le contrat public
 * dit `deferred`, et ajoute un `status` que le moteur n'a pas besoin de connaître. C'est
 * exactement le travail d'une route : traduire, sans rien décider.
 *
 * `partially_completed` mérite son existence. Une vente dont la remontée en caisse n'a
 * pas eu lieu n'est ni un succès complet ni un échec : l'interface doit pouvoir dire au
 * commerçant « c'est vendu, pensez à le saisir en caisse ». Un contrat qui ne connaît
 * que 200 et 500 rend cette phrase impossible.
 */
function toContract(run) {
  const deferred = (run.report || []).map((entry) => ({
    step: entry.step,
    reason: entry.skipped ? 'capability_missing' : 'step_failed',
    capability: entry.capability ?? null,
    message: entry.message ?? null,
  }));

  return {
    intent: run.intent,
    run_id: run.runId,
    status: deferred.length ? 'partially_completed' : 'completed',
    replayed: !!run.replayed,
    result: run.results || {},
    deferred,
  };
}

// GET /api/v1/intents — ce que mon rôle peut formuler
//
// Une surface qui lit cette liste n'a pas besoin de coder en dur ce qu'elle propose, et
// apprend en même temps ce qui est indisponible faute de capacité (Loi 12).
router.get('/', verifyToken, (req, res) => {
  res.json({ intents: orchestration.forActor(req.user.role) });
});

// GET /api/v1/intents/:intentId — le plan complet
//
// Sans secret : un plan décrit ce que Ma Zone fait quand on le lui demande. Le cacher
// n'ajouterait aucune sécurité et retirerait la seule façon de comprendre les effets
// d'une intention avant de la déclencher.
router.get('/:intentId', verifyToken, (req, res) => {
  const described = orchestration.describe(req.params.intentId);
  if (!described) return res.status(404).json({ error: 'Intention inconnue' });
  res.json({ intent: described });
});

// POST /api/v1/intents/:intentId — formuler une intention
router.post('/:intentId', verifyToken, (req, res) => {
  const key = req.get('Idempotency-Key');

  if (!key || key.trim().length < MIN_KEY_LENGTH) {
    return res.status(400).json({
      error: `En-tête « Idempotency-Key » requise (${MIN_KEY_LENGTH} caractères minimum). `
        + 'Rejouer la même clé renvoie le premier résultat, sans nouvel effet.',
    });
  }

  try {
    const run = orchestration.run(req.params.intentId, req.body?.params || {}, {
      actor: req.user.id,
      actorRole: req.user.role,
      io: req.app.get('io'),
      idempotencyKey: key.trim(),
    });

    const payload = toContract(run);
    // 200 sur un rejeu, 201 sur une première exécution : un intégrateur qui réessaie doit
    // pouvoir distinguer « ma commande vient d'être créée » de « elle l'était déjà », sans
    // relire le corps.
    res.status(run.replayed ? 200 : 201).json(payload);
  } catch (err) {
    if (!err?.status) throw err;

    // 422 quand des étapes ont été défaites : la demande était légitime, l'état l'a
    // refusée en cours de route, et Ma Zone a tout remis en place. Un 400 laisserait
    // croire à une erreur de l'appelant ; un 500 à une panne. Ce n'est ni l'un ni l'autre.
    const undone = err.compensated || [];
    const status = undone.length ? 422 : err.status;

    res.status(status).json({
      error: err.message,
      intent: req.params.intentId,
      run_id: err.runId || null,
      status: undone.length ? 'compensated' : 'failed',
      compensated: undone,
      deferred: (err.report || []).map((entry) => ({
        step: entry.step,
        reason: entry.skipped ? 'capability_missing' : 'step_failed',
        capability: entry.capability ?? null,
        message: entry.message ?? null,
      })),
    });
  }
});

// GET /api/v1/intents/runs/:runId — le déroulé journalisé
//
// Déclarée APRÈS `/:intentId` mais atteinte quand même : Express essaie les motifs dans
// l'ordre, et `/runs/:runId` a deux segments là où `/:intentId` n'en a qu'un. Aucune
// ambiguïté, donc aucune raison de renommer la route pour contourner le routeur.
router.get('/runs/:runId', verifyToken, (req, res) => {
  const entries = orchestration.history(req.params.runId);
  if (!entries.length) return res.status(404).json({ error: 'Exécution introuvable' });

  // Une exécution contient l'enchaînement des décisions prises au nom de quelqu'un :
  // elle ne se lit que par son auteur. 404 et non 403, pour ne pas confirmer qu'elle
  // existe.
  if (req.user.role !== 'admin' && entries[0].actor !== req.user.id) {
    return res.status(404).json({ error: 'Exécution introuvable' });
  }

  res.json({ run_id: req.params.runId, steps: entries });
});

module.exports = router;
