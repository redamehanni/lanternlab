/**
 * Integration Engine — le coffre à secrets d'éditeur.
 *
 * L'étape 6 refusait net de brancher un connecteur exigeant des identifiants, avec une
 * phrase précise : « l'étape 8 devra d'abord répondre à *où vivent les secrets* ». Ce
 * fichier est cette réponse, et il la donne pour la FAMILLE des connecteurs, pas pour
 * l'éditeur qui a rendu la question urgente.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI UN COFFRE, ET PAS UNE COLONNE `access_token`
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Un jeton d'éditeur n'est pas une donnée de configuration. C'est une procuration : il
 * donne à Ma Zone le droit d'agir dans le logiciel d'un commerçant. Les conséquences de
 * cette nature-là dictent tout ce fichier.
 *
 *   · Il ne se relit JAMAIS en clair par une surface. Aucune route, aucun écran, aucun
 *     journal n'a de raison légitime de l'afficher : seul le connecteur qui appelle
 *     l'éditeur en a besoin, au moment de l'appel.
 *   · Il se PURGE au débranchement. Un commerçant qui retire son logiciel retire aussi
 *     notre pouvoir d'agir dedans. Conserver le jeton « au cas où il revienne » serait
 *     garder une clé de chez lui après avoir rendu le trousseau.
 *   · Il se REMPLACE. Les éditeurs révoquent, font expirer, et demandent des
 *     rafraîchissements. Un coffre en écriture seule qui ne saurait pas remplacer une
 *     valeur obligerait à supprimer puis réinsérer — donc à passer par un instant où le
 *     commerçant n'a plus d'intégration.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CE COFFRE NE PRÉTEND PAS ÊTRE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Ce n'est pas un HSM, ni Vault, ni KMS. La clé maîtresse vit dans l'environnement du
 * processus : quelqu'un qui obtient à la fois le fichier de base ET les variables
 * d'environnement lit les jetons. Le chiffrement protège donc contre le scénario RÉEL et
 * fréquent — une sauvegarde SQLite copiée, un fichier `data/` récupéré, un dump partagé
 * pour déboguer — et pas contre une compromission complète du serveur.
 *
 * Le dire est important : un chiffrement présenté comme plus fort qu'il n'est produit des
 * décisions imprudentes ailleurs. Le jour où Ma Zone gère des centaines de boutiques, la
 * clé maîtresse doit passer dans un service dédié, et la seule chose qui devra changer
 * est `masterKey()`.
 *
 * LOI 16 — ce fichier ne nomme aucun éditeur et n'en nommera jamais. Un secret est un
 * secret : sa forme (jeton, clé d'API, mot de passe d'API SOAP) est l'affaire du
 * connecteur, qui déclare seulement les NOMS de ce dont il a besoin.
 */

const crypto = require('crypto');
const db = require('../../db');
const { IntegrationError } = require('./errors');

/**
 * AES-256-GCM et pas AES-256-CBC.
 *
 * GCM authentifie ce qu'il chiffre : un octet modifié en base fait échouer le
 * déchiffrement au lieu de rendre une valeur silencieusement fausse. Sur un jeton
 * d'authentification, la différence entre « erreur bruyante » et « valeur corrompue » est
 * la différence entre un incident diagnostiquable et un connecteur qui se fait
 * mystérieusement refuser par l'éditeur.
 */
const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;

const ENV_KEY = 'INTEGRATION_SECRET_KEY';

db.exec(`
  CREATE TABLE IF NOT EXISTS integration_secrets (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    connector_id TEXT NOT NULL,
    -- Nom canonique du secret, déclaré par le connecteur (« access_token »,
    -- « refresh_token », « api_key »…). Jamais un nom d'éditeur.
    name TEXT NOT NULL,
    -- Valeur chiffrée : iv:tag:ciphertext, en base64url.
    ciphertext TEXT NOT NULL,
    -- Empreinte de la clé maîtresse utilisée. Sans elle, une clé changée produirait un
    -- « unable to authenticate data » incompréhensible ; avec elle, le message dit
    -- exactement ce qui s'est passé et ce qu'il faut faire.
    key_fingerprint TEXT NOT NULL,
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (store_id, connector_id, name)
  );

  CREATE INDEX IF NOT EXISTS idx_integration_secrets_scope
    ON integration_secrets(store_id, connector_id);
`);

