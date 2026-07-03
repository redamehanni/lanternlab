/** Position de référence du consommateur (zone pilote, centre de Paris). */
export const USER_LOCATION = { lat: 48.8584, lng: 2.347 };

/** Distance à vol d'oiseau en kilomètres (formule de Haversine). */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/**
 * Estimation du temps de livraison : préparation fixe + trajet à ~15 km/h
 * (vélo en ville), arrondi à 5 min près. Volontairement simple pour le MVP.
 */
export function estimateDeliveryMinutes(km: number): number {
  const minutes = 8 + (km / 15) * 60;
  return Math.max(10, Math.round(minutes / 5) * 5);
}
