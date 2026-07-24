/**
 * Ouvre Expo Go sur le simulateur iOS avec un deep link Laboratoire.
 *
 * Le Laboratoire (admin-web) tourne dans le navigateur et ne peut pas piloter
 * Xcode directement : cette helper tourne côté backend (Mac) via `simctl`.
 *
 * Deep link : exp://<metroHost>:8081/--/lab?labToken=<jwt>
 * Consommé nativement par AppContext (Linking), miroir du #labToken web.
 */

const { execFile } = require('child_process');
const os = require('os');
const http = require('http');

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: opts.timeout || 20000, ...opts }, (err, stdout, stderr) => {
      if (err) {
        const e = new Error((stderr || err.message || String(err)).trim());
        e.status = 500;
        return reject(e);
      }
      resolve(String(stdout || '').trim());
    });
  });
}

/** Première IPv4 non loopback (en0 / en1 prioritaires sur macOS). */
function detectLanIp() {
  if (process.env.MOBILE_METRO_HOST) return process.env.MOBILE_METRO_HOST;
  const ifaces = os.networkInterfaces();
  for (const name of ['en0', 'en1', 'eth0', 'wlan0']) {
    for (const info of ifaces[name] || []) {
      if (info.family === 'IPv4' && !info.internal) return info.address;
    }
  }
  for (const list of Object.values(ifaces)) {
    for (const info of list || []) {
      if (info.family === 'IPv4' && !info.internal) return info.address;
    }
  }
  return '127.0.0.1';
}

function metroPort() {
  return String(process.env.MOBILE_METRO_PORT || '8081');
}

function buildExpoDeepLink(token, host = detectLanIp()) {
  const port = metroPort();
  return `exp://${host}:${port}/--/lab?labToken=${encodeURIComponent(token)}`;
}

function probeHttp(url, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function ensureSimulatorReady() {
  if (process.platform !== 'darwin') {
    const err = new Error('L’ouverture Xcode / simulateur n’est disponible que sur macOS.');
    err.status = 501;
    throw err;
  }

  // Ouvre l’app Simulator si besoin.
  try {
    await run('open', ['-a', 'Simulator']);
  } catch {
    /* ignore — peut déjà être ouvert */
  }

  let bootedUdid = await firstBootedUdid();

  if (!bootedUdid) {
    // Tente un iPhone récent ; ignore l’échec si déjà booted entre-temps.
    const candidates = ['iPhone 17 Pro', 'iPhone 16 Pro', 'iPhone 15 Pro', 'iPhone 16', 'iPhone 15'];
    for (const name of candidates) {
      try {
        await run('xcrun', ['simctl', 'boot', name]);
        break;
      } catch {
        /* try next */
      }
    }
    // Laisse le boot se stabiliser puis relit l’UDID booté.
    await new Promise((r) => setTimeout(r, 2500));
    bootedUdid = await firstBootedUdid();
    if (!bootedUdid) {
      const err = new Error(
        'Aucun simulateur iOS démarré. Ouvrez le Simulator (Xcode) puis réessayez.'
      );
      err.status = 503;
      throw err;
    }
  }

  // Expo Go (bundle id historique). Cible l’UDID précis : `booted` échoue si
  // plusieurs simulateurs sont ouverts (« multiple devices matched »).
  try {
    await run('xcrun', ['simctl', 'launch', bootedUdid, 'host.exp.Exponent']);
  } catch {
    const err = new Error(
      'Expo Go n’est pas installé sur le simulateur. Lancez une fois `cd mobile && npx expo start --ios`.'
    );
    err.status = 503;
    throw err;
  }

  return bootedUdid;
}

/** UDID du premier simulateur booté (ou null). */
async function firstBootedUdid() {
  try {
    const out = await run('xcrun', ['simctl', 'list', 'devices', 'booted']);
    const match = out.match(/\(([0-9A-Fa-f-]{36})\)\s*\(Booted\)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Émet le deep link Laboratoire vers le simulateur booted.
 * @returns {{ deepLink: string, metroHost: string, metroOk: boolean }}
 */
async function openLabOnSimulator(token) {
  const metroHost = detectLanIp();
  const port = metroPort();
  const metroOk = await probeHttp(`http://${metroHost}:${port}/status`)
    || await probeHttp(`http://127.0.0.1:${port}/status`);

  if (!metroOk) {
    const err = new Error(
      `Metro injoignable sur :${port}. Lancez l’app mobile (\`cd mobile && npm run ios\` ou \`npx expo start\`) puis réessayez.`
    );
    err.status = 503;
    throw err;
  }

  // Prépare le simulateur (boot + Expo Go) et récupère son UDID précis.
  const bootedUdid = await ensureSimulatorReady();

  // Préfère l’IP LAN (iOS 26+ / Expo Go) ; fallback localhost si Metro n’écoute qu’en local.
  let deepLink = buildExpoDeepLink(token, metroHost);
  const lanMetro = await probeHttp(`http://${metroHost}:${port}/status`);
  if (!lanMetro) {
    deepLink = buildExpoDeepLink(token, '127.0.0.1');
  }

  try {
    await run('xcrun', ['simctl', 'openurl', bootedUdid, deepLink]);
  } catch (e) {
    const err = new Error(
      `Impossible d’ouvrir le deep link sur le simulateur : ${e.message}`
    );
    err.status = 500;
    throw err;
  }

  return { deepLink, metroHost: lanMetro ? metroHost : '127.0.0.1', metroOk: true, udid: bootedUdid };
}

module.exports = {
  openLabOnSimulator,
  buildExpoDeepLink,
  detectLanIp,
};
