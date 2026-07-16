/**
 * Épée — Registre déclaratif des modules du poste de travail commerçant.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ PRINCIPE — L'Épée est une SURFACE, pas un organe.                         │
 * │                                                                          │
 * │ Ce registre ne contient AUCUNE logique métier. Il déclare seulement :    │
 * │   - les familles (regroupements visuels, renommables en un point),       │
 * │   - les modules (une tuile = un accès vers un écran d'organe existant).   │
 * │                                                                          │
 * │ Ajouter un futur organe (Événement, Marketing, Fidélité…) = déclarer un   │
 * │ module ici (`enabled: false` tant qu'il n'existe pas), sans jamais        │
 * │ toucher au Cockpit ni à la navigation.                                    │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

// Familles : ordre + libellé centralisés (renommer/réorganiser ici uniquement).
export const FAMILIES = [
  { id: 'vendre',  label: 'Vendre',  icon: 'pricetags-outline' },
  { id: 'animer',  label: 'Animer',  icon: 'megaphone-outline' },
  { id: 'reseau',  label: 'Réseau',  icon: 'people-outline' },
  { id: 'piloter', label: 'Piloter', icon: 'compass-outline' },
];

/**
 * Modules déclarés.
 *
 * - `route`       : écran de l'organe cible (dans EpeeStack). `null` = pas encore branché.
 * - `entitlement` : capacité requise (ex. 'store'). Absent = toujours accessible.
 * - `enabled`     : le module existe-t-il réellement dans l'app ?
 * - `comingSoon`  : affiché en « Bientôt » (organe futur, non branché).
 */
const MODULES = [
  // ── Vendre ──
  { id: 'catalog',    familyId: 'vendre',  label: 'Catalogue & stock', icon: 'cube-outline',     route: 'ManageStock',      entitlement: 'store', enabled: true },
  { id: 'orders',     familyId: 'vendre',  label: 'Commandes',         icon: 'receipt-outline',  route: 'MerchantOrders',   entitlement: 'store', enabled: true },

  // ── Animer ──
  { id: 'promotions', familyId: 'animer',  label: 'Promotions',        icon: 'pricetag-outline', route: 'ManagePromotions', entitlement: 'store', enabled: true },
  { id: 'events',     familyId: 'animer',  label: 'Événements',        icon: 'calendar-outline', route: null,               entitlement: 'store', enabled: false, comingSoon: true },
  { id: 'loyalty',    familyId: 'animer',  label: 'Fidélité',          icon: 'ribbon-outline',   route: null,               entitlement: 'store', enabled: false, comingSoon: true },

  // ── Réseau ──
  { id: 'clients',        familyId: 'reseau', label: 'Clients',        icon: 'people-outline',      route: 'MesClients',    entitlement: 'store', enabled: true },
  { id: 'messages',       familyId: 'reseau', label: 'Messages',       icon: 'chatbubbles-outline', route: 'MerchantInbox',                       enabled: true },
  { id: 'collaborations', familyId: 'reseau', label: 'Collaborations', icon: 'git-network-outline', route: null,            entitlement: 'store', enabled: false, comingSoon: true },

  // ── Piloter ──
  { id: 'store', familyId: 'piloter', label: 'Mon commerce',  icon: 'storefront-outline',  route: 'CreateStore',                        enabled: true },
  { id: 'stats', familyId: 'piloter', label: 'Statistiques',  icon: 'stats-chart-outline', route: 'MerchantStats', entitlement: 'store', enabled: true },
];

/** Un module est-il déverrouillé pour ce commerçant (capacités satisfaites) ? */
export function isUnlocked(module, entitlements = {}) {
  if (!module.entitlement) return true;
  return !!entitlements[module.entitlement];
}

/** Tous les modules réellement branchés (enabled). */
export function getEnabledModules() {
  return MODULES.filter((m) => m.enabled);
}

/** Modules déclarés mais à venir (affichés en « Bientôt »). */
export function getComingSoonModules() {
  return MODULES.filter((m) => m.comingSoon);
}

/**
 * Modules regroupés par famille, prêts pour l'affichage.
 * `includeComingSoon` : inclure les organes futurs (drawer) ou non (accès rapides).
 */
export function getModulesByFamily({ includeComingSoon = false } = {}) {
  return FAMILIES.map((family) => ({
    ...family,
    modules: MODULES.filter(
      (m) => m.familyId === family.id && (m.enabled || (includeComingSoon && m.comingSoon))
    ),
  })).filter((f) => f.modules.length > 0);
}

/** Retrouver un module par son id. */
export function getModule(id) {
  return MODULES.find((m) => m.id === id) || null;
}

export default {
  FAMILIES,
  isUnlocked,
  getEnabledModules,
  getComingSoonModules,
  getModulesByFamily,
  getModule,
};