let cachedKey = null;
let cachedRaw = null;

/**
 * Clé maîtresse, ou `null` si l'exploitation n'en a pas fourni.
 *
 * `null` n'est PAS une erreur ici : une instance Ma Zone dont aucun commerçant n'a de
 * logiciel à connecter n'a aucune raison de porter une clé de chiffrement. Le refus se
 * produit au moment du branchement d'un connecteur qui en a besoin (`assertUsable`), là
 * où le message peut être utile à quelqu'un.
 */
function masterKey() {
  const raw = process.env[ENV_KEY];
  if (!raw) return null;
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedKey = deriveKey(raw);
  }
  return cachedKey;
}

/**
 * Accepte une clé de 32 octets en base64 / base64url / hexadécimal, et rien d'autre.
 *
 * Le refus d'accepter une phrase de passe arbitraire est délibéré. Dériver une clé d'un
 * « mot de passe » choisi par un humain donnerait l'apparence du chiffrement avec
 * l'entropie d'un mot de passe — c'est-à-dire le pire des deux mondes, puisque personne
 * ne s'inquiète plus après avoir vu « chiffré ».
 */
function deriveKey(raw) {
  const trimmed = String(raw).trim();

  for (const encoding of ['base64url', 'base64', 'hex']) {
    try {
      const buffer = Buffer.from(trimmed, encoding);
      if (buffer.length === KEY_BYTES) return buffer;
    } catch {
      // encodage suivant
    }
  }

  throw new IntegrationError(
    `${ENV_KEY} doit être une clé de ${KEY_BYTES} octets en base64 ou en hexadécimal. `
    + 'Générer : node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
    500
  );
}

/** Empreinte courte de la clé, pour reconnaître une rotation sans exposer la clé. */
function fingerprint(key) {
  return crypto.createHash('sha256').update(key).digest('base64url').slice(0, 12);
}

/** Le coffre est-il utilisable ? Consulté par les surfaces pour expliquer, pas pour agir. */
function available() {
  try {
    return masterKey() !== null;
  } catch {
    // Clé présente mais invalide : le coffre est indisponible, et `assertUsable` dira
    // pourquoi. Répondre `true` ici ferait échouer le branchement plus loin, avec un
    // message moins clair.
    return false;
  }
}

/**
 * Exige un coffre utilisable, avec un message adressé à un exploitant.
 *
 * `503` et non `500` : la configuration est incomplète, l'application est saine. Un
 * exploitant qui lit ce code sait qu'il a une variable à poser, pas un bug à chercher.
 */
function assertUsable() {
  const key = masterKey();
  if (key) return key;

  throw new IntegrationError(
    'Aucun coffre à secrets n\'est configuré sur cette instance : les identifiants d\'un '
    + `logiciel tiers ne peuvent pas être stockés. Posez ${ENV_KEY} `
    + `(${KEY_BYTES} octets en base64) et redémarrez.`,
    503
  );
}

/**
 * Range un secret. Écrase la valeur précédente pour le même nom.
 *
 * @param {object} params
 * @param {string} params.storeId
 * @param {string} params.connectorId
 * @param {string} params.name       nom canonique déclaré par le connecteur
 * @param {string} params.value      valeur en clair, qui ne ressortira que par `read`
 * @param {string|null} [params.expiresAt] échéance connue de l'éditeur, si elle existe
 */
