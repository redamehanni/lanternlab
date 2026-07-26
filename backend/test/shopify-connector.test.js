/**
 * Étape 8 — le premier logiciel du marché, éprouvé HORS LIGNE.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * AUCUN APPEL RÉSEAU. C'EST UNE CONDITION, PAS UNE COMMODITÉ.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Un test d'intégration qui appelle un vrai éditeur ne tourne pas en intégration continue :
 * il exige une boutique de démonstration, des identifiants, une connexion, et il échoue les
 * jours où l'éditeur est lent. Autrement dit, il finit désactivé. Ici, le transport sortant
 * est remplacé par une fonction qui répond ce que le scénario demande — y compris des pannes
 * de trente minutes et des quotas dépassés, qu'on ne sait pas provoquer chez un vrai éditeur
 * au moment précis où on en a besoin.
 *
 * C'est le transport injectable (`integration/http.js`) qui rend cela possible, et il a été
 * écrit pour la famille : le connecteur suivant s'éprouvera de la même façon.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LES QUATRE SCÉNARIOS QUI DÉCIDENT SI L'ÉTAPE 8 EST RÉUSSIE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   1. ZÉRO DOUBLE DÉCRÉMENT en mode `pos`. Une vente Ma Zone doit retirer UNE fois la
 *      marchandise, pas deux — une fois chez nous et une fois chez l'éditeur. C'est le
 *      risque numéro un de toute intégration de stock, et il ne se voit pas en lisant le
 *      code : il se voit en comptant.
 *   2. UNE PANNE DE L'ÉDITEUR NE BLOQUE PAS UNE VENTE. Trente minutes d'indisponibilité
 *      doivent coûter un message en attente, pas un client qui ne peut pas acheter.
 *   3. UNE NOTIFICATION NON SIGNÉE EST REFUSÉE. La route est publique : sans preuve
 *      d'origine, n'importe qui déclarerait le stock d'une boutique.
 *   4. LE DÉBRANCHEMENT REND LA PROCURATION ET LAISSE LE COMMERÇANT DEBOUT. Réversibilité :
 *      son catalogue et son stock restent à lui.
 *
 * Ce que ce fichier NE vérifie pas, et qui est vérifié ailleurs exprès : la conformité du
 * connecteur au contrat (`test/connector-conformance.test.js`, qui l'applique à tous) et le
 * comportement du moteur face aux files (`test/integration.test.js`).
 */

// Posé AVANT le harnais : `config/env` lit ces variables au chargement, et l'adresse
// publique décide si un flux d'autorisation peut même commencer.
process.env.PUBLIC_BASE_URL = 'https://api.mazone.test';
process.env.INTEGRATION_SHOPIFY_CLIENT_ID = 'cle-publique-de-l-application';
process.env.INTEGRATION_SHOPIFY_CLIENT_SECRET = 'secret-partage-de-l-application';

const test = require('node:test');
const assert = require('node:assert/strict');

const h = require('./helpers/testServer');
const integration = require('../src/lib/integration');
const http = require('../src/lib/integration/http');
const signature = require('../src/lib/integration/signature');
const secrets = require('../src/lib/integration/secrets');
const cursors = require('../src/lib/integration/cursors');
const outbox = require('../src/lib/integration/outbox');
const inbox = require('../src/lib/integration/inbox');
const worker = require('../src/lib/integration/worker');
const bindings = require('../src/lib/integration/bindings');
const catalog = require('../src/lib/catalog');
const inventory = require('../src/lib/inventory');
const shopify = require('../src/lib/integration/connectors/shopify');

integration.boot({ workers: false });

const SHOP = 'cafe-du-coin.myshopify.com';
const CLIENT_SECRET = process.env.INTEGRATION_SHOPIFY_CLIENT_SECRET;
const LOCATION_ID = 74123;
const INVENTORY_ITEM_ID = 800001;

test.beforeEach(() => {
  h.reset();
  worker.releaseAll();
});

test.after(async () => {
  http.resetTransport();
  await h.stopServer();
  h.cleanup();
});

// ── La boutique Shopify de fiction ────────────────────────────────────────────

