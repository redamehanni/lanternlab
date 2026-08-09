/**
 * Deuxième Âme — Déclaration des 6 portes.
 *
 * PRINCIPE (V1 public — Portes scellées) :
 * Les Portes sont un mécanisme de PRÉSENTATION et d'ACCÈS PUBLIC.
 * Elles ne définissent PAS l'architecture interne de l'application.
 * L'Event Engine, le Wallet, l'Identity et les Murmurs ne connaissent
 * aucune Porte. Ouvrir une Porte = passer `status` à `'open'` ici —
 * aucune migration d'organe.
 *
 * Une porte = intention de découverte + destination (+ statut d'accès).
 * `illustrationKey` pointe vers le registry d'illustrations (jamais d'asset en dur).
 * `route` cible un écran du DeuxiemeAmeHomeStack (écrans conservés même si sealed).
 * L'ordre du tableau = l'ordre d'affichage.
 */

export const PORTE_STATUS = {
  OPEN: 'open',
  SEALED: 'sealed',
};

export const PORTES = [
  {
    id: 'lanternes',
    label: 'Les Lanternes',
    description: 'Partez à la recherche de trésors cachés dans le quartier.',
    icon: 'sparkles-outline',
    iconKey: 'lantern',
    illustrationKey: 'portes.lanternes',
    color: '#8B6FAE',
    soft: '#F0EAF6',
    route: 'Lanterns',
    status: PORTE_STATUS.OPEN,
  },
  {
    id: 'evenements',
    label: 'Les Événements',
    description: 'Découvrez tout ce qui se passe aujourd\u2019hui autour de vous.',
    icon: 'calendar-outline',
    iconKey: 'calendar',
    illustrationKey: 'portes.evenements',
    color: '#C4785A',
    soft: '#F8EBE4',
    route: 'Events',
    status: PORTE_STATUS.SEALED,
    sealedLabel: 'Porte II',
    sealedHint: 'Encore scellée. Les Lanternes ne sont que le premier chapitre.',
  },
  {
    id: 'participer',
    label: 'Participer',
    description: 'Contribuez à la vie du quartier, créez ou rejoignez des initiatives locales.',
    icon: 'people-outline',
    iconKey: 'people',
    illustrationKey: 'portes.participer',
    color: '#5F8F78',
    soft: '#E8F2EC',
    route: 'Participer',
    status: PORTE_STATUS.SEALED,
    sealedLabel: 'Porte III',
    sealedHint: 'Encore scellée. D\u2019autres façons d\u2019entrer dans le quartier viendront.',
  },
  {
    id: 'quartier',
    label: 'Découvrir mon quartier',
    description: 'Explorez les lieux, artisans, cafés, patrimoine et coins inspirants près de chez vous.',
    icon: 'compass-outline',
    iconKey: 'compass',
    illustrationKey: 'portes.quartier',
    color: '#6A92A8',
    soft: '#E8F0F4',
    route: 'DecouvrirQuartier',
    status: PORTE_STATUS.SEALED,
    sealedLabel: 'Porte IV',
    sealedHint: 'Encore scellée. Le programme est plus vaste que ce qui est déjà ouvert.',
  },
  {
    id: 'adresses',
    label: 'Mes adresses',
    description: 'Vos lieux préférés, leurs actualités, offres et recommandations sur mesure.',
    icon: 'heart-outline',
    iconKey: 'heart',
    illustrationKey: 'portes.adresses',
    color: '#B86B6B',
    soft: '#F6EAEA',
    route: 'MesAdresses',
    status: PORTE_STATUS.SEALED,
    sealedLabel: 'Porte V',
    sealedHint: 'Encore scellée. Une entrée de plus, pour plus tard.',
  },
  {
    id: 'surprise',
    label: 'Se laisser surprendre',
    description: 'Laissez Ma Zone vous proposer une expérience unique, rien que pour vous.',
    icon: 'color-wand-outline',
    iconKey: 'wand',
    illustrationKey: 'portes.surprise',
    color: '#7A7FB8',
    soft: '#EEEDF6',
    route: 'Surprise',
    status: PORTE_STATUS.SEALED,
    sealedLabel: 'Porte VI',
    sealedHint: 'Encore scellée. Laissez le mystère faire son travail.',
  },
];

export function isPorteOpen(porte) {
  return porte?.status === PORTE_STATUS.OPEN;
}

export function porteByRoute(route) {
  if (!route) return null;
  return PORTES.find((p) => p.route === route) || null;
}

export function openPortesCount() {
  return PORTES.filter(isPorteOpen).length;
}

/**
 * Formes de participation à la vie locale.
 *
 * IMPORTANT (vision produit) : la porte « Participer » n'est PAS réductible à la
 * création d'initiatives. Elle est le point d'entrée de TOUTES les formes de
 * participation (rejoindre, aider, contribuer, répondre à un besoin, missions…).
 * On les déclare ici : ajouter une forme = une entrée, sans refonte. Les formes
 * non encore adossées à un organe sont honnêtement marquées « Bientôt ».
 *
 * NOTE V1 : la Porte Participer est scellée en surface ; ce registre reste intact
 * pour le jour d'ouverture — aucun filtrage métier ici.
 */
export const PARTICIPATION_MODES = [
  {
    id: 'create',
    label: 'Créer une initiative',
    description: 'Faites naître un moment de vie locale : balade, rencontre, collecte…',
    icon: 'add-circle-outline',
    color: '#5F8F78',
    route: 'CreateEvent',
    enabled: true,
  },
  {
    id: 'join',
    label: 'Rejoindre une initiative',
    description: 'Participez à ce que d\u2019autres habitants ont lancé près de chez vous.',
    icon: 'hand-left-outline',
    color: '#6A92A8',
    comingSoon: true,
  },
  {
    id: 'help_merchant',
    label: 'Aider un commerçant',
    description: 'Donnez un coup de main ou répondez à un besoin d\u2019un commerce du quartier.',
    icon: 'storefront-outline',
    color: '#C4785A',
    comingSoon: true,
  },
  {
    id: 'association',
    label: 'Participer à une association',
    description: 'Rejoignez les associations locales et leurs actions.',
    icon: 'people-circle-outline',
    color: '#8B6FAE',
    comingSoon: true,
  },
  {
    id: 'need',
    label: 'Répondre à un besoin',
    description: 'Le quartier a besoin d\u2019un coup de main ? Proposez le vôtre.',
    icon: 'megaphone-outline',
    color: '#C4893A',
    comingSoon: true,
  },
  {
    id: 'mission',
    label: 'Prendre part à une mission',
    description: 'Des missions ponctuelles pour faire vivre le quartier.',
    icon: 'flag-outline',
    color: '#6A92A8',
    comingSoon: true,
  },
];

/**
 * Suggestions de la barre d'intention. `route` (optionnel) branche la puce sur
 * une projection Event Engine (première version) ; sans `route`, la puce relève
 * de l'assistant.
 *
 * Si `route` cible une Porte scellée, l'accueil refuse la navigation (couche
 * d'accès public) — le contenu métier n'est pas modifié.
 */
export const INTENT_SUGGESTIONS = [
  { id: 'calme', label: 'Trouve-moi un endroit calme' },
  { id: 'soir', label: 'Idées pour ce soir', route: 'Events' },
  { id: 'balade', label: 'Balade en 1h' },
  { id: 'surprise', label: 'Surprends-moi', route: 'Surprise' },
];
