# Rapport d'implémentation — Raffinement du modèle métier « livreur occupé »

**Date :** 22 juin 2026  
**Statut :** Correction appliquée et validée par tests automatisés  
**Référence :** [AUDIT_POPUP_ACCEPT_LIVREUR.md](./AUDIT_POPUP_ACCEPT_LIVREUR.md)

---

## 1. Contexte et objectif

Le bug observé (HTTP **409** à l'acceptation d'une offre popup) n'était qu'un **symptôme**. La cause structurelle était l'utilisation d'une fonction générique `driverHasActiveMission()` qui mélangeait deux notions métier distinctes :

| Concept | Statuts / données | Signification |
|---------|-------------------|---------------|
| **Mission acceptée** | `accepted`, `picking_up`, `picked_up`, `delivering` + `driver_id` | Le livreur est engagé dans une livraison en cours |
| **Offre en attente** | `offered` + `offered_to_driver_id` + `offer_expires_at` | Le livreur a reçu une proposition qu'il n'a pas encore acceptée ni refusée |

Ces deux états obéissent à des règles différentes :

- **Accepter une offre** ne doit pas être bloqué par l'offre elle-même — seule une mission déjà acceptée doit empêcher une nouvelle acceptation.
- **Proposer une nouvelle course** doit tenir compte des deux cas : livreur en livraison **ou** déjà en train de répondre à une offre.

L'implémentation traite cette correction comme un **raffinement explicite du modèle métier**, pas comme un simple correctif ponctuel.

---

## 2. Fichiers modifiés

| Fichier | Nature des changements |
|---------|------------------------|
| `backend/src/lib/dispatch.js` | Scission des responsabilités métier ; garde `assignOrderToDriver` ; export des nouvelles fonctions |
| `backend/src/lib/dispatchOffer.js` | Garde `proposeOrderToDriver` basée sur `driverIsBusyForNewOffer` |
| `mobile/src/screens/driver/DriverHomeScreen.js` | Robustesse UX : fallback HTTP, message d'erreur API, pause du timer pendant l'acceptation |

