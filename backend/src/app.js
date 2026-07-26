/**
 * Construction du serveur — sans écoute réseau.
 *
 * Séparé de `index.js` à l'étape 1 de la roadmap Organe d'Orchestration : les
 * tests de caractérisation ont besoin de démarrer une instance complète sur un
 * port éphémère, ce qui est impossible si `server.listen()` est appelé au moment
 * du `require`. `index.js` reste le point d'entrée de production ; ce module ne
 * fait que câbler.
 */

const express = require('express');
const http = require('http');
const { Server: SocketIO } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const config = require('./config/env');
const logger = require('./lib/logger');
const { registerOrderSubscribers } = require('./lib/orders');
const inventory = require('./lib/inventory');
const integration = require('./lib/integration');

const authRoutes = require('./routes/auth');
const storesRoutes = require('./routes/stores');
const productsRoutes = require('./routes/products');
const ordersRoutes = require('./routes/orders');
const intentsRoutes = require('./routes/intents');
const integrationRoutes = require('./routes/integration');
const missionsRoutes = require('./routes/missions');
const messagesRoutes = require('./routes/messages');
const conversationsRoutes = require('./routes/conversations');
const communicationRoutes = require('./routes/communication');
const usersRoutes = require('./routes/users');
const cartRoutes = require('./routes/cart');
const favoritesRoutes = require('./routes/favorites');
const promotionsRoutes = require('./routes/promotions');
const driversRoutes = require('./routes/drivers');
const merchantsRoutes = require('./routes/merchants');
const walletRoutes = require('./routes/wallet');
const identityRoutes = require('./routes/identity');
const eventsRoutes = require('./routes/events');
const adminRoutes = require('./routes/admin');
const v1Routes = require('./routes/v1');
const sunset = require('./lib/sunset');
const setupSocket = require('./socket/handlers');

/**
 * Câble l'application et son serveur HTTP/WebSocket.
 *
 * @param {{ rateLimiting?: boolean, syncWorkers?: boolean }} options
 *        `rateLimiting: false` en test — sinon la suite épuise le quota et les
 *        assertions échouent pour une raison qui n'a rien à voir avec le métier.
 *        `syncWorkers: false` en test — une boucle de fond rendrait les assertions non
 *        déterministes ; les tests pilotent `integration.drain()` explicitement.
 * @returns {{ app: import('express').Express, server: http.Server, io: SocketIO }}
 */
