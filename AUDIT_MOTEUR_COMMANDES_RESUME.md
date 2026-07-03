# Ma Zone — Résumé audit moteur de commandes

**Date :** juin 2026 · **Type :** analyse en lecture seule (aucune modification de code)

---

## Conclusion principale

Le flux **Client → Commande → Dispatch → Livreur** fonctionne en théorie, mais se rompt le plus souvent **avant l’émission socket**, dans `findAvailableDriver()` (`backend/src/lib/dispatch.js`).

**Symptôme utilisateur :** commandes bloquées sur « En attente de livreur » (`pending_driver`), livreur ne reçoit rien.

**Cause racine typique :** aucun livreur éligible (`driver_online = 0` et/ou mission active `accepted` non terminée en base).

---

## Flux en 7 étapes

| Étape | Composant | Résultat |
|-------|-----------|----------|
| 1 | Client `POST /api/orders` | OK |
| 2 | `createOrderWithDispatch()` | Order `pending_driver` + mission `available` |
| 3 | `notifyMerchantNewOrder()` | Commerçant notifié (`order:new`) |
| 4 | `tryDispatchNewOrder()` → `findAvailableDriver()` | **POINT DE RUPTURE** si aucun livreur libre |
| 5 | `assignOrderToDriver()` | Order `driver_assigned`, mission `accepted` |
| 6 | Socket `mission:assigned` → `user_{driverId}` | **POINT DE RUPTURE** si socket déconnecté |
| 7 | `DriverContext` → `DriverHomeScreen` → `MissionDrawer` | Tiroir + workflow livraison |

---

## Fichiers critiques

### Backend
- `backend/src/lib/dispatch.js` — moteur dispatch (cœur)
- `backend/src/routes/orders.js` — création commande
- `backend/src/routes/missions.js` — workflow livreur
- `backend/src/routes/drivers.js` — en ligne / file d’attente
- `backend/src/socket/handlers.js` — rooms + `driver:online`
- `backend/src/lib/orderStatus.js` — statuts
- `backend/src/db/index.js` — schéma + migrations au boot

### Mobile livreur
- `mobile/src/context/DriverContext.js` — listener `mission:assigned`
- `mobile/src/screens/driver/DriverHomeScreen.js` — plein écran + tiroir
- `mobile/src/components/driver/MissionDrawer.js` — prise en charge / livraison

### Mobile client
- `mobile/src/screens/client/OrderConfirmScreen.js` — passe commande
- `mobile/src/screens/client/OrderTrackingScreen.js` — suivi temps réel

---

## Fonctions critiques

| Fonction | Fichier | Rôle |
|----------|---------|------|
| `createOrderWithDispatch` | dispatch.js | Crée order + mission |
| `tryDispatchNewOrder` | dispatch.js | Lance l’attribution |
| `findAvailableDriver` | dispatch.js | Cherche livreur en ligne sans mission active |
| `assignOrderToDriver` | dispatch.js | Attribution + sockets |
| `assignPendingOrdersToDriver` | dispatch.js | Vide la file (online, delivered) |
| `driverHasActiveMission` | dispatch.js | Bloque si mission en cours |
| `PATCH /missions/:id/status` | missions.js | Workflow jusqu’à `delivered` |
| `DriverContext.syncOnline` | DriverContext.js | En ligne : API + socket |
| `startActiveMission` | DriverHomeScreen.js | Ouvre tiroir plein écran |

---

## Socket.io — événements clés

**Émis par le serveur (flux commande)**
- `order:new` → commerçant
- `order:status_updated` → client, commerçant, room commande
- `mission:assigned` → **livreur** (`user_{driverId}`) — événement critique
- `mission:accepted` → client, commerçant
- `mission:status_updated` → suivi course
- `mission:cancelled` → livreur

**Écouté côté livreur**
- `DriverContext` : `mission:assigned`, `mission:cancelled` uniquement
- Pas de filtre de statut sur `mission:assigned`

**Rooms**
- `user_{id}`, `merchant_{id}`, `drivers_available`, `order_{orderId}`

---

## Statuts

### Commande (`orders.status`)
```
pending_driver → driver_assigned → picking_up → picked_up → delivering → delivered
                                                                    ↘ cancelled
```
Alias legacy encore en base : `searching_driver`, `offered`, `accepted`, `accepted_by_driver` (normalisés au boot).

### Mission (`missions.status`)
```
available → accepted → picking_up → picked_up → delivering → delivered
                                                        ↘ cancelled
```
Le `MissionDrawer` saute souvent `picking_up` (UI va directement à `picked_up`).

---

## 10 fragilités majeures

1. **Dispatch silencieux** — `tryDispatchNewOrder` retourne `null` sans log ni retry.
2. **Triple source « en ligne »** — SQLite, AsyncStorage, socket room (désync possible).
3. **Race au boot** — `GET /mine` peut charger une mission active avant que le handler tiroir soit enregistré.
4. **Bouton Maison** — ferme le plein écran mais garde `activeMission` → UI « libre », DB occupée.
5. **`picking_up` ignoré** par l’UI livreur.
6. **Double chemin d’attribution** — auto (`dispatch`) vs manuel (`POST /accept`).
7. **PATCH order** sans sync mission — désynchronisation possible.
8. **Panier multi-articles** — 1er article occupe le livreur, reste en file.
9. **Disconnect socket** — émet `driver:offline` pour tous les rôles.
10. **Migrations au boot** — réécriture statuts `offered` legacy.

---

## Risques de blocage (top 5)

| # | Scénario | Symptôme |
|---|----------|----------|
| B1 | Livreur `driver_online = 0` | Aucune attribution |
| B2 | Mission `accepted` non terminée | File figée pour ce livreur |
| B3 | Un seul livreur, déjà occupé | Toutes commandes en attente |
| B4 | Socket déconnecté à l’attribution | Mission en DB, pas de tiroir |
| B5 | Reconnexion avec mission active | File non vidée tant que pas `delivered` |

---

## Risques de missions fantômes (top 5)

Mission en base (`accepted`+) invisible côté UI, bloquant le dispatch.

| # | Cause |
|---|-------|
| G1 | Bouton Maison ferme l’UI, mission reste active |
| G2 | Race handler au chargement (`GET /mine`) |
| G3 | Socket `mission:assigned` manqué, pas de rattrapage |
| G4 | Course jamais passée à `delivered` |
| G5 | Désync order/mission via PATCH manuel |

---

## 3 points de rupture du flux

```
1. findAvailableDriver()     → livreur offline ou occupé
2. mission:assigned socket   → livreur non connecté à user_{id}
3. DriverContext race        → mission en mémoire, tiroir non ouvert
```

---

## Corrections minimales suggérées (non appliquées)

1. Garantir ouverture tiroir si `GET /mine` retourne `active`.
2. Ne pas afficher livreur « libre » tant qu’une mission active existe.
3. Logs quand dispatch échoue (offline / busy / aucun driver).
4. Réémettre `mission:assigned` à la reconnexion si mission active en DB.
5. Après `delivered` ou annulation : toujours tenter `assignPendingOrdersToDriver`.

---

*Résumé de l’audit complet — voir aussi CURRENT_ARCHITECTURE.md*
