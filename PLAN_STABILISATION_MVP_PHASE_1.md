# Ma Zone — Plan de stabilisation MVP Phase 1

**Document technique — Équipe de développement Ma Zone**

| | |
|---|---|
| **Version** | 1.0 |
| **Date** | juin 2026 |
| **Périmètre** | Stabilisation du moteur de commandes — 3 problèmes critiques |
| **Statut** | Plan de correction (aucune implémentation) |
| **Références** | AUDIT_MOTEUR_COMMANDES_RESUME.md, CURRENT_ARCHITECTURE.md |

---

## 1. Résumé exécutif

L'audit du moteur de commandes Ma Zone a identifié un flux fonctionnel en théorie correct (création commande → dispatch automatique → attribution → socket → tiroir livreur → livraison), mais fragile en conditions réelles. Les commandes restent fréquemment bloquées en `pending_driver` alors que le livreur semble disponible côté interface.

**Diagnostic consolidé :** la rupture se produit le plus souvent **avant** l'émission du socket `mission:assigned`, dans la fonction `findAvailableDriver()` — typiquement parce qu'une **mission fantôme** en base bloque le livreur (`driverHasActiveMission` retourne `true`), ou parce que le livreur est marqué hors ligne en SQLite.

Ce plan Phase 1 se concentre exclusivement sur **trois problèmes critiques** à fort impact, sans refactoring majeur ni changement d'architecture :

| # | Problème | Impact | Risque correction |
|---|----------|--------|-------------------|
| **P1** | Missions fantômes bloquant le dispatch | File d'attente figée, commandes jamais attribuées | Moyen |
| **P2** | Socket `mission:assigned` perdu à la reconnexion | Mission en DB, livreur sans tiroir | Faible |
| **P3** | `DriverContext` ne rouvre pas le tiroir si mission active en base | Course invisible, blocage prolongé | Faible |

**Objectif Phase 1 :** rendre le flux actuel **résilient** en comblant les trous de synchronisation entre SQLite, Socket.io et l'état React Native — sans réintroduire le flux « offre OUI/NON » ni modifier le modèle de statuts.

**Principe directeur :** la base de données reste la source de vérité ; l'UI livreur doit se réaligner sur la base à chaque connexion, reconnexion et focus écran.

---

## 2. Les trois problèmes critiques identifiés

### P1 — Missions fantômes bloquant le dispatch

**Définition opérationnelle :** mission où `missions.status IN ('accepted', 'picking_up', 'picked_up', 'delivering')` ET `missions.driver_id IS NOT NULL`, alors que le livreur ne mène pas activement la course dans `MissionDrawer`.

**Symptôme :** nouvelles commandes en attente indéfiniment ; logs serveur silencieux (`tryDispatchNewOrder` retourne `null`).

### P2 — Socket `mission:assigned` perdu lors d'une reconnexion

**Définition :** le serveur émet `mission:assigned` une seule fois au moment de l'attribution ; si le livreur n'est pas connecté à la room `user_{driverId}`, l'événement est perdu sans mécanisme de rattrapage.

**Symptôme :** commande `driver_assigned` en base, livreur sans notification ni tiroir.

### P3 — DriverContext ne rouvre pas le tiroir lorsqu'une mission active existe en base

**Définition :** `GET /api/missions/mine` retourne `active`, mais l'UI livreur n'ouvre pas le plein écran / `MissionDrawer` de manière fiable.

**Symptôme :** livreur voit l'écran « libre » (bouton en ligne) alors qu'une mission active existe ; le dispatch reste bloqué pour ce livreur.

---

## 3. Cause technique détaillée de chaque problème

### P1 — Missions fantômes

#### Mécanisme de blocage backend

La fonction `driverHasActiveMission(driverId)` dans `backend/src/lib/dispatch.js` (L29-36) interroge :

```sql
SELECT id FROM missions
WHERE driver_id = ?
  AND status IN ('accepted', 'picking_up', 'picked_up', 'delivering')
```

