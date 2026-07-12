# Ma Zone — Audit popup Accept livreur

**Document technique — Équipe de développement Ma Zone**

| | |
|---|---|
| **Version** | 1.0 |
| **Date** | juillet 2026 |
| **Périmètre** | Bug bouton « Accepter » inopérant sur la popup proposition de course (Phase F UX) |
| **Statut** | Audit + plan de correction (**aucune correction exécutée**) |
| **Références** | PLAN_UX_CHAPITRE_CLIENT_MESSAGERIE.md, dispatch.js, dispatchOffer.js, DriverHomeScreen.js |

---

## Document de référence

| Format | Fichier | Usage |
|--------|---------|-------|
| **HTML (recommandé dans Cursor)** | `AUDIT_POPUP_ACCEPT_LIVREUR.html` | Lecture directe dans le navigateur |
| **Markdown** | `AUDIT_POPUP_ACCEPT_LIVREUR.md` | Partage / édition |
| **PDF** | `AUDIT_POPUP_ACCEPT_LIVREUR.pdf` | Impression — ouvrir via Finder ou `Ouvrir_AUDIT_POPUP_PDF.command` |

---

## 0. Contexte utilisateur

Après implémentation du plan UX (Phase F — popup proposition course livreur), le comportement observé est :

| Élément | Statut |
|---------|--------|
| Popup « Nouvelle course disponible ! » | **OK** — s’affiche avec compte à rebours 20 s |
| Bouton **Refuser** | **OK** — ferme la popup, relance le dispatch |
| Bouton **Accepter** | **KO** — alerte *« Impossible d'accepter la course »*, pas de tiroir mission |
| Assignation directe (ancien flux) | **Corrigé** — la popup remplace bien l’assignation immédiate |

Ce document explique **pourquoi** Accepter échoue, **ce qui a déjà été corrigé** pour faire apparaître la popup, et **le plan minimal** pour réparer Accept — sans l’avoir encore appliqué.

---

## 1. Synthèse exécutive

**Cause racine (confirmée par analyse statique du code)** : dans `backend/src/lib/dispatch.js`, la fonction `driverHasActiveMission()` considère qu’un livreur avec une offre en cours (`status = 'offered'`) est « occupé ». Or `assignOrderToDriver()` appelle cette fonction **avant** de finaliser l’acceptation. Résultat : rejet systématique → HTTP **409** → alerte mobile générique.

**Asymétrie Refuser / Accepter** : Refuser ne passe pas par `assignOrderToDriver` ; il remet la mission en `available` et relance `tryDispatchNewOrder`. D’où Refuser fonctionnel et Accepter bloqué.

**Gravité** : bloquant pour le flux livreur Phase F. Le moteur dispatch et la communication ne sont pas impactés ; correction localisée (~15 lignes backend).

---

## 2. Flux attendu vs flux réel

### 2.1 Flux cible (Phase F UX)

```
Client passe commande
    → tryDispatchNewOrder (OFFER_MODE=true)
    → proposeOrderToDriver
    → DB: mission.status = 'offered', offered_to_driver_id = livreur
    → Socket: mission:offered → popup livreur (20 s)

Livreur clique ACCEPTER
    → POST /api/missions/:id/accept
    → assignOrderToDriver
    → DB: status = 'accepted', driver_id = livreur
    → Socket: mission:assigned → tiroir mission

Livreur clique REFUSER ou timeout
    → POST /api/missions/:id/refuse (ou auto)
    → DB: status = 'available'
    → tryDispatchNewOrder(excludeDriverIds)
```

### 2.2 Flux réel aujourd’hui (Accept)

```
Livreur clique ACCEPTER
    → POST /api/missions/:id/accept          [missions.js L99-112]
    → assignOrderToDriver(order_id, driver)  [dispatch.js L93+]
    → driverHasActiveMission(driver) === TRUE  [dispatch.js L105]
         └── car offre 'offered' pending pour CE livreur [L39-46]
    → return null
    → HTTP 409 { error: 'Mission déjà prise ou expirée' }
    → Mobile: Alert.alert('Impossible d\'accepter la course.')
```

