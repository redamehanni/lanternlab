/**
 * Integration Engine — le transport sortant, et le seul.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * AUCUN CONNECTEUR N'APPELLE `fetch` LUI-MÊME. C'EST LA RÈGLE DE FAMILLE.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Un connecteur reçoit une fonction `request` dans son contexte, et c'est tout ce qu'il
 * connaît du réseau. Ce n'est pas de la coquetterie d'architecture : quatre problèmes se
 * posent IDENTIQUEMENT chez tous les éditeurs du marché, et chacun est une source
 * d'incident si chaque connecteur le traite à sa façon.
 *
 *   1. LE DÉLAI D'ATTENTE. Un éditeur qui ne répond jamais bloque un worker, donc la file,
 *      donc les ventes de toutes les autres boutiques. Un `fetch` sans `AbortSignal` est
 *      une panne d'une boutique qui devient une panne générale.
 *   2. LES QUOTAS. Tous limitent. Tous répondent 429. Tous envoient `Retry-After`. Un
 *      connecteur qui l'ignore se fait bannir, et c'est le commerçant qui le paie.
 *   3. LA DISTINCTION RÉESSAYABLE / DÉFINITIF. Réessayer un 401 six fois est du bruit ;
 *      ne pas réessayer un 503 est une vente perdue. Cette qualification n'a rien de
 *      propre à un éditeur : c'est de l'HTTP.
 *   4. LA TESTABILITÉ. Un connecteur qui appelle le réseau en dur ne se teste qu'avec le
 *      réseau — donc ne se teste pas en intégration continue, donc n'est pas testé.
 *
 * Le quatrième point mérite d'être insisté : c'est parce que le transport est INJECTABLE
 * que la suite de conformité peut éprouver un connecteur d'éditeur hors ligne, en lui
 * servant des réponses choisies — dont les pannes, qu'on ne sait pas provoquer chez un
 * vrai éditeur au moment où on en a besoin.
 *
 * LOI 16 — ce fichier ne connaît ni éditeur, ni ressource, ni format. Il connaît HTTP.
 */

const logger = require('../logger');
const { IntegrationError } = require('./errors');

const DEFAULT_TIMEOUT_MS = 10_000;
/** Deux réessais immédiats au plus : au-delà, c'est le travail de la file, pas du socket. */
const MAX_IMMEDIATE_RETRIES = 2;
const MAX_IMMEDIATE_WAIT_MS = 2_000;

/**
 * Échec de transport, qualifié.
 *
 * `retryable` est l'information que la file attend : elle décide de reprogrammer ou
 * d'enterrer sur cette seule base. La qualifier ici, une fois, évite que chaque
 * connecteur ait à la deviner — et se trompe différemment.
 */
class TransportError extends IntegrationError {
  constructor(message, { status = null, retryable, retryAfterMs = null, body = null } = {}) {
    super(message, status && status >= 400 && status < 500 ? status : 502);
    this.name = 'TransportError';
    this.httpStatus = status;
    this.retryable = !!retryable;
    this.retryAfterMs = retryAfterMs;
    this.responseBody = body;
  }
}

/**
 * Un état HTTP mérite-t-il un réessai ?
 *
 * 429 et 5xx : oui, l'éditeur dit lui-même « plus tard ». 408 : oui, le délai est le
 * nôtre. Tout le reste des 4xx : non — un jeton révoqué, un champ refusé ou une ressource
 * absente le resteront, et six tentatives ne feront qu'ajouter du bruit au journal du
 * commerçant.
 */
function isRetryableStatus(status) {
  return status === 429 || status === 408 || (status >= 500 && status <= 599);
}

/**
 * Délai demandé par l'éditeur, en millisecondes.
 *
 * `Retry-After` accepte des secondes ou une date HTTP : les deux formes existent dans la
 * nature, et ignorer la seconde ferait réessayer immédiatement au pire moment.
 */
function retryAfterMs(headers) {
  const raw = headers?.get?.('retry-after') ?? headers?.['retry-after'];
  if (!raw) return null;

  const seconds = Number.parseFloat(raw);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const date = Date.parse(raw);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
}

function headersToObject(headers) {
  if (!headers) return {};
  if (typeof headers.entries === 'function') return Object.fromEntries(headers.entries());
  return { ...headers };
}

/**
 * Crée un transport.
 *
 * @param {object} [options]
 * @param {Function} [options.fetchImpl] implémentation de `fetch` (injectée par les tests)
 * @param {number} [options.timeoutMs]
 */
