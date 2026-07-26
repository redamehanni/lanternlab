/**
 * Integration Engine — l'autorisation déléguée, pour toute la famille.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE FICHIER EST ÉCRIT POUR LE DEUXIÈME CONNECTEUR, PAS POUR LE PREMIER
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Le premier éditeur branché sur Ma Zone parle OAuth 2.0 « authorization code ». Le
 * deuxième aussi. Le troisième également, à trois détails près : le nom d'un paramètre,
 * la présence d'un domaine de boutique dans l'URL, une signature sur la redirection.
 *
 * Ces trois détails sont EXACTEMENT ce qui décide si Ma Zone aura une famille de
 * connecteurs ou une collection de cas particuliers. S'ils vivent ici, ce fichier
 * accumulera des `if (connector === ...)` et le quatrième connecteur coûtera autant que
 * le premier. S'ils vivent dans le connecteur, ce fichier ne changera plus jamais.
 *
 * Le partage retenu :
 *
 *   CE MOTEUR POSSÈDE       ce qui est dangereux et invariant : le jeton anti-rejeu à
 *                           usage unique, l'URL de redirection, le stockage chiffré, la
 *                           décision de brancher, le nettoyage en cas d'échec.
 *
 *   LE CONNECTEUR POSSÈDE   ce qui est propre à son éditeur : la forme de l'URL
 *                           d'autorisation, la requête d'échange, la lecture de la
 *                           réponse, et la vérification éventuelle de la redirection.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TROIS REFUS AVANT DE COMMENCER, ET ILS SONT DANS CET ORDRE EXPRÈS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. PAS DE COFFRE, PAS DE FLUX. Obtenir un jeton pour découvrir ensuite qu'on ne sait pas
 *    où le ranger est le pire enchaînement possible : le commerçant a donné son
 *    consentement chez son éditeur, Ma Zone a un secret en mémoire, et rien pour le garder.
 * 2. PAS D'IDENTIFIANTS D'APPLICATION, PAS DE FLUX. Sans eux la redirection ramènerait une
 *    erreur de l'éditeur, incompréhensible pour le commerçant.
 * 3. PAS D'ADRESSE PUBLIQUE, PAS DE FLUX. Une URL de redirection déduite d'un en-tête de
 *    requête est une URL que l'appelant choisit — donc un vol de jeton par redirection.
 *
 * LOI 16 — aucun éditeur n'est nommé dans ce fichier, et les variables d'environnement
 * qu'il lit sont dérivées de l'identifiant du connecteur, jamais écrites en dur.
 */

const crypto = require('crypto');
const db = require('../../db');
const config = require('../../config/env');
const logger = require('../logger');
const http = require('./http');
const secrets = require('./secrets');
const { IntegrationError } = require('./errors');

/**
 * Durée de vie d'un jeton d'état.
 *
 * Dix minutes : le temps qu'un commerçant lise l'écran de consentement de son éditeur,
 * hésite, et valide. Beaucoup plus long ouvrirait une fenêtre de rejeu inutile ; beaucoup
 * plus court ferait échouer un flux légitime parce que quelqu'un a répondu au téléphone.
 */
const STATE_TTL_SECONDS = 600;

db.exec(`
  CREATE TABLE IF NOT EXISTS integration_oauth_states (
    state TEXT PRIMARY KEY,
    connector_id TEXT NOT NULL,
    store_id TEXT NOT NULL,
    actor TEXT,
    -- Paramètres saisis par le commerçant avant le départ (identifiant de boutique chez
    -- l'éditeur, par exemple). Non secrets : ils reviendront de toute façon dans l'URL.
    params TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    consumed_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_oauth_states_store
    ON integration_oauth_states(store_id, connector_id);
`);

/**
 * Identifiants de l'APPLICATION Ma Zone chez l'éditeur.
 *
 * Ils ne sont ni par boutique ni secrets d'un commerçant : c'est Ma Zone qui s'enregistre
 * une fois chez chaque éditeur. Ils vivent donc dans l'environnement du serveur, et pas
 * dans le coffre — qui, lui, garde les procurations des commerçants.
 *
 * Le nom des variables est DÉRIVÉ de l'identifiant du connecteur (`INTEGRATION_X_CLIENT_ID`)
 * et non écrit en dur : c'est ce qui permet d'ajouter un éditeur sans toucher ce fichier.
 */
function appCredentials(connector) {
  const prefix = `INTEGRATION_${connector.id.toUpperCase()}`;
  const names = connector.oauth?.appCredentials || ['client_id', 'client_secret'];

  const app = {};
  const missing = [];
  for (const name of names) {
    const variable = `${prefix}_${name.toUpperCase()}`;
    const value = process.env[variable];
    if (!value) missing.push(variable);
    app[name] = value || null;
  }

  if (missing.length) {
    throw new IntegrationError(
      `L'application Ma Zone n'est pas déclarée chez « ${connector.label} » sur cette `
      + `instance : ${missing.join(', ')} manquent.`,
      503
    );
  }

  return app;
}