### 2.3 Flux réel Refuser (OK)

```
Livreur clique REFUSER
    → POST /api/missions/:id/refuse           [missions.js L124-138]
    → UPDATE mission SET status='available'   (sans assignOrderToDriver)
    → tryDispatchNewOrder(..., excludeDriverIds)
    → OK
```

---

## 3. Cause racine — analyse détaillée

### 3.1 Fonction `driverHasActiveMission` (dispatch.js L31-46)

```javascript
function driverHasActiveMission(driverId) {
  // Cas 1 : mission en cours de livraison
  const row = db.prepare(`
    SELECT id FROM missions
    WHERE driver_id = ?
      AND status IN ('accepted', 'picking_up', 'picked_up', 'delivering')
    LIMIT 1
  `).get(driverId);
  if (row) return true;

  // Cas 2 : offre en attente de réponse (AJOUT Phase F)
  const offer = db.prepare(`
    SELECT id FROM missions
    WHERE offered_to_driver_id = ?
      AND status = 'offered'
      AND datetime(offer_expires_at) > datetime('now')
    LIMIT 1
  `).get(driverId);
  return !!offer;
}
```

**Intention du Cas 2** : empêcher qu’un second `proposeOrderToDriver` soit envoyé au même livreur tant qu’il n’a pas répondu à la popup. **Correct pour la proposition.**

### 3.2 Fonction `assignOrderToDriver` (dispatch.js L93-105)

```javascript
function assignOrderToDriver(orderId, driverId, io) {
  const result = db.transaction(() => {
    const order = db.prepare(`... AND m.status IN ('available', 'offered')`).get(orderId);

    if (!order) return null;
    if (driverHasActiveMission(driverId)) return null;  // ← BUG ICI

    // UPDATE mission → accepted ...
  })();
  // ...
}
```

Au moment où Karim accepte **son** offre :
- `offered_to_driver_id` = Karim
- `status` = `offered`
- `driverHasActiveMission(Karim)` → **true** (Cas 2)
- Transaction abortée **avant** le UPDATE SQL (pourtant valide L112-116)

### 3.3 Route accept (missions.js L105-111)

La route appelle correctement `clearOfferTimeout` puis `assignOrderToDriver`. Le SQL d’update accepte bien `status = 'offered' AND offered_to_driver_id = driver`. **Le blocage est uniquement en amont**, dans le guard `driverHasActiveMission`.

### 3.4 Origine de la régression

Lors de l’implémentation Phase F, `driverHasActiveMission` a été enrichi pour inclure les offres pending. Cette fonction est réutilisée à **deux endroits aux sémantiques opposées** :

| Appelant | Besoin |
|----------|--------|
| `proposeOrderToDriver`, `assignPendingOrdersToDriver` | Livreur **occupé** = ne pas proposer une 2e course |
| `assignOrderToDriver` | Livreur **en livraison** = ne pas assigner ; mais **doit pouvoir accepter son offre** |

**Conclusion** : une seule fonction pour deux règles métier incompatibles.

---

## 4. Causes secondaires (non bloquantes)

| ID | Problème | Fichier | Impact |
|----|----------|---------|--------|
| S1 | Message d’erreur API non affiché | `DriverHomeScreen.js` L106-108 | Debug difficile (`409` masqué) |
| S2 | Pas de fallback HTTP sur accept | `DriverHomeScreen.js` L100-110 | Dépendance totale au socket `mission:assigned` |
| S3 | Race timer 20 s vs clic Accept | `DriverHomeScreen.js` L113-130 | Refuse auto possible pendant accept (rare) |
| S4 | `acceptMissionOffer` API morte | `api/index.js` L98 | Dette, pas de bug |

---

## 5. Historique des corrections déjà appliquées

