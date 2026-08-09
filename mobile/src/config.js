import { Platform } from 'react-native';

const SERVER_PORT = '4000';

/**
 * Hôte backend local.
 *
 * iOS Simulator (Xcode) → toujours 127.0.0.1 (évite les IP Wi‑Fi périmées
 * qui cassaient login / « Devenir X » / restauration de session au reload).
 */
function getServerHost() {
  if (Platform.OS === 'ios') {
    return `http://127.0.0.1:${SERVER_PORT}`;
  }

  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }

  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${SERVER_PORT}`;
  }

  return `http://127.0.0.1:${SERVER_PORT}`;
}

export const API_URL = getServerHost();
export const SOCKET_URL = getServerHost();

/**
 * Bascule vers l'API v1, écran par écran.
 */
export const FEATURES = {
  stockV1: process.env.EXPO_PUBLIC_V1_STOCK === '1',
};

if (__DEV__) {
  const enabled = Object.entries(FEATURES).filter(([, on]) => on).map(([name]) => name);
  console.log(`[MaZone] API v1 : ${enabled.length ? enabled.join(', ') : 'aucun écran basculé'}`);
}

if (__DEV__) {
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

export const TRANSPORT_OPTIONS = ['Vélo', 'Vélo cargo', 'Scooter', 'Voiture'];

export const PRODUCT_CATEGORIES = [
  'Alimentation', 'Électronique', 'Jeux vidéo', 'Livres', 'Maison',
  'Bricolage', 'Sport', 'Beauté', 'Animaux', 'Autres',
];

export const STORE_CATEGORIES = [
  'Artisan', 'Boutique spécialisée', 'Supermarché', 'Librairie', 'Épicerie',
  'Informatique', 'Jeux vidéo', 'Sport', 'Autre',
];
