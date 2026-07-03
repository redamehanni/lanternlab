# Ma Zone — Architecture actuelle du MVP

> Document de référence décrivant **l'état réel du code** (juin 2026), pas l'architecture cible.
> Stack : **Expo / React Native** (`mobile/`) + **Node.js / Express / SQLite** (`backend/`).

---

## 1. Vue d'ensemble

```
┌─────────────────┐     HTTP REST + JWT      ┌──────────────────────────────┐
│  App mobile     │ ◄──────────────────────► │  backend/src/index.js        │
│  (3 rôles)      │     Socket.io (JWT auth) │  Express + Socket.io :4000   │
└─────────────────┘                          └──────────────┬───────────────┘
                                                            │
                                                            ▼
                                               ┌──────────────────────────────┐
                                               │  SQLite  backend/data/mazone.db │
                                               └──────────────────────────────┘
```

| Couche | Technologie |
|--------|-------------|
| Mobile | Expo, React Navigation (tabs + stacks), Axios, socket.io-client |
| API | Express, better-sqlite3, JWT, Socket.io |
| Persistance | SQLite WAL, migrations incrémentales au démarrage |
| Temps réel | Socket.io avec rooms par utilisateur / commande / conversation |

**Rôles utilisateur** : `client` | `merchant` | `driver` (table `users.role`).

---

## 2. Modèles de données

### 2.1 User (`users`)

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | TEXT PK | UUID |
| `name`, `email`, `password` | TEXT | Identité + auth |
| `phone`, `address` | TEXT | Contact |
| `role` | TEXT | `client` \| `merchant` \| `driver` |
| `lat`, `lng` | REAL | Position (livreur notamment) |
| `transport` | TEXT | Moyen de transport livreur |
| `photo_url` | TEXT | Avatar |
| `driver_online` | INTEGER | `0` / `1` — livreur disponible pour dispatch |
| `first_name`, `last_name`, `vehicle_plate` | TEXT | Migrations optionnelles |
| `created_at` | TEXT | datetime SQLite |

**Relations** : un commerçant possède un `store` ; un client passe des `orders` ; un livreur reçoit des `missions`.

### 2.2 Order (`orders`)

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | TEXT PK | UUID |
| `client_id` | TEXT FK → users | Client |
| `product_id` | TEXT FK → products | Produit commandé |
| `store_id` | TEXT FK → stores | Boutique |
| `quantity` | INTEGER | Quantité |
| `total_price` | REAL | Montant TTC |
| `status` | TEXT | Voir § 3.1 |
| `delivery_address` | TEXT | Adresse de livraison |
| `estimated_minutes` | INTEGER | ETA calculée (`lib/geo.js`) |
| `created_at`, `updated_at` | TEXT | Horodatage |

**Relation 1:1** avec `missions` (une mission par commande, créée à la commande).

**Vue enrichie** : `getFullOrder()` (`backend/src/lib/orders.js`) joint client, produit, store, mission, livreur.

### 2.3 Mission (`missions`)

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | TEXT PK | UUID |
| `order_id` | TEXT FK → orders | Commande liée |
| `driver_id` | TEXT FK → users | Livreur (null tant que non attribuée) |
| `status` | TEXT | Voir § 3.2 |
| `accepted_at` | TEXT | Date d'attribution |
| `created_at`, `updated_at` | TEXT | Horodatage |

**Vue enrichie** : `getFullMission()` (`backend/src/lib/dispatch.js`) joint commande, produit, store, client, livreur.

### 2.4 Modèles connexes (MVP)

| Table | Rôle |
|-------|------|
| `stores` | Boutique du commerçant |
| `products` | Catalogue + stock |
| `conversations` | Messagerie par paire (`client_merchant`, `client_driver`, `merchant_driver`) |
| `cart_items` | Panier client |
| `promotions` | Promos commerçant |
| `driver_broadcast` | Message global affiché aux livreurs |
| `driver_notifications` | Notifications système livreur |

---

## 3. Statuts existants

### 3.1 Statuts commande (`orders.status`)

**Canoniques** (définis dans `backend/src/lib/orderStatus.js`) :