Ces changements **ont été exécutés** lors de la session UX (phases B–F). Ils expliquent pourquoi la **popup est visible** aujourd’hui (problème initial : assignation directe sans popup).

### 5.1 Backend — activation mode proposition

| Fichier | Modification |
|---------|--------------|
| `backend/src/config/dispatch.js` | `OFFER_MODE = true` par défaut (`DISPATCH_OFFER_MODE=0` pour rollback) |
| `backend/src/lib/dispatchOffer.js` | **Nouveau** — `proposeOrderToDriver`, timeout 20 s, socket `mission:offered` |
| `backend/src/lib/dispatch.js` | `tryDispatchNewOrder` / `assignPendingOrdersToDriver` → `proposeOrderToDriver` si OFFER_MODE |
| `backend/src/db/index.js` | Colonnes `offered_to_driver_id`, `offer_expires_at` ; **suppression wipe `offered` au boot** |
| `backend/src/routes/missions.js` | `GET /offered`, accept/refuse enrichis pour statut `offered` |
| `backend/src/index.js` | Log démarrage : `Dispatch offer mode : ON (popup 20s)` |

### 5.2 Backend — bug « offre = mission active » (popup invisible / tiroir direct)

**Symptôme** : popup n’apparaissait pas, ou tiroir s’ouvrait directement.

**Cause** : `PUT /api/drivers/online` renvoyait `mission` dès la proposition ; `DriverContext` mettait cette mission en `activeMission`.

**Correctifs** :

| Fichier | Modification |
|---------|--------------|
| `backend/src/routes/drivers.js` | Réponse séparée `{ offered, assigned, mission }` — `mission` null si simple proposition |
| `backend/src/routes/orders.js` | Champ `dispatch: 'offered' \| 'assigned' \| 'pending_driver'` |

### 5.3 Mobile — affichage popup

| Fichier | Modification |
|---------|--------------|
| `mobile/src/context/DriverContext.js` | État `pendingOffer` ; `activeMission` seulement si statut `accepted+` ; listener `mission:offered` |
| `mobile/src/screens/driver/DriverHomeScreen.js` | Branchement `NewCourseOfferModal`, timer 20 s, handlers accept/refuse |
| `mobile/src/components/driver/NewCourseOfferModal.js` | UI « Nouvelle course disponible ! », Accepter/Refuser, rémunération 3,99 € + 10 % |

### 5.4 Phases UX client (B–E) — hors scope popup

Drawer hamburger, onglet Messagerie, `ChatPresentation`, labels commerçant — implémentés en parallèle, **sans lien** avec le bug Accept.

### 5.5 Chronologie

| Étape | Résultat |
|-------|----------|
| 1. Implémentation Phase F (propose + modal) | Assignation directe persistait (backend non redémarré / bugs API) |
| 2. Fix `drivers.js` + `DriverContext` | Popup visible, Refuser OK |
| 3. Test Accept | **Échec 409** — bug `driverHasActiveMission` identifié |
| 4. Ce document | Audit + plan, **correction Accept non appliquée** |

---

## 6. Plan de correction proposé (NON EXÉCUTÉ)

### 6.1 Correctif principal — backend (~15 lignes)

**Fichier** : `backend/src/lib/dispatch.js`

**Objectif** : séparer « livreur en livraison » vs « livreur avec offre pending ».

1. Créer `driverHasAcceptedMission(driverId)` — uniquement statuts `accepted|picking_up|picked_up|delivering`

2. Créer `driverHasPendingOffer(driverId, excludeMissionId?)` — offres actives, avec exclusion optionnelle

3. **`assignOrderToDriver`** : guard = `driverHasAcceptedMission(driverId)` **uniquement**

4. **`proposeOrderToDriver`** / **`assignPendingOrdersToDriver`** : guard = `driverHasAcceptedMission || driverHasPendingOffer`

5. Conserver le UPDATE SQL existant (clause `offered AND offered_to_driver_id = ?`)