**Fichiers volontairement non modifiés** (conformément à l'audit) :

- Cœur transactionnel SQL de `assignOrderToDriver()` (UPDATE missions / orders inchangé)
- `findAvailableDriver()` — moteur de sélection du livreur le plus ancien en ligne
- `tryDispatchNewOrder()` — délégation offer/assign inchangée
- Routes `missions.js` — logique accept/refuse déjà correcte (`clearOfferTimeout` puis `assignOrderToDriver`)
- `DriverContext.js`, `NewCourseOfferModal.js` — hors périmètre du correctif

---

## 3. Nouvelles responsabilités des fonctions

### 3.1 `driverHasAcceptedMission(driverId)`

**Rôle :** Indique si le livreur est **engagé dans une mission active de livraison**.

**Requête :** missions où `driver_id = driverId` et `status IN ('accepted', 'picking_up', 'picked_up', 'delivering')`.

**Usage :**

- Garde dans `assignOrderToDriver()` — une offre `offered` en cours **n'est pas** un blocage.

### 3.2 `driverHasPendingOffer(driverId, excludeMissionId?)`

**Rôle :** Indique si le livreur possède **une proposition de course en attente** (non expirée).

**Requête :** missions où `offered_to_driver_id = driverId`, `status = 'offered'`, `offer_expires_at > now`. Le paramètre optionnel `excludeMissionId` permet d'exclure une mission (usage futur / tests).

**Usage :** Modèle métier explicite ; composant de `driverIsBusyForNewOffer`.

### 3.3 `driverIsBusyForNewOffer(driverId)`

**Rôle :** Règle métier **uniquement pour la proposition** d'une nouvelle course.

**Implémentation :** `driverHasAcceptedMission(driverId) || driverHasPendingOffer(driverId)`.

**Usage :**

- `proposeOrderToDriver()` — ne pas envoyer une 2ᵉ offre tant que le livreur est occupé ou en attente de réponse
- `assignPendingOrdersToDriver()` — ne pas relancer une proposition si le livreur est déjà « pris » au sens dispatch

### 3.4 `driverHasActiveMission(driverId)` — alias déprécié

Conservé pour compatibilité ascendante ; délègue à `driverIsBusyForNewOffer()`. Les nouveaux appels doivent utiliser les fonctions explicites ci-dessus.

---

## 4. Pourquoi cette séparation est plus conforme au modèle métier

### Avant (modèle implicite)

```
driverHasActiveMission()
  ├── mission acceptée en livraison  ─┐
  └── offre pending (offered)         ─┴─→ une seule fonction pour tout
         │
         ├── assignOrderToDriver()  → BUG : bloqué par sa propre offre
         └── proposeOrderToDriver() → comportement attendu
```

Une même fonction servait à la fois à **finaliser une acceptation** et à **décider si on peut proposer**. Sémantiques opposées, même nom → bug 409.

### Après (modèle explicite)

```
driverHasAcceptedMission()     → « est-il en livraison ? »
driverHasPendingOffer()        → « a-t-il une offre en attente ? »
driverIsBusyForNewOffer()      → « peut-on lui proposer une course ? »
```

| Action | Fonction utilisée | Comportement |
|--------|-------------------|--------------|
| Accepter une offre | `driverHasAcceptedMission` only | Offre pending **autorisée** |
| Proposer une course | `driverIsBusyForNewOffer` | Offre pending **bloque** une nouvelle proposition |
| Refuser / timeout | Inchangé | Pas de garde métier supplémentaire |

À la lecture du code, la distinction « en livraison » vs « en attente de réponse » est immédiatement visible.

---

## 5. Améliorations de robustesse mobile

Dans `DriverHomeScreen.js` :

1. **Fallback HTTP après acceptation** — si le socket `mission:assigned` tarde, `setActiveMission(res.data.mission)` + `startActiveMission()` garantissent l'ouverture du drawer mission.
2. **Message d'erreur API** — `Alert.alert('Erreur', err.response?.data?.error || …)` au lieu d'un message générique fixe.
3. **Pause du timer 20 s** — pendant `offerLoading`, l'intervalle ne décrémente plus ; `offerLoadingRef` empêche un auto-refus pendant l'appel réseau ; l'intervalle est arrêté dès le clic « Accepter ».

Ces changements n'altèrent pas le modèle métier ; ils stabilisent l'expérience livreur.

---

## 6. Tests de non-régression (dispatch)

Tests exécutés via script Node sur la base SQLite locale (`backend/`), avec `OFFER_MODE = true`.

| ID | Scénario | Résultat attendu | Résultat obtenu |
|----|----------|------------------|-----------------|
| **T1** | Proposer une offre puis `assignOrderToDriver` (simule Accept) | Mission passe à `accepted`, `driver_id` renseigné | ✅ OK |
| **T2** | Deuxième `proposeOrderToDriver` alors qu'une offre est pending | Bloqué (`driverIsBusyForNewOffer === true`) | ✅ OK |
| **T3** | `assignPendingOrdersToDriver` avec offre pending | Retourne `null` (skip) | ✅ OK |
| **T4** | `findAvailableDriver` avec livreur ayant seulement une offre | Peut encore retourner ce livreur (comportement moteur **inchangé**) | ✅ OK — documenté |
| **T5** | `assignOrderToDriver` avec mission déjà `accepted` | Retourne `null` | ✅ OK |
| **T6** | `tryDispatchNewOrder` sur commande pending | Émet une offre (`mission:offered`) | ✅ OK |

**Détail T1 (correctif principal) :**

```
after propose:
  acceptedMission: false
  pendingOffer: true
  busyForNewOffer: true
assign after offer: true accepted
DB status: { status: 'accepted', driver_id: '<driver>' }
```

Le livreur n'est plus bloqué par sa propre offre en cours d'acceptation.

**Note T4 :** `findAvailableDriver` exclut uniquement les missions acceptées (SQL `NOT EXISTS` sur statuts livraison). Ce comportement existait avant la correction et n'a pas été modifié, conformément à la contrainte « ne pas toucher au moteur de dispatch » au-delà du périmètre identifié.

---

## 7. Recette manuelle recommandée

| Test | Étapes | Résultat attendu |
|------|--------|------------------|
| **Accept** | Livreur en ligne → commande client → popup → Accepter | Drawer mission s'ouvre, pas d'alerte 409 |
| **Refuse** | Même scénario → Refuser | Popup disparaît, course reproposée à un autre livreur |
| **Timeout 20 s** | Ne rien faire | Auto-refus, reproposition dispatch |

**Prérequis :** backend redémarré (log `Dispatch offer mode : ON (popup 20s)`), Metro relancé si nécessaire.

---

## 8. Synthèse

| Élément | État |
|---------|------|
| Modèle métier explicite (3 fonctions) | ✅ Implémenté |
| Bug 409 à l'acceptation | ✅ Corrigé |
| Moteur dispatch / SQL transactionnel | ✅ Inchangé hors garde |
| Robustesse mobile (audit) | ✅ Appliquée |
| Tests automatisés dispatch | ✅ 6/6 passés |

La correction aligne le code sur la sémantique métier : **être en livraison** et **avoir une offre en attente** sont deux concepts distincts, avec des usages distincts, lisibles directement dans `backend/src/lib/dispatch.js`.
