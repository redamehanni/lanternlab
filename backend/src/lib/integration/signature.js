/**
 * Integration Engine — preuve d'origine d'un message entrant.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE CODE N'EST PAS DANS LES CONNECTEURS, ALORS QUE LE SCHÉMA DE
 * SIGNATURE, LUI, EST PROPRE À CHAQUE ÉDITEUR
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Parce que ce sont deux choses différentes, et que les confondre a un coût mesurable.
 *
 * Ce qui VARIE d'un éditeur à l'autre : le nom de l'en-tête, l'algorithme, l'encodage de
 * l'empreinte, et ce qui est signé exactement. Cela reste dans le connecteur, déclaré.
 *
 * Ce qui NE VARIE PAS : comparer deux empreintes sans fuir d'information par le temps de
 * calcul, refuser un corps absent au lieu de signer la chaîne vide, refuser une longueur
 * différente avant de comparer. Ces trois gestes sont de la cryptographie appliquée, et
 * c'est exactement le genre de code que personne ne devrait écrire deux fois.
 *
 * LE DÉTAIL QUI COMPTE LE PLUS ICI : `crypto.timingSafeEqual`. Une comparaison avec `===`
 * s'arrête au premier octet différent. Le temps de réponse trahit alors combien d'octets
 * sont corrects, ce qui permet de reconstruire une signature valide octet par octet. C'est
 * une attaque connue, mesurable sur un réseau local, et le seul moyen de ne pas y être
 * exposé est de comparer en temps constant — donc de ne jamais laisser un connecteur
 * écrire cette ligne lui-même.
 *
 * DEUXIÈME DÉTAIL : ON SIGNE LE CORPS BRUT. Un JSON re-sérialisé n'a pas les mêmes octets
 * que celui reçu — l'ordre des clés, les espaces, l'échappement des caractères non ASCII
 * diffèrent. Vérifier une signature sur `JSON.stringify(req.body)` produit un système qui
 * refuse tous les messages légitimes, ou pire, qui « marche » jusqu'au premier accent.
 *
 * LOI 16 — aucun nom d'éditeur ici, et aucun n'y entrera. Un connecteur décrit son schéma,
 * ce fichier l'applique.
 */

const crypto = require('crypto');
const { IntegrationError } = require('./errors');

/** Algorithmes acceptés. Fermé : un algorithme inconnu serait une vérification illusoire. */
const ALGORITHMS = ['sha256', 'sha512', 'sha1'];
const ENCODINGS = ['base64', 'hex'];

/**
 * Vérifie une empreinte HMAC.
 *
 * @param {object} params
 * @param {Buffer|string} params.payload  corps BRUT tel que reçu
 * @param {string} params.provided        empreinte annoncée par l'éditeur
 * @param {string} params.secret          secret partagé
 * @param {string} [params.algorithm]
 * @param {string} [params.encoding]
 * @returns {boolean}
 */
function verifyHmac({ payload, provided, secret, algorithm = 'sha256', encoding = 'base64' }) {
  assertScheme(algorithm, encoding);

  // Refus AVANT tout calcul. Une empreinte absente n'est pas une empreinte invalide : c'est
  // un message qui n'a pas essayé de prouver son origine, et le distinguer évite de
  // conclure « signature fausse » sur un connecteur mal configuré.
  if (!provided || !secret) return false;
  if (payload === null || payload === undefined) return false;

  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), 'utf8');
  if (body.length === 0) return false;

  const expected = crypto.createHmac(algorithm, secret).update(body).digest();
  let candidate;
  try {
    candidate = Buffer.from(String(provided).trim(), encoding);
  } catch {
    return false;
  }

  // `timingSafeEqual` LÈVE si les longueurs diffèrent : la comparaison de longueur doit
  // donc précéder, et elle ne fuit rien d'utile (la longueur d'une empreinte est publique,
  // elle découle de l'algorithme).
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

/**
 * Empreinte HMAC d'une charge. Utile aux connecteurs qui doivent SIGNER ce qu'ils envoient.
 *
 * Même fonction, même contrôle de schéma : un éditeur qui exige une signature sortante
 * l'exige toujours dans un des formats ci-dessus.
 */
function sign({ payload, secret, algorithm = 'sha256', encoding = 'base64' }) {
  assertScheme(algorithm, encoding);
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload ?? ''), 'utf8');
  return crypto.createHmac(algorithm, secret).update(body).digest(encoding);
}

/**
 * Lit un en-tête sans se soucier de la casse.
 *
 * Node normalise en minuscules, mais un connecteur testé avec un objet littéral écrit
 * l'en-tête comme la documentation de l'éditeur l'affiche — souvent en casse mixte. Une
 * vérification qui échoue pour cette seule raison est un piège coûteux à diagnostiquer.
 */
function header(headers, name) {
  if (!headers || !name) return null;
  const wanted = String(name).toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() === wanted) return Array.isArray(value) ? value[0] : value;
  }
  return null;
}

function assertScheme(algorithm, encoding) {
  if (!ALGORITHMS.includes(algorithm)) {
    throw new IntegrationError(
      `Algorithme de signature inconnu « ${algorithm} » — connus : ${ALGORITHMS.join(', ')}.`,
      500
    );
  }
  if (!ENCODINGS.includes(encoding)) {
    throw new IntegrationError(
      `Encodage de signature inconnu « ${encoding} » — connus : ${ENCODINGS.join(', ')}.`,
      500
    );
  }
}

module.exports = { ALGORITHMS, ENCODINGS, verifyHmac, sign, header };
