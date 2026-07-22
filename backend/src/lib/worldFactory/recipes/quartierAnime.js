/**
 * Recette — Quartier animé.
 *
 * Peuple un petit quartier réaliste : habitants, commerçants avec boutique +
 * produits, favoris, et objets Wallet (via l'organe Wallet — jamais d'insert
 * direct). Paramétrable. Sans effets de bord dispatch (pas de commandes live).
 *
 * Principe : ORCHESTRER. Cette recette ne contient aucune règle métier.
 */

const { defineRecipe } = require('../recipeRegistry');

const DEFAULTS = {
  residents: 5,
  merchants: 3,
  drivers: 2,
};

const TRANSPORTS = ['Vélo', 'Vélo cargo', 'Scooter', 'Voiture'];

const STORE_TEMPLATES = [
  {
    merchant: { name: 'Claire Boulanger', emailPrefix: 'claire' },
    store: {
      name: 'Boulangerie Lumière',
      category: 'boulangerie',
      address: '12 place du Marché',
      description: 'Pains au levain et viennoiseries du coin.',
      story: 'Ouverte depuis 2018 par Claire, artisan boulanger.',
    },
    products: [
      { name: 'Baguette tradition', price: 1.2, quantity: 40, category: 'pain' },
      { name: 'Croissant beurre', price: 1.4, quantity: 30, category: 'viennoiserie' },
      { name: 'Pain au chocolat', price: 1.5, quantity: 25, category: 'viennoiserie' },
    ],
  },
  {
    merchant: { name: 'Karim Épicier', emailPrefix: 'karim' },
    store: {
      name: "Épicerie du coin",
      category: 'epicerie',
      address: '3 rue des Lilas',
      description: 'Produits frais et épicerie de quartier.',
      story: 'Le dépannage du soir pour tout le quartier.',
    },
    products: [
      { name: 'Lait entier 1L', price: 1.1, quantity: 50, category: 'frais' },
      { name: 'Œufs x6', price: 2.4, quantity: 20, category: 'frais' },
      { name: 'Pâtes 500g', price: 1.8, quantity: 35, category: 'sec' },
    ],
  },
  {
    merchant: { name: 'Inès Café', emailPrefix: 'ines' },
    store: {
      name: 'Café des Habitants',
      category: 'cafe',
      address: '8 avenue Centrale',
      description: 'Café de quartier, terrasse et wifi.',
      story: 'Point de rendez-vous du matin.',
    },
    products: [
      { name: 'Espresso', price: 1.8, quantity: 100, category: 'boisson' },
      { name: 'Cappuccino', price: 3.2, quantity: 80, category: 'boisson' },
      { name: 'Cookie maison', price: 2.5, quantity: 20, category: 'snack' },
    ],
  },
];

const FIRST_NAMES = ['Marie', 'Lucas', 'Sofia', 'Thomas', 'Léa', 'Hugo', 'Emma', 'Noah'];
const LAST_NAMES = ['Dupont', 'Martin', 'Bernard', 'Petit', 'Robert', 'Richard', 'Durand', 'Moreau'];

