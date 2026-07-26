/**
 * Routes intégrations — l'écran « Mes intégrations » de l'Épée.
 *
 * Couche de TRADUCTION, comme toutes les routes depuis l'étape 3 : elle lit un corps
 * HTTP, vérifie qui parle, appelle l'organe, met en forme. Aucune décision, aucun SQL.
 *
 * LOI 16 — aucune de ces routes ne parle un protocole d'éditeur. Elles parlent de
 * « brancher un logiciel », « importer un fichier », « voir ce qui n'est pas parti ».
 * Ce qui se passe derrière — jetons, formats, files, réessais — appartient à
 * l'Integration Engine et n'a aucune raison d'apparaître dans une URL.
 */

const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const access = require('../lib/access');
const integration = require('../lib/integration');

const router = express.Router();

/** Le commerçant est-il de cette boutique ? Posé une fois, pour toutes les routes. */
function requireStoreMember(req, res, next) {
  const storeId = req.params.storeId || req.body?.store_id;
  if (!storeId) return res.status(400).json({ error: 'Boutique manquante' });
  if (!access.isStoreMember(req.user.id, storeId)) {
    // 404 et non 403 : répondre « interdit » confirmerait l'existence de la boutique.
    return res.status(404).json({ error: 'Boutique introuvable' });
  }
  req.storeId = storeId;
  return next();
}

function fail(res, err) {
  if (err?.status) return res.status(err.status).json({ error: err.message });
  throw err;
}

/**
 * Adaptateur pour les routes qui attendent un logiciel tiers.
 *
 * Express 4 n'attend PAS une promesse : un rejet dans un `async (req, res)` ne remonte pas au
 * gestionnaire d'erreurs de l'application, il devient un rejet non traité — et la requête reste
 * sans réponse jusqu'au délai d'attente du client. C'était sans conséquence tant qu'aucune route
 * n'était asynchrone ; les routes de l'étape 8 font des appels réseau, elles ne peuvent pas s'en
 * passer. Trois lignes ici valent mieux qu'un écran qui tourne indéfiniment.
 */
function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

// POST /api/integration/webhooks/:connectorId — un logiciel nous prévient
//
// TROIS DÉCISIONS TIENNENT DANS CETTE ROUTE, ET AUCUNE N'EST NÉGOCIABLE.
//
// 1. RÉPONDRE 202, VITE. On accepte, on ne traite pas. Un éditeur qui attend notre logique
//    métier finit par considérer notre point d'entrée comme lent, puis le désactive. Le
//    traitement a lieu plus tard, par le worker de l'Inbox.
//
// 2. VÉRIFIER AVANT D'ACCEPTER. Une route de webhook est publique par nature : sans
//    signature vérifiée, n'importe qui pourrait déclarer le stock d'une boutique. Un
//    connecteur qui ne sait pas vérifier n'a donc pas de webhook — 501, pas de passe-droit.
//    ÉTAPE 8 : cette porte, fermée jusqu'ici faute de connecteur capable, s'ouvre pour le
//    premier logiciel du marché. La règle n'a pas bougé d'un mot pour l'accueillir.
//
// 3. NE RIEN DÉCIDER ICI. La route ne lit pas la charge, ne la traduit pas, ne touche aucun
//    organe. Elle range un message dans une file.
router.post('/webhooks/:connectorId', (req, res) => {
  try {
    const accepted = integration.receiveWebhook({
      connectorId: req.params.connectorId,
      headers: req.headers,
      rawBody: req.rawBody,
      payload: req.body,
    });
    // 202 même sur un doublon : dire « déjà reçu » à un éditeur qui réessaie l'inciterait
    // à considérer sa livraison comme échouée et à recommencer indéfiniment.
    res.status(202).json({ accepted: true, duplicate: accepted.duplicate });
  } catch (err) {
    fail(res, err);
  }
});

