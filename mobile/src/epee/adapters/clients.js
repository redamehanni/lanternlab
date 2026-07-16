/**
 * Adaptateur Clients — présente l'affluence servie (agrégation d'affichage).
 * Pur : dérive le nombre de clients distincts des commandes déjà chargées.
 */
export default {
  id: 'clients',
  build(ctx = {}) {
    const orders = ctx.orders || [];
    const ids = new Set(orders.map((o) => o.client_id || o.client_name).filter(Boolean));
    if (ids.size === 0) return [];

    return [
      {
        id: 'clients-count',
        section: 'life',
        moduleId: 'clients',
        icon: 'people',
        tone: 'neutral',
        title: `${ids.size} client${ids.size > 1 ? 's' : ''} servi${ids.size > 1 ? 's' : ''}`,
        subtitle: 'Ont déjà commandé chez vous',
        value: String(ids.size),
        route: 'MesClients',
        priority: 15,
      },
    ];
  },
};
