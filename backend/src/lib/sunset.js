/**
 * Ce qui est promis à disparaître, et à quelle date.
 *
 * Étape 7 de ROADMAP_ORGANE_ORCHESTRATION_MAZONE.md. L'audit critique de la roadmap
 * pose deux fois le même reproche à ce chantier :
 *
 *   « Deux API en parallèle pendant plusieurs mois » → date de fin de vie inscrite
 *     DANS LE CODE, plus un compteur d'usage par route pour savoir quand couper.
 *   « La projection `products.quantity` : temporaire a une fâcheuse tendance à durer
 *     trois ans » → il faut une date de suppression inscrite à l'étape 7.
 *
 * D'où ce fichier. Il ne fait rien fonctionnellement — et c'est bien la difficulté :
 * une intention de suppression qui n'a aucun effet observable ne survit pas à six mois
 * de travail sur autre chose. Trois mécanismes la rendent inévitable :
 *
 *   1. Les réponses de `/api` portent les en-têtes `Deprecation` et `Sunset` (RFC 8594).
 *      Un intégrateur peut le voir sans lire notre code.
 *   2. Un compteur d'usage par route legacy répond à la seule question qui permette de
 *      couper sans casser : « qui appelle encore ça ? ».
 *   3. Un test échoue quand la date est dépassée. Pas un avertissement dans un log que
 *      personne ne lit : un échec de CI, avec le message qui dit quoi décider.
 *
 * Le point 3 est volontairement inconfortable. Une date qui ne fait rien quand elle
 * arrive n'est pas une date, c'est un souhait.
 */

/**
 * Les échéances. Format ISO, en UTC, sans heure : ce sont des jours de décision, pas
 * des instants d'exécution.
 *
 * POURQUOI CES DATES. `/api` meurt six mois après l'ouverture de `/api/v1` : c'est le
 * temps d'une bascule mobile écran par écran, avec les délais de validation des stores
 * d'applications, qui ne dépendent pas de nous. `products.quantity` meurt trois mois
 * plus tard, jamais avant : le champ est lu par sept écrans client et deux écrans
 * commerçant, et le supprimer avant que la dernière version de l'application les ait
 * quittés ferait afficher « 0 en stock » à des clients devant des produits disponibles.
 * L'ordre entre les deux dates est donc une contrainte, pas une préférence.
 */
const DEADLINES = {
  legacyApi: {
    id: 'legacy_api',
    what: 'Les routes /api non versionnées',
    date: '2027-01-31',
    replacement: '/api/v1',
    decision:
      'Couper /api, ou repousser la date en sachant ce que ça coûte. Avant de couper : '
      + 'vérifier GET /api/admin/api-usage — une route encore appelée est une application '
      + 'installée chez quelqu\'un.',
  },
  productsQuantity: {
    id: 'products_quantity',
    what: 'La projection products.quantity (double écriture de available)',
    date: '2027-04-30',
    replacement: 'available, exposé par /api/v1/products/:id et /api/v1/inventory/:productId',
    decision:
      'Supprimer la colonne et le seul écrivain (lib/inventory/stockLevels.js → project). '
      + 'Ne le faire qu\'après la mort de /api : les écrans qui lisent quantity passent par lui.',
  },
};

/** Date d'échéance en objet Date, à minuit UTC. */
function deadlineOf(key) {
  const entry = DEADLINES[key];
  if (!entry) throw new Error(`[Sunset] échéance inconnue : ${key}`);
  return new Date(`${entry.date}T00:00:00Z`);
}

/** Jours restants — négatif si la date est passée. */
function daysLeft(key, now = new Date()) {
  return Math.ceil((deadlineOf(key) - now) / 86400000);
}

/** L'échéance est-elle dépassée ? Utilisé par le test qui réveille la décision. */
function isOverdue(key, now = new Date()) {
  return daysLeft(key, now) < 0;
}

