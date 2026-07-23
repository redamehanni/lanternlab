/**
 * Recette — Monde événementiel (simulateur de la Deuxième Âme).
 *
 * Objectif : peupler RAPIDEMENT le quartier d'une grande VARIÉTÉ d'initiatives
 * afin de tester tous les parcours de la Deuxième Âme — les 6 portes, les
 * Murmures, les Opportunités Volantes, les écrans de détail, la billetterie
 * (gratuite et payante), les Lanternes / QR Codes, les jauges de places.
 *
 * Principe cardinal : ORCHESTRER, jamais réimplémenter. Chaque initiative naît
 * via l'organe Event Engine (`ctx.createEventInitiative`), chaque abonnement via
 * `ctx.setModeReception`. Aucune règle métier ni insert direct ici.
 *
 * Chaque « scénario » d'initiative est déclaratif : ajouter un cas de test =
 * ajouter une entrée dans SCENARIOS, sans toucher au moteur d'exécution.
 */

const { defineRecipe } = require('../recipeRegistry');
const { pickParisAddress } = require('../parisAddresses');

const DEFAULTS = { citizens: 4, merchants: 3 };

const STORE_TEMPLATES = [
  { merchant: { name: 'Claire Boulanger', emailPrefix: 'evt.claire' }, store: { name: 'Boulangerie Lumière', category: 'boulangerie', address: '12 place du Marché' } },
  { merchant: { name: 'Karim Épicier', emailPrefix: 'evt.karim' }, store: { name: "Épicerie du coin", category: 'epicerie', address: '3 rue des Lilas' } },
  { merchant: { name: 'Inès Café', emailPrefix: 'evt.ines' }, store: { name: 'Café des Habitants', category: 'cafe', address: '8 avenue Centrale' } },
];

const FIRST_NAMES = ['Marie', 'Lucas', 'Sofia', 'Thomas', 'Léa', 'Hugo', 'Emma', 'Noah'];
const LAST_NAMES = ['Dupont', 'Martin', 'Bernard', 'Petit', 'Robert', 'Richard', 'Durand', 'Moreau'];

/**
 * Catalogue déclaratif des scénarios d'initiatives commerçantes. `reservation`
 * suit le modèle générique de l'Event Engine (payload.reservation).
 */
const MERCHANT_SCENARIOS = [
  {
    type: 'atelier',
    title: (s) => `Atelier ouvert chez ${s.name}`,
    summary: 'Participation libre, sans réservation — venez comme vous êtes.',
    channels: ['vie_de_quartier', 'culture'],
    startsAt: '2026-09-12 18:00',
    reservation: { mode: 'open' },
    publish: true,
  },
  {
    type: 'atelier',
    title: (s) => `Atelier gratuit sur réservation — ${s.name}`,
    summary: 'Places limitées, billet gratuit à réserver.',
    channels: ['vie_de_quartier', 'famille'],
    startsAt: '2026-09-14 10:30',
    capacity: 8,
    reservation: { mode: 'ticket', price: 0, currency: 'EUR' },
    publish: true,
  },
  {
    type: 'atelier',
    title: (s) => `Atelier payant — ${s.name}`,
    summary: 'Places limitées, billet payant.',
    channels: ['culture', 'createurs'],
    startsAt: '2026-09-19 19:00',
    capacity: 15,
    reservation: { mode: 'ticket', price: 12, currency: 'EUR' },
    publish: true,
  },
  {
    type: 'degustation',
    title: (s) => `Dégustation chez ${s.name}`,
    summary: 'Un moment convivial à partager au comptoir.',
    channels: ['gastronomie', 'commerces'],
    startsAt: '2026-09-15 18:00',
    capacity: 12,
    reservation: { mode: 'ticket', price: 5, currency: 'EUR' },
    publish: true,
  },
  {
    type: 'promo',
    title: (s) => `Offre du moment — ${s.name}`,
    summary: '-15% sur une sélection cette semaine.',
    channels: ['commerces'],
    endsAt: '2026-09-30',
    reservation: { mode: 'open' },
    publish: true,
  },
];

/** Lanternes curées (cycle de vie spécialisé : hidden → active). */
const LANTERNE_SCENARIOS = [
  { title: 'Lanterne du vieux lavoir', summary: 'Un secret du quartier à découvrir.' },
  { title: 'Lanterne de la fresque oubliée', summary: 'Derrière le marché, une histoire attend.' },
];