/**
 * Une boutique Shopify en mémoire, avec son stock.
 *
 * ELLE TIENT SON PROPRE COMPTE, et c'est indispensable au scénario du double décrément :
 * une fausse boutique qui accepterait les ajustements sans les appliquer ne pourrait pas
 * dire si Ma Zone a retiré une unité ou deux. Ici, `available` évolue comme chez le vrai
 * éditeur, et c'est cette valeur qui revient ensuite par notification.
 */
function fakeShopify({ available = 10, failing = false } = {}) {
  const state = {
    available,
    calls: [],
    adjustments: [],
    webhooks: [],
    failing,
    /** Panne franche, comme un éditeur en incident : rien ne répond. */
    breakdown(on = true) { state.failing = on; },
  };

  const product = {
    id: 900001,
    title: 'Café en grains',
    product_type: 'Épicerie',
    body_html: '<p>Arabica du Brésil<script>alert(1)</script></p>',
    updated_at: '2026-07-25T08:00:00Z',
    variants: [{
      id: 700001,
      inventory_item_id: INVENTORY_ITEM_ID,
      sku: 'CAFE-001',
      title: 'Default Title',
      price: '18.90',
      updated_at: '2026-07-25T08:00:00Z',
    }],
  };

  function json(body, headers = {}) {
    return {
      status: 200,
      headers: new Map(Object.entries(headers)),
      text: async () => JSON.stringify(body),
    };
  }

  async function fetchImpl(url, options = {}) {
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : null;
    state.calls.push({ method, url, body, headers: options.headers || {} });

    if (state.failing) {
      // Ce que fait un éditeur en incident : il ne dit pas « réessayez », il ne répond pas.
      const err = new Error('connexion refusée');
      err.name = 'FetchError';
      throw err;
    }

    if (url.includes('/admin/oauth/access_token')) {
      return json({ access_token: 'shpat_jeton-de-test', scope: shopify.SCOPES.join(',') });
    }
    if (url.includes('/shop.json')) {
      return json({ shop: { myshopify_domain: SHOP, domain: 'cafe-du-coin.fr' } });
    }
    if (url.includes('/locations.json')) {
      return json({ locations: [{ id: LOCATION_ID, name: 'Boutique', active: true }] });
    }
    if (url.includes('/webhooks.json')) {
      if (method === 'POST') {
        state.webhooks.push(body.webhook);
        return json({ webhook: { id: state.webhooks.length, ...body.webhook } });
      }
      return json({ webhooks: state.webhooks });
    }
    if (url.includes('/products.json')) {
      return json({ products: [product] });
    }
    if (url.includes('/inventory_levels/adjust.json')) {
      state.adjustments.push(body);
      state.available += Number(body.available_adjustment);
      return json({
        inventory_level: {
          inventory_item_id: body.inventory_item_id,
          location_id: body.location_id,
          available: state.available,
          updated_at: new Date().toISOString(),
        },
      });
    }
    if (url.includes('/inventory_levels.json')) {
      return json({
        inventory_levels: [{
          inventory_item_id: INVENTORY_ITEM_ID,
          location_id: LOCATION_ID,
          available: state.available,
          updated_at: '2026-07-25T09:00:00Z',
        }],
      });
    }

    return json({});
  }

  http.useTransport(http.createTransport({ fetchImpl, timeoutMs: 500 }));
  return state;
}

/**
 * Connecte la boutique par le vrai flux d'autorisation déléguée.
 *
 * Rien n'est raccourci : jeton d'état créé par le moteur, redirection signée comme le fait
 * l'éditeur, échange du code, rangement du jeton dans le coffre, test de connexion,
 * abonnements. C'est le seul moyen de vérifier que ce chemin fonctionne de bout en bout —
 * un branchement fabriqué à la main en base testerait notre fixture, pas notre code.
 */
async function connectShopify({ storeId, actor }) {
  const { authorizeUrl } = integration.beginConnection({
    storeId,
    connectorId: 'shopify',
    actor,
    params: { shop_domain: SHOP },
  });

  const state = new URL(authorizeUrl).searchParams.get('state');

  const query = {
    code: 'code-d-autorisation',
    shop: SHOP,
    state,
    timestamp: '1785000000',
  };
  query.hmac = signCallback(query);

  return integration.completeConnection({ connectorId: 'shopify', query });
}

