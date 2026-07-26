/**
 * Orchestration — exécution des intentions.
 *
 * Séquence, journalise, compense. Rien d'autre.
 *
 * Ce fichier ne doit JAMAIS contenir de règle métier, de nom de table d'organe, ni de
 * nom de logiciel tiers. Un test structurel le vérifie, parce que c'est le risque
 * principal de toute l'architecture : un orchestrateur attire le métier, et dans
 * dix-huit mois un plan contiendrait des cas particuliers. Le garde-fou n'est pas la
 * discipline, c'est un test qui casse la CI.
 *
 * LOI 16 — ce moteur exécute des INTENTIONS MÉTIER. Il ne parle à aucun logiciel tiers,
 * jamais, même indirectement : il appelle une opération d'organe par son nom et attend
 * un résultat. Ce qu'il ne fait à aucun moment : ouvrir une connexion réseau, lire un
 * secret d'éditeur, traduire un format, résoudre un identifiant externe, gérer une file
 * ou un réessai de synchronisation. Tout cela appartient exclusivement à l'Integration
 * Engine et aux connecteurs. Le `capabilities.has()` ci-dessous est la seule chose que
 * ce moteur sait du monde extérieur — une réponse oui/non, sans cause connue.
 *
 * MODÈLE D'EXÉCUTION — assumé, documenté, à réexaminer :
 *   · séquentiel, en process, une étape après l'autre ;
 *   · chaque étape est sa propre transaction, tenue par l'organe qu'elle appelle ;
 *   · l'intention n'est PAS une transaction — c'est précisément pourquoi elle a des
 *     compensations ;
 *   · un crash entre deux étapes laisse un plan à moitié fait, visible dans
 *     `journal.findIncomplete()` et reprenable à la main.
 */

const { idempotency } = require('../kernel');
const db = require('../../db');
const registry = require('./intentRegistry');
const organs = require('./organs');
const capabilities = require('./capabilities');
const journal = require('./journal');

const { RUN_STATUS } = journal;
const IDEMPOTENCY_SCOPE = 'orchestration.intent';

class IntentError extends Error {
  constructor(message, status = 400, details = null) {
    super(message);
    this.name = 'IntentError';
    this.status = status;
    if (details) this.details = details;
  }
}

/**
 * Exécute une intention.
 *
 * @param {string} intentId
 * @param {object} params            paramètres déclarés par l'intention
 * @param {object} context
 * @param {string} context.actor     identifiant de l'auteur
 * @param {string} context.actorRole rôle de l'auteur, confronté à `actors`
 * @param {object} [context.io]      passé aux organes qui diffusent
 * @param {string} [context.idempotencyKey]
 * @returns {{ runId: string, intent: string, results: object, report: object[], replayed: boolean }}
 */
function run(intentId, params = {}, context = {}) {
  const intent = registry.get(intentId);
  if (!intent) throw new IntentError(`Intention inconnue « ${intentId} ».`, 404);

  const { actor = null, actorRole = null, io = null, idempotencyKey = null } = context;

  if (!actorRole || !intent.actors.includes(actorRole)) {
    // 403 et non 400 : la demande est valide, c'est le demandeur qui ne l'est pas.
    throw new IntentError(
      `Le rôle « ${actorRole || 'inconnu'} » ne peut pas formuler l'intention « ${intentId} ».`,
      403
    );
  }

  registry.validateParams(intent, params);

  const { result, replayed } = idempotency.once(
    `${IDEMPOTENCY_SCOPE}.${intentId}`,
    idempotencyKey,
    { payload: params, actor },
    () => execute(intent, params, { actor, actorRole, io, idempotencyKey })
  );

  if (replayed) {
    // Journalisé pour que le rejeu se VOIE : sinon un client qui réessaie en boucle
    // reste invisible dans l'histoire du système.
    journal.append({
      runId: result.runId,
      intentId,
      status: RUN_STATUS.REPLAYED,
      actor,
      actorRole,
      idempotencyKey,
    });
    return { ...result, replayed: true };
  }

  return { ...result, replayed: false };
}

