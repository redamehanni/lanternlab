/**
 * Deuxième Âme — Déclaration des 6 portes.
 *
 * PRINCIPE : les portes sont une notion de SURFACE. L'Event Engine ne les connaît
 * pas ; il expose des projections (listDiscoverable / listMurmurs). Une porte =
 * une intention de découverte + une destination. Ajouter/renommer une porte se
 * fait ici, sans toucher à l'organe.
 *
 * `route` cible un écran du DeuxiemeAmeHomeStack. `open` (optionnel) est un mode
 * d'ouverture particulier (ex. scanner). L'ordre du tableau = l'ordre d'affichage.
 */
export const PORTES = [
  {
    id: 'lanternes',
    label: 'Les Lanternes',
    description: 'Partez à la recherche de trésors cachés dans le quartier.',
    icon: 'sparkles-outline',
    color: '#7C3AED',
    route: 'Lanterns',
  },
  {
    id: 'evenements',
    label: 'Les Événements',
    description: 'Découvrez tout ce qui se passe aujourd\u2019hui autour de vous.',
    icon: 'calendar-outline',
    color: '#EA580C',
    route: 'Events',
  },
  {
    id: 'participer',
    label: 'Participer',
    description: 'Contribuez à la vie du quartier, créez ou rejoignez des initiatives locales.',
    icon: 'people-outline',
    color: '#059669',
    route: 'Participer',
  },
  {
    id: 'quartier',
    label: 'Découvrir mon quartier',
    description: 'Explorez les lieux, artisans, cafés, patrimoine et coins inspirants près de chez vous.',
    icon: 'compass-outline',
    color: '#0891B2',
    route: 'DecouvrirQuartier',
  },
  {
    id: 'adresses',
    label: 'Mes adresses',
    description: 'Vos lieux préférés, leurs actualités, offres et recommandations sur mesure.',
    icon: 'heart-outline',
    color: '#DC2626',
    route: 'MesAdresses',
  },
  {
    id: 'surprise',
    label: 'Se laisser surprendre',
    description: 'Laissez Ma Zone vous proposer une expérience unique, rien que pour vous.',
    icon: 'color-wand-outline',
    color: '#2563EB',
    route: 'Surprise',
  },
];

/**
 * Formes de participation à la vie locale.
 *
 * IMPORTANT (vision produit) : la porte « Participer » n'est PAS réductible à la
 * création d'initiatives. Elle est le point d'entrée de TOUTES les formes de
 * participation (rejoindre, aider, contribuer, répondre à un besoin, missions…).
 * On les déclare ici : ajouter une forme = une entrée, sans refonte. Les formes
 * non encore adossées à un organe sont honnêtement marquées « Bientôt ».
 */
export const PARTICIPATION_MODES = [
  {
    id: 'create',
    label: 'Créer une initiative',
    description: 'Faites naître un moment de vie locale : balade, rencontre, collecte…',
    icon: 'add-circle-outline',
    color: '#059669',
    route: 'CreateEvent',
    enabled: true,
  },
  {
    id: 'join',
    label: 'Rejoindre une initiative',
    description: 'Participez à ce que d\u2019autres habitants ont lancé près de chez vous.',
    icon: 'hand-left-outline',
    color: '#2563EB',
    comingSoon: true,
  },
  {
    id: 'help_merchant',
    label: 'Aider un commerçant',
    description: 'Donnez un coup de main ou répondez à un besoin d\u2019un commerce du quartier.',
    icon: 'storefront-outline',
    color: '#EA580C',
    comingSoon: true,
  },
  {
    id: 'association',
    label: 'Participer à une association',
    description: 'Rejoignez les associations locales et leurs actions.',
    icon: 'people-circle-outline',
    color: '#7C3AED',
    comingSoon: true,
  },
  {
    id: 'need',
    label: 'Répondre à un besoin',
    description: 'Le quartier a besoin d\u2019un coup de main ? Proposez le vôtre.',
    icon: 'megaphone-outline',
    color: '#D97706',
    comingSoon: true,
  },
  {
    id: 'mission',
    label: 'Prendre part à une mission',
    description: 'Des missions ponctuelles pour faire vivre le quartier.',
    icon: 'flag-outline',
    color: '#0891B2',
    comingSoon: true,
  },
];

/**
 * Suggestions de la barre d'intention. `route` (optionnel) branche la puce sur
 * une projection Event Engine (première version) ; sans `route`, la puce relève
 * de l'assistant (état « Bientôt » tant que l'organe IA n'existe pas).
 */
export const INTENT_SUGGESTIONS = [
  { id: 'calme', label: 'Trouve-moi un endroit calme' },
  { id: 'soir', label: 'Idées pour ce soir', route: 'Events' },
  { id: 'balade', label: 'Balade en 1h' },
  { id: 'surprise', label: 'Surprends-moi', route: 'Surprise' },
];
