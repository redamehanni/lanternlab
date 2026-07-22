# Deuxième Âme — Première version de production

Base de production durable (pas un échafaudage jetable) : écrans, hiérarchie, composants et interactions pensés pour être enrichis au fil des versions, pas remplacés. La DA (illustrations, animations) évoluera ; la composition, elle, se stabilise ici. Référence de composition = la maquette fournie (organisation, hiérarchie, rythme, 6 portes, place du Mode Réception / Murmures / bannière), pas pixel-perfect.

## Principes de cadrage (décidés)

- La Deuxième Âme est **une des deux faces** de Ma Zone (au même titre que la Première Âme), avec son propre Accueil complet.
- **Première Âme inchangée** : aucun impact sur les parcours commerce existants (`mobile/src/screens/client/HomeScreen.js`, etc.).
- **Panier partagé** : la barre de la Deuxième Âme est Accueil / Messages / Wallet / **Panier** (le « Panier » remplace le « Aide » de la maquette). Le panier reste celui de la Marketplace, rendu accessible depuis les deux faces.
- Les éléments sans organe (IA, météo, lieux/patrimoine) sont construits comme **vrais composants de production** avec états honnêtes (« Bientôt » / données d'exemple) et points de branchement clairs.
- Aucune modification backend : toutes les routes/API sont déjà en place (`mobile/src/api/index.js`).

## Architecture des deux faces

Cart / Wallet / Communication sont déjà des providers app-wide (`mobile/App.js`) : le partage est automatique. On ajoute un état `activeSoul` et une seconde racine de navigation.

```
role === client
        │
        ▼
   activeSoul
   ┌────┴────┐
   │         │
 first     second
   │         │
   ▼         ▼
Première   Deuxième Âme
Âme        (nouvelle face)
(inchan-
gée)
   │         │
   └────┬────┘
        ▼
Providers app-wide déjà partagés
  · CartProvider
  · WalletProvider
  · CommunicationProvider
```

- Étendre `mobile/src/context/AppContext.js` : `activeSoul` (`'first' | 'second'`, défaut `'first'`, persisté via `appStorage`) + `switchSoul()`.
- Dans `mobile/src/navigation/index.js`, pour `role === 'client'` : rendre `ClientRoot` (face 1) ou un nouveau `DeuxiemeAmeRoot` selon `activeSoul`.
- `DeuxiemeAmeRoot` = `Tab.Navigator` : **Accueil** (`DeuxiemeAmeHomeStack`), **Messages** (réutilise `MessagingStack`), **Wallet** (réutilise `WalletStack`), **Panier** (réutilise `CartStack`).
- Bascule (additive, seul point de contact avec la face 1) : entrée « Basculer vers la Deuxième Âme » dans `mobile/src/components/client/ClientDrawerContent.js`, et contrôle de retour dans l'en-tête de la Deuxième Âme. Ne modifie aucun parcours existant.

## Écran Accueil — composition et mapping vers les organes

Nouvel écran `mobile/src/screens/deuxiemeAme/DeuxiemeAmeHomeScreen.js` (ScrollView), composé de blocs. Chaque bloc = un composant dédié dans `mobile/src/components/deuxiemeAme/`.

- **En-tête** (`AmeHeader.js`) : logo « Ma Zone / Deuxième Âme », cloche notifications, icône Messages, avatar. La cloche ouvre `ModeReceptionPopover.js` (toggle rapide + lien « Gérer »).
- **Mode Réception** (`ModeReceptionPopover.js` + écran `ModeReceptionScreen.js`) — RÉEL : `getModeReception()` / `setModeReception([{ channel, radiusKm?, zoneId? }])`, canaux via `getEventChannels()`.
- **Hero météo/lieu** (`WeatherHero.js`) : lieu (zone/profil utilisateur), météo en **données d'exemple** avec point de branchement `getLocalContext()` (organe météo futur). Puces stats **RÉELLES** calculées depuis `getEventDiscovery` : « N événements en cours » et « N lanternes disponibles » (`capability: 'isLantern'`).
- **Barre d'intention IA** (`AiIntentBar.js`) : champ + puces (« Idées pour ce soir », « Balade en 1h », « Surprends-moi »). Les puces mappables sont branchées sur des filtres Event Engine (ex. « Idées pour ce soir » → événements du jour) ; la saisie libre / vraie IA affiche un état « Bientôt » via un point de branchement `askAssistant()`.
- **Les 6 portes** (grille 2 colonnes, `PorteCard.js`) :
  - **Les Lanternes** → `LanternsScreen.js` : `getEventDiscovery({ capability: 'isLantern' })` + accès scan. RÉEL.
  - **Les Événements** → `EventsScreen.js` : `getEventDiscovery({...})` (+ filtres canal/zone). RÉEL.
  - **Participer** → `ParticiperScreen.js` : production citoyenne (l'API supporte déjà `SOURCE_KIND.CITIZEN`, cf. `backend/src/routes/events.js`) ; première version = créer/rejoindre une initiative citoyenne (`createEvent` en contexte citoyen). RÉEL (première version), enrichie ensuite.
  - **Découvrir mon quartier** → `DecouvrirQuartierScreen.js` : commerces/lieux locaux via la Marketplace existante (`getFavoriteStores`, découverte boutiques, `StoreDetail`) ; sections patrimoine/lieux en « Bientôt ». RÉEL (première version).
  - **Mes adresses** → `MesAdressesScreen.js` : favoris existants (`getFavoriteStores`, réutilise la logique de `FavoriteStores`). RÉEL.
  - **Se laisser surprendre** → `SurpriseScreen.js` : première version = tirage d'une initiative découvrable au hasard depuis `getEventDiscovery` ; enrichissement IA ultérieur (`askAssistant()`). RÉEL (première version).
- **Les murmures du quartier** (`MurmurCard.js` + `MurmursScreen.js`) — RÉEL : `getEventMurmurs()` ; « Voir tout » → écran dédié.
- **Bannière Opportunité Volante** (`OpportunityBanner.js` + `OpportunityContext.js`) — RÉEL : écoute socket `event:opportunity` (rooms `user_<id>` déjà rejointes ; émission dans `backend/src/lib/eventEngine/diffusion.js`). Pattern d'abonnement calqué sur `mobile/src/context/WalletContext.js`. Provider monté app-wide (clients uniquement), bannière overlay dans la Deuxième Âme, CTA « Voir » → `EventDetail`.

## Détail d'un événement + parcours billet / lanterne (client)

- `EventDetailScreen.js` : `getEventById`, rendu piloté par `event.display`. Si `canTicket` → « Demander un billet » → `requestEventTicket(id)` (succès « Billet ajouté au Wallet », le Wallet se rafraîchit seul via `wallet:object_issued` ; gérer 409 « Complet »).
- `LanternScanScreen.js` : **expo-camera** (dépendance validée) ; QR = `event.id` de la Lanterne → `discoverLantern(scannedId)` ; gérer `replayed: true`, succès (récompense Wallet), 409 (pas active / retirée). Repli web (support caméra limité) = saisie manuelle du code.

## Côté producteur (Épée) — Opportunité Volante

Navigation Épée inchangée par ailleurs.

- `mobile/src/screens/merchant/DiffuseOpportunityScreen.js` : liste des initiatives publiées « flyables » (`getMyEvents`), choix canaux + fenêtre + note, `diffuseEvent(id, { channels, windowStart, windowEnd, note, idempotencyKey })` (clé d'idempotence côté client).
- Déclarer le module dans `mobile/src/epee/moduleRegistry.js` (famille `animer`) : `{ id: 'opportunities', label: 'Opportunité Volante', icon: 'send-outline', route: 'DiffuseOpportunity', entitlement: 'store', enabled: true }` + `Stack.Screen` dans `EpeeStack`.
- Fabrique de QR de test : afficher le QR d'une Lanterne (valeur = `event.id`) via `react-native-qrcode-svg` côté producteur pour boucler le parcours de scan.

## Prérequis technique

- Ajouter `expo-camera` dans `mobile/package.json` + permission caméra dans `mobile/app.json` (`NSCameraUsageDescription`, plugin expo-camera).

## Extensibilité (gouvernance, zéro code cœur)

Tout nouveau producteur (association, artiste, citoyen, IA) = 1 type déclaré (`registerType()` dans `backend/src/lib/eventEngine/types/*`) + 1 mapping de source (`productionContext(user)` dans `backend/src/routes/events.js`). Côté surface, une nouvelle porte = une vue composée sur les projections, sans toucher à l'organe. Livrable : courte note « Ajouter un producteur ».

## Nouveaux fichiers (récap)

- Contexte : `mobile/src/context/OpportunityContext.js` ; extension `AppContext` (`activeSoul`).
- Écrans `mobile/src/screens/deuxiemeAme/` : `DeuxiemeAmeHomeScreen`, `EventsScreen`, `EventDetailScreen`, `LanternsScreen`, `LanternScanScreen`, `ParticiperScreen`, `DecouvrirQuartierScreen`, `MesAdressesScreen`, `SurpriseScreen`, `MurmursScreen`, `ModeReceptionScreen`.
- Composants `mobile/src/components/deuxiemeAme/` : `AmeHeader`, `ModeReceptionPopover`, `WeatherHero`, `AiIntentBar`, `PorteCard`, `MurmurCard`, `OpportunityBanner`.
- Merchant : `mobile/src/screens/merchant/DiffuseOpportunityScreen.js`.
- Navigation : `DeuxiemeAmeRoot` + `DeuxiemeAmeHomeStack` dans `mobile/src/navigation/index.js`.

## Roadmap d'exécution

| # | Chantier | Livrable principal |
|---|----------|-------------------|
| 1 | Deux faces | `activeSoul` + `DeuxiemeAmeRoot` + bascule additive |
| 2 | Prérequis | `expo-camera` + permissions |
| 3 | Accueil | `DeuxiemeAmeHomeScreen` + hero + barre IA |
| 4 | 6 portes | `PorteCard` + 6 écrans dédiés |
| 5 | Mode Réception | Popover + écran complet |
| 6 | Murmures | Section + `MurmursScreen` |
| 7 | Opportunité | `OpportunityContext` + bannière socket |
| 8 | Billet / Lanterne | `EventDetailScreen` + `LanternScanScreen` |
| 9 | Épée | `DiffuseOpportunityScreen` + module registre |
| 10 | Gouvernance | Note « Ajouter un producteur » |
| — | Tests | Bascule Âmes, diffusion → Wallet, scan idempotent |

## Tests

- Bascule Première ↔ Deuxième Âme : panier / wallet / messages continus (mêmes contenus des deux côtés).
- Bout-en-bout : producteur diffuse (Épée) → habitant abonné reçoit la bannière → détail → billet → Wallet.
- Lanterne : scan → récompense ; re-scan → `replayed` sans double récompense.
- Portes réelles : Événements / Lanternes / Murmures / Mes adresses renvoient les bonnes projections ; stats du hero cohérentes avec l'Event Engine.
- États honnêtes : IA / météo / patrimoine affichent « Bientôt » proprement, sans casser la page ; erreurs réseau gérées.

## Points d'attention

- Bascule entre Âmes = unique ajout additif côté Première Âme (entrée drawer) ; réévaluable plus tard comme demandé.
- Nettoyage des listeners socket (bannière) pour éviter les fuites ; bannière clients uniquement.
- `expo-camera` sur web : prévoir la saisie manuelle en repli.
- Frontière stricte : la surface compose, l'organe ne connaît pas les portes ; ne pas réintroduire de logique métier dans les écrans.