// GET /api/integration/connectors — logiciels que Ma Zone sait brancher
router.get('/connectors', verifyToken, (req, res) => {
  res.json({ connectors: integration.connectors() });
});

// GET /api/integration/stores/:storeId — état des intégrations d'une boutique
//
// ÉTAPE 8 — la réponse porte désormais tout ce qu'il faut pour DESSINER l'écran, y compris
// le formulaire de connexion de chaque logiciel. C'est ce qui permet à « Mes intégrations »
// de ne contenir aucune connaissance d'éditeur : l'écran lit une description et l'affiche.
// Le connecteur suivant n'ajoutera donc pas une ligne au mobile.
//
// Ce que cette réponse ne contient JAMAIS : un identifiant d'éditeur. `credentials` ne donne
// que des noms et des dates — voir `lib/integration/secrets.js`.
router.get('/stores/:storeId', verifyToken, requireRole('merchant'), requireStoreMember, (req, res) => {
  const state = integration.stateForStore(req.storeId);
  res.json({
    // Champs de l'étape 6, conservés : des écrans les lisent déjà.
    installations: integration.forStore(req.storeId, { activeOnly: false }),
    capabilities: state.capabilities,
    conflicts: state.pendingConflicts,
    outbox: state.outbox,
    // Étape 8.
    connectors: state.connectors,
    conflictLog: state.conflicts,
  });
});

// POST /api/integration/stores/:storeId/connect/:connectorId — commencer une connexion
//
// Deux réponses possibles, selon ce que le logiciel exige, et l'écran n'a pas à savoir
// lequel : soit une URL de consentement à ouvrir, soit une installation déjà faite.
router.post(
  '/stores/:storeId/connect/:connectorId',
  verifyToken, requireRole('merchant'), requireStoreMember,
  asyncRoute(async (req, res) => {
    try {
      const form = integration.connectionForm(req.params.connectorId);

      if (form.mode === integration.CONNECTION_MODE.DELEGATED) {
        const started = integration.beginConnection({
          storeId: req.storeId,
          connectorId: req.params.connectorId,
          actor: req.user.id,
          params: req.body?.params || {},
        });
        // 200 et non 201 : rien n'a été créé côté commerçant. Il n'a pas encore donné son
        // accord chez son éditeur, et il peut très bien ne jamais le donner.
        return res.json({ mode: form.mode, authorize_url: started.authorizeUrl });
      }

      if (form.mode === integration.CONNECTION_MODE.CREDENTIALS) {
        const result = await integration.connectWithCredentials({
          storeId: req.storeId,
          connectorId: req.params.connectorId,
          values: req.body?.credentials || {},
          config: req.body?.config ?? null,
          actor: req.user.id,
        });
        return res.status(201).json({ mode: form.mode, installation: result.installation });
      }

      const installation = integration.install({
        storeId: req.storeId,
        connectorId: req.params.connectorId,
        config: req.body?.config ?? null,
        actor: req.user.id,
      });
      return res.status(201).json({ mode: form.mode, installation });
    } catch (err) {
      return fail(res, err);
    }
  })
);

// GET /api/integration/oauth/:connectorId/callback — retour du logiciel du commerçant
//
// TROIS PARTICULARITÉS, ET AUCUNE N'EST ARBITRAIRE.
//
// 1. AUCUNE AUTHENTIFICATION MA ZONE. C'est l'éditeur qui redirige le navigateur du
//    commerçant, et rien ne garantit qu'il porte notre jeton — sur mobile, la connexion a
//    lieu dans le navigateur du système, qui n'a pas notre session. La preuve d'identité est
//    donc le jeton d'état à usage unique créé au départ, pas un en-tête d'autorisation.
// 2. UNE PAGE HTML, PAS DU JSON. Le destinataire est un humain devant un navigateur. Lui
//    répondre `{"installation":{...}}` serait une fin de parcours ratée.
// 3. AUCUN DÉTAIL TECHNIQUE EN CAS D'ÉCHEC. Un message d'erreur affiché dans un navigateur
//    est un message public : il ne nomme ni variable d'environnement, ni jeton, ni hôte.
router.get('/oauth/:connectorId/callback', asyncRoute(async (req, res) => {
  try {
    await integration.completeConnection({
      connectorId: req.params.connectorId,
      query: req.query || {},
    });
    res.type('html').send(page(
      'Logiciel connecté',
      'Votre logiciel est relié à Ma Zone. Vous pouvez revenir dans l\'application : '
      + 'votre catalogue et votre stock vont se synchroniser.'
    ));
  } catch (err) {
    res.status(err?.status || 500).type('html').send(page(
      'Connexion interrompue',
      err?.status ? err.message : 'La connexion n\'a pas abouti. Réessayez depuis Ma Zone.'
    ));
  }
}));

