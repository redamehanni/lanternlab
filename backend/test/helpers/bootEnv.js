/**
 * Aide de test : charge `config/env.js` dans un process séparé.
 *
 * Les garde-fous de l'étape 0 agissent AU DÉMARRAGE (`process.exit(1)`). On ne
 * peut donc pas les tester par un `require()` direct : il faut un process enfant
 * et observer son code de sortie.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const ENV_MODULE = path.join(__dirname, '../../src/config/env.js');

/**
 * Charge `config/env` avec l'environnement fourni.
 *
 * @param {Record<string,string|undefined>} env variables à définir ; `undefined` supprime
 * @returns {{ exitCode: number, stdout: string, stderr: string, config: object|null }}
 */
function bootEnv(env = {}) {
  // Environnement volontairement minimal : on part d'une base propre pour que le
  // `.env` ou les variables de la machine hôte ne faussent pas le résultat.
  const childEnv = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    MAZONE_SKIP_DOTENV: '1',
  };

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete childEnv[key];
    else childEnv[key] = value;
  }

  const result = spawnSync(
    process.execPath,
    ['-e', `process.stdout.write(JSON.stringify(require(${JSON.stringify(ENV_MODULE)})))`],
    { env: childEnv, encoding: 'utf8' }
  );

  let config = null;
  if (result.status === 0) {
    const start = result.stdout.indexOf('{');
    if (start !== -1) {
      try {
        config = JSON.parse(result.stdout.slice(start));
      } catch {
        config = null;
      }
    }
  }

  return {
    exitCode: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    config,
  };
}

const STRONG_SECRET = 'x'.repeat(48);

module.exports = { bootEnv, STRONG_SECRET };