Cette garde est utilisée par :

- `findAvailableDriver()` (L50-54) — exclut le livreur du pool dispatch
- `assignOrderToDriver()` (L95) — refuse une double attribution
- `assignPendingOrdersToDriver()` (L128) — skip le vidage de file

**Conséquence :** toute mission active non terminée en base **fige le livreur** pour le dispatch, indépendamment de l'état UI.

#### Causes racines identifiées

| Cause | Mécanisme |
|-------|-----------|
| **Bouton Maison** | `DriverHomeScreen.js` L112 : `setFullscreen(false)` sans toucher `activeMission` → UI « libre », DB occupée |
| **Course abandonnée** | Mission reste `accepted` si le livreur ferme l'app sans passer par `delivered` |
| **Pas de timeout** | Aucune expiration automatique des missions actives stale |
| **Dispatch silencieux** | `tryDispatchNewOrder()` retourne `null` sans log (L134-137) — masque la cause |

#### Chaîne de causalité

```
Livreur ferme le tiroir (Maison) ou perd l'UI
  → activeMission reste en DriverContext + mission active en SQLite
  → driverHasActiveMission() = true
  → findAvailableDriver() exclut ce livreur
  → nouvelles commandes restent pending_driver
```

---

### P2 — Socket perdu à la reconnexion

#### Mécanisme d'émission unique

Dans `assignOrderToDriver()` (`dispatch.js` L115-121), après la transaction DB :

```javascript
io.to(`user_${driverId}`).emit('mission:assigned', { mission: result });
```

Socket.io délivre uniquement aux sockets **actuellement connectés** dans la room `user_{driverId}`.

#### Absence de rattrapage à la reconnexion

Dans `backend/src/socket/handlers.js`, à la connexion (L19-40) :

- Le livreur rejoint `user_{id}` ✓
- Si `driver_online = 1`, il rejoint `drivers_available` ✓
- **Aucune** réémission de `mission:assigned` si une mission active existe ✗

L'événement `driver:online` (L63-68) appelle `assignPendingOrdersToDriver()`, qui **skip** si `driverHasActiveMission` — donc ne rattrape pas la mission déjà attribuée.

#### Côté mobile

`AppContext.js` (L28-33) configure `reconnection: true`, mais aucun listener `connect` ne déclenche de resynchronisation mission dans `DriverContext`.

**Fenêtre de perte typique :** attribution pendant coupure réseau, changement d'onglet web, mise en arrière-plan prolongée, ou redémarrage app entre attribution et connexion socket.

---

### P3 — Tiroir non rouvert

#### Trois défaillances distinctes dans le code actuel

**Défaillance A — Race condition au boot**

`DriverContext.load()` (L57-59) :

```javascript
setActiveMission(active);
if (active) assignedHandlerRef.current?.(active);
```

`assignedHandlerRef` est enregistré par `DriverHomeScreen` dans un `useEffect` (L47-50) qui peut s'exécuter **après** `load()`. Si le handler est `null`, le tiroir ne s'ouvre pas via le callback — même si `activeMission` est bien en mémoire.

**Défaillance B — Écran non monté**

Si le livreur est sur un autre onglet (Messages, Revenus), `DriverHomeScreen` n'est pas monté → pas de handler, pas de `useEffect` sur `activeMission?.id`.

**Défaillance C — Bouton Maison**

Après `setFullscreen(false)` (L112), `activeMission` persiste. Le `useEffect` sur `activeMission?.id` (L52-57) ne se re-déclenche pas (l'id n'a pas changé) → pas de réouverture automatique.

#### Effet composé avec P1

Le livreur croit être libre, peut rester « en ligne », mais le dispatch le considère occupé → **double incohérence** UI/DB.

---

## 4. Fichiers concernés

### P1 — Missions fantômes