/** Déroule le plan. Séparé de `run` pour que l'idempotence enveloppe tout. */
function execute(intent, params, { actor, actorRole, io, idempotencyKey }) {
  const runId = db.generateId();
  const steps = intent.plan();

  const ctx = { runId, actor, actorRole, io, results: {}, params };
  /** Étapes réussies, pour compenser en ordre inverse. */
  const done = [];
  /** Ce qui n'a pas pu être fait et que l'utilisateur doit savoir (Loi 12). */
  const report = [];

  journal.append({
    runId,
    intentId: intent.id,
    status: RUN_STATUS.STARTED,
    actor,
    actorRole,
    result: { steps: steps.length },
    idempotencyKey,
  });

  for (const step of steps) {
    const name = `${step.organ}.${step.action}`;

    if (step.requires && !capabilities.has(step.requires, { ...params, actor })) {
      // Reportée, pas échouée. Une vente ne doit pas être refusée parce que le
      // logiciel de caisse du commerçant n'est pas branché.
      const reason = capabilities.explainMissing(step.requires);
      report.push({ step: name, skipped: true, capability: step.requires, message: reason });
      journal.append({
        runId,
        intentId: intent.id,
        step: name,
        status: RUN_STATUS.STEP_SKIPPED,
        actor,
        actorRole,
        result: { capability: step.requires },
      });
      continue;
    }

    try {
      const result = organs.operation(step.organ, step.action)(params, ctx);
      ctx.results[name] = result;
      done.push(step);
      journal.append({
        runId,
        intentId: intent.id,
        step: name,
        status: RUN_STATUS.STEP_DONE,
        actor,
        actorRole,
        result,
      });
    } catch (err) {
      journal.append({
        runId,
        intentId: intent.id,
        step: name,
        status: RUN_STATUS.STEP_FAILED,
        actor,
        actorRole,
        error: err.message,
      });

      // Une étape optionnelle qui casse ne fait pas tomber l'intention : elle est
      // reportée, comme une capacité manquante. C'est la même promesse vue de l'autre
      // côté — l'essentiel aboutit, l'accessoire se dit.
      if (step.optional) {
        report.push({ step: name, failed: true, message: err.message });
        continue;
      }

      const undone = compensate(intent, done, ctx, { actor, actorRole });
      journal.append({
        runId,
        intentId: intent.id,
        status: RUN_STATUS.FAILED,
        actor,
        actorRole,
        error: err.message,
      });

      // L'erreur de l'organe est propagée telle quelle : son code HTTP et son message
      // sont plus justes que tout ce que l'orchestrateur pourrait réécrire.
      err.runId = runId;
      err.report = report;
      // Ce qui a été défait, nommé. Une surface publique doit pouvoir distinguer
      // « votre demande a été refusée, rien n'a eu lieu » de « nous avions commencé,
      // puis tout a été défait » : ce n'est pas la même phrase à dire au commerçant, et
      // ce n'est pas le même code HTTP. Le journal le savait déjà, l'appelant non.
      err.compensated = undone;
      throw err;
    }
  }

  journal.append({
    runId,
    intentId: intent.id,
    status: RUN_STATUS.COMPLETED,
    actor,
    actorRole,
    result: { steps: done.length, skipped: report.length },
    idempotencyKey,
  });

  return { runId, intent: intent.id, results: ctx.results, report };
}

/**
 * Défait les étapes réussies, de la dernière à la première.
 *
 * Une compensation qui échoue n'interrompt PAS les suivantes : abandonner à la
 * première résistance laisserait encore plus d'états à demi défaits. Chaque échec est
 * journalisé, et c'est cette trace qui permet la reprise humaine.
 *
 * Renvoie ce qui a été défait, et ce qui a résisté. Une compensation échouée est la
 * seule situation où Ma Zone laisse derrière elle un état qu'elle sait faux : elle doit
 * donc remonter jusqu'à la surface, pas seulement jusqu'au journal.
 */
function compensate(intent, done, ctx, { actor, actorRole }) {
  const undone = [];

  for (const step of [...done].reverse()) {
    if (!step.compensate) continue;
    const name = `${step.organ}.${step.compensate}`;

    try {
      const result = organs.operation(step.organ, step.compensate)(ctx.params, ctx);
      journal.append({
        runId: ctx.runId,
        intentId: intent.id,
        step: name,
        status: RUN_STATUS.COMPENSATED,
        actor,
        actorRole,
        result,
      });
      undone.push({ step: name, ok: true });
    } catch (err) {
      journal.append({
        runId: ctx.runId,
        intentId: intent.id,
        step: name,
        status: RUN_STATUS.COMPENSATION_FAILED,
        actor,
        actorRole,
        error: err.message,
      });
      undone.push({ step: name, ok: false, message: err.message });
    }
  }

  return undone;
}

/** Histoire d'une exécution. */
function history(runId) {
  return journal.read(runId);
}

/** Exécutions restées en plan, à reprendre à la main. */
function incomplete(options) {
  return journal.findIncomplete(options);
}

module.exports = { run, history, incomplete, IntentError, RUN_STATUS };
