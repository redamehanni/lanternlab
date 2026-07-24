import { NativeModules, Platform } from 'react-native';

const SERVER_PORT = '4000';

/**
 * Hôte du backend en local — sans IP à hardcoder.
 *
 * Ordre de résolution :
 *  1. EXPO_PUBLIC_API_URL (mobile/.env ou export shell)
 *  2. Hôte de Metro (script bundle) → même machine que le packager, port 4000
 *     Crucial sur iOS Simulator / Expo Go quand Metro est en LAN (iOS 26+)
 *     et que `localhost` ne pointe plus vers le Mac.
 *  3. Android emulator → 10.0.2.2
 *  4. iOS / web → 127.0.0.1 (évite les soucis IPv6 de `localhost`)
 */
function hostFromMetro() {
  try {
    const scriptURL = NativeModules?.SourceCode?.scriptURL;
    if (!scriptURL || typeof scriptURL !== 'string') return null;
    const match = scriptURL.match(/https?:\/\/([^/:]+)(?::\d+)?/);
    const host = match?.[1];
    if (!host) return null;
    if (host === 'localhost' || host === '127.0.0.1') return null;
    return host;
  } catch {
    return null;
  }
}

function getServerHost() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }

  const metroHost = hostFromMetro();
  if (metroHost) {
    return `http://${metroHost}:${SERVER_PORT}`;
  }

  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${SERVER_PORT}`;
  }

  return `http://127.0.0.1:${SERVER_PORT}`;
}

export const API_URL = getServerHost();
export const SOCKET_URL = getServerHost();

if (__DEV__) {
  // Visible dans la console Metro / Xcode : utile pour diagnostiquer login/register.
  console.log(`[MaZone] API_URL = ${API_URL}`);
}

export const COLORS = {
  primary:      '#0f2d5c',
  secondary:    '#1a4a8a',
  success:      '#059669',
  warning:      '#f59e0b',
  error:        '#ef4444',
  bg:           '#f0f2f5',
  card:         '#ffffff',
  text:         '#0a0a0a',
  textLight:    '#6b7280',
  border:       '#e5e7eb',
  inputBg:      '#f9fafb',
};

export const ORDER_STATUS_LABEL = {
  placed:           'Commande passée',
  pending_driver:   'En attente de livreur',
  driver_assigned:  'Livreur assigné',
  picking_up:       'En route vers le commerce',
  picked_up:        'Produit récupéré',
  delivering:       'En route vers vous',
  delivered:        'Livré',
  cancelled:        'Annulée',
  pending:          'En attente de livreur',
  accepted:         'Livreur assigné',
  searching_driver: 'En attente de livreur',
  accepted_by_driver: 'Livreur assigné',
  offered:          'En attente de livreur',
};

export const CANCELLABLE_ORDER_STATUSES = [
  'placed', 'pending_driver', 'driver_assigned', 'picking_up',
  'pending', 'accepted', 'searching_driver', 'accepted_by_driver', 'offered',
];

export const MISSION_STATUS_LABEL = {
  available:    'Disponible',
  accepted:     'Acceptée',
  picking_up:   'En route vers commerce',
  picked_up:    'Produit récupéré',
  delivering:   'En route vers client',
  delivered:    'Livré',
};

// Moyens de transport livreur (issue #5 : "À pied" retiré, "Vélo cargo" ajouté)
export const TRANSPORT_OPTIONS = ['Vélo', 'Vélo cargo', 'Scooter', 'Voiture'];

// Catégories produits (issue #10)
export const PRODUCT_CATEGORIES = [
  'Alimentation', 'Électronique', 'Jeux vidéo', 'Livres', 'Maison',
  'Bricolage', 'Sport', 'Beauté', 'Animaux', 'Autres',
];

// Natures de commerce (issue #11)
export const STORE_CATEGORIES = [
  'Artisan', 'Boutique spécialisée', 'Supermarché', 'Librairie', 'Épicerie',
  'Informatique', 'Jeux vidéo', 'Sport', 'Autre',
];
