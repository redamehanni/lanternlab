# Plan de correction — Nouvelle commande & Annulation client

**Date :** 12 juillet 2026  
**Statut :** Analyse — en attente de validation avant implémentation  
**Périmètre :** Correctifs uniquement, aucune nouvelle fonctionnalité

---

## Diagnostic

### Point 1 — « Nouvelle commande » ne fait rien

**Cause racine confirmée :** chemin de navigation **obsolète** depuis le refactor Drawer (Phase UX B).

Le handler actuel dans `mobile/src/screens/client/OrderTrackingScreen.js` (L277-280) :

```javascript
navigation.navigate('HomeTab', {
  screen: 'Home',           // ← écran inexistant au niveau Drawer
  params: { reset: Date.now() },
});
```

**Arborescence réelle** (`mobile/src/navigation/index.js`) :

```
ClientTabs
├── HomeTab → HomeDrawer
│   └── HomeMain → HomeStack
│       ├── Home              ← cible réelle
│       └── OrderTracking
└── CartTab → CartStack
    ├── Cart
    └── OrderTracking
```

Le listener de l'onglet Home utilise **le bon chemin** (L216-218) :

```javascript
navigation.navigate('HomeTab', {
  screen: 'HomeMain',
  params: { screen: 'Home', params: { reset: Date.now() } },
});
```

`HomeScreen.js` écoute `route.params.reset` pour appeler `resetHome()` — mais ce paramètre **n'arrive jamais** car la navigation cible un écran fantôme `Home` au mauvais niveau.

**Cause secondaire :** `OrderTracking` existe dans **deux stacks** (`HomeStack` et `CartStack`). Même après correction du chemin, revenir sur l'onglet Panier peut réafficher l'écran de suivi « livré » si la stack n'est pas remise à zéro.

**Ce n'est PAS la cause :** absence de store `activeOrder`, listeners socket, ou logique `resetHome()` — tout cela fonctionne si les params arrivent.

**Régression :** documentée dans `MVP_0_8_1_UI_FIXES_REPORT.md` — le fix MVP 0.8.1 (`HomeTab → Home`) a été **invalidé** par l'introduction du Drawer (`HomeMain` intermédiaire).

---

### Point 2 — « Annuler la commande » sans action

**Causes multiples identifiées :**

| Cause | Impact | Fichier |
|-------|--------|---------|
| **`Alert.alert` non fonctionnel sur web** | Tap → aucune confirmation → API jamais appelée | `OrderTrackingScreen.js`, `OrderHistoryScreen.js` |
| **`cancellable` stale via socket** | `onMissionStatus` met à jour `status` mais pas `cancellable` ; le bouton peut rester visible après `picked_up` | `OrderTrackingScreen.js` L113, L179 |
| **Backend : offre pending non notifiée** | Livreur avec popup `offered` non libéré | `dispatch.js` `cancelOrderByClient` |
| **Pas de `clearOfferTimeout`** | Timer offre en mémoire non annulé | `dispatchOffer.js` |
| **Pas de `assignPendingOrdersToDriver`** | Livreur libéré en DB mais pas re-proposé | `cancelOrderByClient` |
| **`DriverContext` ne clear pas `pendingOffer`** | Popup livreur persiste après annulation | `DriverContext.js` |
| **Pas de retour état normal post-annulation** | Client reste bloqué sur écran suivi annulé | `OrderTrackingScreen.js` |

**Infrastructure déjà en place (à réutiliser) :**

- API mobile : `POST /api/orders/:id/cancel`
- Route backend : `backend/src/routes/orders.js`
- Règle métier : `backend/src/lib/orderStatus.js` — annulation autorisée jusqu'à `picking_up` inclus, **interdite** dès `picked_up`
- Helper cross-plateforme : `mobile/src/utils/confirm.js` → `confirmAction()`

**Flux corrigé attendu :**

1. Client tape « Annuler »
2. `confirmAction()` (web + mobile)
3. `POST /orders/:id/cancel`
4. `cancelOrderByClient()` : DB + stock + `clearOfferTimeout`
5. Socket `mission:cancelled` vers livreur assigné **et** livreur en offre
6. `assignPendingOrdersToDriver()` pour libérer le dispatch
7. Client : `navigateToFreshHome()` → état propre pour nouvelle commande

---

## Plan de correction

### Étape 1 — Utilitaire navigation partagé (Point 1 + Point 2)

Créer `mobile/src/navigation/navigateToFreshHome.js` :

- Remonter au navigateur Tab racine
- Naviguer vers `HomeTab → HomeMain → Home` avec `{ reset: Date.now() }`
- Réinitialiser la stack `CartTab` pour éviter un suivi stale au retour sur Panier
- Réutiliser dans `OrderTrackingScreen` et le listener onglet Home

### Étape 2 — Corriger « Nouvelle commande » (Point 1)

Dans `OrderTrackingScreen.js` : remplacer le handler par `navigateToFreshHome(navigation)`.

### Étape 3 — Corriger l'annulation client mobile (Point 2)

- `confirmAction()` au lieu de `Alert.alert`
- `order.id` pour l'appel API
- `showCancel = active && canCancelOrder(order.status)` (source unique)
- Mettre à jour `cancellable` dans tous les handlers socket
- Après annulation : `navigateToFreshHome(navigation)`
- Même fix dans `OrderHistoryScreen.js`
- Ajouter `'offered'` à `CANCELLABLE_ORDER_STATUSES` dans `config.js`

### Étape 4 — Renforcer `cancelOrderByClient` backend

Sans toucher au cœur transactionnel :

1. SELECT `offered_to_driver_id`
2. `clearOfferTimeout(mission_id)`
3. NULL `driver_id`, `offered_to_driver_id`, `offer_expires_at` sur mission
4. `mission:cancelled` vers les deux livreurs concernés
5. `assignPendingOrdersToDriver()` pour chaque livreur libéré

**Hors périmètre :** `assignOrderToDriver`, `tryDispatchNewOrder`, Communication Engine.

### Étape 5 — Propagation côté livreur

Dans `DriverContext.js` : clear `pendingOffer` sur `mission:cancelled`.

---

## Tests de non-régression prévus

| ID | Scénario | Attendu |
|----|----------|---------|
| T1 | Commande livrée → « Nouvelle commande » | Accueil reset, pas de suivi stale |
| T2 | Livrée via CartStack → « Nouvelle commande » | Panier ne rouvre pas le suivi |
| T3 | Annulation web | `window.confirm` → API → `cancelled` |
| T4 | Annulation iOS/simulateur | Confirmation → annulation OK |
| T5 | Statut `picked_up` via socket | Bouton annuler disparaît |
| T6 | Annulation avec offre `offered` | Popup livreur disparaît |
| T7 | Annulation livreur `accepted` | Livreur libéré, dispatch relancé |
| T8 | Accept/refuse offre dispatch | Non-régression |
| T9 | Communication Engine post-annulation | Chats éphémères archivés |

---

## Fichiers impactés (7 fichiers)

| Fichier | Modification |
|---------|-------------|
| `mobile/src/navigation/navigateToFreshHome.js` | **Nouveau** |
| `mobile/src/navigation/index.js` | Réutiliser utilitaire |
| `mobile/src/screens/client/OrderTrackingScreen.js` | Navigation + cancel |
| `mobile/src/screens/client/OrderHistoryScreen.js` | confirmAction |
| `mobile/src/config.js` | Ajout `offered` |
| `backend/src/lib/dispatch.js` | Enrichissement cancel |
| `mobile/src/context/DriverContext.js` | Clear pendingOffer |

---

*Document généré pour validation avant implémentation.*
