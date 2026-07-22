# Compte rendu — Audit & consolidation de la Deuxième Âme (V1)

**Date :** 22 juillet 2026  
**Objet :** Audit et consolidation de la première version de production de la Deuxième Âme  
**Périmètre :** Navigation entre Âmes, création d'initiatives, Laboratoire, Mode Réception, billetterie / places limitées

---

## Démarche

Pour chaque point, reproduction et remontée à la **cause racine** (backend + DB + front) avant toute modification, puis corrections **génériques et durables**, fidèles à la règle « la surface compose, l'organe décide ».

Tout a été validé par des tests exécutés (voir section Tests).

---

## 1. Navigation entre les deux Âmes — incohérence corrigée

### Problème / cause

Deux mécanismes différents pour la même action :

- depuis la **Première Âme** : passage via un CTA dans le **drawer** ;
- depuis la **Deuxième Âme** : petite icône « storefront » dans la bannière, présente uniquement sur l'écran d'accueil (absente des onglets Messages / Wallet / Panier).

### Décision UX

Retention d'un **bouton de bascule flottant unique**, plutôt qu'un second hamburger : seul choix qui garantit un geste **strictement identique, toujours visible, dans les deux sens**, sur **tous** les écrans, sans alourdir la Deuxième Âme d'un drawer.

### Correction