defineRecipe({
  id: 'quartier_anime',
  label: 'Quartier animé',
  description:
    'Habitants, commerçants avec boutique et produits, livreurs, favoris, et Wallets peuplés. ' +
    'Première recette du Bac à Sable — sans commandes live ni missions.',
  params: {
    residents: { type: 'number', default: DEFAULTS.residents, min: 1, max: 50 },
    merchants: { type: 'number', default: DEFAULTS.merchants, min: 1, max: STORE_TEMPLATES.length },
    drivers: { type: 'number', default: DEFAULTS.drivers, min: 0, max: 20 },
  },
  run(ctx, params = {}) {
    const residents = clamp(params.residents ?? DEFAULTS.residents, 1, 50);
    const merchants = clamp(params.merchants ?? DEFAULTS.merchants, 1, STORE_TEMPLATES.length);
    const drivers = clamp(params.drivers ?? DEFAULTS.drivers, 0, 20);
    const stamp = Date.now().toString(36);

    // ── Habitants ─────────────────────────────────────────────────────────────
    const citizens = [];
    for (let i = 0; i < residents; i++) {
      const first = FIRST_NAMES[i % FIRST_NAMES.length];
      const last = LAST_NAMES[i % LAST_NAMES.length];
      citizens.push(
        ctx.createCitizen({
          name: `${first} ${last}`,
          email: `demo.${first.toLowerCase()}.${i}.${stamp}@mazone.demo`,
          address: `${10 + i} rue des Habitants`,
          lat: 48.8566 + i * 0.001,
          lng: 2.3522 + i * 0.001,
        })
      );
    }

    // ── Commerçants + boutiques + produits ────────────────────────────────────
    const shops = [];
    for (let i = 0; i < merchants; i++) {
      const tpl = STORE_TEMPLATES[i];
      const { merchant, store } = ctx.createMerchantWithStore(
        {
          name: tpl.merchant.name,
          email: `demo.${tpl.merchant.emailPrefix}.${stamp}@mazone.demo`,
          address: tpl.store.address,
        },
        tpl.store
      );
      const products = tpl.products.map((p) => ctx.createProduct(store.id, p));
      shops.push({ merchant, store, products });
    }

    // ── Livreurs (acteurs du monde, sans mission ni dispatch) ─────────────────
    const couriers = [];
    for (let i = 0; i < drivers; i++) {
      const first = FIRST_NAMES[(i + 3) % FIRST_NAMES.length];
      const last = LAST_NAMES[(i + 5) % LAST_NAMES.length];
      couriers.push(
        ctx.createDriver({
          name: `${first} ${last}`,
          email: `demo.driver.${first.toLowerCase()}.${i}.${stamp}@mazone.demo`,
          transport: TRANSPORTS[i % TRANSPORTS.length],
          lat: 48.8566 + i * 0.0012,
          lng: 2.3522 - i * 0.0012,
        })
      );
    }

    // ── Favoris (quelques habitants découvrent des commerces) ─────────────────
    let favorites = 0;
    for (let i = 0; i < citizens.length; i++) {
      const shop = shops[i % shops.length];
      ctx.addFavorite(citizens[i].id, shop.store.id);
      favorites += 1;
    }

    // ── Wallets peuplés via l'organe Wallet (ORCHESTRATION) ───────────────────
    // Chaque habitant reçoit un petit set d'objets. Un billet est consommé pour
    // illustrer la facette souvenir — via ctx.consumeWalletObject, pas en SQL.
    let walletObjects = 0;
    for (const citizen of citizens) {
      const ticket = ctx.issueWalletObject({
        ownerId: citizen.id,
        kind: 'event_ticket',
        payload: { venue: 'Place du Marché', date: '2026-08-20' },
        display: {
          title: 'Concert de quartier',
          subtitle: 'Place du Marché · 20 août',
          primaryDate: '2026-08-20',
          category: 'culture',
        },
      });
      walletObjects += 1;

      // Consommation via l'organe (souvenir) — toujours orchestrer.
      ctx.consumeWalletObject({ objectId: ticket.id });

      ctx.issueWalletObject({
        ownerId: citizen.id,
        kind: 'promo_voucher',
        payload: { code: 'ZONE10' },
        display: { title: '-10% sur votre panier', subtitle: 'Code ZONE10', category: 'commerce' },
      });
      walletObjects += 1;

      if (shops[0]) {
        ctx.issueWalletObject({
          ownerId: citizen.id,
          kind: 'loyalty_card',
          payload: { points: 50 + Math.floor(Math.random() * 100) },
          display: {
            title: shops[0].store.name,
            subtitle: 'Carte de fidélité',
            category: 'commerce',
          },
        });
        walletObjects += 1;
      }
    }

    // ── Initiatives locales via l'Event Engine (ORCHESTRATION) ────────────────
    // Chaque commerce fait naître une initiative qui n'existerait pas sans Ma
    // Zone (dégustation), publiée pour être découvrable. Une Lanterne curée est
    // posée dans le quartier. On passe par l'organe, jamais d'insert direct.
    let initiatives = 0;
    for (const shop of shops) {
      ctx.createEventInitiative(
        {
          type: 'degustation',
          sourceKind: 'merchant',
          sourceId: shop.store.id,
          storeId: shop.store.id,
          title: `Dégustation chez ${shop.store.name}`,
          summary: 'Un moment convivial à partager au comptoir.',
          startsAt: '2026-09-15 18:00',
          address: shop.store.address,
          capacity: 12,
        },
        { publish: true }
      );
      initiatives += 1;
    }

    ctx.createEventInitiative(
      {
        type: 'lanterne',
        sourceKind: 'admin',
        title: 'Lanterne du vieux lavoir',
        summary: 'Un secret du quartier à découvrir.',
        geoPrecision: 'approx',
      }
    );
    initiatives += 1;

    // ── Mode Réception des habitants (audience des Opportunités Volantes) ──────
    for (const citizen of citizens) {
      ctx.setModeReception(citizen.id, [
        { channel: 'gastronomie' },
        { channel: 'vie_de_quartier' },
        { channel: 'lanternes' },
      ]);
    }

    return {
      residents: citizens.length,
      merchants: shops.length,
      drivers: couriers.length,
      products: shops.reduce((n, s) => n + s.products.length, 0),
      favorites,
      walletObjects,
      initiatives,
    };
  },
});

function clamp(n, min, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.floor(v)));
}
