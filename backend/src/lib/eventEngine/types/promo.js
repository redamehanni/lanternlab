/**
 * Type d'événement — Promotion (PROJECTION d'un organe existant).
 *
 * Une promo reste gérée par l'organe Promotions : sa logique métier ne bouge
 * pas. Ce type permet seulement de la PROJETER comme initiative visible dans la
 * Deuxième Âme, via le canal « commerces ». Le cœur ne recalcule aucune remise :
 * il porte un descripteur d'affichage et un lien `source_ref` vers la promo réelle.
 */

const { registerType } = require('../eventRegistry');

registerType({
  type: 'promo',
  label: 'Promotion',
  defaultChannels: ['commerces'],
  capabilities: {
    isFlyable: true,
  },
  requiredPayload: [],
  display(row) {
    return {
      title: row.title,
      subtitle: row.summary || 'Offre du moment',
      category: 'commerce',
      when: row.ends_at ? `Jusqu'au ${row.ends_at}` : null,
      where: row.address || null,
    };
  },
});
