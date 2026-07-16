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

module.exports = router;
