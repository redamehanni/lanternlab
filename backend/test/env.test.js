/**
 * Étape 0 — critères de validation du socle de production.
 *
 * Ces tests vérifient les garde-fous de démarrage. Chacun correspond à une case
 * de la checklist de l'étape 0 dans ROADMAP_ORGANE_ORCHESTRATION_MAZONE.md.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { bootEnv, STRONG_SECRET } = require('./helpers/bootEnv');

const PROD = {
  NODE_ENV: 'production',
  JWT_SECRET: STRONG_SECRET,
  ADMIN_JWT_SECRET: `admin-${STRONG_SECRET}`,
  CORS_ORIGINS: 'https://mazone.app',
};

test('production sans JWT_SECRET : le démarrage échoue', () => {
  const { exitCode, stderr } = bootEnv({ ...PROD, JWT_SECRET: undefined });
  assert.equal(exitCode, 1);
  assert.match(stderr, /JWT_SECRET/);
});

test('production sans ADMIN_JWT_SECRET : le démarrage échoue', () => {
  const { exitCode, stderr } = bootEnv({ ...PROD, ADMIN_JWT_SECRET: undefined });
  assert.equal(exitCode, 1);
  assert.match(stderr, /ADMIN_JWT_SECRET/);
});

test('les secrets de développement historiques sont refusés', () => {
  const { exitCode, stderr } = bootEnv({ ...PROD, JWT_SECRET: 'mazone-secret-dev-2024' });
  assert.equal(exitCode, 1);
  assert.match(stderr, /publiques/);
});

test('un secret trop court est refusé', () => {
  const { exitCode, stderr } = bootEnv({ ...PROD, JWT_SECRET: 'court' });
  assert.equal(exitCode, 1);
  assert.match(stderr, /trop courts/);
});

test('production sans CORS_ORIGINS : le démarrage échoue', () => {
  const { exitCode, stderr } = bootEnv({ ...PROD, CORS_ORIGINS: undefined });
  assert.equal(exitCode, 1);
  assert.match(stderr, /CORS_ORIGINS/);
});

test('CORS_ORIGINS = * est refusé en production', () => {
  const { exitCode, stderr } = bootEnv({ ...PROD, CORS_ORIGINS: '*' });
  assert.equal(exitCode, 1);
  assert.match(stderr, /CORS_ORIGINS/);
});

test('SANDBOX_MODE=on avec NODE_ENV=production est refusé', () => {
  const { exitCode, stderr } = bootEnv({ ...PROD, SANDBOX_MODE: 'on' });
  assert.equal(exitCode, 1);
  assert.match(stderr, /SANDBOX_MODE/);
});

test('une configuration de production complète démarre', () => {
  const { exitCode, config } = bootEnv(PROD);
  assert.equal(exitCode, 0);
  assert.equal(config.isProduction, true);
  assert.deepEqual(config.corsOrigins, ['https://mazone.app']);
  // En production on écoute en loopback : le TLS est terminé en amont.
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.trustProxy, 1);
});

test('en développement les secrets sont générés, pas exigés', () => {
  const { exitCode, config } = bootEnv({ NODE_ENV: 'development' });
  assert.equal(exitCode, 0);
  assert.equal(config.isProduction, false);
  assert.ok(config.jwtSecret.length >= 32);
  assert.notEqual(config.jwtSecret, 'mazone-secret-dev-2024');
  // Le développement doit rester joignable depuis les téléphones du Wi-Fi.
  assert.equal(config.host, '0.0.0.0');
});

test('les secrets de développement sont stables entre deux démarrages', () => {
  const first = bootEnv({ NODE_ENV: 'development' });
  const second = bootEnv({ NODE_ENV: 'development' });
  assert.equal(first.exitCode, 0);
  assert.equal(second.exitCode, 0);
  // Sinon toutes les sessions mobiles tomberaient à chaque redémarrage.
  assert.equal(first.config.jwtSecret, second.config.jwtSecret);
});

test('les secrets citoyen et admin sont distincts', () => {
  const { config } = bootEnv({ NODE_ENV: 'development' });
  assert.notEqual(config.jwtSecret, config.adminJwtSecret);
});