| Élément | Détail |
|---------|--------|
| Nouveau composant | `mobile/src/components/common/SoulSwitchFab.js` — même look, même position (bas-droite, au-dessus de la barre d'onglets), libellé orienté **destination** (« Deuxième Âme » / « Marketplace ») |
| Montage | Identique sur les deux faces (`FirstSoulScreen` et `SecondSoulScreen` dans `navigation/index.js`) |
| Suppressions | CTA du drawer (`ClientDrawerContent`) et icône storefront de la bannière (`AmeHeader`) |

**Résultat :** un seul mécanisme, symétrique et omniprésent.

---

## 2. Création d'initiative — cause racine trouvée, bug levé

### Ce n'était pas un bug de code

Tests effectués :

- `events.createEvent` + `publishEvent` en direct : **OK**
- Les marchands ont bien un `store_members` (donc pas de 403)
- **`GET /api/events/types` sur le serveur en cours → HTTP 404**, alors que `src/index.js` monte bien `/api/events`

### Cause racine

Le **process backend tournait depuis le 16/07**, soit **avant l'intégration de l'Event Engine**. Le serveur en mémoire ne servait donc **aucune** route `/api/events` → tout appel renvoyait 404.

Côté mobile, ce 404 tombait dans un `catch` qui n'affichait qu'une `Alert` — **peu / pas visible sur le build web** → sensation de « rien ne se passe ».

### Corrections

1. **Redémarrage propre du backend** — le nouveau process sert bien les routes (`types → 401` auth au lieu de `404`). Flux complet **création → publication** revalidé en HTTP réel.

2. **Robustesse durable du front** (`CreateEventScreen`) pour que ce type de panne ne soit **plus jamais silencieux** :
   - retours d'erreur via `toast` (fiable sur web, contrairement à `Alert`) ;
   - message explicite si les types ne chargent pas + **état d'erreur avec bouton « Réessayer »** ;
   - message dédié en cas de 404 (« Service indisponible (serveur à redémarrer ?) ») ;
   - garde sur la réponse serveur inattendue.

---

## 3. Laboratoire — véritable simulateur de monde

Enrichi **sans nouveau super-pouvoir** (toujours via les organes) :

### Nouvelle recette `monde_evenementiel`

Fichier : `worldFactory/recipes/mondeEvenementiel.js`

En un clic, génère un catalogue **déclaratif** d'initiatives variées par commerce :

- atelier **ouvert**
- atelier **gratuit sur réservation**
- atelier **payant**
- **dégustation**
- **promotion**
- **Lanternes activées** (découvrables et présentes dans les Murmures)

Les habitants sont abonnés au Mode Réception. Ajouter un cas de test = ajouter une entrée dans `SCENARIOS`.

### Primitive `transitionEventInitiative`

Ajoutée au contexte worldFactory : indispensable pour activer les Lanternes (`hidden → active`), ce que `publish` ne couvre pas (cycle de vie spécialisé).

### Actions de labo enrichies (`lab/actions/events.js`)

| Action | Description |
|--------|-------------|
| `create_event` | Accepte désormais **réservation** (ouvert / gratuit / payant), **prix**, **jauge**, **canaux**, **publication** |
| `set_mode_reception` | Nouvelle — régler les canaux d'écoute d'un habitant |
| `issue_ticket` | Nouvelle — réserver un billet |
| `discover_lantern` | Nouvelle — simuler un scan de Lanterne |

Tout le parcours est désormais testable depuis le Lab.

### UI `LabPowers` (admin-web)

Ajout des widgets manquants **`boolean`, `multi`, `number`** et **affichage du résultat** (dont l'`id` renvoyé), pour enchaîner créer → publier → diffuser sans copier-coller à l'aveugle.

---

## 4. Mode Réception — icônes (bannière refondue)

Dans `AmeHeader` :

- **Suppression** du raccourci **Messagerie** (déjà dans la barre d'onglets) et de l'icône storefront (bascule désormais via le bouton flottant).
- **Cloche remplacée** par une **boîte aux lettres à fanion** (`MaterialCommunityIcons`) :
  - **`mailbox-up` (fanion levé) = activé**
  - **`mailbox-outline` (fanion baissé) = désactivé**
  - renforcée par un liseré / fanion rouge et un fond accentué à l'état actif

La même métaphore est reprise dans le popover.

Il ne reste que deux accès sans ambiguïté : **boîte aux lettres** (réception) et **profil**.

---

## 5. Mode Réception — audit de fonctionnement

### Ce qui est implémenté (et fonctionne)

- Abonnements habitant : `GET/PUT /api/events/reception` → `diffusion.setSubscriptions` (remplace l'ensemble des canaux, validation des canaux connus, table `event_subscriptions`).
- UI : toggle rapide (popover) + écran de réglage fin (`ModeReceptionScreen`), avec retours `toast`.
- Diffusion active (Opportunité Volante) : `diffuseEvent` → `runOpportunity` cible les abonnés et **émet `event:opportunity`** en temps réel ; côté client `OpportunityContext` écoute et `OpportunityBanner` s'affiche ; côté commerçant `DiffuseOpportunityScreen` déclenche la campagne. **Idempotence** assurée.

### Pourquoi « impossible d'activer » aujourd'hui

**Même cause qu'au point 2** : le serveur périmé renvoyait 404 sur `/reception` → `get/setModeReception` échouaient dans un `catch` silencieux → le toggle semblait inopérant.

**Résolu par le redémarrage** ; activation revalidée (les abonnements sont bien créés).

### Opportunités Volantes — état

Le **cœur est complet** pour l'envoi **immédiat** (ciblage par canal + zone, temps réel, journal, idempotence, historique des diffusions).

**Dépendances restantes :**

| Dépendance | État |
|------------|------|
| Fenêtre de programmation (`windowStart` / `windowEnd`) | Stockée mais **pas d'ordonnanceur** (envoi immédiat uniquement) → nécessite un scheduler |
| Ciblage géographique fin par rayon | `radiusKm` est stocké mais `matchSubscribers` ne filtre que par `zoneId` |
| Notifications hors-ligne (push) | La diffusion n'atteint que les habitants **connectés au socket**. Un canal push (APNs / FCM) reste à brancher |

### Types d'initiatives réellement supportés par le moteur

| Type | Capacités | Notes |
|------|-----------|-------|
| **atelier** | `canRSVP`, `hasCapacity`, **`canTicket`** *(ajouté)*, `isFlyable` | Type générique : ouvert **ou** à places limitées (gratuit / payant) |
| **degustation** | `canTicket`, `hasCapacity`, `isFlyable` | Initiative commerçante billetterie |
| **promo** | `isFlyable` | Projection d'une promo existante |
| **lanterne** | `isLantern`, `isMurmur` | Cycle de vie spécialisé (`hidden → active → discovered`) |

---

## 6. Événements à places limitées — modèle générique

### Principe retenu

Sans dupliquer de logique, sans nouveau type. Le **régime de réservation est un choix d'INSTANCE**, porté par la donnée opaque `payload.reservation` que le cœur ne fait que transporter :

```
{ mode: 'open' | 'ticket', price?: number, currency?: 'EUR' }
```

- `canTicket` reste une **éligibilité de type** (« ce type PEUT proposer une billetterie ») — ajoutée à `atelier` pour couvrir « ouvert » **et** « places limitées » avec un seul type.
- La billetterie **réutilise l'existant** : le billet **est** un objet Wallet (`event_ticket`), émis par `orchestration.issueTicket`, jauge via le journal (`ticketsIssued`).

### Backend

| Élément | Rôle |
|---------|------|
| `orchestration.reservationOf(event)` | Résout le régime (rétrocompatible — une initiative billetterie historique à jauge = « réservation gratuite ») |
| `issueTicket` | Refuse un billet sur un événement **ouvert** (409), applique la jauge, inscrit prix + devise dans le payload / affichage du billet |
| `getEventById` | Renvoie un bloc **`reservation` enrichi** (`required`, `price`, `currency`, `capacity`, `ticketsIssued`, `seatsLeft`, `soldOut`) → la surface affiche sans aucune règle métier |

### Mobile

- **`CreateEventScreen`** : sélecteur **Ouvert à tous / Places limitées**, puis **Gratuit / Payant** (prix configurable) + **nombre de places** (optionnel) — visible uniquement pour les types billetterie.
- **`EventDetailScreen`** : affiche « Sur réservation · prix », **places restantes / Complet**, CTA « Réserver — Gratuit / X € », ou « Ouvert à tous — participation libre » sinon.

### Extensibilité

De futurs régimes (liste d'attente, quotas par profil, dons libres…) s'ajoutent en enrichissant `reservation` — **sans nouveau type ni refonte**.

### Dépendance assumée (honnête)

Il n'existe pas encore d'organe **Paiement** : pour un billet payant, le billet est **émis avec son prix**, mais le **règlement en ligne** reste à brancher (indiqué explicitement dans l'UI et le code). Le flux **gratuit** est complet de bout en bout.

---

## Améliorations d'architecture réalisées

1. **Bascule d'Âme unifiée** — un composant partagé monté sur les deux faces ; suppression des deux mécanismes divergents.
2. **Régime de réservation au niveau instance** (`payload.reservation`) — Open/Closed : étendre sans nouveau type ni refonte du cœur.
3. **`canTicket` sur atelier** — éligibilité de type, pas obligation ; le choix réel est à l'instance.
4. **Projection `reservation` dans `getEventById`** — la surface n'a aucune règle métier à recalculer.
5. **Recette Lab déclarative** — peuplement riche sans insert SQL direct (orchestration Event Engine).
6. **`transitionEventInitiative`** — permet d'activer les Lanternes dans le monde de démo.

---

## Tests effectués

| Test | Résultat |
|------|----------|
| Cœur : `createEvent` + `publishEvent` (direct et HTTP réel login → create → publish) | HTTP 201 — OK |
| Réservation : billet refusé sur événement ouvert (409) ; billet payant portant prix + devise ; `getEventById.reservation` (places restantes / soldOut) | OK |
| Laboratoire : recette `monde_evenementiel` → 12 initiatives, toutes découvrables (`atelier`, `degustation`, `lanterne`, `promo`), Lanternes en Murmures, reset propre (19 entités) | OK |
| Non-régression : `scripts/test-sandbox-events.js` | **7 / 7** |
| Front : compilation Babel des 8 fichiers modifiés ; glyphes `mailbox*` | 0 lint — OK |
| Serveur : routes `/api/events` et `/api/admin/world` montées après redémarrage | 401 (auth), plus 404 |

---

## Recommandations avant de poursuivre

1. **Dev sans piège de serveur périmé** — lancer le backend avec un watcher (`nodemon`) et / ou afficher un **bandeau « API injoignable »** global côté mobile (le 404 silencieux a coûté du temps de diagnostic).
2. **Organe Paiement** — prérequis pour finaliser les billets **payants** (règlement + remboursement + annulation).
3. **Ordonnanceur de diffusion** — pour honorer `windowStart` / `windowEnd` (Opportunités Volantes programmées).
4. **Ciblage géographique** — implémenter le filtre par `radiusKm` dans `matchSubscribers`.
5. **Push hors-ligne** — brancher APNs / FCM pour toucher les habitants non connectés.
6. **Annulation de réservation** — exposer côté habitant la libération d'une place (le Wallet gère déjà `revoke` / `consume`).

---

## Fichiers principaux touchés

### Backend

- `backend/src/lib/eventEngine/types/atelier.js`
- `backend/src/lib/eventEngine/orchestration.js`
- `backend/src/lib/eventEngine/index.js`
- `backend/src/lib/worldFactory/context.js`
- `backend/src/lib/worldFactory/index.js`
- `backend/src/lib/worldFactory/recipes/mondeEvenementiel.js` *(nouveau)*
- `backend/src/lib/lab/actions/events.js`

### Mobile

- `mobile/src/components/common/SoulSwitchFab.js` *(nouveau)*
- `mobile/src/navigation/index.js`
- `mobile/src/components/client/ClientDrawerContent.js`
- `mobile/src/components/deuxiemeAme/AmeHeader.js`
- `mobile/src/components/deuxiemeAme/ModeReceptionPopover.js`
- `mobile/src/screens/deuxiemeAme/DeuxiemeAmeHomeScreen.js`
- `mobile/src/screens/deuxiemeAme/EventDetailScreen.js`
- `mobile/src/screens/merchant/CreateEventScreen.js`

### Admin-web (Laboratoire)

- `admin-web/src/pages/ExplorerPage.jsx`

---

*Fin du compte rendu — Ma Zone · Deuxième Âme V1 · Audit & consolidation*