/** Signature de la redirection : paramètres triés, hexadécimal — le schéma de l'éditeur. */
function signCallback(query) {
  const message = Object.keys(query)
    .filter((key) => key !== 'hmac')
    .sort()
    .map((key) => `${key}=${query[key]}`)
    .join('&');

  return signature.sign({ payload: message, secret: CLIENT_SECRET, encoding: 'hex' });
}

/** Décor complet : boutique connectée, catalogue importé, stock lu, tenue confiée à la caisse. */
async function connectedStore({ available = 10 } = {}) {
  const world = h.seedWorld();
  const shop = fakeShopify({ available });

  await connectShopify({ storeId: world.store.id, actor: world.merchant.id });
  await integration.pull({ storeId: world.store.id, connectorId: 'shopify', resource: 'product' });

  const product = catalog.findByReference(world.store.id, 'CAFE-001');
  // Le commerçant confie la tenue du stock à sa caisse : c'est CE geste qui fait de
  // `on_hand` un miroir, et il est explicite (étape 4).
  inventory.setInventoryOwner(product.id, inventory.INVENTORY_OWNER.POS);

  await integration.pull({ storeId: world.store.id, connectorId: 'shopify', resource: 'inventory' });
  await integration.drain();

  return { ...world, shop, product };
}

/** Notification signée, envoyée par la route publique comme le ferait l'éditeur. */
async function sendWebhook({ topic, payload, signed = true, secret = CLIENT_SECRET }) {
  const raw = JSON.stringify(payload);
  const headers = {
    [shopify.webhooks.HEADER.TOPIC]: topic,
    [shopify.webhooks.HEADER.SHOP_DOMAIN]: SHOP,
    [shopify.webhooks.HEADER.EVENT_ID]: `evt-${Math.random().toString(36).slice(2)}`,
  };
  if (signed) {
    headers[shopify.webhooks.HEADER.SIGNATURE] = signature.sign({ payload: raw, secret });
  }

  return h.api.post('/api/integration/webhooks/shopify', payload, { headers });
}

// ── 1. La connexion ───────────────────────────────────────────────────────────

test('la connexion déléguée range le jeton dans le coffre et jamais ailleurs', async () => {
  const { store, merchant } = h.seedWorld();
  const shop = fakeShopify();

  const result = await connectShopify({ storeId: store.id, actor: merchant.id });

  assert.equal(result.installation.status, 'active');
  assert.equal(result.installation.config.shop_domain, SHOP);
  // L'établissement a été choisi à la connexion : sans lui, Ma Zone ne saurait pas quel
  // stock elle lit (`api.listInventoryLevels` refuse explicitement).
  assert.equal(result.installation.config.location_id, String(LOCATION_ID));

  // Le jeton est lisible par le coffre…
  assert.equal(
    secrets.read({ storeId: store.id, connectorId: 'shopify', name: 'access_token' }),
    'shpat_jeton-de-test'
  );
  // …et n'apparaît NULLE PART ailleurs en base. Un jeton recopié dans une colonne de
  // configuration serait un jeton en clair dans une sauvegarde.
  const dump = JSON.stringify(
    h.db.prepare('SELECT * FROM integration_installations').all()
  );
  assert.equal(dump.includes('shpat_'), false);

  // Les abonnements temps réel ont été posés, désinstallation comprise : sans elle, Ma Zone
  // continuerait d'appeler l'éditeur avec un jeton révoqué.
  const topics = shop.webhooks.map((hook) => hook.topic);
  assert.ok(topics.includes('inventory_levels/update'));
  assert.ok(topics.includes('app/uninstalled'));
  assert.ok(shop.webhooks.every((hook) => hook.address.startsWith('https://api.mazone.test')));
});