| Fichier | Rôle |
|---------|------|
| `backend/src/lib/dispatch.js` | `driverHasActiveMission`, `findAvailableDriver`, `assignPendingOrdersToDriver` |
| `backend/src/routes/missions.js` | `GET /mine`, `PATCH /:id/status` (seule voie de clôture mission) |
| `mobile/src/screens/driver/DriverHomeScreen.js` | Bouton Maison L112, gestion `fullscreen` / `activeMission` |
| `mobile/src/context/DriverContext.js` | État `activeMission`, pas de garde « occupé » |
| `mobile/src/components/driver/MissionDrawer.js` | Workflow jusqu'à `delivered` |

### P2 — Socket perdu

| Fichier | Rôle |
|---------|------|
| `backend/src/lib/dispatch.js` | Émission unique `mission:assigned` L118 |
| `backend/src/socket/handlers.js` | Connexion socket, `driver:online` — point d'accroche rattrapage |
| `backend/src/routes/drivers.js` | `PUT /online` — retourne `mission` si attribution file |
| `mobile/src/context/AppContext.js` | Connexion / reconnexion socket |
| `mobile/src/context/DriverContext.js` | Listeners `mission:assigned`, `load()` |

### P3 — Tiroir non rouvert

| Fichier | Rôle |
|---------|------|
| `mobile/src/context/DriverContext.js` | `load()`, `assignedHandlerRef`, `onMissionAssigned` |
| `mobile/src/screens/driver/DriverHomeScreen.js` | `startActiveMission`, `useEffect` activeMission, `useFocusEffect` |
| `backend/src/routes/missions.js` | `GET /mine` — source `active` |

---

## 5. Correctifs minimaux recommandés

### P1 — Missions fantômes bloquant le dispatch

#### Correctif 1A — Empêcher l'état UI « libre » avec mission active (mobile)

**Fichier :** `DriverHomeScreen.js`

**Changement :** le bouton Maison (L112) ne doit plus laisser l'impression que le livreur est libre.

**Option minimale recommandée :** remplacer la fermeture totale par une **minimisation** du tiroir (`drawerExpanded = false`, `fullscreen = false`) tout en affichant une **bannière persistante** « Course en cours » avec bouton « Reprendre » qui rouvre le plein écran.

**Alternative plus simple :** désactiver le bouton Maison tant que `activeMission` existe ; forcer le livreur à terminer ou contacter le support.

#### Correctif 1B — Resynchronisation mission au focus écran (mobile)

**Fichier :** `DriverHomeScreen.js`

**Changement :** dans `useFocusEffect`, si `activeMission` existe → `setFullscreen(true)` et `setDrawerExpanded(true)`.

Couvre le cas onglet Messages / Revenus puis retour carte.

#### Correctif 1C — Logs dispatch structurés (backend)

**Fichier :** `dispatch.js`

**Changement :** dans `tryDispatchNewOrder()` et `assignPendingOrdersToDriver()`, logger la raison du `null` :

- `no_driver_online`
- `all_drivers_busy` (avec id livreur bloqué + mission_id)
- `order_already_assigned`

**Impact :** diagnostic immédiat en dev/staging, sans changer la logique métier.

#### Correctif 1D — (Optionnel Phase 1.1) Endpoint admin stale missions

Hors scope minimal strict, mais documenté pour la suite : script ou endpoint interne listant les missions actives > N heures sans `updated_at` récent.

---

### P2 — Socket `mission:assigned` perdu

#### Correctif 2A — Rattrapage serveur à la connexion socket (recommandé)

**Fichier :** `backend/src/socket/handlers.js`

**Changement :** après `socket.join('user_{id}')` pour un livreur, si `driverHasActiveMission(id)` :

1. Charger la mission via `getFullMission(missionId)`
2. Émettre `socket.emit('mission:assigned', { mission })` **au socket connecté uniquement** (pas broadcast)

**Pourquoi côté serveur :** source de vérité unique, fonctionne même si le mobile n'a pas encore appelé `GET /mine`.

#### Correctif 2B — Rattrapage mobile sur événement `connect` (complément)

**Fichier :** `DriverContext.js`

