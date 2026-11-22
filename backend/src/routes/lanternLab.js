/**
 * Routes Simulateur Lantern Engine (S1).
 * Namespace : /api/admin/lantern-lab/*
 * Sandbox uniquement — même handleEvent que le moteur.
 */

const express = require('express');
const path = require('path');
const multer = require('multer');
const { verifyAdmin } = require('../middleware/adminAuth');
const { isSandbox } = require('../lib/sandbox');
const simulate = require('../lib/lanternEngine/simulate');
const mediaStore = require('../lib/lanternEngine/creator/mediaStore');

const router = express.Router();

const DEFAULT_SIM_KEY = 'mazone-lantern-sim';

function simKeyOk(req) {
  const expected = process.env.LANTERN_SIM_KEY || DEFAULT_SIM_KEY;
  const got =
    req.headers['x-lantern-sim-key'] ||
    req.headers['x-mazone-lab-key'] ||
    req.query.simKey;
  return Boolean(got && got === expected);
}

/**
 * Sandbox obligatoire. Auth = Admin JWT OU clé lab locale.
 */
function authSim(req, res, next) {
  if (!isSandbox()) {
    return res.status(403).json({
      error: 'Simulateur Lantern réservé au Bac à Sable (indisponible en production).',
    });
  }
  if (simKeyOk(req)) {
    req.lanternSim = { mode: 'sim_key' };
    return next();
  }
  return verifyAdmin(req, res, next);
}

function handle(res, fn) {
  try {
    const out = fn();
    if (out && typeof out.then === 'function') {
      return out.then((v) => res.json(v)).catch((e) => {
        res.status(e.status || 500).json({ error: e.message, code: e.code || null });
      });
    }
    return res.json(out);
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message || 'Erreur', code: e.code || null });
  }
}

router.get('/health', authSim, (_req, res) => {
  res.json({
    ok: true,
    engine: 'lanternEngine',
    stage: 'S1+E6',
    sandbox: isSandbox(),
  });
});

router.get('/fixtures', authSim, (_req, res) => {
  handle(res, () => ({ fixtures: simulate.listFixtures() }));
});

router.get('/fixtures/:fixtureId', authSim, (req, res) => {
  handle(res, () => {
    const { meta, definition } = simulate.loadFixture(req.params.fixtureId);
    return {
      meta,
      definition: {
        id: definition.id,
        title: definition.title,
        slug: definition.slug,
        timezone: definition.timezone,
        rules: (definition.rules || []).map((r) => ({
          id: r.id,
          title: r.title,
          listen: r.listen,
          priority: r.priority,
          exclusiveGroupId: r.exclusiveGroupId || null,
        })),
        zones: definition.zones,
        mediaItems: definition.mediaItems,
        variables: definition.variables,
      },
    };
  });
});

router.get('/presets', authSim, (_req, res) => {
  handle(res, () => ({ presets: simulate.listPresets() }));
});

router.post('/sessions', authSim, (req, res) => {
  handle(res, () => simulate.createSession(req.body || {}));
});

router.get('/sessions/:sessionId', authSim, (req, res) => {
  handle(res, () => {
    const session = simulate.getSession(req.params.sessionId);
    return {
      sessionId: session.id,
      label: session.label,
      fixtureId: session.fixtureId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      state: simulate.snapshotState(session.runtime),
      historyCount: session.history.length,
    };
  });
});

router.delete('/sessions/:sessionId', authSim, (req, res) => {
  handle(res, () => {
    const ok = simulate.deleteSession(req.params.sessionId);
    if (!ok) {
      const err = new Error('Session introuvable');
      err.status = 404;
      throw err;
    }
    return { ok: true };
  });
});

router.post('/sessions/:sessionId/simulate', authSim, (req, res) => {
  handle(res, () => {
    const session = simulate.getSession(req.params.sessionId);
    return simulate.runStep(session, req.body || {});
  });
});

/**
 * One-shot : crée une session + exécute event/tick.
 * Body : fixtureId, runtime?, event?, tickTo?, now, lat, lng
 */
router.post('/simulate', authSim, (req, res) => {
  handle(res, () => {
    const body = req.body || {};
    if (body.sessionId) {
      const session = simulate.getSession(body.sessionId);
      return simulate.runStep(session, body);
    }
    return simulate.simulateOnce(body);
  });
});

