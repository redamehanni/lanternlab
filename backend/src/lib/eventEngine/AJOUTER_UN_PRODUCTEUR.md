# Ajouter un producteur d'initiatives (association, artiste, citoyen, IA…)

Règle d'or : **un nouveau producteur = 1 type déclaré + 1 mapping de source.**
On ne touche JAMAIS au cœur (`index.js`), ni aux surfaces (l'Épée, la Deuxième Âme).

## Point de touche 1 — Déclarer le(s) type(s) d'initiative

Créer un fichier dans `types/` et l'enregistrer via `registerType()` (principe
Open/Closed). Le cœur lit le registre ; il ne contient aucun `if (type === ...)`.

```js
// backend/src/lib/eventEngine/types/collecte.js
const { registerType } = require('../eventRegistry');

registerType({
  type: 'collecte',
  label: 'Collecte solidaire',
  defaultChannels: ['solidarite', 'associations'],
  capabilities: { canRSVP: true, isFlyable: true }, // capacités connues uniquement
  display(row) {
    return { title: row.title, subtitle: row.summary, category: 'solidarite' };
  },
});
```

Puis l'importer dans `types/index.js`. C'est tout côté organe.

- Capacités valides : voir `KNOWN_CAPABILITIES` (`eventRegistry.js`).
- Canaux valides : voir `CHANNELS` (`eventRegistry.js`) — en ajouter un s'y déclare aussi ici, sans toucher au cœur.
- Un cycle de vie spécialisé (ex. Lanterne `hidden → active → discovered`) se déclare via `lifecycle` dans le type.

## Point de touche 2 — Mapper la source du producteur

Un producteur agit avec un `sourceKind` (déjà ouverts : `merchant`, `association`,
`artist`, `citizen`, `ai`, …, cf. `SOURCE_KIND`). Le seul endroit à ajuster est
`productionContext(user)` dans `backend/src/routes/events.js` :

```js
function productionContext(user) {
  if (user.role === 'merchant')    return { sourceKind: SOURCE_KIND.MERCHANT, storeIds: userStoreIds(user.id) };
  if (user.role === 'association') return { sourceKind: SOURCE_KIND.ASSOCIATION, storeIds: [] };
  // … nouveau rôle => nouveau mapping, rien d'autre à changer.
  return { sourceKind: SOURCE_KIND.CITIZEN, storeIds: [] }; // défaut : l'habitant
}
```

## Ce qu'il ne faut PAS faire

- Ajouter de la logique métier dans le cœur (`index.js`) ou dans les écrans.
- Faire de l'Event Engine un bus technique universel (voir `bus.js`).
- Réimplémenter un autre organe : billets → Wallet, scan → Identity, messages →
  Communication. L'Event Engine **orchestre**, il n'absorbe pas.

## Côté surface (rappel)

Une nouvelle « porte » de la Deuxième Âme = une vue composée sur les projections
(`listDiscoverable` / `listMurmurs`), déclarée dans `mobile/src/data/deuxiemeAme.js`.
La surface compose ; l'organe ne connaît pas les portes.