function put({ storeId, connectorId, name, value, expiresAt = null }) {
  const key = assertUsable();
  if (!storeId || !connectorId || !name) {
    throw new IntegrationError('Secret incomplet : boutique, connecteur et nom requis.', 400);
  }
  if (typeof value !== 'string' || value === '') {
    throw new IntegrationError(`Le secret « ${name} » est vide.`, 400);
  }

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const packed = [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString('base64url'))
    .join(':');

  db.prepare(`
    INSERT INTO integration_secrets
      (id, store_id, connector_id, name, ciphertext, key_fingerprint, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(store_id, connector_id, name) DO UPDATE SET
      ciphertext = excluded.ciphertext,
      key_fingerprint = excluded.key_fingerprint,
      expires_at = excluded.expires_at,
      updated_at = datetime('now')
  `).run(db.generateId(), storeId, connectorId, name, packed, fingerprint(key), expiresAt);

  return { name, stored: true };
}

/**
 * Relit un secret en clair, ou `null` s'il n'existe pas.
 *
 * Le seul appelant légitime est le moteur, au moment de fournir un contexte d'appel à un
 * connecteur. Une route qui appellerait cette fonction pour « afficher l'état de la
 * connexion » n'aurait pas besoin de la valeur : `describe()` existe pour cela.
 */
function read({ storeId, connectorId, name }) {
  const key = assertUsable();
  const row = db.prepare(`
    SELECT * FROM integration_secrets
    WHERE store_id = ? AND connector_id = ? AND name = ?
  `).get(storeId, connectorId, name);

  if (!row) return null;

  if (row.key_fingerprint !== fingerprint(key)) {
    throw new IntegrationError(
      `Le secret « ${name} » a été chiffré avec une autre clé maîtresse : il est illisible. `
      + `Restaurez la clé d'origine, ou faites reconnecter son logiciel au commerçant.`,
      503
    );
  }

  const [iv, tag, payload] = row.ciphertext.split(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));

  return Buffer
    .concat([decipher.update(Buffer.from(payload, 'base64url')), decipher.final()])
    .toString('utf8');
}

/**
 * Tous les secrets d'une installation, en clair.
 *
 * Renvoie un objet simple plutôt qu'une classe : c'est ce qu'un connecteur consomme, et
 * il ne doit pas avoir à connaître ce module pour le lire.
 */
function readAll({ storeId, connectorId }) {
  const rows = db.prepare(`
    SELECT name FROM integration_secrets WHERE store_id = ? AND connector_id = ?
  `).all(storeId, connectorId);

  const out = {};
  for (const row of rows) out[row.name] = read({ storeId, connectorId, name: row.name });
  return out;
}

/** Quels secrets existent, quand ils expirent — sans jamais leur valeur. */
function describe({ storeId, connectorId }) {
  return db.prepare(`
    SELECT name, expires_at, updated_at FROM integration_secrets
    WHERE store_id = ? AND connector_id = ?
    ORDER BY name
  `).all(storeId, connectorId);
}

function has({ storeId, connectorId, name }) {
  const row = db.prepare(`
    SELECT 1 AS ok FROM integration_secrets
    WHERE store_id = ? AND connector_id = ? AND name = ?
  `).get(storeId, connectorId, name);
  return !!row;
}

/**
 * Efface tous les secrets d'une installation.
 *
 * Appelé au débranchement définitif. Volontairement séparé de `installations.pause()` :
 * une PAUSE conserve les correspondances et les jetons — le commerçant reprendra —, un
 * OUBLI rend la procuration. Confondre les deux ferait perdre un jeton à chaque
 * suspension temporaire, et donc obligerait à refaire un OAuth pour rien.
 */
function forget({ storeId, connectorId }) {
  const info = db.prepare(`
    DELETE FROM integration_secrets WHERE store_id = ? AND connector_id = ?
  `).run(storeId, connectorId);
  return info.changes;
}

module.exports = {
  ENV_KEY,
  KEY_BYTES,
  available,
  assertUsable,
  put,
  read,
  readAll,
  describe,
  has,
  forget,
};