/** URL de redirection, construite par le moteur et par personne d'autre. */
function redirectUri(connectorId) {
  if (!config.publicBaseUrl) {
    throw new IntegrationError(
      'PUBLIC_BASE_URL n\'est pas configurée : Ma Zone ne peut pas dire à un logiciel tiers '
      + 'où le commerçant doit revenir après avoir donné son accord.',
      503
    );
  }
  return `${config.publicBaseUrl}/api/integration/oauth/${connectorId}/callback`;
}

/**
 * Ouvre un flux d'autorisation.
 *
 * @returns {{ authorizeUrl: string, state: string, expiresAt: string }}
 */
function begin({ connector, storeId, actor = null, params = {} }) {
  const descriptor = connector.oauth;
  if (!descriptor) {
    throw new IntegrationError(
      `« ${connector.label} » ne se connecte pas par autorisation déléguée.`,
      400
    );
  }

  // Ordre volontaire : voir l'en-tête de ce fichier.
  secrets.assertUsable();
  const app = appCredentials(connector);
  const uri = redirectUri(connector.id);
  const cleanParams = validateParams(connector, descriptor, params);

  const state = crypto.randomBytes(32).toString('base64url');
  db.prepare(`
    INSERT INTO integration_oauth_states (state, connector_id, store_id, actor, params, expires_at)
    VALUES (?, ?, ?, ?, ?, datetime('now', ?))
  `).run(
    state, connector.id, storeId, actor,
    JSON.stringify(cleanParams), `+${STATE_TTL_SECONDS} seconds`
  );

  const authorizeUrl = descriptor.authorizeUrl({
    app, params: cleanParams, redirectUri: uri, state, scopes: descriptor.scopes || [],
  });

  if (typeof authorizeUrl !== 'string' || !authorizeUrl.startsWith('https://')) {
    // Un flux d'autorisation en clair expose le code d'échange sur le réseau. Refuser est
    // le seul comportement acceptable, y compris si l'éditeur le propose.
    throw new IntegrationError(
      `« ${connector.label} » a produit une URL d'autorisation qui n'est pas en HTTPS.`,
      500
    );
  }

  logger.info('Flux d\'autorisation ouvert', { connectorId: connector.id, storeId });
  return { authorizeUrl, state, expiresAt: `+${STATE_TTL_SECONDS}s` };
}

/**
 * Vérifie ce que le commerçant a saisi avant de partir.
 *
 * Le motif est déclaré par le connecteur, et il ne sert pas qu'à l'ergonomie : un
 * identifiant de boutique non contrôlé est injecté dans une URL sortante. Sans motif, un
 * connecteur pourrait être amené à contacter un hôte choisi par l'appelant.
 */
function validateParams(connector, descriptor, provided) {
  const clean = {};

  for (const param of descriptor.params || []) {
    const raw = provided?.[param.name];
    const value = raw === undefined || raw === null ? '' : String(raw).trim();

    if (!value) {
      if (param.required === false) continue;
      throw new IntegrationError(
        `« ${param.label} » est nécessaire pour connecter ${connector.label}.`,
        400
      );
    }
    if (param.pattern && !new RegExp(param.pattern).test(value)) {
      throw new IntegrationError(
        `« ${param.label} » n'a pas la forme attendue par ${connector.label}.`,
        400
      );
    }
    clean[param.name] = value;
  }

  return clean;
}

/**
 * Consomme un jeton d'état.
 *
 * USAGE UNIQUE PAR UNE ÉCRITURE CONDITIONNELLE, pas par une lecture suivie d'une écriture.
 * Un `SELECT` puis un `UPDATE` laisse une fenêtre où deux redirections jumelles passent
 * toutes les deux — et deux échanges de code produisent deux jeux de jetons, dont un
 * orphelin que personne ne révoquera.
 */
function consumeState(connectorId, state) {
  if (!state) throw new IntegrationError('Redirection sans jeton d\'état.', 400);

  const info = db.prepare(`
    UPDATE integration_oauth_states SET consumed_at = datetime('now')
    WHERE state = ? AND connector_id = ? AND consumed_at IS NULL
      AND datetime(expires_at) >= datetime('now')
  `).run(state, connectorId);

  if (info.changes === 0) {
    throw new IntegrationError(
      'Cette autorisation a expiré ou a déjà été utilisée. Relancez la connexion depuis '
      + 'Ma Zone.',
      409
    );
  }

  const row = db.prepare('SELECT * FROM integration_oauth_states WHERE state = ?').get(state);
  return { ...row, params: parseJson(row.params) };
}

/**
 * Termine un flux : échange le code, range les secrets, branche le connecteur.
 *
 * @param {object} params
 * @param {object} params.connector
 * @param {object} params.query   paramètres de la redirection, tels que reçus
 * @param {Function} params.install fonction de branchement (injectée pour éviter un cycle)
 */
