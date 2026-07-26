/**
 * Point d'entrée de production — écoute réseau, journalisation, arrêt propre.
 *
 * Le câblage de l'application vit dans `app.js` : ce fichier ne s'occupe que du
 * cycle de vie du process.
 */

// `config/env` valide la configuration et fait échouer le démarrage si un secret
// obligatoire manque : il doit être chargé AVANT tout le reste.
const config = require('./config/env');
const db = require('./db'); // Initialise le schéma SQLite au démarrage
const { OFFER_MODE } = require('./config/dispatch');
const logger = require('./lib/logger');
const { isSandbox } = require('./lib/sandbox');
const { createServer } = require('./app');

const { server, io } = createServer();

// ── Démarrage ─────────────────────────────────────────────────────────────────

// L'hôte vient de la configuration : loopback en production (TLS terminé par un
// reverse proxy), 0.0.0.0 en développement pour que les téléphones du Wi-Fi
// puissent joindre le backend.
server.listen(config.port, config.host, () => {
  logger.info('Backend démarré', {
    env: config.nodeEnv,
    host: config.host,
    port: config.port,
    dispatchOfferMode: OFFER_MODE ? 'on' : 'off',
    sandbox: isSandbox(),
    corsOrigins: config.corsOrigins,
  });

  if (!config.isProduction) {
    console.log('\n╔═══════════════════════════════════════╗');
    console.log('║         MA ZONE — Backend API         ║');
    console.log('╠═══════════════════════════════════════╣');
    console.log(`║  URL : http://localhost:${config.port}            ║`);
    console.log(`║  Dispatch offer mode : ${OFFER_MODE ? 'ON (popup 20s)' : 'OFF (direct)'}   ║`);
    console.log(`║  Bac à Sable : ${isSandbox() ? 'ACTIF' : 'inactif'}                  ║`);
    console.log('║                                       ║');
    console.log('║  Lancez l\'app : cd mobile && npm run ios');
    console.log('╚═══════════════════════════════════════╝\n');
  }
});

// ── Arrêt propre ──────────────────────────────────────────────────────────────
// Sans cela, un redéploiement coupe les requêtes en vol et laisse le WAL SQLite
// dans un état qui rallonge la récupération au démarrage suivant.

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('Arrêt demandé', { signal });

  const forceExit = setTimeout(() => {
    logger.warn('Arrêt forcé après délai de grâce');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  // Les minuteries d'offre de course retiennent l'event loop jusqu'à leur
  // échéance (20 s) : sans cela, chaque redéploiement attend la dernière offre.
  require('./lib/dispatchOffer').clearAllOfferTimeouts();

  io.close(() => {
    server.close(() => {
      try {
        db.pragma('wal_checkpoint(TRUNCATE)');
        db.close();
      } catch (err) {
        logger.reportError('Fermeture base échouée', err);
      }
      logger.info('Arrêt terminé');
      process.exit(0);
    });
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.reportError(
    'Promesse rejetée non gérée',
    reason instanceof Error ? reason : new Error(String(reason))
  );
});

process.on('uncaughtException', (err) => {
  logger.reportError('Exception non capturée', err);
  shutdown('uncaughtException');
});
