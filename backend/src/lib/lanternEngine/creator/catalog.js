/**
 * Catalogue créateur — blocs humains (pas le langage moteur).
 * Extensible : ajouter une entrée ici + handler dans compile.js.
 */

const TRIGGERS = [
  {
    kind: 'media_discovered',
    label: 'Le joueur découvre',
    icon: '🎞',
    fields: [{ key: 'mediaItemId', type: 'mediaItem', label: 'Média' }],
  },
  {
    kind: 'media_consumed',
    label: 'Le joueur consomme',
    icon: '🎧',
    fields: [{ key: 'mediaItemId', type: 'mediaItem', label: 'Média' }],
  },
  {
    kind: 'media_opened',
    label: 'Le joueur ouvre',
    icon: '📂',
    fields: [{ key: 'mediaItemId', type: 'mediaItem', label: 'Média' }],
  },
  {
    kind: 'beacon_found',
    label: 'Le joueur trouve une balise',
    icon: '📡',
    fields: [
      { key: 'beaconId', type: 'beacon', label: 'Balise' },
      { key: 'channel', type: 'enum', options: ['qr', 'nfc'], label: 'Type', default: 'qr' },
    ],
  },
  {
    kind: 'time_reached',
    label: 'L’heure prévue arrive',
    icon: '🕰',
    fields: [{ key: 'scheduleId', type: 'text', label: 'Identifiant horaire' }],
  },
  {
    kind: 'run_started',
    label: 'L’aventure commence',
    icon: '🏮',
    fields: [],
  },
  {
    kind: 'player_choice',
    label: 'Le joueur appuie sur',
    icon: '👆',
    fields: [
      { key: 'choiceId', type: 'text', label: 'Identifiant du bouton' },
      { key: 'label', type: 'text', label: 'Libellé affiché', optional: true },
    ],
  },
  {
    kind: 'code_submitted',
    label: 'Le joueur entre un code',
    icon: '⌨️',
    fields: [
      { key: 'choiceId', type: 'text', label: 'Identifiant saisie', default: 'code_input' },
      { key: 'expected', type: 'text', label: 'Code attendu' },
      { key: 'label', type: 'text', label: 'Libellé', optional: true },
    ],
  },
  {
    kind: 'player_moves',
    label: 'Le joueur se déplace / position',
    icon: '🚶',
    fields: [],
  },
];

const CONDITIONS = [
  {
    kind: 'player_in_place',
    label: 'Le joueur est dans',
    icon: '📍',
    fields: [{ key: 'zoneId', type: 'zone', label: 'Lieu' }],
  },
  {
    kind: 'player_in_any_place',
    label: 'Le joueur est dans l’un de',
    icon: '📍',
    fields: [{ key: 'zoneIds', type: 'zones', label: 'Lieux' }],
  },
  {
    kind: 'clock_is',
    label: 'Il est',
    icon: '🕰',
    fields: [{ key: 'at', type: 'time', label: 'Heure (HH:mm)' }],
  },
  {
    kind: 'clock_between',
    label: 'Il est entre',
    icon: '🕰',
    fields: [
      { key: 'start', type: 'time', label: 'Début' },
      { key: 'end', type: 'time', label: 'Fin' },
    ],
  },
  {
    kind: 'media_discovered',
    label: 'Le joueur a découvert',
    icon: '🎞',
    fields: [{ key: 'mediaItemId', type: 'mediaItem', label: 'Média' }],
  },
  {
    kind: 'media_consumed',
    label: 'Le joueur a consommé',
    icon: '🎧',
    fields: [{ key: 'mediaItemId', type: 'mediaItem', label: 'Média' }],
  },
  {
    kind: 'flag_false',
    label: 'Ce n’est pas encore arrivé',
    icon: '🔒',
    fields: [{ key: 'varId', type: 'variable', label: 'État' }],
  },
  {
    kind: 'flag_true',
    label: 'Ceci est déjà arrivé',
    icon: '✓',
    fields: [{ key: 'varId', type: 'variable', label: 'État' }],
  },
  {
    kind: 'media_unlocked',
    label: 'L’item média est déverrouillé',
    icon: '🔓',
    fields: [{ key: 'mediaItemId', type: 'mediaItem', label: 'Média' }],
  },
  {
    kind: 'choice_equals',
    label: 'Le joueur a choisi',
    icon: '✅',
    fields: [
      { key: 'choiceId', type: 'text', label: 'Choix' },
      { key: 'value', type: 'text', label: 'Valeur' },
    ],
  },
  {
    kind: 'floor_open',
    label: 'L’étage est accessible',
    icon: '🗂',
    fields: [{ key: 'floorIndex', type: 'number', label: 'N° étage' }],
  },
  {
    kind: 'object_state',
    label: 'L’objet est dans l’état',
    icon: '🧩',
    fields: [
      { key: 'objectId', type: 'text', label: 'Objet' },
      { key: 'value', type: 'text', label: 'État' },
    ],
  },
];

