/**
 * Orchestration — registre des intentions métier.
 *
 * Écrit sur le modèle exact de `eventRegistry.registerType` et
 * `walletRegistry.defineKind` : un point d'extension unique, validé au boot, que le
 * moteur lit sans jamais contenir de `if (intent === ...)`.
 *
 * Une intention déclare QUI peut la formuler, AVEC QUOI, et QUELS effets elle
 * produit. Le plan est une LISTE, pas un algorithme : c'est ce qui permet de
 * répondre à « que se passe-t-il quand je vends » en lisant un seul écran.
 *
 * Tout est vérifié au chargement, jamais à l'exécution. Une intention mal déclarée
 * doit empêcher le serveur de démarrer, pas échouer devant un commerçant.
 *
 * LOI 16 — UNE INTENTION EST MÉTIER, JAMAIS TECHNIQUE NI EXTERNE.
 *
 * Ce qu'une intention exprime : « une vente a lieu », « une boutique ferme
 * exceptionnellement ». Ce qu'elle n'exprime jamais : « appeler tel logiciel », « pousser
 * tel format », « rafraîchir tel jeton ». Une étape de plan qui sort de Ma Zone se nomme
 * en vocabulaire métier canonique (`integration.pushSale`) et se conditionne à une
 * capacité abstraite (`requires: 'push_sales'`) — jamais à un logiciel nommé.
 *
 * Concrètement, sont à refuser en revue de code, dans `intents/` :
 *   · un identifiant de logiciel tiers dans un paramètre d'intention ;
 *   · une étape dont l'existence ou l'ordre est dicté par un protocole externe ;
 *   · une étape nommée d'après un éditeur plutôt que d'après un acte métier.
 *
 * Un plan doit rester lisible et vrai même si le commerçant n'utilise aucun autre
 * logiciel que Ma Zone. C'est la condition de la substitution progressive : le jour où
 * un plan porte une contrainte d'éditeur, remplacer ce logiciel n'est plus un
 * débranchement de connecteur mais une réécriture du cœur.
 */

const organs = require('./organs');
const capabilities = require('./capabilities');

const INTENT_ID = /^[a-z][a-z_]*\.[a-z][a-z_]*$/;
const KNOWN_ACTORS = ['client', 'merchant', 'driver', 'admin', 'system'];
const PARAM_TYPES = ['string', 'number', 'integer', 'boolean', 'object'];

const INTENTS = {};

class IntentDeclarationError extends Error {
  constructor(message) {
    super(`[Orchestration] ${message}`);
    this.name = 'IntentDeclarationError';
  }
}

/**
 * Déclare une intention.
 *
 * @param {object} def
 * @param {string} def.id                 `<domaine>.<verbe>`
 * @param {string} def.label              phrase lisible par un commerçant
 * @param {string[]} def.actors           rôles autorisés à formuler l'intention
 * @param {Record<string,string>} def.params  `{ orderId: 'string', reason: 'string?' }`
 * @param {() => object[]} def.plan       fonction renvoyant la liste des étapes
 */
function defineIntent(def) {
  const intent = normalize(def);
  if (INTENTS[intent.id]) {
    throw new IntentDeclarationError(`intention déjà déclarée : ${intent.id}`);
  }
  validate(intent);
  INTENTS[intent.id] = intent;
  return intent;
}

function normalize(def) {
  if (!def || !def.id) throw new IntentDeclarationError('`id` est requis');
  return {
    id: def.id,
    label: def.label || def.id,
    actors: def.actors || [],
    params: def.params || {},
    // Le plan est une FONCTION pour être évalué au boot ET relisible à chaud, sans
    // que sa déclaration ait à connaître l'ordre de chargement des adaptateurs.
    plan: typeof def.plan === 'function' ? def.plan : () => (def.plan || []),
  };
}