| Statut | Label UI (`mobile/src/config.js`) | Signification |
|--------|-----------------------------------|---------------|
| `placed` | Commande passée | Rarement utilisé ; création utilise `pending_driver` |
| `pending_driver` | En attente de livreur | Commande créée, pas encore attribuée |
| `driver_assigned` | Livreur assigné | Livreur attribué automatiquement |
| `picking_up` | En route vers le commerce | Mission en cours |
| `picked_up` | Produit récupéré | Colis pris au commerçant |
| `delivering` | En route vers vous | Livraison en cours |
| `delivered` | Livré | Terminé |
| `cancelled` | Annulée | Annulation client |

**Alias legacy** encore présents en base / normalisés côté backend :

| Alias | Mappé vers |
|-------|------------|
| `pending` | `pending_driver` |
| `searching_driver` | `pending_driver` |
| `offered` | `pending_driver` |
| `accepted` | `driver_assigned` |
| `accepted_by_driver` | `driver_assigned` |

> Au démarrage du serveur, `backend/src/db/index.js` exécute des `UPDATE` pour ramener les anciens statuts vers `pending_driver` / `driver_assigned` et libérer les missions `offered`.

### 3.2 Statuts mission (`missions.status`)

| Statut | Signification |
|--------|---------------|
| `available` | Mission créée, en attente d'attribution |
| `accepted` | Livreur attribué (équivalent « course active ») |
| `picking_up` | En route vers le commerçant |
| `picked_up` | Produit récupéré |
| `delivering` | En route vers le client |
| `delivered` | Livraison terminée |
| `cancelled` | Commande annulée |

**Mission active** (bloque le dispatch) : `accepted`, `picking_up`, `picked_up`, `delivering`.

---

## 4. Flux complet d'une commande

### 4.1 Diagramme

```
CLIENT                          BACKEND                           LIVREUR (en ligne)
  │                                │                                    │
  │ POST /api/orders               │                                    │
  ├──────────────────────────────►│ createOrderWithDispatch()          │
  │                                │  → order: pending_driver           │
  │                                │  → mission: available              │
  │                                │                                    │
  │                                │ tryDispatchNewOrder()              │
  │                                │  → findAvailableDriver()           │
  │                                │     (driver_online=1, pas de       │
  │                                │      mission active)               │
  │                                │  → assignOrderToDriver()           │
  │                                │     order → driver_assigned        │
  │                                │     mission → accepted             │
  │                                │                                    │
  │                                │ Socket mission:assigned ──────────►│ DriverContext
  │                                │                                    │ → activeMission
  │                                │                                    │ → DriverHomeScreen
  │                                │                                    │   fullscreen + MissionDrawer
  │                                │                                    │
  │◄── order:status_updated ───────│ emitOrderUpdate()                  │
  │                                │                                    │
COMMERÇANT ◄── order:new ──────────│ notifyMerchantNewOrder()           │
  │                                │                                    │
  │                                │         PATCH mission/status       │
  │                                │◄───────────────────────────────────┤
  │                                │  picked_up → delivering → delivered│
  │                                │                                    │
  │                                │ Si delivered:                      │
  │                                │  assignPendingOrdersToDriver()     │
  │                                │  (file d'attente suivante)         │
```

### 4.2 Étapes détaillées

