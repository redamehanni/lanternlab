/**
 * Langage iconographique — Deuxième Âme.
 *
 * Un seul studio : outlines doux, puits pastel, jamais de mélange de styles.
 * Les icônes Ionicons sont filtrées via ce dictionnaire sémantique pour
 * garantir la cohérence avec les illustrations aquarelle.
 *
 * Usage : resolveAmeIcon('mailbox') → { set, name }
 *         SoftIcon name="mailbox" …
 */
export const AME_ICONS = {
  // Navigation / âme
  home: { set: 'ion', name: 'home-outline', active: 'home' },
  messages: { set: 'ion', name: 'chatbubbles-outline', active: 'chatbubbles' },
  wallet: { set: 'ion', name: 'wallet-outline', active: 'wallet' },
  cart: { set: 'ion', name: 'cart-outline', active: 'cart' },
  planet: { set: 'ion', name: 'planet-outline', active: 'planet' },
  storefront: { set: 'ion', name: 'storefront-outline', active: 'storefront' },

  // Header / réception
  mailbox: { set: 'mci', name: 'mailbox-outline', active: 'mailbox-up' },
  profile: { set: 'ion', name: 'person-outline', active: 'person' },
  sparkle: { set: 'ion', name: 'sparkles-outline', active: 'sparkles' },

  // Portes (fallback si illustration absente)
  lantern: { set: 'ion', name: 'flashlight-outline' },
  calendar: { set: 'ion', name: 'calendar-outline' },
  people: { set: 'ion', name: 'people-outline' },
  compass: { set: 'ion', name: 'compass-outline' },
  heart: { set: 'ion', name: 'heart-outline', active: 'heart' },
  wand: { set: 'ion', name: 'color-wand-outline' },

  // UI
  chevronRight: { set: 'ion', name: 'chevron-forward' },
  chevronDown: { set: 'ion', name: 'chevron-down' },
  arrowRight: { set: 'ion', name: 'arrow-forward' },
  arrowUp: { set: 'ion', name: 'arrow-up' },
  close: { set: 'ion', name: 'close' },
  location: { set: 'ion', name: 'location-outline' },
  time: { set: 'ion', name: 'time-outline' },
  flash: { set: 'ion', name: 'flash-outline', active: 'flash' },
  mailOpen: { set: 'ion', name: 'mail-open-outline' },
  ticket: { set: 'ion', name: 'ticket-outline' },
  add: { set: 'ion', name: 'add' },
};

export function resolveAmeIcon(key, { active = false } = {}) {
  const entry = AME_ICONS[key];
  if (!entry) {
    return { set: 'ion', name: 'ellipse-outline' };
  }
  return {
    set: entry.set,
    name: active && entry.active ? entry.active : entry.name,
  };
}

export default AME_ICONS;
