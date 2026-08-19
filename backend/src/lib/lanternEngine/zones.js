/**
 * Résolution de zones GPS génériques (cercle / arrondissement approx).
 * Vérité serveur : le client propose lat/lng, le moteur résout les zones.
 */

const { distanceKm } = require('../geo');

/**
 * Centres approximatifs des arrondissements parisiens (E0 tests terrain).
 * Suffisant pour golden tests ; polygones précis = évolution ultérieure.
 */
const PARIS_ARRONDISSEMENT_CENTERS = {
  1: { lat: 48.8606, lng: 2.3376, radiusM: 700 },
  2: { lat: 48.8698, lng: 2.3412, radiusM: 600 },
  3: { lat: 48.8637, lng: 2.3615, radiusM: 700 },
  4: { lat: 48.8546, lng: 2.357, radiusM: 700 },
  5: { lat: 48.8448, lng: 2.3471, radiusM: 900 },
  6: { lat: 48.8493, lng: 2.33, radiusM: 800 },
  7: { lat: 48.8566, lng: 2.3122, radiusM: 1100 },
  8: { lat: 48.876, lng: 2.311, radiusM: 1100 },
  9: { lat: 48.8766, lng: 2.3376, radiusM: 800 },
  10: { lat: 48.8761, lng: 2.3614, radiusM: 900 },
  11: { lat: 48.8584, lng: 2.379, radiusM: 1100 },
  12: { lat: 48.8412, lng: 2.3876, radiusM: 1400 },
  13: { lat: 48.8322, lng: 2.3561, radiusM: 1400 },
  14: { lat: 48.833, lng: 2.3266, radiusM: 1200 },
  15: { lat: 48.8422, lng: 2.2926, radiusM: 1500 },
  16: { lat: 48.8637, lng: 2.2769, radiusM: 1600 },
  17: { lat: 48.8845, lng: 2.3219, radiusM: 1300 },
  18: { lat: 48.8925, lng: 2.3444, radiusM: 1200 },
  19: { lat: 48.8822, lng: 2.3822, radiusM: 1300 },
  20: { lat: 48.8638, lng: 2.3984, radiusM: 1200 },
};

function pointInCircle(lat, lng, centerLat, centerLng, radiusM) {
  const km = distanceKm(lat, lng, centerLat, centerLng);
  if (km == null) return false;
  return km * 1000 <= radiusM;
}

/**
 * Point-in-polygon ray casting (lng/lat pairs).
 */
function pointInPolygon(lat, lng, coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 3) return false;
  let inside = false;
  for (let i = 0, j = coordinates.length - 1; i < coordinates.length; j = i++) {
    const [lngi, lati] = coordinates[i];
    const [lngj, latj] = coordinates[j];
    const intersect =
      lati > lat !== latj > lat &&
      lng < ((lngj - lngi) * (lat - lati)) / (latj - lati + 0.0) + lngi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function isInsideZone(zone, lat, lng) {
  if (lat == null || lng == null || !zone) return false;
  if (zone.kind === 'circle') {
    return pointInCircle(lat, lng, zone.center.lat, zone.center.lng, zone.radiusM);
  }
  if (zone.kind === 'polygon') {
    return pointInPolygon(lat, lng, zone.coordinates);
  }
  if (zone.kind === 'arrondissement') {
    const code = Number(zone.code ?? zone.arrondissement);
    const approx = PARIS_ARRONDISSEMENT_CENTERS[code];
    if (!approx) return false;
    return pointInCircle(lat, lng, approx.lat, approx.lng, approx.radiusM);
  }
  return false;
}

/**
 * @param {object[]} zones — GeoZone[] de la Definition
 * @param {number} lat
 * @param {number} lng
 * @returns {string[]} ids de zones contenant le point
 */
function resolveZones(zones, lat, lng) {
  if (!Array.isArray(zones) || lat == null || lng == null) return [];
  return zones.filter((z) => isInsideZone(z, lat, lng)).map((z) => z.id);
}

module.exports = {
  PARIS_ARRONDISSEMENT_CENTERS,
  pointInCircle,
  pointInPolygon,
  isInsideZone,
  resolveZones,
};