test('un jeton d\'état ne sert qu\'une fois', async () => {
  const { store, merchant } = h.seedWorld();
  fakeShopify();

  const { authorizeUrl } = integration.beginConnection({
    storeId: store.id, connectorId: 'shopify', actor: merchant.id,
    params: { shop_domain: SHOP },
  });
  const state = new URL(authorizeUrl).searchParams.get('state');
  const query = { code: 'code-1', shop: SHOP, state, timestamp: '1785000000' };
  query.hmac = signCallback(query);

  await integration.completeConnection({ connectorId: 'shopify', query });

  await assert.rejects(
    () => integration.completeConnection({ connectorId: 'shopify', query }),
    // Une redirection rejouable est une redirection qu'on peut faire rejouer : deux échanges
    // du même code produiraient deux jeux de jetons, dont un que personne ne révoquera.
    (err) => err.status === 409
  );
});

test('une redirection non signée par l\'éditeur est refusée', async () => {
  const { store, merchant } = h.seedWorld();
  fakeShopify();

  const { authorizeUrl } = integration.beginConnection({
    storeId: store.id, connectorId: 'shopify', actor: merchant.id,
    params: { shop_domain: SHOP },
  });
  const state = new URL(authorizeUrl).searchParams.get('state');

  await assert.rejects(
    () => integration.completeConnection({
      connectorId: 'shopify',
      query: { code: 'code-1', shop: SHOP, state, timestamp: '1', hmac: 'signature-inventee' },
    }),
    (err) => err.status === 401
  );

  assert.equal(integration.forStore(store.id, { activeOnly: false }).length, 0);
});

test('un domaine de boutique fantaisiste n\'atteint jamais le réseau', () => {
  const { store, merchant } = h.seedWorld();
  const shop = fakeShopify();

  assert.throws(
    () => integration.beginConnection({
      storeId: store.id, connectorId: 'shopify', actor: merchant.id,
      // Un domaine libre serait injecté dans l'hôte de tous nos appels sortants : le jeton
      // d'une boutique partirait vers un serveur choisi par l'appelant.
      params: { shop_domain: 'evil.example.com' },
    }),
    (err) => err.status === 400
  );

  assert.equal(shop.calls.length, 0);
});

// ── 2. Le catalogue et le stock ───────────────────────────────────────────────

test('le catalogue Shopify devient un catalogue Ma Zone, sans HTML ni titre par défaut', async () => {
  const { store, product } = await connectedStore();

  assert.equal(product.name, 'Café en grains', '« Default Title » n\'a rien à faire dans un nom');
  assert.equal(product.price, 18.9);
  assert.equal(product.description, 'Arabica du Brésil', 'le HTML de l\'éditeur est nettoyé');

  // L'identité externe est l'`inventory_item_id`, seul identifiant présent dans TOUS les
  // flux de cet éditeur. C'est la décision la plus lourde du connecteur : la vérifier ici
  // évite de découvrir l'erreur au premier webhook de stock.
  const binding = bindings.forEntity('product', product.id)[0];
  assert.equal(binding.external_id, String(INVENTORY_ITEM_ID));

  assert.equal(inventory.getLevel(product.id).on_hand, 10, 'le stock lu chez l\'éditeur');
});

test('la lecture est incrémentielle : le curseur survit à la passe', async () => {
  const { store } = await connectedStore();

  const state = cursors.forStore(store.id);
  assert.ok(state.length >= 1);
  assert.ok(state.every((row) => row.last_pulled_at), 'sans date de lecture, pas de réconciliation');
});

test('tous les appels passent par la version d\'API épinglée', async () => {
  const { shop } = await connectedStore();

  const admin = shop.calls.filter((call) => call.url.includes('/admin/api/'));
  assert.ok(admin.length >= 3);
  for (const call of admin) {
    assert.ok(
      call.url.includes(`/admin/api/${shopify.api.API_VERSION}/`),
      `appel non épinglé : ${call.url}`
    );
  }
});

test('la date de revue de la version d\'API n\'est pas dépassée', () => {
  // Une échéance qui ne vit que dans la tête de quelqu'un n'existe pas. Ce test échouera
  // quelques mois avant que l'éditeur retire la version épinglée — au moment où la mise à
  // jour est une tâche, et pas encore une panne chez un commerçant.
  assert.ok(
    Date.parse(shopify.api.API_VERSION_REVIEW) > Date.now(),
    `la version d'API ${shopify.api.API_VERSION} doit être revue : `
    + `échéance ${shopify.api.API_VERSION_REVIEW}`
  );
});

