/**
 * Event Engine — Routes HTTP.
 *
 * Deux faces, une seule et même règle « la surface orchestre, l'organe décide » :
 *  - PRODUCTION (authentifiée) : un acteur crée/édite/publie ses initiatives.
 *    Aujourd'hui le commerçant via l'Épée ; demain association / artiste /
 *    citoyen via le même contrat (matrice rôle × type), sans refonte du cœur.
 *  - CONSOMMATION (découverte) : projections publiques d'initiatives publiées,
 *    consommées par la Deuxième Âme (les 6 portes) et la Marketplace.
 *
 * Les écritures inter-organes (billet Wallet, scan Identity…) ne sont pas
 * exposées ici : elles passent en interne par l'organe, via l'Event Engine.
 */

const express = require('express');
const db = require('../db');
const { verifyToken } = require('../middleware/auth');
const events = require('../lib/eventEngine');

const router = express.Router();

function handle(res, fn) {
  try {
    fn();
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Erreur' });
  }
}

/** Boutiques dont l'utilisateur est membre (production commerçante). */
function userStoreIds(userId) {
  return db.prepare('SELECT store_id FROM store_members WHERE user_id = ?').all(userId).map((r) => r.store_id);
}

/**
 * Contexte de production d'un acteur : sa nature de source et l'identifiant à
 * rattacher. Générique et extensible : demain, une association/artiste aura son
 * propre mapping sans toucher au cœur.
 */
function productionContext(user) {
  if (user.role === 'merchant') {
    const stores = userStoreIds(user.id);
    return { sourceKind: events.SOURCE_KIND.MERCHANT, storeIds: stores };
  }
  // Par défaut : le citoyen produit en son nom (futurs producteurs habitants).
  return { sourceKind: events.SOURCE_KIND.CITIZEN, storeIds: [] };
}

/** Garde d'appartenance : l'utilisateur peut-il gérer cette initiative ? */
function assertCanManage(user, event) {
  const ctx = productionContext(user);
  if (ctx.sourceKind === events.SOURCE_KIND.MERCHANT) {
    if (event.storeId && ctx.storeIds.includes(event.storeId)) return;
  }
  if (event.sourceKind === events.SOURCE_KIND.CITIZEN && event.sourceId === user.id) return;
  const err = new Error('Initiative non gérée par cet acteur');
  err.status = 403;
  throw err;
}

// ── Métadonnées (formulaire de production) ────────────────────────────────────

router.get('/types', verifyToken, (req, res) => {
  handle(res, () => res.json({ types: events.listTypes() }));
});

router.get('/channels', verifyToken, (req, res) => {
  handle(res, () => res.json({ channels: events.getChannels() }));
});

// Statistiques agrégées issues du hook interne (abonné en lecture seule).
router.get('/insights', verifyToken, (req, res) => {
  handle(res, () => res.json({ insights: events.getInsights() }));
});

// ── Mode Réception (l'habitant construit ses canaux d'écoute) ─────────────────

router.get('/reception', verifyToken, (req, res) => {
  handle(res, () => res.json({ subscriptions: events.getModeReception(req.user.id) }));
});

router.put('/reception', verifyToken, (req, res) => {
  handle(res, () => {
    const entries = (req.body && req.body.subscriptions) || [];
    res.json({ subscriptions: events.setModeReception(req.user.id, entries) });
  });
});

// ── Production (créer / éditer / publier / annuler ses initiatives) ────────────

router.post('/', verifyToken, (req, res) => {
  handle(res, () => {
    const ctx = productionContext(req.user);
    const body = req.body || {};

    let sourceId = null;
    let storeId = null;
    if (ctx.sourceKind === events.SOURCE_KIND.MERCHANT) {
      // Un commerçant produit au nom d'une de ses boutiques.
      storeId = body.storeId || ctx.storeIds[0] || null;
      if (!storeId || !ctx.storeIds.includes(storeId)) {
        return res.status(403).json({ error: 'Aucune boutique valide pour produire cette initiative' });
      }
      sourceId = storeId;
    } else {
      sourceId = req.user.id;
    }

    const created = events.createEvent(
      { ...body, sourceKind: ctx.sourceKind, sourceId, storeId },
      req.app.get('io')
    );
    res.status(201).json({ event: created });
  });
});

router.get('/mine', verifyToken, (req, res) => {
  handle(res, () => {
    const ctx = productionContext(req.user);
    let mine = [];
    if (ctx.sourceKind === events.SOURCE_KIND.MERCHANT && ctx.storeIds.length) {
      mine = ctx.storeIds.flatMap((sid) => events.listEvents({ storeId: sid }));
    } else {
      mine = events.listEvents({ sourceKind: ctx.sourceKind, sourceId: req.user.id });
    }
    res.json({ events: mine });
  });
});