function createTransport({ fetchImpl = null, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  /**
   * Effectue une requête.
   *
   * @param {object} params
   * @param {string} params.url
   * @param {string} [params.method]
   * @param {object} [params.headers]
   * @param {object|string|null} [params.body] objet sérialisé en JSON, ou chaîne brute
   * @param {boolean} [params.idempotent] réessai immédiat autorisé (déduit de la méthode)
   * @returns {Promise<{status: number, headers: object, body: any}>}
   */
  async function request({
    url, method = 'GET', headers = {}, body = null, timeoutMs: perCall = null,
    idempotent = null,
  }) {
    const impl = fetchImpl || globalThis.fetch;
    if (typeof impl !== 'function') {
      throw new IntegrationError(
        'Aucun transport HTTP disponible : ni `fetch` global, ni implémentation injectée.',
        500
      );
    }

    const verb = String(method).toUpperCase();
    // Un réessai immédiat sur une écriture est un risque de doublon : la requête a
    // peut-être abouti et c'est la RÉPONSE qui s'est perdue. On ne réessaie donc de
    // lui-même que ce qui est idempotent par nature, sauf affirmation explicite du
    // connecteur (qui porte alors une clé d'idempotence de l'éditeur).
    const mayRetry = idempotent === null ? verb === 'GET' || verb === 'HEAD' : !!idempotent;

    let attempt = 0;
    for (;;) {
      attempt += 1;
      let response;

      try {
        response = await callOnce(impl, { url, verb, headers, body, timeoutMs: perCall || timeoutMs });
      } catch (err) {
        // Panne de socket, DNS, ou délai dépassé : réessayable par nature, mais seulement
        // si la requête pouvait l'être.
        if (mayRetry && attempt <= MAX_IMMEDIATE_RETRIES) {
          await wait(Math.min(250 * attempt, MAX_IMMEDIATE_WAIT_MS));
          continue;
        }
        throw new TransportError(
          `Le logiciel n'a pas répondu (${err.name === 'AbortError' ? 'délai dépassé' : err.message}).`,
          { retryable: true }
        );
      }

      if (response.status < 400) return response;

      const wait_ = response.retryAfterMs;
      const retryable = isRetryableStatus(response.status);

      if (retryable && mayRetry && attempt <= MAX_IMMEDIATE_RETRIES
        && (wait_ === null || wait_ <= MAX_IMMEDIATE_WAIT_MS)) {
        await wait(wait_ ?? 250 * attempt);
        continue;
      }

      throw new TransportError(
        `Le logiciel a répondu ${response.status}${summarize(response.body)}.`,
        {
          status: response.status,
          retryable,
          retryAfterMs: wait_,
          body: response.body,
        }
      );
    }
  }

  return { request };
}

async function callOnce(impl, { url, verb, headers, body, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const sendJson = body !== null && typeof body === 'object';
  const finalHeaders = sendJson
    ? { 'content-type': 'application/json', ...headers }
    : { ...headers };

  try {
    const raw = await impl(url, {
      method: verb,
      headers: finalHeaders,
      body: body === null ? undefined : (sendJson ? JSON.stringify(body) : String(body)),
      signal: controller.signal,
    });

    const text = typeof raw.text === 'function' ? await raw.text() : '';
    return {
      status: raw.status,
      headers: headersToObject(raw.headers),
      body: parseBody(text),
      retryAfterMs: retryAfterMs(raw.headers),
    };
  } finally {
    clearTimeout(timer);
  }
}

function parseBody(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // Un éditeur en panne renvoie souvent une page HTML : la garder telle quelle rend le
    // diagnostic possible, alors qu'une exception de parsing masquerait le vrai problème.
    return text;
  }
}

/** Résumé borné : un corps d'erreur d'éditeur peut peser des kilo-octets. */
function summarize(body) {
  if (!body) return '';
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return ` — ${text.slice(0, 200)}`;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Transport de l'instance ───────────────────────────────────────────────────

let current = createTransport();

/**
 * Remplace le transport du processus.
 *
 * Prévu pour les tests et pour une exploitation qui voudrait un délai différent. Renvoie
 * le transport précédent afin que l'appelant puisse le restaurer — sans cela, un test qui
 * installe un transport factice contaminerait tous les suivants.
 */
function useTransport(transport) {
  const previous = current;
  current = transport;
  return previous;
}

function transport() {
  return current;
}

/** Remet le transport réel. */
function resetTransport() {
  current = createTransport();
  logger.debug('Transport d\'intégration réinitialisé');
  return current;
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  TransportError,
  createTransport,
  useTransport,
  resetTransport,
  transport,
  isRetryableStatus,
};
