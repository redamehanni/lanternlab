/**
 * Configuration d'environnement — point unique de vérité, validé au démarrage.
 *
 * Étape 0 de la roadmap Organe d'Orchestration : « secrets obligatoires, crash au
 * boot si absents ». Avant ce module, `JWT_SECRET` et `ADMIN_JWT_SECRET` avaient
 * un fallback en dur committé dans le dépôt — donc publiquement connu, donc tout
 * token forgeable par quiconque a lu le code.
 *
 * Règle appliquée ici :
 *   - En production : un secret manquant fait CRASHER le process. Aucune exception.
 *   - Hors production : un secret aléatoire est généré puis PERSISTÉ dans
 *     `data/.dev-secrets.json` (gitignoré). Stable entre les redémarrages — les
 *     sessions mobiles survivent — mais unique par machine et jamais dans le dépôt.
 *
 * Ce module ne dépend d'aucun autre du backend : il est chargé en premier.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '../../data');
const DEV_SECRETS_FILE = path.join(DATA_DIR, '.dev-secrets.json');
const DOTENV_FILE = path.join(__dirname, '../../.env');

// ── Chargement .env minimal (pas de dépendance dotenv) ────────────────────────
// Les variables déjà présentes dans l'environnement gagnent toujours : un
// fichier .env ne doit jamais écraser une configuration d'hébergeur.
function loadDotEnv() {
  // Les tests doivent être déterministes quel que soit le .env de la machine.
  if (process.env.MAZONE_SKIP_DOTENV === '1') return;
  if (!fs.existsSync(DOTENV_FILE)) return;
  const content = fs.readFileSync(DOTENV_FILE, 'utf8');
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadDotEnv();

// ── Environnement ─────────────────────────────────────────────────────────────

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const IS_TEST = NODE_ENV === 'test';

// ── Secrets ───────────────────────────────────────────────────────────────────

const REQUIRED_SECRETS = ['JWT_SECRET', 'ADMIN_JWT_SECRET'];
const MIN_SECRET_LENGTH = 32;

/**
 * Secrets OPTIONNELS : générés hors production, jamais exigés en production.
 *
 * `INTEGRATION_SECRET_KEY` chiffre les identifiants des logiciels tiers (étape 8). La
 * distinction avec les secrets requis n'est pas un adoucissement, c'est une question de
 * proportion : une instance dont aucun commerçant n'a de logiciel à connecter n'a aucune
 * raison de refuser de démarrer faute de clé de chiffrement. Le refus se produit au
 * branchement du premier connecteur qui en a besoin, là où il est actionnable — voir
 * `lib/integration/secrets.js`.
 *
 * Hors production, la clé est générée et persistée comme les autres : sans cela, chaque
 * redémarrage rendrait illisibles les jetons de la veille et un développeur passerait
 * une matinée à chercher une panne qui n'existe pas.
 */
const OPTIONAL_SECRETS = [
  { name: 'INTEGRATION_SECRET_KEY', bytes: 32, encoding: 'base64' },
];

// Valeurs historiquement committées : refusées même si fournies explicitement.
const BANNED_SECRETS = new Set([
  'mazone-secret-dev-2024',
  'mazone-admin-secret-dev-2024',
]);

function fatal(lines) {
  const border = '─'.repeat(70);
  console.error(`\n${border}`);
  console.error('DÉMARRAGE REFUSÉ — configuration invalide');
  console.error(border);
  for (const line of lines) console.error(line);
  console.error(`${border}\n`);
  process.exit(1);
}