/** Toutes les échéances, avec leur compte à rebours. Pour l'administration. */
function schedule(now = new Date()) {
  return Object.entries(DEADLINES).map(([key, entry]) => ({
    ...entry,
    days_left: daysLeft(key, now),
    overdue: isOverdue(key, now),
  }));
}

// ── Compteur d'usage des routes legacy ────────────────────────────────────────

/**
 * Comptage EN MÉMOIRE, et c'est un choix, pas un oubli.
 *
 * Écrire en base à chaque requête ajouterait une écriture SQLite sur le chemin de
 * TOUTES les requêtes, sur une base qui n'accepte qu'un écrivain à la fois (voir
 * `db/index.js`, `busy_timeout`). Payer une contention d'écriture permanente pour un
 * compteur de télémétrie serait un mauvais échange.
 *
 * LIMITE ASSUMÉE : un redémarrage remet les compteurs à zéro. Elle est acceptable
 * parce que la question posée n'est pas « combien d'appels au total depuis le début »
 * mais « cette route est-elle encore appelée aujourd'hui ». Un serveur qui tourne
 * depuis quelques heures répond déjà à celle-là.
 */
const usage = new Map();
let since = new Date().toISOString();

/**
 * La clé est le MOTIF de route (`/api/orders/:id`), jamais l'URL appelée.
 *
 * Compter les URL brutes ferait grandir cette table indéfiniment — un identifiant de
 * commande par ligne — et transformerait un compteur en fuite de mémoire. Le motif
 * n'est connu qu'après le routage, d'où la lecture dans `res.on('finish')`.
 */
function keyOf(req) {
  const pattern = req.route?.path;
  if (!pattern) return `${req.method} ${req.baseUrl || req.path} (non routé)`;
  const base = req.baseUrl || '';
  return `${req.method} ${base}${pattern === '/' ? '' : pattern}`;
}

function note(req, status) {
  const key = keyOf(req);
  const entry = usage.get(key) || { calls: 0, errors: 0, last_seen: null };
  entry.calls += 1;
  if (status >= 400) entry.errors += 1;
  entry.last_seen = new Date().toISOString();
  usage.set(key, entry);
}

/** Les routes legacy encore appelées, les plus utilisées d'abord. */
function legacyUsage() {
  return {
    since,
    routes: [...usage.entries()]
      .map(([route, entry]) => ({ route, ...entry }))
      .sort((a, b) => b.calls - a.calls),
  };
}

/** Remise à zéro — tests, et administration après une décision de coupure. */
function resetUsage() {
  usage.clear();
  since = new Date().toISOString();
}

/**
 * Middleware à monter sur `/api` : marque les réponses legacy et les compte.
 *
 * Ne touche PAS `/api/v1` : la surface versionnée n'est pas dépréciée, elle est la
 * destination. Le test de l'étape 7 vérifie cette asymétrie, faute de quoi l'API neuve
 * s'annoncerait mourante dès sa naissance.
 */
function deprecationMiddleware() {
  const entry = DEADLINES.legacyApi;
  const sunsetHttpDate = deadlineOf('legacyApi').toUTCString();

  return (req, res, next) => {
    if (req.path === '/v1' || req.path.startsWith('/v1/')) return next();

    // `Deprecation` et `Sunset` : RFC 8594 et son brouillon compagnon. Un intégrateur
    // découvre la fin de vie dans la réponse elle-même, sans avoir à lire une page de
    // documentation qu'il n'ira pas chercher.
    res.set('Deprecation', 'true');
    res.set('Sunset', sunsetHttpDate);
    res.set('Link', `<${entry.replacement}>; rel="successor-version"`);

    res.on('finish', () => note(req, res.statusCode));
    return next();
  };
}

module.exports = {
  DEADLINES,
  deadlineOf,
  daysLeft,
  isOverdue,
  schedule,
  deprecationMiddleware,
  legacyUsage,
  resetUsage,
};