defineRecipe({
  id: 'monde_evenementiel',
  label: 'Monde événementiel',
  description:
    'Peuple le quartier parisien (vraies adresses) d\'une grande variété d\'initiatives ' +
    '(ateliers ouverts, gratuits et payants sur réservation, dégustations, promotions, Lanternes) ' +
    'pour tester toute la Deuxième Âme : portes, Murmures, billetterie, QR Codes, ' +
    'Opportunités Volantes géolocalisées. Habitants abonnés au Mode Réception.',
  params: {
    citizens: { type: 'number', default: DEFAULTS.citizens, min: 1, max: 30 },
    merchants: { type: 'number', default: DEFAULTS.merchants, min: 1, max: STORE_TEMPLATES.length },
  },
  run(ctx, params = {}) {
    const citizensN = clamp(params.citizens ?? DEFAULTS.citizens, 1, 30);
    const merchantsN = clamp(params.merchants ?? DEFAULTS.merchants, 1, STORE_TEMPLATES.length);
    const stamp = Date.now().toString(36);
    const used = new Set();

    // ── Habitants abonnés (audience des Opportunités Volantes) ────────────────
    const citizens = [];
    for (let i = 0; i < citizensN; i++) {
      const first = FIRST_NAMES[i % FIRST_NAMES.length];
      const last = LAST_NAMES[i % LAST_NAMES.length];
      const place = pickParisAddress(used);
      const c = ctx.createCitizen({
        name: `${first} ${last}`,
        email: `demo.evt.${first.toLowerCase()}.${i}.${stamp}@mazone.demo`,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
      });
      // Large écoute pour capter toutes les diffusions de test.
      ctx.setModeReception(c.id, [
        { channel: 'vie_de_quartier' },
        { channel: 'culture' },
        { channel: 'gastronomie' },
        { channel: 'commerces' },
        { channel: 'famille' },
        { channel: 'createurs' },
        { channel: 'lanternes' },
        { channel: 'opportunites_rares' },
      ]);
      citizens.push(c);
    }

    // ── Commerçants + boutiques + variété d'initiatives (géolocalisés) ────────
    const shops = [];
    let initiatives = 0;
    for (let i = 0; i < merchantsN; i++) {
      const tpl = STORE_TEMPLATES[i];
      const place = pickParisAddress(used);
      const { store } = ctx.createMerchantWithStore(
        {
          name: tpl.merchant.name,
          email: `demo.${tpl.merchant.emailPrefix}.${stamp}@mazone.demo`,
          address: place.address,
          lat: place.lat,
          lng: place.lng,
        },
        { ...tpl.store, address: place.address, lat: place.lat, lng: place.lng }
      );
      shops.push(store);

      for (const sc of MERCHANT_SCENARIOS) {
        ctx.createEventInitiative(
          {
            type: sc.type,
            sourceKind: 'merchant',
            sourceId: store.id,
            storeId: store.id,
            title: typeof sc.title === 'function' ? sc.title(store) : sc.title,
            summary: sc.summary,
            channels: sc.channels,
            startsAt: sc.startsAt || null,
            endsAt: sc.endsAt || null,
            address: store.address,
            lat: store.lat,
            lng: store.lng,
            capacity: sc.capacity ?? null,
            payload: sc.reservation ? { reservation: sc.reservation } : null,
          },
          { publish: !!sc.publish }
        );
        initiatives += 1;
      }
    }

    // ── Lanternes curées : créées cachées puis activées (découvrables) ────────
    for (const l of LANTERNE_SCENARIOS) {
      const place = pickParisAddress(used);
      const lantern = ctx.createEventInitiative({
        type: 'lanterne',
        sourceKind: 'admin',
        title: l.title,
        summary: l.summary,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
        geoPrecision: 'approx',
      });
      ctx.transitionEventInitiative(lantern.id, 'active');
      initiatives += 1;
    }

    return {
      citizens: citizens.length,
      merchants: shops.length,
      initiatives,
      scenariosParMerchant: MERCHANT_SCENARIOS.length,
      lanternes: LANTERNE_SCENARIOS.length,
    };
  },
});

function clamp(n, min, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.floor(v)));
}
