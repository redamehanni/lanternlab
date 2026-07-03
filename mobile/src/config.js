import { Platform } from 'react-native';

const SERVER_PORT = '4000';

/**
 * URL du backend en local — aucune IP à configurer.
 *
 * - iOS Simulator / Web : localhost
 * - Android Emulator  : 10.0.2.2 (localhost de votre Mac vu depuis l'émulateur)
 *
 * Pour un téléphone physique plus tard, définissez EXPO_PUBLIC_API_URL dans mobile/.env
 */
function getServerHost() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }

  const host = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
  return `http://${host}:${SERVER_PORT}`;
}

export const API_URL = getServerHost();
export const SOCKET_URL = getServerHost();

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
  'pending', 'accepted', 'searching_driver', 'accepted_by_driver',
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