// ── Creator Phase A — conception visuelle (compile → même moteur) ─────────────

const creator = require('../lib/lanternEngine/creator');

router.get('/creator/catalog', authSim, (_req, res) => {
  handle(res, () => ({ catalog: creator.getCatalog() }));
});

router.get('/creator/situations', authSim, (_req, res) => {
  handle(res, () => ({ situations: creator.listSituationTemplates() }));
});

router.get('/creator/situations/:id', authSim, (req, res) => {
  handle(res, () => ({ situation: creator.loadSituationTemplate(req.params.id) }));
});

router.post('/creator/compile', authSim, (req, res) => {
  handle(res, () => {
    const situation = req.body?.situation;
    if (!situation) {
      const err = new Error('situation requise');
      err.status = 400;
      throw err;
    }
    const prepared = creator.compileAndPrepare(situation, {
      fixtureId: req.body.fixtureId || situation.fixtureId,
    });
    return {
      title: prepared.compiled.title,
      situationId: prepared.compiled.situationId,
      humanSummary: prepared.compiled.humanSummary,
      enginePreview: prepared.compiled.enginePreview,
      rules: prepared.compiled.rules,
    };
  });
});

router.post('/creator/test', authSim, (req, res) => {
  handle(res, () => {
    const situation = req.body?.situation;
    if (!situation) {
      const err = new Error('situation requise');
      err.status = 400;
      throw err;
    }
    return creator.testSituation(situation, req.body.test || {});
  });
});

// ── Creator Phase B — Étages de situation ────────────────────────────────────

router.get('/creator/adventures', authSim, (_req, res) => {
  handle(res, () => ({ adventures: creator.listAdventures() }));
});

router.post('/creator/adventures/blank', authSim, (req, res) => {
  handle(res, () => {
    const adventure = creator.newBlankAdventure(req.body?.title);
    let warnings = [];
    try {
      const compiled = creator.compileAdventureFull(adventure);
      warnings = compiled.warnings || [];
    } catch (e) {
      warnings = [{ level: 'error', code: 'COMPILE', message: e.message }];
    }
    return { adventure, warnings };
  });
});

router.get('/creator/adventures/:id', authSim, (req, res) => {
  handle(res, () => {
    const bundle = creator.getAdventureBundle(req.params.id);
    return {
      adventure: bundle.adventure,
      list: bundle.list,
      tree: bundle.tree,
      journey: bundle.journey,
      warnings: bundle.warnings,
      humanSummary: bundle.humanSummary,
      enginePreview: bundle.enginePreview,
      initialRuntime: bundle.initialRuntime,
      e6: bundle.e6,
    };
  });
});

router.post('/creator/adventures/compile', authSim, (req, res) => {
  handle(res, () => {
    const adventure = req.body?.adventure;
    if (!adventure) {
      const err = new Error('adventure requise');
      err.status = 400;
      throw err;
    }
    const compiled = creator.compileAdventureFull(adventure);
    return {
      id: compiled.definition.id,
      title: adventure.title,
      warnings: compiled.warnings,
      humanSummary: compiled.humanSummary,
      tree: compiled.tree,
      journey: compiled.journey,
      list: creator.listViewModel(adventure, compiled),
      enginePreview: {
        rulesCount: compiled.definition.rules.length,
        floors: compiled.floors.length,
      },
      // Mode développeur uniquement côté client
      definition: compiled.definition,
      initialRuntime: compiled.initialRuntime,
      e6: creator.e6.buildE6(adventure),
    };
  });
});

router.post('/creator/adventures/test-situation', authSim, (req, res) => {
  handle(res, () => {
    const adventure = req.body?.adventure;
    const situationId = req.body?.situationId;
    if (!adventure || !situationId) {
      const err = new Error('adventure et situationId requis');
      err.status = 400;
      throw err;
    }
    return creator.testAdventureSituation(adventure, situationId, req.body.test || {});
  });
});

router.post('/creator/adventures/validate', authSim, (req, res) => {
  handle(res, () => {
    const adventure = req.body?.adventure;
    if (!adventure) {
      const err = new Error('adventure requise');
      err.status = 400;
      throw err;
    }
    return creator.validateAdventureOnly(adventure);
  });
});

