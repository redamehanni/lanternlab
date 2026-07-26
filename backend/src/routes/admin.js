/**
 * Bac à Sable — Routes HTTP administrateur.
 *
 * Namespace `/api/admin/*`. Authentification STRICTEMENT séparée de l'écosystème
 * citoyen (middleware `verifyAdmin`). Un token citoyen est rejeté.
 *
 * La World Factory est exposée ici pour que le futur Back Office web (et les
 * scripts) puissent peupler / resetter le monde de démonstration.
 */

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { verifyAdmin, signAdminToken } = require('../middleware/adminAuth');
const { JWT_SECRET } = require('../middleware/auth');
const { requireSandbox } = require('../lib/sandbox');
const world = require('../lib/worldFactory');
const explorer = require('../lib/worldFactory/explorer');
const lab = require('../lib/lab');
const { openLabOnSimulator } = require('../lib/lab/openSimulator');

const router = express.Router();

function handle(res, fn) {
  try {
    fn();
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Erreur' });
  }
}

// ── Auth admin ────────────────────────────────────────────────────────────────

router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }
    const admin = db.prepare('SELECT * FROM admin_users WHERE email = ?').get(email);
    if (!admin || !admin.active) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }
    const ok = await bcrypt.compare(password, admin.password);
    if (!ok) return res.status(401).json({ error: 'Identifiants invalides' });

    const token = signAdminToken(admin);
    res.json({
      token,
      admin: { id: admin.id, email: admin.email, name: admin.name, level: admin.level },
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Erreur' });
  }
});

router.get('/me', verifyAdmin, (req, res) => {
  res.json({ admin: req.admin });
});

// ── World Factory ─────────────────────────────────────────────────────────────

router.get('/world/recipes', verifyAdmin, (req, res) => {
  handle(res, () => {
    res.json({ recipes: world.listRecipes() });
  });
});

router.post('/world/run', verifyAdmin, (req, res) => {
  handle(res, () => {
    const { recipeId, params } = req.body || {};
    if (!recipeId) return res.status(400).json({ error: 'recipeId requis' });
    const result = world.runRecipe(recipeId, params || {});
    res.status(201).json(result);
  });
});

router.get('/world/batches', verifyAdmin, (req, res) => {
  handle(res, () => {
    res.json({ batches: world.listBatches() });
  });
});

router.post('/world/reset', verifyAdmin, (req, res) => {
  handle(res, () => {
    const { batchId } = req.body || {};
    if (batchId) {
      res.json(world.resetBatch(batchId));
    } else {
      res.json(world.resetAllDemo());
    }
  });
});

// ── Explorateur du monde (LECTURE SEULE) ──────────────────────────────────────

router.get('/world/actors', verifyAdmin, (req, res) => {
  handle(res, () => {
    res.json({
      actors: explorer.listActors({
        type: req.query.type || null,
        batchId: req.query.batchId || null,
      }),
    });
  });
});

router.get('/world/actors/:id', verifyAdmin, (req, res) => {
  handle(res, () => {
    const actor = explorer.getActorDetail(req.params.id);
    if (!actor) return res.status(404).json({ error: 'Acteur introuvable' });
    res.json({ actor });
  });
});

// ── Impersonation — « Devenir X » (sandbox + acteur démo uniquement) ───────────
// Émet un VRAI jeton citoyen. Aucune écriture : entrer dans un acteur est une
// authentification, jamais une mutation.