// ── 3. Le scénario décisif : zéro double décrément ────────────────────────────

test('en mode pos, une vente Ma Zone ne retire la marchandise qu\'une fois', async () => {
  const { store, product, shop, merchant } = await connectedStore({ available: 10 });

  // Une vente Ma Zone, du point de vue des organes : la marchandise est promise, puis elle
  // part. En mode `pos`, `commit` ne touche PAS `on_hand` — la vérité physique appartient à
  // la caisse (étape 4).
  inventory.reserve({ productId: product.id, quantity: 2, reference: 'cmd-1', actor: merchant.id });
  assert.equal(inventory.getSellableQty(product.id), 8, 'le client voit sa réservation');

  inventory.commit({ productId: product.id, quantity: 2, reference: 'cmd-1' });
  assert.equal(inventory.getLevel(product.id).on_hand, 10, 'Ma Zone ne décrémente pas un miroir');

  integration.pushSale({
    order: {
      id: 'cmd-1', store_id: store.id, product_id: product.id, quantity: 2, total_price: 37.8,
    },
  }, {});
  await integration.drain();

  // UN SEUL ajustement, RELATIF, du bon signe. Un `set` absolu écraserait les ventes passées
  // en caisse depuis notre dernière lecture ; deux envois retireraient quatre unités.
  assert.equal(shop.adjustments.length, 1);
  assert.equal(shop.adjustments[0].available_adjustment, -2);
  assert.equal(shop.adjustments[0].location_id, LOCATION_ID);
  assert.equal(shop.adjustments[0].inventory_item_id, INVENTORY_ITEM_ID);
  assert.equal(shop.available, 8, 'l\'éditeur tient son compte');

  // L'éditeur notifie son nouveau stock. Ma Zone recopie, elle ne recalcule pas.
  const notified = await sendWebhook({
    topic: 'inventory_levels/update',
    payload: {
      inventory_item_id: INVENTORY_ITEM_ID,
      location_id: LOCATION_ID,
      available: shop.available,
      updated_at: '2026-07-25T10:00:00Z',
    },
  });
  assert.equal(notified.status, 202);
  await integration.drain();

  // ═══════════════════════════════════════════════════════════════════════════
  // LE COMPTE QUI VALIDE L'ÉTAPE : 10 − 2 = 8, ET PAS 6.
  // ═══════════════════════════════════════════════════════════════════════════
  const level = inventory.getLevel(product.id);
  assert.equal(level.on_hand, 8);
  assert.equal(level.reserved, 0);
  assert.equal(inventory.getSellableQty(product.id), 8);
  assert.equal(
    integration.pendingConflicts(store.id), 0,
    'un conflit ici signifierait que la notification de stock n\'a pas retrouvé son produit'
  );
});

test('la même vente rejouée n\'ajuste pas deux fois le stock de l\'éditeur', async () => {
  const { store, product, shop } = await connectedStore();
  const order = {
    id: 'cmd-idem', store_id: store.id, product_id: product.id, quantity: 1, total_price: 18.9,
  };

  integration.pushSale({ order }, {});
  integration.pushSale({ order }, {});
  await integration.drain();

  // Un ajustement relatif n'est PAS rejouable : c'est l'idempotence de l'Outbox qui protège,
  // et elle doit tenir avant le réseau, pas après.
  assert.equal(shop.adjustments.length, 1);
  assert.equal(shop.available, 9);
});

test('une vente d\'un produit inconnu de l\'éditeur ne devient pas une panne', async () => {
  const { store, merchant } = await connectedStore();
  // Un produit créé dans Ma Zone, jamais apparié chez l'éditeur : réessayer six fois ne le
  // fera pas apparaître.
  const orphelin = h.createProduct({ storeId: store.id, name: 'Créé dans Ma Zone' });

  integration.pushSale({
    order: {
      id: 'cmd-orpheline', store_id: store.id, product_id: orphelin.id, quantity: 1, total_price: 5,
    },
  }, {});
  await integration.drain();

  const [message] = outbox.forStore(store.id);
  assert.equal(message.status, outbox.STATUS.PENDING, 'la vente n\'est pas perdue');
  assert.match(message.last_error, /importez le catalogue/);
});