| # | Étape | Fichier / fonction |
|---|-------|-------------------|
| 1 | Client passe commande | `POST /api/orders` ou `POST /api/orders/cart` → `routes/orders.js` |
| 2 | Création commande + mission | `createOrderWithDispatch()` → `lib/dispatch.js` |
| 3 | Notification commerçant | `notifyMerchantNewOrder()` → socket `order:new` |
| 4 | Dispatch automatique | `tryDispatchNewOrder()` → `findAvailableDriver()` → `assignOrderToDriver()` |
| 5 | Si aucun livreur libre | Commande reste `pending_driver`, mission `available` (file d'attente) |
| 6 | Livreur repasse en ligne | `PUT /api/drivers/online` ou socket `driver:online` → `assignPendingOrdersToDriver()` |
| 7 | Réception livreur | Socket `mission:assigned` → `DriverContext` → `DriverHomeScreen` |
| 8 | Workflow livraison | `PATCH /api/missions/:id/status` → `MissionDrawer` + `SlideConfirm` |
| 9 | Fin de course | `delivered` → libère le livreur → dispatch de la prochaine commande en file |

### 4.3 Conditions du dispatch (`findAvailableDriver`)

Un livreur est éligible si **toutes** ces conditions sont vraies :

1. `users.role = 'driver'`
2. `users.driver_online = 1`
3. Aucune mission en statut `accepted` | `picking_up` | `picked_up` | `delivering`

Sinon `tryDispatchNewOrder()` retourne `null` et la commande reste en attente.

---

## 5. Socket.io

### 5.1 Authentification et rooms

Fichier : `backend/src/socket/handlers.js`

À la connexion (JWT dans `handshake.auth.token`) :

| Room | Qui rejoint | Usage |
|------|-------------|-------|
| `user_{id}` | Tous les rôles | Événements personnels (ex. `mission:assigned`) |
| `merchant_{id}` | Commerçants | Commandes boutique |
| `drivers_available` | Livreurs en ligne | Broadcast missions prises |
| `order_{orderId}` | Sur demande (`join:order`) | Suivi commande |
| `conv_{conversationId}` | Sur demande (`join:conversation`) | Chat |

### 5.2 Événements émis par le client mobile

| Événement | Émetteur | Action serveur |
|-----------|----------|----------------|
| `join:order` | Client / commerçant / livreur | Rejoint `order_{id}` |
| `leave:order` | Idem | Quitte la room |
| `join:conversation` | Chat | Rejoint `conv_{id}` |
| `leave:conversation` | Chat | Quitte la room |
| `driver:online` | Livreur | `driver_online=1`, join `drivers_available`, dispatch file |
| `driver:offline` | Livreur | `driver_online=0`, leave `drivers_available` |
| `chat:typing` | Chat | Relay vers la conversation |

### 5.3 Événements émis par le serveur

| Événement | Room cible | Déclencheur | Listeners mobile |
|-----------|------------|-------------|------------------|
| `order:new` | `merchant_{id}` | Nouvelle commande | `DashboardScreen`, `MerchantOrdersScreen` |
| `order:status_updated` | `order_*`, `merchant_*`, `user_client` | Changement statut commande | Client, commerçant, suivi |
| `order:cancelled` | `order_*`, `merchant_*` | Annulation | Client, commerçant |
| `mission:assigned` | `user_{driverId}` | Attribution livreur | **`DriverContext`** → tiroir mission |
| `mission:accepted` | `order_*`, `merchant_*` | Idem (notif client/commerçant) | Client, commerçant |
| `mission:status_updated` | `order_*`, `merchant_*`, `user_driver` | MAJ statut mission | Suivi, commerçant |
| `mission:taken` | `drivers_available` | Mission plus disponible | (peu utilisé côté mobile) |
| `mission:cancelled` | `user_{driverId}` | Annulation commande | `DriverContext` |
| `message:new` | `conv_*` ou `order_*` | Nouveau message | Chat |
| `chat:typing` | `conv_*` | Frappe en cours | Chat |
| `product:stock_updated` | Broadcast global | Stock modifié | Client, commerçant |
| `promotion:*` | Broadcast global | Promos | Client, commerçant |

### 5.4 Listener critique livreur

```
Socket mission:assigned
    → DriverContext.js (onAssigned)
        → setActiveMission(mission)
        → assignedHandlerRef → DriverHomeScreen.startActiveMission()
            → fullscreen = true
            → MissionDrawer expanded
```

**Pas de filtre de statut** sur cet événement : toute mission assignée déclenche l'UI.

---

## 6. API REST critique (commandes / livreur)

| Méthode | Route | Rôle | Rôle métier |
|---------|-------|------|-------------|
| POST | `/api/orders` | client | Créer commande + dispatch |
| POST | `/api/orders/cart` | client | Valider panier |
| POST | `/api/orders/:id/cancel` | client | Annuler |
| GET | `/api/orders/mine` | client | Historique |
| GET | `/api/orders/merchant` | merchant | Commandes boutique |
| PUT | `/api/drivers/online` | driver | En ligne / hors ligne + dispatch file |
| GET | `/api/missions/mine` | driver | Missions + `active` |
| PATCH | `/api/missions/:id/status` | driver | Workflow livraison |
| POST | `/api/missions/:id/accept` | driver | Acceptation manuelle (file legacy) |

---

## 7. Mobile — structure par rôle

### Client
- Tabs : Accueil, Panier, Commandes, Menu
- Écrans clés : `HomeScreen`, `OrderConfirmScreen`, `OrderTrackingScreen`, `ClientOrdersScreen`

### Commerçant
- Tabs : Boutique, Commandes, Boîte de réception, Profil
- Écrans clés : `DashboardScreen`, `MerchantOrdersScreen`

### Livreur
- Tabs : **Accueil**, **Revenu**, **Boîte de réception**, **Menu**
- Écran principal : `DriverHomeScreen` (carte premium + bouton en ligne + `MissionDrawer`)
- Contexte : `DriverContext` (online, `activeMission`, socket)
- Carte : `DriverMap` → `PremiumMap.native.js` / `.web.js`

---

## 8. Fichiers critiques

### Backend

| Fichier | Responsabilité |
|---------|----------------|
| `backend/src/index.js` | Point d'entrée, montage routes, Socket.io |
| `backend/src/db/index.js` | Schéma SQLite + migrations statuts au boot |
| `backend/src/lib/dispatch.js` | **Moteur d'attribution** (cœur du flux commande) |
| `backend/src/lib/orderStatus.js` | Constantes et règles statuts commande |
| `backend/src/lib/orders.js` | `getFullOrder()` |
| `backend/src/lib/missions.js` | Liste missions disponibles (file) |
| `backend/src/routes/orders.js` | Création commande |
| `backend/src/routes/missions.js` | Workflow livreur, stats revenus |
| `backend/src/routes/drivers.js` | Online/offline, broadcast |
| `backend/src/socket/handlers.js` | Rooms, `driver:online`, join order/conv |

### Mobile

| Fichier | Responsabilité |
|---------|----------------|
| `mobile/src/context/AppContext.js` | Auth, token, connexion socket |
| `mobile/src/context/DriverContext.js` | **État livreur**, listener `mission:assigned` |
| `mobile/src/screens/driver/DriverHomeScreen.js` | UI principale livreur, plein écran, tiroir |
| `mobile/src/components/driver/MissionDrawer.js` | Workflow course (slide confirm, chat, nav) |
| `mobile/src/components/maps/PremiumMap.native.js` | Carte interactive iOS/Android |
| `mobile/src/config.js` | URLs API, labels statuts |
| `mobile/src/api/index.js` | Client HTTP Axios |
| `mobile/src/navigation/index.js` | Navigation 3 rôles |

### Fichiers présents mais non branchés au flux actuel

| Fichier | Note |
|---------|------|
| `mobile/src/components/driver/NewCourseOfferModal.js` | Popup OUI/NON — **non utilisée** (flux direct) |
| `mobile/src/screens/driver/MissionsScreen.js` | Ancien écran missions |
| `mobile/src/screens/driver/ActiveMissionScreen.js` | Ancien écran mission active |

---

## 9. Points d'attention connus (état réel)

1. **File d'attente silencieuse** : si le livreur est hors ligne (`driver_online=0`) ou a une mission active non terminée, les nouvelles commandes restent en `pending_driver` sans erreur visible côté client.

2. **Mission fantôme** : une mission `accepted` en base bloque `findAvailableDriver()` même si l'UI livreur semble « libre » (ex. tiroir fermé via bouton Maison).

3. **Migrations au boot** : chaque démarrage backend normalise les statuts legacy ; ne pas s'appuyer sur `searching_driver` / `offered` comme statuts stables.

4. **Commission livreur** : 5 % du `total_price` (calculée dans `missionToBroadcast` et `/api/missions/stats`).

5. **Réseau mobile** : `mobile/src/config.js` utilise `localhost` (iOS Simulator) ou `10.0.2.2` (Android Emulator) ; téléphone physique nécessite `EXPO_PUBLIC_API_URL`.

---

## 10. Démarrage local

```bash
# Terminal 1 — API
cd backend && node src/index.js
# → http://localhost:4000

# Terminal 2 — Mobile
cd mobile && npm run ios
# → Expo :4000/8081
```

Base de données : `backend/data/mazone.db` (créée automatiquement).
