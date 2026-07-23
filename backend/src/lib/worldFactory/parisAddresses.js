/**
 * World Factory — Catalogue d'adresses parisiennes réelles.
 *
 * Source de géographie pour peupler le monde simulé : chaque acteur et chaque
 * initiative reçoit une adresse + coordonnées (lat/lng) tirées de ce catalogue.
 * Les distances (Opportunités Volantes, livraisons…) s'appuient ensuite sur
 * `geo.distanceKm` — plus de positions synthétiques autour de 48.8566.
 *
 * Les coordonnées sont approximatives (centre de rue / place) : suffisantes pour
 * un simulateur crédible, sans prétendre à un géocodeur officiel.
 */

const PARIS_ADDRESSES = [
  // Centre / Louvres / Marais
  { address: '10 rue de Rivoli, 75001 Paris', lat: 48.8606, lng: 2.3376, arr: 1 },
  { address: '15 place Vendôme, 75001 Paris', lat: 48.8674, lng: 2.3295, arr: 1 },
  { address: '8 rue Saint-Honoré, 75001 Paris', lat: 48.8632, lng: 2.3321, arr: 1 },
  { address: '22 rue des Archives, 75004 Paris', lat: 48.8592, lng: 2.3558, arr: 4 },
  { address: '5 place des Vosges, 75004 Paris', lat: 48.8556, lng: 2.3655, arr: 4 },
  { address: '12 rue Vieille du Temple, 75004 Paris', lat: 48.8589, lng: 2.3612, arr: 4 },
  // Latin / Saint-Germain
  { address: '27 rue Mouffetard, 75005 Paris', lat: 48.8421, lng: 2.3496, arr: 5 },
  { address: '14 rue Soufflot, 75005 Paris', lat: 48.8462, lng: 2.3431, arr: 5 },
  { address: '45 boulevard Saint-Germain, 75005 Paris', lat: 48.8495, lng: 2.3468, arr: 5 },
  { address: '6 place Saint-Sulpice, 75006 Paris', lat: 48.8508, lng: 2.3345, arr: 6 },
  { address: '19 rue de Seine, 75006 Paris', lat: 48.8551, lng: 2.3372, arr: 6 },
  { address: '3 rue Bonaparte, 75006 Paris', lat: 48.8564, lng: 2.3351, arr: 6 },
  // 7e / 8e / 9e
  { address: '9 rue Cler, 75007 Paris', lat: 48.8565, lng: 2.3072, arr: 7 },
  { address: '28 avenue de Breteuil, 75007 Paris', lat: 48.8478, lng: 2.3115, arr: 7 },
  { address: '16 rue du Faubourg Saint-Honoré, 75008 Paris', lat: 48.8708, lng: 2.3186, arr: 8 },
  { address: '21 avenue Montaigne, 75008 Paris', lat: 48.8663, lng: 2.3048, arr: 8 },
  { address: '7 place de la Madeleine, 75008 Paris', lat: 48.8702, lng: 2.3248, arr: 8 },
  { address: '32 rue des Martyrs, 75009 Paris', lat: 48.8789, lng: 2.3395, arr: 9 },
  { address: '11 boulevard Haussmann, 75009 Paris', lat: 48.8738, lng: 2.3325, arr: 9 },
  // Bastille / Oberkampf / Belleville
  { address: '18 rue de la Roquette, 75011 Paris', lat: 48.8548, lng: 2.3732, arr: 11 },
  { address: '54 rue Oberkampf, 75011 Paris', lat: 48.8642, lng: 2.3785, arr: 11 },
  { address: '9 boulevard Voltaire, 75011 Paris', lat: 48.8576, lng: 2.3761, arr: 11 },
  { address: '25 rue de Belleville, 75019 Paris', lat: 48.8735, lng: 2.3802, arr: 19 },
  { address: '40 avenue Simon Bolivar, 75019 Paris', lat: 48.8768, lng: 2.3845, arr: 19 },
  // 12e / 13e / 14e / 15e
  { address: '8 rue du Faubourg Saint-Antoine, 75012 Paris', lat: 48.8512, lng: 2.3768, arr: 12 },
  { address: '15 avenue Daumesnil, 75012 Paris', lat: 48.8455, lng: 2.3862, arr: 12 },
  { address: '30 avenue des Gobelins, 75013 Paris', lat: 48.8348, lng: 2.3535, arr: 13 },
  { address: '12 place d\'Italie, 75013 Paris', lat: 48.8312, lng: 2.3556, arr: 13 },
  { address: '20 avenue du Général Leclerc, 75014 Paris', lat: 48.8325, lng: 2.3258, arr: 14 },
  { address: '7 rue Daguerre, 75014 Paris', lat: 48.8341, lng: 2.3289, arr: 14 },
  { address: '45 rue de Vaugirard, 75015 Paris', lat: 48.8428, lng: 2.3105, arr: 15 },
  { address: '18 rue du Commerce, 75015 Paris', lat: 48.8465, lng: 2.2948, arr: 15 },
  // 16e / 17e / 18e
  { address: '24 avenue Victor Hugo, 75016 Paris', lat: 48.8702, lng: 2.2856, arr: 16 },
  { address: '10 rue de Passy, 75016 Paris', lat: 48.8575, lng: 2.2802, arr: 16 },
  { address: '35 avenue des Ternes, 75017 Paris', lat: 48.8782, lng: 2.2958, arr: 17 },
  { address: '14 rue des Batignolles, 75017 Paris', lat: 48.8856, lng: 2.3215, arr: 17 },
  { address: '8 place du Tertre, 75018 Paris', lat: 48.8865, lng: 2.3408, arr: 18 },
  { address: '22 rue Lepic, 75018 Paris', lat: 48.8862, lng: 2.3355, arr: 18 },
  { address: '5 boulevard de Clichy, 75018 Paris', lat: 48.8835, lng: 2.3332, arr: 18 },
  // 2e / 3e / 10e
  { address: '16 rue Montorgueil, 75002 Paris', lat: 48.8658, lng: 2.3465, arr: 2 },
  { address: '9 rue Réaumur, 75002 Paris', lat: 48.8672, lng: 2.3508, arr: 2 },
  { address: '28 rue de Turbigo, 75003 Paris', lat: 48.8645, lng: 2.3582, arr: 3 },
  { address: '11 rue de Bretagne, 75003 Paris', lat: 48.8628, lng: 2.3625, arr: 3 },
  { address: '20 rue du Faubourg Saint-Denis, 75010 Paris', lat: 48.8715, lng: 2.3542, arr: 10 },
  { address: '6 place de la République, 75010 Paris', lat: 48.8675, lng: 2.3638, arr: 10 },
  { address: '33 canal Saint-Martin, 75010 Paris', lat: 48.8718, lng: 2.3655, arr: 10 },
];

/**
 * Tire une adresse au hasard. `exclude` = Set d'adresses déjà prises (évite
 * les doublons trop visibles dans un petit batch).
 */
function pickParisAddress(exclude = null) {
  const pool = exclude
    ? PARIS_ADDRESSES.filter((a) => !exclude.has(a.address))
    : PARIS_ADDRESSES;
  const source = pool.length ? pool : PARIS_ADDRESSES;
  const picked = source[Math.floor(Math.random() * source.length)];
  if (exclude) exclude.add(picked.address);
  return { ...picked };
}

/** Nombre d'adresses disponibles (introspection Lab / tests). */
function parisAddressCount() {
  return PARIS_ADDRESSES.length;
}

module.exports = {
  PARIS_ADDRESSES,
  pickParisAddress,
  parisAddressCount,
};
