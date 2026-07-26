/**
 * Type d'événement — Annonce de boutique.
 *
 * Une information brève et datée qu'un commerçant adresse à son quartier :
 * « fermé aujourd'hui », « ouverture exceptionnelle dimanche », « livraison
 * suspendue ». Ce n'est ni une promotion ni un atelier — rien à réserver, rien à
 * gagner, juste un fait à faire savoir.
 *
 * Ajouté à l'étape 5 pour que l'intention `store.close_exceptionally` ait un support
 * de diffusion existant à orchestrer, au lieu d'inventer un canal parallèle.
 * Aucune capacité : une annonce ne rend rien possible, elle informe.
 */

const { registerType } = require('../eventRegistry');

registerType({
  type: 'annonce_boutique',
  label: 'Annonce de boutique',
  defaultChannels: ['commerces', 'vie_de_quartier'],
  capabilities: {
    // Diffusable en Opportunité Volante : une fermeture doit atteindre les
    // habitants qui s'apprêtaient à venir, pas attendre qu'ils consultent.
    isFlyable: true,
  },
  requiredPayload: [],
  display(row) {
    return {
      title: row.title,
      subtitle: row.summary || 'Information de votre commerçant',
      category: 'commerce',
      when: row.starts_at || null,
      where: row.address || null,
    };
  },
});
