# Deuxième Âme — Câblage client & Opportunités Volantes

Pont entre l'Event Engine (organe, déjà livré) et les surfaces mobiles. **Aucune modification backend** : toutes les routes et fonctions API existent déjà. On respecte la règle « la surface compose, l'organe ne connaît pas les portes ».

## Objectif

Câbler côté mobile les 5 recommandations post-Event Engine :

1. Les 6 portes de découverte (vues composées)
2. Mode Réception habitant
3. Écoute socket des Opportunités Volantes
4. Onglet diffusion dans l'Épée + parcours billet/lanterne
5. Règle d'extensibilité (nouveau producteur = type + mapping source)

## Constat de faisabilité (déjà en place)

- API client : `getEventDiscovery`, `getEventMurmurs`, `getModeReception`, `setModeReception`, `diffuseEvent`, `requestEventTicket`, `discoverLantern` dans `mobile/src/api/index.js` (l.138-171).
- Socket : chaque user rejoint `user_<id>` (`backend/src/socket/handlers.js` l.24) ; le serveur émet `event:opportunity` avec `{ event, channels }` (`backend/src/lib/eventEngine/diffusion.js` l.135).
- Routes billet/lanterne : `POST /api/events/:id/ticket` et `POST /api/events/:id/discover` (`backend/src/routes/events.js` l.194-206). Le billet/récompense arrive dans le Wallet et le socket `wallet:object_issued` rafraîchit déjà l'écran via `mobile/src/context/WalletContext.js`.

## Flux visés

```
Surface mobile                          Event Engine (inchangé)
─────────────────                       ───────────────────────
Écran Découvrir (6 portes)  ──────────► /feed/discover + /feed/murmurs
Écran Mode Réception        ──────────► /reception GET-PUT
Épée: Opportunité Volante   ──────────► /:id/diffuse
        │                                      │
        │                                      ▼
        │                              event:opportunity (socket)
        │                                      │
        ▼                                      ▼
Bannière Opportunité ◄─────────────────────────┘
Demander un billet          ──────────► /:id/ticket
Scanner Lanterne            ──────────► /:id/discover
```

## Prérequis technique

Ajouter `expo-camera` (choix validé) pour le scan de QR Lanterne.

- Installer la dépendance dans `mobile/package.json` et déclarer le plugin + permission caméra dans `mobile/app.json` (message `cameraPermission`, `NSCameraUsageDescription`).
- Vérifier le fallback web (react-native-web) : `expo-camera` a un support web limité ; prévoir une saisie manuelle du code sur web.

## Chantier 1 — Les 6 portes (échafaudage fonctionnel)

Un écran `Découvrir` où chaque « porte » = une vue composée par un filtre passé aux projections existantes. L'organe ne connaît aucune de ces portes.

- Nouvel écran `mobile/src/screens/client/DiscoverScreen.js` : 6 sections branchées ainsi :
  - Autour de moi → `getEventDiscovery({ zoneId })`
  - Culture & Ateliers → `getEventDiscovery({ channel: 'culture' })`
  - Gastronomie → `getEventDiscovery({ channel: 'gastronomie' })`
  - Billetterie → `getEventDiscovery({ capability: 'canTicket' })`
  - Lanternes → `getEventDiscovery({ capability: 'isLantern' })`
  - Murmures → `getEventMurmurs()`
- Nouvel écran `mobile/src/screens/client/EventDetailScreen.js` : détail d'une initiative via `getEventById`, affiche `event.display`, boutons contextuels (billet si `canTicket`).
- Navigation : ajouter un onglet `DécouvrirTab` dans `ClientTabs` et un `DiscoverStack` (Discover → EventDetail) dans `mobile/src/navigation/index.js`. Icône `compass-outline`.
- Rendu piloté par `event.display` fourni par l'organe (pas de logique métier dans la surface).

## Chantier 2 — Mode Réception habitant

- Nouvel écran `mobile/src/screens/client/ModeReceptionScreen.js` :
  - Au montage : `getModeReception()` pour l'état courant ; liste des canaux via `getEventChannels()`.
  - Toggles par canal ; à l'enregistrement : `setModeReception(subscriptions)` (forme `[{ channel, radiusKm?, zoneId? }]`).
- Accès : entrée dans le drawer client `mobile/src/components/client/ClientDrawerContent.js` + `Drawer.Screen` dans `HomeDrawer`.

## Chantier 3 — Écoute socket `event:opportunity`

Reproduire le pattern de `mobile/src/context/WalletContext.js` (abonnement sur `useApp().socket`).