// ── 4. Une panne de l'éditeur ne bloque pas une vente ─────────────────────────

test('trente minutes de panne chez l\'éditeur ne bloquent aucune vente', async () => {
  const { store, product, shop, merchant } = await connectedStore({ available: 10 });

  shop.breakdown(true);

  // LA VENTE A LIEU. C'est tout l'enjeu : la réservation et la sortie de marchandise sont des
  // décisions de Ma Zone, et un éditeur injoignable ne doit pas empêcher un commerçant de
  // vendre.
  inventory.reserve({ productId: product.id, quantity: 3, reference: 'cmd-panne', actor: merchant.id });
  assert.equal(inventory.getSellableQty(product.id), 7, 'la marchandise est promise malgré la panne');

  inventory.commit({ productId: product.id, quantity: 3, reference: 'cmd-panne' });
  const sortie = inventory.readMovements(product.id).filter((m) => m.kind === 'commit');
  assert.equal(sortie.length, 1, 'la sortie de marchandise est enregistrée sans l\'éditeur');

  integration.pushSale({
    order: {
      id: 'cmd-panne', store_id: store.id, product_id: product.id, quantity: 3, total_price: 56.7,
    },
  }, {});

  // La panne dure. Chaque passage de file constate, reprogramme, et n'abandonne pas.
  for (let minute = 0; minute < 3; minute += 1) {
    h.db.prepare(
      'UPDATE integration_outbox SET next_attempt_at = datetime(\'now\', \'-1 minute\')'
    ).run();
    await integration.drain();
  }

  const pending = outbox.forStore(store.id)[0];
  assert.equal(pending.status, outbox.STATUS.PENDING);
  assert.equal(pending.attempts, 3);
  assert.equal(shop.adjustments.length, 0);

  // L'éditeur revient. Rien n'a été perdu, et rien n'a été envoyé deux fois.
  shop.breakdown(false);
  h.db.prepare(
    'UPDATE integration_outbox SET next_attempt_at = datetime(\'now\', \'-1 minute\')'
  ).run();
  await integration.drain();

  assert.equal(outbox.forStore(store.id)[0].status, outbox.STATUS.SENT);
  assert.equal(shop.adjustments.length, 1);
  assert.equal(shop.adjustments[0].available_adjustment, -3);
});

// ── 5. Les notifications ──────────────────────────────────────────────────────

test('une notification non signée est refusée et n\'entre pas dans la file', async () => {
  const { store } = await connectedStore();
  const avant = inbox.forStore(store.id).length;

  const res = await sendWebhook({
    topic: 'inventory_levels/update',
    payload: { inventory_item_id: INVENTORY_ITEM_ID, location_id: LOCATION_ID, available: 0 },
    signed: false,
  });

  // 401 et non 400 : ce n'est pas une requête mal formée, c'est une origine non prouvée.
  assert.equal(res.status, 401);
  // Le refus a lieu AVANT la file : un message non prouvé ne doit pas exister, même refusé.
  assert.equal(inbox.forStore(store.id).length, avant);
});

test('une notification signée avec une autre clé est refusée', async () => {
  const { store, product } = await connectedStore();
  const avant = inbox.forStore(store.id).length;

  const res = await sendWebhook({
    topic: 'inventory_levels/update',
    payload: { inventory_item_id: INVENTORY_ITEM_ID, location_id: LOCATION_ID, available: 0 },
    secret: 'la-clef-de-quelqu-un-d-autre',
  });

  assert.equal(res.status, 401);
  assert.equal(inbox.forStore(store.id).length, avant);
  assert.equal(inventory.getLevel(product.id).on_hand, 10, 'personne n\'a mis ce stock à zéro');
});