function createServer({ rateLimiting = true, syncWorkers = true } = {}) {
  const app = express();
  const server = http.createServer(app);

  // ── Reprise du stock existant (jalon T0 de l'étape 4) ──────────────────────
  // Idempotente et bon marché : elle ne fait quelque chose que pour les produits
  // qui n'ont pas encore de ligne de stock. Au démarrage plutôt que dans un script
  // à lancer à la main, parce qu'un backfill qu'on oublie de lancer laisse la base
  // dans un état que le code ne sait plus décrire.
  const adoption = inventory.backfill();
  if (adoption.adopted > 0) {
    logger.info('Stock repris par l\'organe Inventory', adoption);
  }

  // ── Integration Engine (étape 6) ───────────────────────────────────────────
  // Se déclare à l'orchestration, qui ne le connaît pas (Loi 16). À partir d'ici, une
  // étape `requires: 'push_sales'` s'exécute pour les boutiques dont un connecteur en est
  // capable, et reste reportée pour les autres — sans qu'aucun plan d'intention change.
  integration.boot({ workers: syncWorkers });

  // ── Configuration ──────────────────────────────────────────────────────────

  // Derrière un reverse proxy (TLS terminé en amont), Express doit faire
  // confiance aux en-têtes X-Forwarded-* pour que le rate limiting et les logs
  // voient la vraie IP cliente et non celle du proxy.
  if (config.trustProxy > 0) app.set('trust proxy', config.trustProxy);

  app.use(helmet({
    // L'API sert aussi `/uploads` en statique : la politique par défaut de
    // helmet bloquerait le chargement de ces images depuis une autre origine.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // Aucune page HTML n'est servie : la CSP par défaut n'a rien à protéger.
    contentSecurityPolicy: false,
  }));

  // Allowlist explicite en production, permissif ailleurs (Expo sert depuis une
  // IP LAN et un port variables). Une requête sans en-tête Origin — cas de React
  // Native et des appels serveur à serveur — est toujours acceptée.
  const allowAllOrigins = config.corsOrigins.includes('*');
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowAllOrigins || config.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      logger.warn('CORS refusé', { origin });
      return callback(new Error('Origine non autorisée'));
    },
    credentials: true,
  }));

  // `verify` conserve les octets BRUTS reçus. Une signature de webhook se calcule sur le
  // corps exact envoyé par l'éditeur : le rejouer depuis l'objet analysé puis resérialisé
  // change un espace ou un ordre de clés, et toute vérification échoue pour une raison
  // impossible à diagnostiquer. Le coût est un doublon en mémoire, borné par `limit`.
  app.use(express.json({
    limit: '1mb',
    verify: (req, res, buf) => { req.rawBody = buf; },
  }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // ── Socket.io ──────────────────────────────────────────────────────────────

  const io = new SocketIO(server, {
    cors: {
      origin: allowAllOrigins ? '*' : config.corsOrigins,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    },
    transports: ['websocket', 'polling'],
  });

  // Rendre io accessible dans toutes les routes via req.app.get('io')
  app.set('io', io);
  setupSocket(io);

  // ── Abonnés aux faits domaine ──────────────────────────────────────────────
  // Les organes publient des faits, ces abonnés les traduisent en sockets et en
  // notifications. Branchés ici parce qu'ils ont besoin de `io`, et nulle part
  // ailleurs pour qu'un seul fichier réponde à « qui écoute quoi ».
  registerOrderSubscribers(io);

  // ── Rate limiting ──────────────────────────────────────────────────────────
  // Une limite globale, et une limite beaucoup plus stricte sur
  // l'authentification (le seul endroit où deviner à répétition a de la valeur).

  let authLimiter = (req, res, next) => next();

  if (rateLimiting) {
    app.use(rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.max,
      standardHeaders: true,
      legacyHeaders: false,
      // Le healthcheck est interrogé par l'hébergeur, pas par un client.
      skip: (req) => req.path === '/health',
    }));

    authLimiter = rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.authMax,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Trop de tentatives. Réessayez dans une minute.' },
    });
  }

  // Servir les images uploadées
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

  // ── Routes HTTP ────────────────────────────────────────────────────────────

  // ÉTAPE 7 — LA SURFACE VERSIONNÉE, MONTÉE EN PREMIER.
  //
  // Deux API coexistent, et c'est la dette principale de cette étape. Elle est bornée par
  // une date inscrite dans le code (`lib/sunset.js`) et par un compteur d'usage qui dit
  // quelles routes historiques sont encore appelées — la seule information qui permette de
  // couper sans casser une application déjà installée chez quelqu'un.
  //
  // `/api/v1` avant le middleware de dépréciation : la surface neuve ne s'annonce pas
  // mourante. Express essaie les montages dans l'ordre, donc ce montage-ci gagne.
  app.use('/api/v1', v1Routes);

  // Marque et compte tout ce qui reste sur `/api`. `Deprecation` et `Sunset` (RFC 8594)
  // rendent la fin de vie visible dans la réponse elle-même, sans documentation à aller
  // chercher.
  app.use('/api', sunset.deprecationMiddleware());

  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/stores', storesRoutes);
  app.use('/api/products', productsRoutes);
  app.use('/api/orders', ordersRoutes);
  app.use('/api/intents', intentsRoutes);
  app.use('/api/integration', integrationRoutes);
  app.use('/api/missions', missionsRoutes);
  app.use('/api/messages', messagesRoutes);
  app.use('/api/conversations', conversationsRoutes);
  app.use('/api/communication', communicationRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api/favorites', favoritesRoutes);
  app.use('/api/promotions', promotionsRoutes);
  app.use('/api/drivers', driversRoutes);
  app.use('/api/merchants', merchantsRoutes);
  app.use('/api/wallet', walletRoutes);
  app.use('/api/identity', identityRoutes);
  app.use('/api/events', eventsRoutes);
  app.use('/api/admin', adminRoutes);

  // Healthcheck
  app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

  // Page d'accueil (évite "Cannot GET /" dans le navigateur)
  app.get('/', (req, res) => {
    res.json({
      name: 'Ma Zone API',
      status: 'running',
      message: 'Le backend fonctionne. L\'application mobile se lance via Expo (port 8081), pas ici.',
      health: '/health',
      api: {
        // La surface à utiliser est nommée en premier, avec sa fin de vie annoncée pour
        // l'autre : c'est la première page qu'un intégrateur ouvre.
        current: '/api/v1',
        contract: 'backend/openapi/openapi.yaml',
        legacy: '/api',
        legacy_sunset: sunset.DEADLINES.legacyApi.date,
      },
      mobile: 'cd mobile && npm run ios',
    });
  });

  // ── Gestion des erreurs ────────────────────────────────────────────────────

  // Route inconnue : réponse JSON explicite plutôt que la page HTML d'Express.
  app.use((req, res) => {
    res.status(404).json({ error: 'Ressource introuvable', path: req.path });
  });

  // Filet final : aucune exception ne doit fuir une stack trace au client.
  app.use((err, req, res, _next) => {
    logger.reportError('Erreur non gérée', err, { method: req.method, path: req.path });
    if (res.headersSent) return;
    res.status(err.status || 500).json({
      error: config.isProduction ? 'Erreur interne' : err.message,
    });
  });

  return { app, server, io };
}

module.exports = { createServer };
