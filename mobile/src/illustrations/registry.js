/**
 * Registry d'illustrations — identité officielle Ma Zone.
 *
 * RÈGLE : les composants ne dépendent JAMAIS d'une image en dur.
 * Ils appellent getIllustration(key) et reçoivent { source, alt, placeholder }.
 * Remplacer une illustration officielle = changer le fichier + une ligne ici.
 */

const ILLUSTRATIONS = {
  'background.papierOrange': {
    source: require('../../assets/illustrations/backgrounds/papier-orange.png'),
    alt: 'Papier aquarelle, feuillage très léger',
    placeholder: false,
  },

  'banner.quartier': {
    source: require('../../assets/illustrations/banner/quartier.jpg'),
    alt: 'Café des Batignolles au crépuscule',
    placeholder: false,
  },
  'banner.quartierSoft': {
    source: require('../../assets/illustrations/banner/quartier-soft.png'),
    alt: 'Ambiance quartier',
    placeholder: true,
  },

  'portes.lanternes': {
    source: require('../../assets/illustrations/portes/lanternes.png'),
    alt: 'Lanterne du quartier',
    placeholder: false,
  },
  'portes.evenements': {
    source: require('../../assets/illustrations/portes/evenements.png'),
    alt: 'Agenda du quartier',
    placeholder: false,
  },
  'portes.participer': {
    source: require('../../assets/illustrations/portes/participer.png'),
    alt: 'Habitants qui se rencontrent',
    placeholder: false,
  },
  'portes.quartier': {
    source: require('../../assets/illustrations/portes/quartier.png'),
    alt: 'Carte du quartier',
    placeholder: false,
  },
  'portes.adresses': {
    source: require('../../assets/illustrations/portes/adresses.png'),
    alt: 'Adresse préférée',
    placeholder: false,
  },
  'portes.surprise': {
    source: require('../../assets/illustrations/portes/surprise.png'),
    alt: 'Surprise du quartier',
    placeholder: false,
  },

  'murmures.default': {
    source: require('../../assets/illustrations/murmures/default.png'),
    alt: 'Murmure du quartier',
    placeholder: true,
  },

  'header.mailbox': {
    source: require('../../assets/illustrations/header/mailbox.png'),
    alt: 'Boîte aux lettres',
    placeholder: true,
  },

  'nav.accueil': {
    source: require('../../assets/illustrations/nav/accueil.png'),
    alt: 'Accueil',
    placeholder: true,
  },
  'nav.messages': {
    source: require('../../assets/illustrations/nav/messages.png'),
    alt: 'Messages',
    placeholder: true,
  },
  'nav.wallet': {
    source: require('../../assets/illustrations/nav/wallet.png'),
    alt: 'Wallet',
    placeholder: true,
  },
  'nav.panier': {
    source: require('../../assets/illustrations/nav/panier.png'),
    alt: 'Panier',
    placeholder: true,
  },
};

export function getIllustration(key) {
  const entry = ILLUSTRATIONS[key];
  if (!entry) {
    if (__DEV__) {
      console.warn(`[illustrations] clé inconnue: ${key}`);
    }
    return ILLUSTRATIONS['murmures.default'];
  }
  return entry;
}

export function listIllustrationKeys() {
  return Object.keys(ILLUSTRATIONS);
}

export default ILLUSTRATIONS;