const ACTIONS = [
  {
    kind: 'ring_phone',
    label: 'Faire sonner le téléphone',
    icon: '📞',
    fields: [{ key: 'label', type: 'text', label: 'Libellé (optionnel)', optional: true }],
  },
  {
    kind: 'ring_talkie',
    label: 'Faire sonner le talkie-walkie',
    icon: '📻',
    fields: [
      { key: 'deviceId', type: 'text', label: 'Appareil', default: 'talkie' },
      { key: 'label', type: 'text', label: 'Libellé', optional: true },
    ],
  },
  {
    kind: 'play_media',
    label: 'Lire le média',
    icon: '▶',
    fields: [
      { key: 'mediaContentId', type: 'mediaContent', label: 'Média (contenu)' },
      { key: 'label', type: 'text', label: 'Titre affiché', optional: true },
    ],
  },
  {
    kind: 'unlock_media',
    label: 'Débloquer un item média',
    icon: '🔓',
    fields: [{ key: 'mediaItemId', type: 'mediaItem', label: 'Média' }],
  },
  {
    kind: 'unlock_bureau',
    label: 'Déverrouiller le Bureau',
    icon: '🗂',
    fields: [],
  },
  {
    kind: 'show_item',
    label: 'Afficher un élément',
    icon: '👁',
    fields: [{ key: 'mediaItemId', type: 'mediaItem', label: 'Média' }],
  },
  {
    kind: 'hide_item',
    label: 'Masquer un élément',
    icon: '🙈',
    fields: [{ key: 'mediaItemId', type: 'mediaItem', label: 'Média' }],
  },
  {
    kind: 'set_flag',
    label: 'Modifier l’état',
    icon: '📝',
    fields: [
      { key: 'varId', type: 'variable', label: 'État' },
      { key: 'value', type: 'booleanOrText', label: 'Valeur' },
      { key: 'label', type: 'text', label: 'Description (créateur)', optional: true },
    ],
  },
  {
    kind: 'wait_then',
    label: 'Attendre puis déclencher',
    icon: '⏳',
    fields: [
      { key: 'afterMinutes', type: 'number', label: 'Minutes' },
      { key: 'scheduleId', type: 'text', label: 'Identifiant' },
      { key: 'label', type: 'text', label: 'Description', optional: true },
    ],
  },
  {
    kind: 'notify',
    label: 'Afficher un message',
    icon: '💬',
    fields: [{ key: 'message', type: 'text', label: 'Message' }],
  },
  {
    kind: 'show_observation',
    label: 'Ouvrir une fenêtre d’observation',
    icon: '🔎',
    fields: [
      { key: 'title', type: 'text', label: 'Titre', optional: true, default: 'Fenêtre d’observation' },
      { key: 'message', type: 'text', label: 'Texte affiché au joueur' },
    ],
  },
  {
    kind: 'unlock_floor',
    label: 'Débloquer un étage',
    icon: '🔓',
    fields: [
      { key: 'floorIndex', type: 'number', label: 'N° étage' },
      { key: 'label', type: 'text', label: 'Description', optional: true },
    ],
  },
  {
    kind: 'add_journal',
    label: 'Ajouter une note au journal',
    icon: '📓',
    fields: [
      { key: 'noteId', type: 'text', label: 'Identifiant note' },
      { key: 'message', type: 'text', label: 'Texte' },
    ],
  },
  {
    kind: 'set_object_state',
    label: 'Changer l’état d’un objet',
    icon: '🧩',
    fields: [
      { key: 'objectId', type: 'text', label: 'Objet' },
      { key: 'value', type: 'text', label: 'Nouvel état' },
      { key: 'label', type: 'text', label: 'Description', optional: true },
    ],
  },
  {
    kind: 'show_code_input',
    label: 'Afficher une saisie de code',
    icon: '⌨️',
    fields: [
      { key: 'choiceId', type: 'text', label: 'Identifiant saisie', default: 'code_input' },
      { key: 'message', type: 'text', label: 'Invite', optional: true },
    ],
  },
  {
    kind: 'show_button',
    label: 'Afficher un bouton',
    icon: '🔘',
    fields: [
      { key: 'choiceId', type: 'text', label: 'Identifiant bouton' },
      { key: 'label', type: 'text', label: 'Libellé du bouton' },
    ],
  },
];

const MEDIA_ITEM_SKINS = [
  { id: 'vhs', label: 'VHS', contentKinds: ['video'] },
  { id: 'cassette', label: 'Cassette', contentKinds: ['audio'] },
  { id: 'dictaphone', label: 'Dictaphone', contentKinds: ['audio'] },
  { id: 'phone', label: 'Téléphone', contentKinds: ['audio'] },
  { id: 'talkie', label: 'Talkie-walkie', contentKinds: ['audio'] },
  { id: 'radio', label: 'Radio', contentKinds: ['audio'] },
  { id: 'letter', label: 'Lettre', contentKinds: ['text', 'image'] },
  { id: 'polaroid', label: 'Polaroid', contentKinds: ['image'] },
  { id: 'usb', label: 'Clé USB', contentKinds: ['text', 'image', 'audio', 'video'], container: true },
  { id: 'box', label: 'Boîte', contentKinds: ['text', 'image', 'audio', 'video'], container: true },
  { id: 'pc', label: 'PC', contentKinds: ['text', 'image', 'audio', 'video'], container: true },
  { id: 'folder', label: 'Pochette cartonnée', contentKinds: ['text', 'image'], container: true },
  { id: 'locker', label: 'Casier', contentKinds: ['text', 'image', 'audio', 'video'], container: true },
];

const { getInventoryCatalog } = require('./inventory');

function getCatalog() {
  return {
    triggers: TRIGGERS,
    conditions: CONDITIONS,
    actions: ACTIONS,
    mediaItemSkins: MEDIA_ITEM_SKINS,
    ...getInventoryCatalog(),
    connectors: {
      when: 'QUAND',
      if: 'SI',
      and: 'ET',
      or: 'OU',
      not: 'PAS',
      then: 'ALORS',
      andThen: 'ET ALORS',
      else: 'SINON',
      after: 'APRÈS',
      during: 'PENDANT',
      therefore: 'DONC',
      transition: 'TRANSITION',
    },
  };
}

module.exports = {
  TRIGGERS,
  CONDITIONS,
  ACTIONS,
  MEDIA_ITEM_SKINS,
  getCatalog,
};
