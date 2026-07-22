/**
 * Type d'événement — Atelier / rencontre (initiative locale générique).
 *
 * Le type « générique » de référence : une initiative que n'importe quel
 * producteur (commerçant, association, artiste, citoyen…) peut créer pour faire
 * vivre le quartier. Participation déclarative OU sur réservation (places
 * limitées, gratuit ou payant), jauge optionnelle, éligible aux Opportunités
 * Volantes. Cycle de vie générique (brouillon → archivage).
 *
 * IMPORTANT — `canTicket` est une ÉLIGIBILITÉ de type (« ce type PEUT proposer
 * une billetterie »), pas une obligation. Le régime de réservation réel est un
 * choix d'INSTANCE porté par `payload.reservation` (voir orchestration.js). Ainsi
 * un même type couvre « ouvert à tous » et « places limitées » sans nouveau type.
 */

const { registerType } = require('../eventRegistry');

registerType({
  type: 'atelier',
  label: 'Atelier / rencontre',
  defaultChannels: ['vie_de_quartier', 'culture'],
  capabilities: {
    canRSVP: true,
    hasCapacity: true,
    canTicket: true,
    isFlyable: true,
  },
  requiredPayload: [],
  display(row) {
    return {
      title: row.title,
      subtitle: row.summary || null,
      category: 'atelier',
      when: row.starts_at || null,
      where: row.address || null,
    };
  },
});
