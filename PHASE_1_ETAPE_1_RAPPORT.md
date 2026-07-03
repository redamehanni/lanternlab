# Ma Zone — Phase 1 Étape 1 — Rapport d'implémentation

**Correctif 3A — Replay handler dans DriverContext**

| | |
|---|---|
| **Date** | juin 2026 |
| **Périmètre** | Étape 1 uniquement — race condition `onMissionAssigned` |
| **Référence** | PLAN_STABILISATION_MVP_PHASE_1.md — Correctif 3A |
| **Statut** | Implémenté |

---

## 1. Cause du bug

### Contexte

Lors du démarrage de l'application livreur, `DriverContext.load()` appelle `GET /api/missions/mine` et, si une mission active existe en base, exécute :

```javascript
setActiveMission(active);
if (active) assignedHandlerRef.current?.(active);
```

Parallèlement, `DriverHomeScreen` enregistre le handler d'ouverture du tiroir via `onMissionAssigned(startActiveMission)` dans un `useEffect` séparé.

### Race condition

L'ordre d'exécution des `useEffect` n'est pas garanti. Si `load()` se termine **avant** que `DriverHomeScreen` n'enregistre son handler :

1. `activeMission` est correctement mis en mémoire ;
2. `assignedHandlerRef.current` est encore `null` ;
3. l'appel `assignedHandlerRef.current?.(active)` est ignoré ;
4. quand le handler est enfin enregistré, aucun rappel n'était effectué.

**Conséquence :** mission active en mémoire et en base, mais tiroir (`MissionDrawer`) et plein écran non ouverts.

### Scénarios affectés

- Cold start avec mission active en base ;
- Login rapide avant montage complet de `DriverHomeScreen` ;
- Toute situation où `load()` précède l'enregistrement du handler.

---

## 2. Modification effectuée

### Fichier modifié

`mobile/src/context/DriverContext.js` — fonction `onMissionAssigned` uniquement.

### Avant

```javascript
const onMissionAssigned = useCallback((handler) => {
  assignedHandlerRef.current = handler;
}, []);
```

### Après

```javascript
const onMissionAssigned = useCallback((handler) => {
  assignedHandlerRef.current = handler;
  if (handler && activeMission) {
    handler(activeMission);
  }
}, [activeMission]);
```

### Comportement

Lorsque `DriverHomeScreen` enregistre son handler :

1. le handler est stocké dans `assignedHandlerRef` ;
2. si `activeMission` existe déjà en mémoire (chargée par `load()`), le handler est **rejoué immédiatement** avec cette mission ;
3. `startActiveMission` ouvre le plein écran et le tiroir comme prévu.

La dépendance `[activeMission]` assure que si le handler est enregistré avant la fin de `load()`, le `useEffect` de `DriverHomeScreen` se réexécute quand `activeMission` arrive — et rejoue le handler à l'enregistrement.

### Ce qui n'a PAS été modifié

- Aucun changement dans `dispatch.js`, `handlers.js`, routes backend ;
- Aucun changement dans `DriverHomeScreen.js`, `MissionDrawer.js`, cartes, navigation, fullscreen ;
- Aucun nouveau socket, aucun refactoring ;
- Aucun autre fichier touché.

---

## 3. Diff précis

```diff
--- a/mobile/src/context/DriverContext.js
+++ b/mobile/src/context/DriverContext.js
@@ -36,8 +36,11 @@ export function DriverProvider({ children }) {
   }, [socket]);

   const onMissionAssigned = useCallback((handler) => {
     assignedHandlerRef.current = handler;
-  }, []);
+    if (handler && activeMission) {
+      handler(activeMission);
+    }
+  }, [activeMission]);

   const load = useCallback(async () => {
```

**Lignes ajoutées :** 3  
**Lignes supprimées :** 1 (remplacement de `}, []);` par le bloc avec replay)  
**Fichiers modifiés :** 1

---

## 4. Risques

| Risque | Niveau | Détail |
|--------|--------|--------|
| Double ouverture tiroir | **Faible** | `startActiveMission` contient `if (!mission) return` ; même `mission.id` = état idempotent |
| Appel handler à la déconnexion | **Nul** | `onMissionAssigned(null)` passe `handler=null` → condition `if (handler && ...)` non exécutée |
| Re-render supplémentaire | **Faible** | `onMissionAssigned` change d'identité quand `activeMission` change → `useEffect` HomeScreen se réexécute (comportement souhaité) |
| Régression dispatch / socket | **Nul** | Aucun fichier backend ou socket modifié |
| Régression navigation / carte | **Nul** | Aucun fichier UI hors DriverContext modifié |

**Risque global : Faible**

---

## 5. Procédure de test

### Prérequis

- Backend démarré sur `http://localhost:4000`
- Compte livreur avec mission active en base (`missions.status IN accepted, picking_up, picked_up, delivering`)
- Ou : créer une commande client, l'attribuer au livreur, ne pas terminer la course

### Test T3.1 — Cold start avec mission active

1. S'assurer qu'une mission active existe pour le livreur en base.
2. Fermer complètement l'app livreur (kill process).
3. Relancer l'app et se connecter en tant que livreur.
4. **Résultat attendu :** le tiroir `MissionDrawer` s'ouvre automatiquement en plein écran avec la mission active.

### Test T3.3 — Login rapide / race handler

1. Se déconnecter du compte livreur.
2. Se reconnecter rapidement.
3. **Résultat attendu :** si une mission active existe, le tiroir s'ouvre sans action manuelle.

### Test NR4 — Livreur sans mission active

1. Livreur sans mission en cours, en ligne.
2. Cold start ou login.
3. **Résultat attendu :** écran normal (carte + bouton en ligne), pas de tiroir fantôme.

### Test NR1 — Flux nominal inchangé

1. Livreur en ligne, pas de mission active.
2. Client passe commande.
3. **Résultat attendu :** `mission:assigned` reçu → tiroir s'ouvre (comportement existant, non régressé).

### Test de non-régression dispatch

1. Vérifier qu'une nouvelle commande client est toujours attribuée à un livreur en ligne libre.
2. **Résultat attendu :** aucun changement de comportement dispatch.

---

## 6. Confirmation

| Élément | Statut |
|---------|--------|
| Correctif 3A implémenté | Oui |
| Fichiers modifiés | `mobile/src/context/DriverContext.js` uniquement |
| Dispatch modifié | Non |
| Sockets modifiés | Non |
| Navigation / cartes / fullscreen modifiés | Non |
| Autres fichiers touchés | Aucun |

---

*Rapport Phase 1 Étape 1 — Ma Zone — juin 2026*