/** Page de fin de parcours. Sobre et autonome : ce navigateur n'a pas nos feuilles de style. */
function page(title, message) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} — Ma Zone</title></head>
<body style="font-family:system-ui,-apple-system,sans-serif;max-width:34rem;margin:4rem auto;padding:0 1.5rem;line-height:1.6;color:#1a1a1a">
<h1 style="font-size:1.4rem">${escapeHtml(title)}</h1>
<p>${escapeHtml(message)}</p>
</body></html>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// POST /api/integration/stores/:storeId/reconcile — confronter Ma Zone et les logiciels
//
// Existe comme geste du COMMERÇANT : « mon stock ne me paraît pas juste » doit avoir une
// réponse dans l'écran, pas un ticket de support. La réconciliation périodique fait la même
// chose sans qu'on le demande ; ce bouton rend le contrôle.
router.post(
  '/stores/:storeId/reconcile',
  verifyToken, requireRole('merchant'), requireStoreMember,
  asyncRoute(async (req, res) => {
    try {
      const report = await integration.reconcile({
        storeId: req.storeId,
        full: req.body?.full === true,
      });
      res.json(report);
    } catch (err) {
      fail(res, err);
    }
  })
);

// POST /api/integration/stores/:storeId/connectors/:connectorId — brancher
router.post(
  '/stores/:storeId/connectors/:connectorId',
  verifyToken, requireRole('merchant'), requireStoreMember,
  (req, res) => {
    try {
      const installation = integration.install({
        storeId: req.storeId,
        connectorId: req.params.connectorId,
        config: req.body?.config ?? null,
        actor: req.user.id,
      });
      res.status(201).json({ installation });
    } catch (err) {
      fail(res, err);
    }
  }
);

// DELETE /api/integration/stores/:storeId/connectors/:connectorId — débrancher
//
// TROIS GESTES EN UN, ET LEUR DIFFÉRENCE COMPTE (étape 8) : le logiciel est suspendu, ses
// identifiants sont EFFACÉS, et les curseurs de lecture oubliés. Les correspondances, elles,
// sont conservées : sans elles, rebrancher recréerait des doublons chez l'éditeur.
//
// Un jeton d'éditeur est une procuration. Le commerçant qui retire son logiciel retire aussi
// notre droit d'agir dedans — le garder « au cas où » serait conserver une clé de chez lui.
//
// `?pause=1` suspend SANS rendre la procuration : c'est le geste de celui qui veut arrêter la
// synchronisation une journée, pas rompre. Deux intentions différentes, deux comportements.
router.delete(
  '/stores/:storeId/connectors/:connectorId',
  verifyToken, requireRole('merchant'), requireStoreMember,
  (req, res) => {
    try {
      if (req.query.pause === '1') {
        return res.json({ installation: integration.pause({
          storeId: req.storeId,
          connectorId: req.params.connectorId,
        }) });
      }

      const result = integration.disconnect({
        storeId: req.storeId,
        connectorId: req.params.connectorId,
      });
      return res.json(result);
    } catch (err) {
      return fail(res, err);
    }
  }
);

