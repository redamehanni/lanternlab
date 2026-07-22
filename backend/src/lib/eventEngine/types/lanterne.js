/**
 * Type d'événement — Lanterne (découverte physique curatée).
 *
 * Une Lanterne est une initiative posée dans la ville (QR curé) qui se DÉCOUVRE
 * par un scan. Elle illustre la spécialisation du cycle de vie autorisée par le
 * registre : `hidden → active → discovered → retired`. La découverte (scan) est
 * vérifiée par l'Identity Engine et peut déclencher une récompense via le Wallet
 * — orchestration en Phase 4, jamais de logique scan/récompense ici.
 */

const { registerType } = require('../eventRegistry');

const LANTERNE_LIFECYCLE = {
  hidden: ['active', 'retired'],
  active: ['discovered', 'retired'],
  discovered: ['active', 'retired'], // re-découvrable (plusieurs habitants)
  retired: [],
};

registerType({
  type: 'lanterne',
  label: 'Lanterne',
  initialStatus: 'hidden',
  lifecycle: LANTERNE_LIFECYCLE,
  defaultChannels: ['lanternes', 'patrimoine'],
  capabilities: {
    isLantern: true,
    isMurmur: true,
  },
  requiredPayload: [],
  display(row) {
    return {
      title: row.title,
      subtitle: row.summary || 'Une lanterne à découvrir',
      category: 'lanterne',
      where: row.geo_precision === 'exact' ? row.address : null,
    };
  },
});

module.exports = { LANTERNE_LIFECYCLE };
