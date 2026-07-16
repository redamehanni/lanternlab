/**
 * Adaptateur Marketplace — traduit l'état des commandes en cartes de briefing.
 *
 * Pur : ne fait AUCUN appel réseau. Il reçoit le contexte déjà chargé par le
 * Cockpit et renvoie des cartes. La logique métier des commandes vit dans
 * l'organe Orders — ici on ne fait que présenter.
 */

const TERMINAL = ['delivered', 'cancelled'];

export default {
  id: 'marketplace',
  build(ctx = {}) {
    const orders = ctx.orders || [];
    const pending = orders.filter((o) => !TERMINAL.includes(o.status));
    if (pending.length === 0) return [];

    return [
      {
        id: 'mp-pending',
        section: 'priority',
        moduleId: 'orders',
        icon: 'receipt',
        tone: pending.length >= 5 ? 'error' : 'warning',
        title: `${pending.length} commande${pending.length > 1 ? 's' : ''} à suivre`,
        subtitle: 'Commandes en cours de traitement',
        value: String(pending.length),
        route: 'MerchantOrders',
        priority: 90,
      },
    ];
  },
};
