/**
 * Type d'événement — Dégustation (initiative commerçante, avec billetterie).
 *
 * Exemple emblématique du brief : un commerçant ouvre l'Épée et crée une
 * dégustation qui n'existerait jamais sans Ma Zone. Billetterie déléguée au
 * Wallet (capability canTicket → orchestration, jamais de logique billet ici).
 */

const { registerType } = require('../eventRegistry');

registerType({
  type: 'degustation',
  label: 'Dégustation',
  defaultChannels: ['gastronomie', 'commerces'],
  capabilities: {
    canTicket: true,
    hasCapacity: true,
    isFlyable: true,
  },
  requiredPayload: [],
  display(row) {
    return {
      title: row.title,
      subtitle: row.summary || 'Dégustation',
      category: 'gastronomie',
      when: row.starts_at || null,
      where: row.address || null,
    };
  },
});