function readDevSecrets() {
  try {
    return JSON.parse(fs.readFileSync(DEV_SECRETS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeDevSecrets(secrets) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DEV_SECRETS_FILE, JSON.stringify(secrets, null, 2), { mode: 0o600 });
}

/**
 * Résout les secrets requis. Crash en production, génération persistée ailleurs.
 */
function resolveSecrets() {
  const missing = [];
  const banned = [];
  const tooShort = [];
  const resolved = {};

  let devSecrets = null;
  let devSecretsDirty = false;

  for (const name of REQUIRED_SECRETS) {
    const provided = process.env[name];

    if (provided) {
      if (BANNED_SECRETS.has(provided)) banned.push(name);
      else if (provided.length < MIN_SECRET_LENGTH) tooShort.push(name);
      resolved[name] = provided;
      continue;
    }

    if (IS_PRODUCTION) {
      missing.push(name);
      continue;
    }

    // Hors production : secret local persisté, jamais committé.
    if (devSecrets === null) devSecrets = readDevSecrets();
    if (!devSecrets[name]) {
      devSecrets[name] = crypto.randomBytes(48).toString('base64url');
      devSecretsDirty = true;
    }
    resolved[name] = devSecrets[name];
    process.env[name] = devSecrets[name];
  }

  if (missing.length || banned.length || tooShort.length) {
    const lines = [];
    if (missing.length) {
      lines.push(`Secrets absents en production : ${missing.join(', ')}`);
    }
    if (banned.length) {
      lines.push(
        `Secrets de développement historiques utilisés : ${banned.join(', ')}`,
        'Ces valeurs sont publiques (présentes dans l\'historique Git). Régénérez-les.'
      );
    }
    if (tooShort.length) {
      lines.push(`Secrets trop courts (< ${MIN_SECRET_LENGTH} caractères) : ${tooShort.join(', ')}`);
    }
    lines.push('', 'Générer un secret :', '  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"');
    lines.push('', 'Voir backend/.env.example');
    fatal(lines);
  }

  for (const { name, bytes, encoding } of OPTIONAL_SECRETS) {
    if (process.env[name]) {
      resolved[name] = process.env[name];
      continue;
    }
    if (IS_PRODUCTION) continue; // absence assumée : refus au branchement, pas au boot

    if (devSecrets === null) devSecrets = readDevSecrets();
    if (!devSecrets[name]) {
      devSecrets[name] = crypto.randomBytes(bytes).toString(encoding);
      devSecretsDirty = true;
    }
    resolved[name] = devSecrets[name];
    process.env[name] = devSecrets[name];
  }

  if (devSecretsDirty) {
    writeDevSecrets(devSecrets);
    console.warn(
      `[env] Secrets de développement générés dans data/.dev-secrets.json ` +
      `(gitignoré). En production, fournissez ${REQUIRED_SECRETS.join(' et ')}.`
    );
  }

  return resolved;
}

const secrets = resolveSecrets();

// ── Sandbox : jamais en production ────────────────────────────────────────────
// Le laboratoire donne le pouvoir d'usurper l'identité d'un citoyen. Avant
// l'étape 0, `SANDBOX_MODE=on` suffisait à l'activer en production. Désormais la
// combinaison est refusée au démarrage : une erreur de configuration doit être
// bruyante, pas silencieusement ignorée.
if (IS_PRODUCTION && process.env.SANDBOX_MODE === 'on') {
  fatal([
    'SANDBOX_MODE=on est incompatible avec NODE_ENV=production.',
    '',
    'Le Bac à Sable autorise l\'impersonation de citoyens et les actions de labo.',
    'Il ne peut jamais être actif en production. Retirez SANDBOX_MODE ou',
    'déployez sur un environnement de staging (NODE_ENV=staging).',
  ]);
}

// ── CORS ──────────────────────────────────────────────────────────────────────
// En production une allowlist explicite est obligatoire. Hors production on
// accepte toute origine : Expo sert depuis un port et une IP LAN variables, et
// React Native n'envoie de toute façon pas d'en-tête Origin.

function parseOrigins(raw) {
  if (!raw) return [];
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
}

const corsOrigins = parseOrigins(process.env.CORS_ORIGINS);

if (IS_PRODUCTION && corsOrigins.length === 0) {
  fatal([
    'CORS_ORIGINS est obligatoire en production.',
    '',
    'Exemple : CORS_ORIGINS=https://admin.mazone.app,https://mazone.app',
    'Une origine « * » en production expose l\'API à n\'importe quel site web.',
  ]);
}

if (corsOrigins.includes('*')) {
  if (IS_PRODUCTION) {
    fatal(['CORS_ORIGINS ne peut pas contenir « * » en production.']);
  }
  console.warn('[env] CORS_ORIGINS contient « * » — accepté hors production uniquement.');
}

// ── Configuration exportée ────────────────────────────────────────────────────

function intFromEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const config = {
  nodeEnv: NODE_ENV,
  isProduction: IS_PRODUCTION,
  isTest: IS_TEST,

  port: intFromEnv('PORT', 4000),
  // En production on écoute en loopback par défaut : le TLS est terminé par un
  // reverse proxy devant l'application, pas par Node.
  host: process.env.HOST || (IS_PRODUCTION ? '127.0.0.1' : '0.0.0.0'),
  // Nombre de proxies de confiance devant l'app (nécessaire pour que le rate
  // limiting et les logs voient la vraie IP cliente).
  trustProxy: intFromEnv('TRUST_PROXY_HOPS', IS_PRODUCTION ? 1 : 0),

  // Adresse publique de l'API, indispensable dès qu'un tiers doit nous RAPPELER :
  // redirection d'autorisation et webhooks. Ni `Host` ni `X-Forwarded-Host` ne peuvent
  // en tenir lieu : ils viennent de la requête, donc de l'extérieur, et une URL de
  // redirection déduite d'un en-tête client est une redirection qu'un attaquant choisit.
  // Absente : les connecteurs qui exigent une autorisation refusent de commencer, en
  // nommant cette variable.
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '') || null,

  jwtSecret: secrets.JWT_SECRET,
  adminJwtSecret: secrets.ADMIN_JWT_SECRET,

  // `[]` en production signifie « aucune origine navigateur » : impossible ici,
  // la validation ci-dessus l'a déjà refusé.
  corsOrigins: corsOrigins.length ? corsOrigins : ['*'],

  rateLimit: {
    windowMs: intFromEnv('RATE_LIMIT_WINDOW_MS', 60_000),
    max: intFromEnv('RATE_LIMIT_MAX', IS_PRODUCTION ? 300 : 100_000),
    authMax: intFromEnv('RATE_LIMIT_AUTH_MAX', IS_PRODUCTION ? 10 : 100_000),
  },

  logLevel: process.env.LOG_LEVEL || (IS_PRODUCTION ? 'info' : 'debug'),
  // Point d'accroche pour un error tracker (Sentry ou équivalent). Absent =
  // désactivé : aucune dépendance n'est imposée à cette étape.
  errorTrackingDsn: process.env.ERROR_TRACKING_DSN || null,
};

module.exports = config;
