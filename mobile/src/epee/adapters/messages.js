/**
 * Adaptateur Messages — traduit les non-lus (organe Communication) en carte.
 * Pur : le nombre de non-lus est fourni par le Cockpit via le contexte.
 */
export default {
  id: 'messages',
  build(ctx = {}) {
    const unread = ctx.unreadMessages || 0;
    if (unread <= 0) return [];

    return [
      {
        id: 'msg-unread',
        section: 'priority',
        moduleId: 'messages',
        icon: 'chatbubbles',
        tone: 'accent',
        title: `${unread} message${unread > 1 ? 's' : ''} non lu${unread > 1 ? 's' : ''}`,
        subtitle: 'Vos clients attendent une réponse',
        value: String(unread),
        route: 'MerchantInbox',
        priority: 80,
      },
    ];
  },
};