function validate(intent) {
  if (!INTENT_ID.test(intent.id)) {
    throw new IntentDeclarationError(
      `identifiant invalide « ${intent.id} » — attendu <domaine>.<verbe>, par exemple order.place`
    );
  }

  if (!intent.actors.length) {
    throw new IntentDeclarationError(`${intent.id} : au moins un acteur autorisé est requis`);
  }
  for (const actor of intent.actors) {
    if (!KNOWN_ACTORS.includes(actor)) {
      throw new IntentDeclarationError(
        `${intent.id} : acteur inconnu « ${actor} » — connus : ${KNOWN_ACTORS.join(', ')}`
      );
    }
  }

  for (const [name, spec] of Object.entries(intent.params)) {
    const type = String(spec).replace(/\?$/, '');
    if (!PARAM_TYPES.includes(type)) {
      throw new IntentDeclarationError(
        `${intent.id} : type de paramètre inconnu « ${spec} » pour « ${name} »`
      );
    }
  }

  const steps = intent.plan();
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new IntentDeclarationError(`${intent.id} : le plan doit contenir au moins une étape`);
  }

  const seen = new Set();
  for (const step of steps) {
    if (!step?.organ || !step?.action) {
      throw new IntentDeclarationError(`${intent.id} : chaque étape doit nommer un organe et une action`);
    }
    if (!organs.hasOrgan(step.organ)) {
      throw new IntentDeclarationError(
        `${intent.id} : organe inconnu « ${step.organ} » — connus : ${organs.ORGAN_NAMES.join(', ')}`
      );
    }
    if (!organs.hasOperation(step.organ, step.action)) {
      throw new IntentDeclarationError(
        `${intent.id} : l'organe « ${step.organ} » n'expose pas d'opération « ${step.action} »`
      );
    }
    if (step.compensate && !organs.hasOperation(step.organ, step.compensate)) {
      throw new IntentDeclarationError(
        `${intent.id} : compensation « ${step.organ}.${step.compensate} » inexistante`
      );
    }
    if (step.requires) capabilities.assertKnown(step.requires);
    if (step.requires && !step.optional) {
      // Une étape qui exige une capacité absente et n'est pas optionnelle rendrait
      // l'intention impossible pour tout commerçant sans connecteur. C'est
      // exactement le piège d'une plateforme qui suppose l'intégration acquise.
      throw new IntentDeclarationError(
        `${intent.id} : l'étape « ${step.organ}.${step.action} » exige la capacité `
        + `« ${step.requires} » sans être optionnelle`
      );
    }

    const key = `${step.organ}.${step.action}`;
    if (seen.has(key)) {
      throw new IntentDeclarationError(`${intent.id} : étape « ${key} » déclarée deux fois`);
    }
    seen.add(key);
  }

  // LOI 5 : l'orchestration n'est PAS un passage obligé. Une action qui ne concerne
  // qu'un organe s'adresse à cet organe directement. Sans cette barrière, tout finit
  // par transiter par l'orchestrateur, qui devient le fourre-tout du métier.
  const involved = new Set(steps.filter((s) => !s.optional).map((s) => s.organ));
  if (involved.size < 2) {
    throw new IntentDeclarationError(
      `${intent.id} : intention mono-organe (${[...involved].join(', ')}). `
      + 'Une action qui ne traverse pas plusieurs organes s\'adresse à l\'organe directement (Loi 5).'
    );
  }
}

// ── Lecture ───────────────────────────────────────────────────────────────────

function get(id) {
  return INTENTS[id] || null;
}

function has(id) {
  return Object.prototype.hasOwnProperty.call(INTENTS, id);
}

function ids() {
  return Object.keys(INTENTS);
}

/** Intentions ouvertes à un rôle. Alimente les surfaces et l'API v1. */
function forActor(role) {
  return Object.values(INTENTS)
    .filter((intent) => intent.actors.includes(role))
    .map(({ plan, ...meta }) => meta);
}

/**
 * Plan lisible d'une intention, sans exécution.
 *
 * C'est le critère de validation de l'étape 5 : lire ceci doit suffire à comprendre
 * tous les effets d'une intention.
 */
function describe(id) {
  const intent = get(id);
  if (!intent) return null;
  return {
    id: intent.id,
    label: intent.label,
    actors: intent.actors,
    params: intent.params,
    steps: intent.plan().map((step) => ({
      step: `${step.organ}.${step.action}`,
      compensate: step.compensate ? `${step.organ}.${step.compensate}` : null,
      optional: !!step.optional,
      requires: step.requires || null,
    })),
  };
}

/** Vérifie les paramètres reçus contre la déclaration. Fail-fast, 400. */
function validateParams(intent, params = {}) {
  const missing = [];
  const wrong = [];

  for (const [name, spec] of Object.entries(intent.params)) {
    const optional = String(spec).endsWith('?');
    const type = String(spec).replace(/\?$/, '');
    const value = params[name];

    if (value === undefined || value === null) {
      if (!optional) missing.push(name);
      continue;
    }
    if (!matchesType(value, type)) wrong.push(`${name} attendu ${type}`);
  }

  if (missing.length || wrong.length) {
    const details = [
      missing.length ? `paramètres manquants : ${missing.join(', ')}` : null,
      wrong.length ? wrong.join(', ') : null,
    ].filter(Boolean).join(' ; ');
    const err = new Error(`Intention « ${intent.id} » mal formée — ${details}.`);
    err.status = 400;
    throw err;
  }
}

function matchesType(value, type) {
  if (type === 'string') return typeof value === 'string';
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'object') return typeof value === 'object';
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'integer') return Number.isInteger(value);
  return false;
}

/** Remise à zéro — tests de déclaration uniquement. */
function reset() {
  for (const id of Object.keys(INTENTS)) delete INTENTS[id];
}

module.exports = {
  defineIntent,
  get,
  has,
  ids,
  forActor,
  describe,
  validateParams,
  reset,
  KNOWN_ACTORS,
  IntentDeclarationError,
};