router.post('/impersonate', verifyAdmin, requireSandbox, (req, res) => {
  handle(res, () => {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId requis' });
    if (!explorer.isDemoUser(userId)) {
      return res.status(403).json({ error: 'Impersonation réservée aux acteurs démo' });
    }
    const u = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(userId);
    if (!u) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const token = jwt.sign(
      { id: u.id, name: u.name, email: u.email, role: u.role },
      JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({ token, user: u });
  });
});

/**
 * « Devenir X sur Xcode » — même jeton citoyen, ouvert sur le simulateur iOS
 * via simctl + deep link Expo Go (sandbox Mac uniquement).
 */
router.post('/impersonate-ios', verifyAdmin, requireSandbox, async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId requis' });
    if (!explorer.isDemoUser(userId)) {
      return res.status(403).json({ error: 'Impersonation réservée aux acteurs démo' });
    }
    const u = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(userId);
    if (!u) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const token = jwt.sign(
      { id: u.id, name: u.name, email: u.email, role: u.role },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    const opened = await openLabOnSimulator(token);
    res.json({ token, user: u, ...opened });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Ouverture simulateur impossible' });
  }
});

// ── Pouvoirs du labo — actions via organes (sandbox + cible démo) ──────────────

router.get('/lab/actions', verifyAdmin, requireSandbox, (req, res) => {
  handle(res, () => {
    res.json({ actions: lab.listActions() });
  });
});

router.post('/lab/actions/:actionId', verifyAdmin, requireSandbox, (req, res) => {
  handle(res, () => {
    const { targetUserId, params } = req.body || {};
    if (!targetUserId) return res.status(400).json({ error: 'targetUserId requis' });
    if (!explorer.isDemoUser(targetUserId)) {
      return res.status(403).json({ error: 'Action réservée aux acteurs démo' });
    }
    const io = req.app.get('io');
    const result = lab.runAction(req.params.actionId, { targetUserId, params: params || {} }, io);
    res.status(201).json(result);
  });
});

// ── Santé des files de synchronisation (étape 6) ───────────────────────────────
//
// Deux choses se surveillent ici, et une seule est un incident.
//
// Les LETTRES MORTES sont l'incident : un message qui n'a pas atteint le logiciel d'un
// commerçant après six tentatives. Perdu en silence, il se transforme en écart de stock
// qu'on découvrira par une survente.
//
// Le nombre de messages EN ATTENTE n'est pas un incident, c'est un signal. La roadmap
// chiffre le seuil de réexamen : au-delà de 200 en attente de façon soutenue, la question
// n'est plus « accélérer le worker » mais « passer à Postgres ». Sans compteur visible,
// ce seuil resterait une phrase dans un document.
router.get('/integration/queues', verifyAdmin, (req, res) => {
  handle(res, () => {
    const integration = require('../lib/integration');
    const outbox = integration.outboxStats();

    res.json({
      outbox,
      inbox: integration.inboxStats(),
      deadLetters: integration.deadLetters({ limit: 100 }),
      connectors: integration.connectors(),
      postgresThreshold: { pending: outbox.pending, reviewAbove: 200 },
    });
  });
});

// ── Usage de l'API historique (étape 7) ────────────────────────────────────────
//
// LA SEULE QUESTION QUI PERMETTE DE COUPER `/api` SANS RIEN CASSER : qui l'appelle
// encore ? Une date de fin de vie sans cette réponse laisse deux choix également mauvais
// — couper à l'aveugle, ou repousser indéfiniment par prudence.
//
// Ce que ce compteur dit : quelles routes non versionnées ont été appelées depuis le
// démarrage du serveur, combien de fois, et quand pour la dernière fois. Une route à zéro
// appel sur plusieurs jours est une route qu'on peut retirer. Une route encore appelée est
// une application installée sur le téléphone de quelqu'un.
//
// Ce qu'il ne dit pas : l'historique avant le dernier redémarrage. Compteurs en mémoire,
// limite assumée et expliquée dans `lib/sunset.js` — payer une écriture SQLite par requête
// pour de la télémétrie serait un mauvais échange sur une base à un seul écrivain.
router.get('/api-usage', verifyAdmin, (req, res) => {
  handle(res, () => {
    const sunset = require('../lib/sunset');
    res.json({
      deadlines: sunset.schedule(),
      legacy: sunset.legacyUsage(),
    });
  });
});

module.exports = router;