router.patch('/:id', verifyToken, (req, res) => {
  handle(res, () => {
    const event = events.getEventById(req.params.id);
    assertCanManage(req.user, event);
    res.json({ event: events.updateEvent(req.params.id, req.body || {}, req.app.get('io')) });
  });
});

router.post('/:id/publish', verifyToken, (req, res) => {
  handle(res, () => {
    const event = events.getEventById(req.params.id);
    assertCanManage(req.user, event);
    res.json({ event: events.publishEvent(req.params.id, { actor: req.user.id }, req.app.get('io')) });
  });
});

router.post('/:id/transition', verifyToken, (req, res) => {
  handle(res, () => {
    const event = events.getEventById(req.params.id);
    assertCanManage(req.user, event);
    const { toStatus } = req.body || {};
    if (!toStatus) return res.status(400).json({ error: 'toStatus requis' });
    res.json({ event: events.transitionEvent(req.params.id, toStatus, { actor: req.user.id }, req.app.get('io')) });
  });
});

router.post('/:id/cancel', verifyToken, (req, res) => {
  handle(res, () => {
    const event = events.getEventById(req.params.id);
    assertCanManage(req.user, event);
    res.json({ event: events.cancelEvent(req.params.id, { actor: req.user.id }, req.app.get('io')) });
  });
});

// ── Opportunité Volante (le producteur diffuse activement son initiative) ──────
// Rappel : ce n'est pas un type d'événement, mais une stratégie de diffusion.

router.post('/:id/diffuse', verifyToken, (req, res) => {
  handle(res, () => {
    const event = events.getEventById(req.params.id);
    assertCanManage(req.user, event);
    const { channels, windowStart, windowEnd, note, idempotencyKey } = req.body || {};
    const result = events.diffuseEvent(
      req.params.id,
      { channels, windowStart, windowEnd, note, actor: req.user.id },
      req.app.get('io'),
      { idempotencyKey: idempotencyKey || null }
    );
    res.status(201).json(result);
  });
});

router.get('/:id/diffusions', verifyToken, (req, res) => {
  handle(res, () => {
    const event = events.getEventById(req.params.id);
    assertCanManage(req.user, event);
    res.json({ diffusions: events.getEventDiffusions(req.params.id) });
  });
});

// ── Orchestration côté habitant (billet Wallet, découverte Lanterne) ──────────
// Actions en self-service : l'habitant identifié agit pour lui-même. L'Event
// Engine oriente vers les organes (Wallet), il ne réimplémente rien.

router.post('/:id/ticket', verifyToken, (req, res) => {
  handle(res, () => {
    const result = events.issueTicket(req.params.id, req.user.id, req.app.get('io'));
    res.status(201).json(result);
  });
});

router.post('/:id/discover', verifyToken, (req, res) => {
  handle(res, () => {
    const result = events.discoverLantern(req.params.id, req.user.id, req.app.get('io'));
    res.status(result.replayed ? 200 : 201).json(result);
  });
});

// ── Consommation (découverte — projections publiques) ─────────────────────────
// Alimente la Deuxième Âme (les 6 portes) et la Marketplace. Publiées uniquement.

router.get('/', verifyToken, (req, res) => {
  handle(res, () => {
    const filters = { status: events.EVENT_STATUS.PUBLISHED };
    if (req.query.type) filters.type = req.query.type;
    if (req.query.channel) filters.channel = req.query.channel;
    if (req.query.zoneId) filters.zoneId = req.query.zoneId;
    if (req.query.storeId) filters.storeId = req.query.storeId;
    res.json({ events: events.listEvents(filters) });
  });
});

// Découverte enrichie pour la Deuxième Âme (préparation Phase 7).
// Une porte = une vue filtrée : type / canal / zone / capacité (canTicket…).
// Inclut les Lanternes actives (statut spécialisé), contrairement à GET '/'.
router.get('/feed/discover', verifyToken, (req, res) => {
  handle(res, () => {
    const filters = {};
    if (req.query.type) filters.type = req.query.type;
    if (req.query.channel) filters.channel = req.query.channel;
    if (req.query.zoneId) filters.zoneId = req.query.zoneId;
    if (req.query.capability) filters.capability = req.query.capability;
    res.json({ events: events.listDiscoverable(filters) });
  });
});

// Projection « Murmures » (types poétiques, isMurmur).
router.get('/feed/murmurs', verifyToken, (req, res) => {
  handle(res, () => res.json({ events: events.listMurmurs() }));
});

router.get('/:id', verifyToken, (req, res) => {
  handle(res, () => res.json({ event: events.getEventById(req.params.id) }));
});

router.get('/:id/journal', verifyToken, (req, res) => {
  handle(res, () => res.json({ journal: events.getEventJournal(req.params.id) }));
});

module.exports = router;