**Changement :** écouter `socket.on('connect', ...)` → appeler `load()` ou `getMyMissions()` ; si `active` → `setActiveMission` + invoquer handler.

**Redondance intentionnelle** avec 2A : défense en profondeur.

#### Correctif 2C — Enrichir `PUT /drivers/online` (déjà partiel)

**Fichier :** `drivers.js` L29-34

**Constat :** retourne déjà `mission` si `assignPendingOrdersToDriver` attribue une nouvelle course, mais **pas** si le livreur a déjà une mission active.

**Changement minimal :** si `online=true` et mission active existe, inclure `activeMission` dans la réponse JSON (même sans nouvelle attribution).

---

### P3 — DriverContext / tiroir

#### Correctif 3A — File d'attente du handler (mobile)

**Fichier :** `DriverContext.js`

**Changement :** dans `onMissionAssigned(handler)` :

```javascript
assignedHandlerRef.current = handler;
if (handler && activeMission) handler(activeMission); // rejouer immédiatement
```

Élimine la race au boot sans refactor.

#### Correctif 3B — `useFocusEffect` resync (mobile)

**Fichier :** `DriverHomeScreen.js`

**Changement :** au focus, appeler `refresh()` du DriverContext puis ouvrir le tiroir si `activeMission`.

#### Correctif 3C — Conserver l'effet existant sur `activeMission?.id`

**Fichier :** `DriverHomeScreen.js` L52-57

**Constat :** déjà présent et correct pour le premier montage. Ne pas supprimer ; compléter avec 3A et 3B.

---

## 6. Risques associés

### Risques par correctif

| Correctif | Risque | Mitigation |
|-----------|--------|------------|
| 1A Bannière / Maison | UX : livreur frustré si ne peut pas « minimiser » | Offrir minimisation + reprise, pas blocage total |
| 1B Focus resync | Réouverture intempestive du tiroir | Ne rouvrir que si `activeMission` non null |
| 1C Logs | Bruit console en production | Niveau `debug` ou flag `DISPATCH_DEBUG` |
| 2A Re-emit socket | Double ouverture tiroir si mobile reçoit aussi via `load()` | Idempotent : `setActiveMission` même id = no-op UI |
| 2B Connect + load | Appels API redondants à chaque reconnect | Debounce 500ms sur `connect` |
| 3A Replay handler | Appel double `startActiveMission` au boot | Guard `if (!mission) return` déjà présent L41 |
| 3B refresh au focus | Latence perceptible | Spinner léger ou sync silencieuse |

### Risques de régression globaux

| Domaine | Risque | Niveau |
|---------|--------|--------|
| **Dispatch** | Réémission socket pourrait déclencher une fausse « nouvelle course » côté livreur | Faible — même mission_id |
| **Socket.io** | Événements supplémentaires à la connexion augmentent légèrement le trafic | Négligeable |
| **DriverContext** | `load()` plus fréquent → plus d'appels API par session | Faible |
| **UX livreur** | Impossibilité de masquer le tiroir peut déranger | Moyen — prévoir minimisation |
| **Client / commerçant** | Aucun changement direct prévu Phase 1 | Nul |
| **Missions manuelles** | `POST /missions/:id/accept` rarement utilisé — même chemin socket | Faible |

---

## 7. Tests fonctionnels après implémentation

### Suite P1 — Missions fantômes

| ID | Scénario | Étapes | Résultat attendu |
|----|----------|--------|------------------|
| T1.1 | Maison avec mission active | Attribuer course → appuyer Maison | Bannière « Course en cours » visible OU tiroir non dismissable ; dispatch bloqué pour ce livreur (comportement cohérent) |
| T1.2 | Nouvelle commande après `delivered` | Terminer course → nouvelle commande client | Attribution immédiate au livreur libéré |
| T1.3 | Mission fantôme existante en DB | Insérer manuellement mission `accepted` orpheline → commande client | Logs indiquent `all_drivers_busy` ; après clôture mission, dispatch reprend |
| T1.4 | Un seul livreur occupé | 2 commandes, 1 livreur | 1ère attribuée, 2ème en file ; après delivered, 2ème attribuée |