async function complete({ connector, query = {}, install }) {
  const descriptor = connector.oauth;
  if (!descriptor) {
    throw new IntegrationError(`« ${connector.label} » n'attend pas de redirection.`, 400);
  }

  const app = appCredentials(connector);

  // L'éditeur signale parfois son propre refus dans la redirection. Le dire au commerçant
  // vaut mieux que de tenter un échange qui échouera avec un message technique.
  if (query.error) {
    throw new IntegrationError(
      `${connector.label} a refusé la connexion : ${query.error_description || query.error}.`,
      400
    );
  }

  const pending = consumeState(connector.id, query.state);

  // Vérification propre à l'éditeur, quand il en propose une. Placée APRÈS la consommation
  // du jeton d'état : une redirection rejouée ne doit pas pouvoir être vérifiée à
  // répétition, même si sa signature est valide.
  if (typeof descriptor.verifyCallback === 'function') {
    const verdict = descriptor.verifyCallback({ query, app, params: pending.params });
    if (verdict !== true) {
      throw new IntegrationError(
        `L'origine de la redirection de ${connector.label} n'est pas prouvée.`,
        401
      );
    }
  }

  if (!query.code) throw new IntegrationError('Redirection sans code d\'autorisation.', 400);

  const spec = descriptor.tokenRequest({
    app, code: query.code, params: pending.params, query,
    redirectUri: redirectUri(connector.id),
  });

  const response = await http.transport().request({
    method: spec.method || 'POST',
    url: spec.url,
    headers: spec.headers || {},
    body: spec.body ?? null,
    // Un échange de code n'est PAS idempotent : la plupart des éditeurs invalident le code
    // à la première utilisation. Un réessai automatique transformerait une réponse perdue
    // en « code déjà consommé », message que personne ne saurait interpréter.
    idempotent: false,
  });

  const parsed = descriptor.parseToken(response.body, { params: pending.params, query });
  const stored = parsed?.secrets || {};

  if (!Object.keys(stored).length) {
    throw new IntegrationError(
      `${connector.label} n'a renvoyé aucun identifiant exploitable.`,
      502
    );
  }

  for (const name of connector.secrets || []) {
    if (!stored[name]) {
      throw new IntegrationError(
        `${connector.label} n'a pas fourni « ${name} », que son connecteur déclare exiger.`,
        502
      );
    }
  }

  for (const [name, value] of Object.entries(stored)) {
    secrets.put({
      storeId: pending.store_id,
      connectorId: connector.id,
      name,
      value,
      expiresAt: parsed.expiresAt ?? null,
    });
  }

  try {
    const installation = install({
      storeId: pending.store_id,
      connectorId: connector.id,
      // Réglages NON SECRETS, décidés par le connecteur : identifiant de boutique chez
      // l'éditeur, magasin par défaut, portées obtenues.
      config: { ...pending.params, ...(parsed.config || {}) },
      actor: pending.actor,
    });

    logger.info('Logiciel connecté', {
      connectorId: connector.id, storeId: pending.store_id,
    });

    return { installation, storeId: pending.store_id, scopes: parsed.scopes || null };
  } catch (err) {
    // Branchement refusé : le jeton obtenu ne doit pas rester en base. Un secret sans
    // installation est une procuration que personne ne surveille et que rien n'utilise.
    secrets.forget({ storeId: pending.store_id, connectorId: connector.id });
    throw err;
  }
}

/**
 * Rafraîchit un jeton expirable.
 *
 * Optionnel : beaucoup d'éditeurs délivrent des jetons sans échéance, et prétendre les
 * rafraîchir créerait un chemin de code jamais exercé. Un connecteur qui en a besoin
 * décrit `refreshRequest`, les autres n'ont rien à faire.
 */
async function refresh({ connector, storeId }) {
  const descriptor = connector.oauth;
  if (typeof descriptor?.refreshRequest !== 'function') {
    return { refreshed: false, reason: 'ce logiciel ne délivre pas de jeton renouvelable' };
  }

  const app = appCredentials(connector);
  const current = secrets.readAll({ storeId, connectorId: connector.id });

  const spec = descriptor.refreshRequest({ app, secrets: current });
  const response = await http.transport().request({
    method: spec.method || 'POST',
    url: spec.url,
    headers: spec.headers || {},
    body: spec.body ?? null,
    idempotent: false,
  });

  const parsed = descriptor.parseToken(response.body, { refresh: true });
  for (const [name, value] of Object.entries(parsed?.secrets || {})) {
    secrets.put({
      storeId, connectorId: connector.id, name, value, expiresAt: parsed.expiresAt ?? null,
    });
  }

  return { refreshed: true };
}

/** Purge les jetons d'état périmés. Hygiène, appelée par le worker de réconciliation. */
function purgeExpiredStates() {
  const info = db.prepare(`
    DELETE FROM integration_oauth_states
    WHERE datetime(expires_at) < datetime('now', '-1 day')
  `).run();
  return info.changes;
}

function parseJson(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

module.exports = {
  STATE_TTL_SECONDS,
  appCredentials,
  redirectUri,
  begin,
  complete,
  refresh,
  purgeExpiredStates,
};