test('la même notification rejouée ne produit qu\'un effet', async () => {
  const { store, product } = await connectedStore();
  const avant = inbox.forStore(store.id).length;

  const payload = {
    inventory_item_id: INVENTORY_ITEM_ID,
    location_id: LOCATION_ID,
    available: 4,
    updated_at: '2026-07-25T11:00:00Z',
  };
  const raw = JSON.stringify(payload);
  const headers = {
    [shopify.webhooks.HEADER.TOPIC]: 'inventory_levels/update',
    [shopify.webhooks.HEADER.SHOP_DOMAIN]: SHOP,
    // MÊME identifiant d'événement : c'est ainsi qu'un éditeur rejoue une livraison dont il
    // n'a pas vu la réponse.
    [shopify.webhooks.HEADER.EVENT_ID]: 'evt-rejoue',
    [shopify.webhooks.HEADER.SIGNATURE]: signature.sign({ payload: raw, secret: CLIENT_SECRET }),
  };

  const first = await h.api.post('/api/integration/webhooks/shopify', payload, { headers });
  const second = await h.api.post('/api/integration/webhooks/shopify', payload, { headers });

  assert.equal(first.body.duplicate, false);
  assert.equal(second.body.duplicate, true);
  // 202 dans les deux cas : répondre « déjà reçu » avec une erreur inciterait l'éditeur à
  // considérer sa livraison comme échouée et à recommencer indéfiniment.
  assert.equal(second.status, 202);

  await integration.drain();
  assert.equal(inventory.getLevel(product.id).on_hand, 4);
  // Deux livraisons, UN message : la déduplication vit en base, pas en mémoire — un
  // redémarrage entre les deux livraisons donnerait le même résultat.
  assert.equal(inbox.forStore(store.id).length, avant + 1);
});

test('la désinstallation chez l\'éditeur débranche et purge le jeton', async () => {
  const { store } = await connectedStore();

  const res = await sendWebhook({
    topic: 'app/uninstalled',
    payload: { id: 900, domain: SHOP },
  });

  assert.equal(res.status, 202);
  // Sans ce traitement, Ma Zone continuerait d'appeler l'éditeur avec un jeton révoqué, en
  // réessayant, jusqu'à ce que quelqu'un lise les journaux.
  assert.equal(secrets.describe({ storeId: store.id, connectorId: 'shopify' }).length, 0);
  const [installation] = integration.forStore(store.id, { activeOnly: false });
  assert.equal(installation.status, 'paused');
});

// ── 6. Réversibilité ──────────────────────────────────────────────────────────

test('débrancher rend la procuration et laisse le commerçant debout', async () => {
  const { store, product, merchant } = await connectedStore();

  const res = await h.api.delete(
    `/api/integration/stores/${store.id}/connectors/shopify`, { token: merchant.token }
  );
  assert.equal(res.status, 200);

  // La procuration est rendue : plus aucun secret, plus aucun curseur de lecture.
  assert.equal(secrets.describe({ storeId: store.id, connectorId: 'shopify' }).length, 0);
  assert.equal(cursors.forStore(store.id).length, 0);

  // Le commerçant reste DEBOUT : son catalogue est à lui, son stock aussi. C'est le critère
  // de réversibilité de la roadmap, et il ne vaut que vérifié.
  assert.ok(catalog.findByReference(store.id, 'CAFE-001'));
  assert.equal(inventory.getLevel(product.id).on_hand, 10);

  // La correspondance externe, elle, SURVIT : sans elle, rebrancher recréerait des doublons
  // chez l'éditeur.
  assert.equal(bindings.forEntity('product', product.id).length, 1);
});

test('un commerçant reprend la tenue de son stock après un débranchement', async () => {
  const { store, product, merchant } = await connectedStore();

  await h.api.delete(
    `/api/integration/stores/${store.id}/connectors/shopify`, { token: merchant.token }
  );

  // Le geste qui compte vraiment : repasser en `mazone` et corriger son stock soi-même. Un
  // commerçant qui débranche son logiciel doit pouvoir continuer à vendre sans lui.
  inventory.setInventoryOwner(product.id, inventory.INVENTORY_OWNER.MAZONE);
  inventory.adjust({ productId: product.id, delta: 5, actor: merchant.id, reason: 'réassort' });

  assert.equal(inventory.getLevel(product.id).on_hand, 15);
  assert.equal(inventory.getSellableQty(product.id), 15);
});