### Suite P2 — Socket reconnexion

| ID | Scénario | Étapes | Résultat attendu |
|----|----------|--------|------------------|
| T2.1 | Attribution pendant offline socket | Couper réseau mobile → créer commande → rétablir réseau | Tiroir s'ouvre avec mission active (via reconnect) |
| T2.2 | Reconnexion avec mission en cours | Mission active → kill app → relancer | `GET /mine` + socket reconnect → tiroir ouvert |
| T2.3 | Pas de double mission | Reconnect multiple fois | Une seule mission active, pas de duplication DB |
| T2.4 | Nouvelle attribution normale | Livreur en ligne, socket OK | `mission:assigned` reçu une fois, tiroir OK |

### Suite P3 — Tiroir / DriverContext

| ID | Scénario | Étapes | Résultat attendu |
|----|----------|--------|------------------|
| T3.1 | Boot avec mission active | Mission en DB → cold start app livreur | Tiroir ouvert automatiquement |
| T3.2 | Retour onglet Carte | Mission active → onglet Messages → retour Carte | Tiroir réouvert |
| T3.3 | Race handler | Login rapide, navigation immédiate | Handler rejoué, pas de course manquée |
| T3.4 | Mission terminée | Slide livraison → `delivered` | `activeMission` null, écran libre, dispatch débloqué |

### Tests de non-régression

| ID | Scénario | Résultat attendu |
|----|----------|------------------|
| NR1 | Flux client complet | Commande → suivi → livré |
| NR2 | Flux commerçant | `order:new` reçu, statuts cohérents |
| NR3 | Annulation client avant pickup | `mission:cancelled` livreur, dispatch débloqué |
| NR4 | Livreur hors ligne | Commande reste `pending_driver` (comportement inchangé) |
| NR5 | Panier multi-articles | File traitée séquentiellement après chaque `delivered` |

---

## 8. Ordre exact recommandé d'implémentation

```
Étape 1 — P3 Correctif 3A (replay handler)
    ↓ Corrige la race la plus simple, zéro impact backend
Étape 2 — P3 Correctif 3B + P1 Correctif 1B (focus resync)
    ↓ Garantit tiroir au retour sur l'écran carte
Étape 3 — P2 Correctif 2A (re-emit socket à la connexion)
    ↓ Rattrapage fiable côté serveur
Étape 4 — P2 Correctif 2B (connect → load mobile)
    ↓ Filet de sécurité mobile
Étape 5 — P1 Correctif 1A (bouton Maison / bannière)
    ↓ Empêche la création de nouvelles missions fantômes
Étape 6 — P1 Correctif 1C (logs dispatch)
    ↓ Observabilité pour valider en staging
Étape 7 — P2 Correctif 2C (enrichir PUT /online) [optionnel]
    ↓ Cohérence API REST
```

**Justification de l'ordre :**

1. **P3 d'abord** — corrige l'affichage sans toucher au dispatch ; débloque les livreurs qui ont déjà une mission en base.
2. **P2 ensuite** — assure le rattrapage réseau une fois que l'UI sait afficher la mission.
3. **P1 en dernier** — prévient la **recréation** de fantômes ; inutile si P3/P2 ne montrent pas la mission existante.

Chaque étape doit être **déployée et testée isolément** avant la suivante.

---

## 9. Estimation du niveau de risque par correction

| Correctif | Description | Risque | Effort |
|-----------|-------------|--------|--------|
| **3A** | Replay handler à l'enregistrement | **Faible** | ~15 min |
| **3B** | Focus resync + refresh | **Faible** | ~30 min |
| **1B** | Focus → ouvrir tiroir si active | **Faible** | ~20 min |
| **2A** | Re-emit `mission:assigned` à la connexion | **Faible** | ~45 min |
| **2B** | `connect` → `load()` mobile | **Faible** | ~30 min |
| **2C** | Enrichir réponse `PUT /online` | **Faible** | ~20 min |
| **1A** | Bannière / comportement Maison | **Moyen** | ~1-2 h |
| **1C** | Logs dispatch structurés | **Faible** | ~30 min |
| **1D** | Endpoint stale missions (optionnel) | **Moyen** | ~2 h |

