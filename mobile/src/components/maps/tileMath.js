export const TILE = 256;
export const CARTO = 'https://a.basemaps.cartocdn.com/light_all';
export const MIN_ZOOM = 10;
export const MAX_ZOOM = 18;

export function clampZoom(z) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

export function lngLatToPoint(lng, lat, zoom) {
  const scale = TILE * 2 ** zoom;
  const x = ((lng + 180) / 360) * scale;
  const sin = Math.sin((lat * Math.PI) / 180);
  const y = ((0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale);
  return { x, y };
}

export function pointToLngLat(x, y, zoom) {
  const scale = TILE * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

export function panByPixels(dx, dy, centerLat, centerLng, zoom) {
  const cp = lngLatToPoint(centerLng, centerLat, zoom);
  return pointToLngLat(cp.x - dx, cp.y - dy, zoom);
}

export function lngToTileX(lng, zoom) {
  return Math.floor(((lng + 180) / 360) * 2 ** zoom);
}

export function latToTileY(lat, zoom) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom);
}

export function tileUrl(z, x, y) {
  return `${CARTO}/${z}/${x}/${y}.png`;
}

export function markerScreenPos(markerLat, markerLng, centerLat, centerLng, zoom, width, height) {
  const cp = lngLatToPoint(centerLng, centerLat, zoom);
  const mp = lngLatToPoint(markerLng, markerLat, zoom);
  return { left: width / 2 + (mp.x - cp.x), top: height / 2 + (mp.y - cp.y) };
}

/** Calcule position tuiles + marqueur dans le repère de la couche carte */
export function tileLayerLayout(centerLat, centerLng, markerLat, markerLng, intZoom, radius = 2) {
  const cx = lngToTileX(centerLng, intZoom);
  const cy = latToTileY(centerLat, intZoom);
  const centerPoint = lngLatToPoint(centerLng, centerLat, intZoom);
  const fracX = centerPoint.x - cx * TILE;
  const fracY = centerPoint.y - cy * TILE;
  const gridSize = radius * 2 + 1;
  const layerSize = gridSize * TILE;
  const translateX = layerSize / 2 - (radius * TILE + fracX);
  const translateY = layerSize / 2 - (radius * TILE + fracY);

  const mp = lngLatToPoint(markerLng, markerLat, intZoom);
  const mtx = lngToTileX(markerLng, intZoom);
  const mty = latToTileY(markerLat, intZoom);
  const markerX = (mtx - cx + radius) * TILE + (mp.x - mtx * TILE);
  const markerY = (mty - cy + radius) * TILE + (mp.y - mty * TILE);

  return { cx, cy, gridSize, layerSize, translateX, translateY, markerX, markerY };
}