// POST /api/integration/stores/:storeId/import/inspect — ce que Ma Zone comprend du fichier
//
// Séparée de l'import : un commerçant doit pouvoir vérifier avant de valider. Un import
// qui part directement est un import qu'on n'ose pas essayer.
router.post(
  '/stores/:storeId/import/inspect',
  verifyToken, requireRole('merchant'), requireStoreMember,
  (req, res) => {
    try {
      res.json(integration.inspectImport(req.body?.document || ''));
    } catch (err) {
      fail(res, err);
    }
  }
);

// POST /api/integration/stores/:storeId/import — importer un catalogue
router.post(
  '/stores/:storeId/import',
  verifyToken, requireRole('merchant'), requireStoreMember,
  (req, res) => {
    try {
      const result = integration.importCatalog({
        storeId: req.storeId,
        document: req.body?.document || '',
        actor: req.user.id,
      });
      // 200 et non 201 : un import partiel n'est pas une création, c'est un compte rendu.
      res.json(result);
    } catch (err) {
      fail(res, err);
    }
  }
);

// GET /api/integration/stores/:storeId/export/sales — ventes à recopier en caisse
router.get(
  '/stores/:storeId/export/sales',
  verifyToken, requireRole('merchant'), requireStoreMember,
  (req, res) => {
    try {
      const { rows, csv } = integration.exportSales({ storeId: req.storeId });
      if (req.query.format === 'csv') {
        res.type('text/csv').attachment('ventes-ma-zone.csv').send(csv);
        return;
      }
      res.json({ sales: rows });
    } catch (err) {
      fail(res, err);
    }
  }
);

// GET /api/integration/stores/:storeId/outbox/dead — ce qui n'est jamais parti
//
// Une vente qui n'atteint pas le logiciel du commerçant après six tentatives ne doit pas
// finir dans un journal technique que personne ne lit. C'est LUI qui doit l'apprendre, et
// pouvoir relancer une fois le problème corrigé.
router.get(
  '/stores/:storeId/outbox/dead',
  verifyToken, requireRole('merchant'), requireStoreMember,
  (req, res) => {
    res.json({ dead: integration.deadLetters({ storeId: req.storeId }) });
  }
);

// POST /api/integration/stores/:storeId/outbox/:messageId/retry — relancer
router.post(
  '/stores/:storeId/outbox/:messageId/retry',
  verifyToken, requireRole('merchant'), requireStoreMember,
  (req, res) => {
    const message = integration.outboxForStore(req.storeId, { limit: 1000 })
      .find((m) => m.id === req.params.messageId);
    // Recherche bornée à la boutique : un identifiant de message ne doit pas permettre de
    // relancer l'envoi d'une autre boutique.
    if (!message) return res.status(404).json({ error: 'Message introuvable' });

    if (!integration.reviveDeadLetter(message.id)) {
      return res.status(409).json({ error: 'Ce message n\'est pas en échec définitif' });
    }
    return res.json({ revived: true });
  }
);

// GET /api/integration/stores/:storeId/conflicts — ce que Ma Zone a refusé, et pourquoi
router.get(
  '/stores/:storeId/conflicts',
  verifyToken, requireRole('merchant'), requireStoreMember,
  (req, res) => {
    res.json({
      conflicts: integration.conflictsForStore(req.storeId, {
        unacknowledgedOnly: req.query.pending === '1',
      }),
    });
  }
);

// POST /api/integration/conflicts/:conflictId/acknowledge — « j'ai vu »
router.post(
  '/conflicts/:conflictId/acknowledge',
  verifyToken, requireRole('merchant'),
  (req, res) => {
    const done = integration.acknowledgeConflict(req.params.conflictId);
    if (!done) return res.status(404).json({ error: 'Conflit introuvable ou déjà vu' });
    res.json({ acknowledged: true });
  }
);

module.exports = router;
