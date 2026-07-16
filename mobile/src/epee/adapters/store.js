/**
 * Adaptateur Boutique — invite à compléter la vitrine si des champs manquent.
 * Pur : reçoit `ctx.store`. L'absence totale de boutique est gérée par le
 * Cockpit (état vide dédié), pas ici.
 */
export default {
  id: 'store',
  build(ctx = {}) {
    const store = ctx.store;
    if (!store) return [];

    const missing = [];
    if (!store.photo_url) missing.push('photo');
    if (!store.description) missing.push('description');
    if (store.lat == null || store.lng == null) missing.push('localisation');
    if (missing.length === 0) return [];

    return [
      {
        id: 'store-complete',
        section: 'life',
        moduleId: 'store',
        icon: 'storefront',
        tone: 'accent',
        title: 'Complétez votre vitrine',
        subtitle: `Il manque : ${missing.join(', ')}`,
        route: 'CreateStore',
        priority: 40,
      },
    ];
  },
};