**Pseudo-code** :

```javascript
function driverHasAcceptedMission(driverId) { /* missions en livraison only */ }
function driverHasPendingOffer(driverId, excludeMissionId = null) { /* offered pending */ }
function driverIsBusyForNewOffer(driverId) {
  return driverHasAcceptedMission(driverId) || driverHasPendingOffer(driverId);
}

// assignOrderToDriver:
if (driverHasAcceptedMission(driverId)) return null;

// proposeOrderToDriver / assignPendingOrdersToDriver:
if (driverIsBusyForNewOffer(driverId)) return null;
```

### 6.2 Correctifs mobile optionnels (robustesse)

**Fichier** : `mobile/src/screens/driver/DriverHomeScreen.js`

1. Sur accept HTTP 200 : `setActiveMission(res.data.mission)` en fallback
2. Alerte : afficher `err.response?.data?.error`
3. Pause du timer 20 s quand `offerLoading === true`

### 6.3 Fichiers impactés (correction Accept)

| Fichier | Type de changement |
|---------|-------------------|
| `backend/src/lib/dispatch.js` | **Obligatoire** — scission guards |
| `backend/src/lib/dispatchOffer.js` | Appeler `driverIsBusyForNewOffer` au lieu de `driverHasActiveMission` |
| `mobile/src/screens/driver/DriverHomeScreen.js` | Optionnel — durcissement UX |

**Fichiers interdits de modification lourde** : `communicationEngine.js`, transaction core `assignOrderToDriver` (UPDATE SQL), logique timeout `dispatchOffer.js`.

---

## 7. Matrice de tests (recette post-correction)

| # | Scénario | Étapes | Attendu |
|---|----------|--------|---------|
| T1 | Accept OK | Livreur en ligne → commande client → Accepter | Popup → tiroir mission, `status=accepted`, pas de 409 |
| T2 | Refuse OK | Même flux → Refuser | Popup fermée, mission `available`, redispatch possible |
| T3 | Timeout 20 s | Aucune action | Auto-refuse, pas de mission fantôme `offered` |
| T4 | Backend log | Commande + Accept | `[Dispatch] mission:offered` puis pas d’erreur sur POST accept |
| T5 | Non-régression dispatch | Livraison complète | Flux picking → delivered inchangé |
| T6 | Non-régression comm | Chat client/livreur | Conversations créées à l’assignation (pas à la proposition) |

---

## 8. Procédure de validation manuelle

```bash
# 1. Backend (vérifier OFFER_MODE ON)
cd backend && node src/index.js
# Attendu : Dispatch offer mode : ON (popup 20s)

# 2. Mobile
cd mobile && npx expo start --clear

# 3. Scénario
# - Livreur Karim : PASSE EN LIGNE
# - Client Marie : nouvelle commande
# - Livreur : popup → Accepter
```

**Comptes test** : Client Marie l | Driver Karim Diouf | Merchant taz le tazer

---

## 9. Estimation et décision

| Tâche | Effort | Statut |
|-------|--------|--------|
| Fix backend `driverHasActiveMission` | 30 min | **À valider** |
| Durcissement mobile (optionnel) | 20 min | **À valider** |
| Recette T1–T6 | 15 min | **À valider** |
| **Total correction** | **~1 h** | En attente confirmation équipe |

**Décision requise** : confirmer ou non l’exécution du plan section 6 avant toute modification de code.

---

## 10. Annexe — chaîne d’appels mobile Accept

```
NewCourseOfferModal.onAccept
  → DriverHomeScreen.handleAcceptOffer
  → acceptMission(mission.id)                    [api/index.js]
  → POST /api/missions/:id/accept                [missions.js]
  → assignOrderToDriver                          [dispatch.js]  ← échec ici
  → (si OK) socket mission:assigned
  → DriverContext.onAssigned → MissionDrawer
```

---

*Document généré pour analyse préalable à correction — Ma Zone MVP juillet 2026.*