- Nouveau `mobile/src/context/OpportunityContext.js` : `socket.on('event:opportunity', ({ event, channels }) => ...)` ; stocke la dernière opportunité et déclenche une bannière in-app.
- Composant `mobile/src/components/client/OpportunityBanner.js` : bannière/toast avec titre + CTA « Voir » → navigue vers `EventDetail`.
- Monter `OpportunityProvider` dans l'arbre de providers (au niveau de `WalletProvider`) et n'activer l'écoute que pour `role === 'client'`. Nettoyage `socket.off` au démontage.

## Chantier 4a — Onglet Opportunité Volante (Épée)

La diffusion est une stratégie (pas un type), appliquée à une initiative existante et « flyable ».

- Nouvel écran `mobile/src/screens/merchant/DiffuseOpportunityScreen.js` : liste les initiatives publiées éligibles (`getMyEvents`, filtrées `isFlyable`), sélection des canaux + fenêtre + note, puis `diffuseEvent(id, { channels, windowStart, windowEnd, note, idempotencyKey })`. Générer un `idempotencyKey` côté client pour éviter les doubles diffusions.
- Déclarer le module dans `mobile/src/epee/moduleRegistry.js` (famille `animer`) : `{ id: 'opportunities', label: 'Opportunité Volante', icon: 'send-outline', route: 'DiffuseOpportunity', entitlement: 'store', enabled: true }`.
- Ajouter `Stack.Screen name="DiffuseOpportunity"` dans `EpeeStack` (`mobile/src/navigation/index.js`) ; option secondaire : bouton « Diffuser » sur les cartes de `mobile/src/screens/merchant/MerchantEventsScreen.js`.

## Chantier 4b — Parcours billet + lanterne (client)

- **Billet** : sur `EventDetailScreen`, si `canTicket`, bouton « Demander un billet » → `requestEventTicket(id)`. Succès → « Billet ajouté à votre Wallet » (le Wallet se rafraîchit seul via socket) ; gérer l'erreur 409 « Complet ».
- **Lanterne** : nouvel écran `mobile/src/screens/client/LanternScanScreen.js` utilisant `expo-camera` ; la valeur du QR = `event.id` de la Lanterne ; au scan → `discoverLantern(scannedId)`. Gérer `replayed: true` (« Déjà découverte »), succès (« Lanterne découverte, récompense ajoutée »), erreurs 409 (pas active / retirée).
  - Fabrique des QR pour tester : afficher le QR d'une Lanterne (valeur = `event.id`) via `react-native-qrcode-svg` dans l'écran producteur (ex. détail sur `MerchantEventsScreen`), afin de scanner depuis un second appareil et boucler le parcours.
  - Point d'accès du scanner : bouton sur `DiscoverScreen` (porte Lanternes) et/ou dans `ClientRoot`.

## Chantier 5 — Règle d'extensibilité (gouvernance, zéro code cœur)

Rien à coder dans le cœur. Vérifier et documenter que tout nouveau producteur = 1 type déclaré + 1 mapping de source.

- Point d'extension type : `registerType()` dans `backend/src/lib/eventEngine/types/*` (index chargeur).
- Point d'extension source : `productionContext(user)` dans `backend/src/routes/events.js` (l.40-47) — ajouter un `sourceKind` par nouveau rôle, sans toucher au reste.
- Livrable : une courte note « Ajouter un producteur » (association/artiste/citoyen/IA) rappelant ces 2 seuls points de touche.

## Roadmap d'exécution

| # | Chantier | Livrable principal |
|---|----------|-------------------|
| 0 | Prérequis | `expo-camera` + permissions |
| 1 | 6 portes | `DiscoverScreen` + `EventDetailScreen` + onglet |
| 2 | Mode Réception | `ModeReceptionScreen` + entrée drawer |
| 3 | Socket opportunité | `OpportunityContext` + bannière |
| 4a | Épée diffusion | `DiffuseOpportunityScreen` + module registre |
| 4b | Billet / Lanterne | CTA billet + `LanternScanScreen` |
| 5 | Gouvernance | Note « Ajouter un producteur » |
| — | Tests | Bout-en-bout diffusion → Wallet / scan idempotent |

## Tests

- Manuel bout-en-bout : producteur diffuse (Épée) → habitant abonné reçoit la bannière (socket) → ouvre le détail → prend un billet → billet visible au Wallet.
- Lanterne : scan QR → récompense au Wallet ; re-scan → `replayed` sans double récompense.
- Portes : chaque porte renvoie les bonnes projections (vérifier `capability` isLantern/canTicket, `channel`, `zoneId`).
- Robustesse : Mode Réception vide → pas de bannière ; erreurs réseau → états d'erreur propres ; idempotence diffusion.

## Points d'attention

- `expo-camera` sur web (react-native-web) : prévoir saisie manuelle de code en repli.
- La bannière ne doit apparaître que pour les clients et se nettoyer correctement (fuites de listeners socket).
- Ce lot reste un échafaudage : la mise en scène poétique finale des 6 portes est un chapitre Deuxième Âme ultérieur.