**Risque global Phase 1 : Faible à Moyen** — aucun changement de schéma DB, aucun nouveau flux métier, modifications localisées.

---

## 10. Impacts transverses

### Impact sur le dispatch

- **Positif :** moins de livreurs « bloqués silencieusement » ; file d'attente se vide après `delivered` comme prévu.
- **Ne change pas :** algorithme FIFO, `findAvailableDriver`, statuts canoniques.
- **Attention :** tant qu'une mission fantôme **existe déjà** en DB, le dispatch restera bloqué jusqu'à clôture manuelle ou script de nettoyage — Phase 1 ne supprime pas les données historiques corrompues.

### Impact sur Socket.io

- Un événement `mission:assigned` supplémentaire par reconnexion livreur avec mission active.
- Pas de nouvelle room, pas de nouvel événement nommé.
- Compatible avec l'architecture rooms actuelle (`user_{id}`).

### Impact sur DriverContext

- `load()` potentiellement appelé plus souvent (reconnect, focus).
- `onMissionAssigned` devient idempotent avec replay.
- Pas de nouveau state global requis ; `activeMission` reste la source UI.

### Impact sur l'expérience livreur

- **Amélioration majeure :** plus de courses « invisibles ».
- **Changement UX :** le bouton Maison ne pourra plus simuler un état libre (1A) — le livreur verra toujours qu'une course est en cours.
- **Workflow MissionDrawer :** inchangé (slides, chat, navigation).

### Risques de régression

| Zone | Probabilité | Gravité | Mitigation |
|------|-------------|---------|------------|
| Double ouverture tiroir | Moyenne | Faible | Guards sur mission.id |
| Appels API excessifs | Faible | Faible | Debounce reconnect |
| Régression tab bar / fullscreen | Faible | Moyenne | Tester iOS + web |
| Réintroduction flux offre | Nulle | — | Ne pas toucher NewCourseOfferModal |

---

## 11. Conclusion et recommandations pour la suite

### Bilan Phase 1

Les trois problèmes critiques partagent une cause commune : **désynchronisation entre l'état SQLite (source de vérité métier) et l'état React Native (source de vérité UI)**. Le dispatch backend fonctionne ; c'est la boucle de retour livreur qui est incomplète.

La Phase 1 comble cette boucle avec des correctifs **minimalistes et localisés**, sans remettre en cause l'architecture MVP documentée dans `CURRENT_ARCHITECTURE.md`.

### Recommandations post-Phase 1 (Phase 2 — hors scope immédiat)

1. **Script de nettoyage** des missions fantômes existantes en base (one-shot avant déploiement).
2. **Unification statut en ligne** — AsyncStorage ne doit pas primer sur l'API si divergent.
3. **Timeout missions stale** — auto-annulation ou alerte admin après N heures.
4. **Tests E2E automatisés** — scénario client → dispatch → livreur → delivered.
5. **Ne pas réactiver** le flux `mission:offered` / `NewCourseOfferModal` tant que le dispatch direct n'est pas stable en production.

### Critère de succès Phase 1

- [ ] Zéro commande bloquée `pending_driver` avec livreur en ligne et sans mission active réelle
- [ ] Reconnexion livreur restaure le tiroir en < 3 secondes
- [ ] Cold start app livreur avec mission active ouvre le tiroir systématiquement
- [ ] Bouton Maison ne crée plus de mission fantôme nouvelle

---

*Document généré à partir de l'audit moteur de commandes Ma Zone — juin 2026. Aucune modification de code applicatif n'a été effectuée.*
