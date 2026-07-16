/**
 * Adaptateur Promotions — reflète l'animation commerciale en cours.
 * Pur : reçoit `ctx.promotions` (déjà chargées par le Cockpit).
 */
export default {
  id: 'promotions',
  build(ctx = {}) {
    const promos = ctx.promotions || [];

    if (promos.length === 0) {
      return [
        {
          id: 'promo-none',
          section: 'life',
          moduleId: 'promotions',
          icon: 'pricetag-outline',
          tone: 'neutral',
          title: 'Aucune promotion',
          subtitle: 'Lancez une offre pour animer votre commerce',
          route: 'ManagePromotions',
          priority: 20,
        },
      ];
    }

    return [
      {
        id: 'promo-active',
        section: 'life',
        moduleId: 'promotions',
        icon: 'pricetag',
        tone: 'success',
        title: `${promos.length} promotion${promos.length > 1 ? 's' : ''} en cours`,
        subtitle: 'Vos offres du moment',
        value: String(promos.length),
        route: 'ManagePromotions',
        priority: 30,
      },
    ];
  },
};