router.post('/creator/adventures/journey/start', authSim, (req, res) => {
  handle(res, () => {
    const adventure = req.body?.adventure;
    if (!adventure) {
      const err = new Error('adventure requise');
      err.status = 400;
      throw err;
    }
    return creator.startJourneySession(adventure, {
      runtime: req.body.runtime || {},
      label: req.body.label || null,
    });
  });
});

router.post('/creator/adventures/journey/step', authSim, (req, res) => {
  handle(res, () => {
    const sessionId = req.body?.sessionId;
    if (!sessionId) {
      const err = new Error('sessionId requis');
      err.status = 400;
      throw err;
    }
    return creator.stepJourneySession(sessionId, req.body.step || req.body);
  });
});

// ── Creator Phase C — brouillons sandbox ─────────────────────────────────────

router.get('/creator/drafts', authSim, (_req, res) => {
  handle(res, () => ({ drafts: creator.drafts.listDrafts() }));
});

router.get('/creator/drafts/:id', authSim, (req, res) => {
  handle(res, () => {
    const draft = creator.drafts.loadDraft(req.params.id);
    const compiled = creator.compileAdventureFull(draft.adventure);
    return {
      draft,
      adventure: draft.adventure,
      list: creator.listViewModel(draft.adventure, compiled),
      tree: compiled.tree,
      journey: compiled.journey,
      warnings: compiled.warnings,
      e6: compiled.e6 || creator.e6.buildE6(draft.adventure),
    };
  });
});

router.post('/creator/drafts', authSim, (req, res) => {
  handle(res, () => {
    const saved = creator.drafts.saveDraft({
      id: req.body?.id || null,
      title: req.body?.title,
      adventure: req.body?.adventure,
      sourceAdventureId: req.body?.sourceAdventureId,
    });
    return { draft: saved };
  });
});

router.delete('/creator/drafts/:id', authSim, (req, res) => {
  handle(res, () => creator.drafts.deleteDraft(req.params.id));
});

router.post('/creator/inventory/add', authSim, (req, res) => {
  handle(res, () => {
    const adventure = req.body?.adventure;
    const kind = req.body?.kind;
    if (!adventure || !kind) {
      const err = new Error('adventure et kind requis');
      err.status = 400;
      throw err;
    }
    return creator.applyInventoryAdd(adventure, kind, req.body.payload || {});
  });
});

router.post('/creator/inventory/update', authSim, (req, res) => {
  handle(res, () => {
    const adventure = req.body?.adventure;
    const kind = req.body?.kind;
    if (!adventure || !kind) {
      const err = new Error('adventure et kind requis');
      err.status = 400;
      throw err;
    }
    return creator.applyInventoryUpdate(adventure, kind, req.body.payload || {});
  });
});

// ── E6 — Timeline / Carte / Médias / Simulateur ──────────────────────────────

const labUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: mediaStore.MAX_BYTES },
});

function acceptLabFile(req, res, next) {
  labUpload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload refusé' });
    next();
  });
}

router.post('/creator/e6/views', authSim, (req, res) => {
  handle(res, () => {
    const adventure = req.body?.adventure;
    if (!adventure) {
      const err = new Error('adventure requise');
      err.status = 400;
      throw err;
    }
    return creator.e6.buildE6(adventure);
  });
});

router.post('/creator/adventures/simulate', authSim, (req, res) => {
  handle(res, () => {
    const adventure = req.body?.adventure;
    if (!adventure) {
      const err = new Error('adventure requise');
      err.status = 400;
      throw err;
    }
    return creator.simulateAdventure(adventure, req.body || {});
  });
});

router.post('/creator/media/upload', authSim, acceptLabFile, (req, res) => {
  handle(res, () => {
    if (!req.file) {
      const err = new Error('Fichier requis');
      err.status = 400;
      throw err;
    }
    return mediaStore.saveBuffer({
      buffer: req.file.buffer,
      mime: req.file.mimetype,
      originalName: req.file.originalname,
      adventureId: req.body?.adventureId || null,
      contentId: req.body?.contentId || null,
    });
  });
});

router.get('/creator/media/file/:fileId', authSim, (req, res) => {
  const rec = mediaStore.resolveFile(req.params.fileId);
  if (!rec) return res.status(404).json({ error: 'Fichier introuvable' });
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=120');
  res.setHeader('Content-Type', rec.mime);
  return res.sendFile(rec.abs);
});

module.exports = {
  router,
  authSim,
  DEFAULT_SIM_KEY,
};
