// Distance Haversine en km
function distanceKm(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Estime le temps de livraison total en minutes.
 * Prend en compte : livreur → commerce → client.
 * Vitesse moyenne urbaine ~18 km/h + temps de préparation/récupération.
 */
function estimateDeliveryMinutes({ driverLat, driverLng, storeLat, storeLng, clientLat, clientLng }) {
  const PREP_MIN = 8;           // préparation de la commande
  const PICKUP_MIN = 4;         // récupération en boutique
  const SPEED_KMH = 18;         // vitesse moyenne urbaine

  let legDriverStore = distanceKm(driverLat, driverLng, storeLat, storeLng);
  let legStoreClient = distanceKm(storeLat, storeLng, clientLat, clientLng);

  // Valeurs par défaut si coordonnées manquantes (démo réaliste)
  if (legDriverStore == null) legDriverStore = 1.8;
  if (legStoreClient == null) legStoreClient = 2.5;

  const travelMin = ((legDriverStore + legStoreClient) / SPEED_KMH) * 60;
  return Math.max(12, Math.round(PREP_MIN + PICKUP_MIN + travelMin));
}

// Formate des minutes en "25 min" ou "1h05"
function formatMinutes(min) {
  if (min == null) return null;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
}

module.exports = { distanceKm, estimateDeliveryMinutes, formatMinutes };
