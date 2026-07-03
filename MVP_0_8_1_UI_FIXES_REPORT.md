# Ma Zone — MVP 0.8.1 — Rapport correctifs UI

**Date :** juin 2026 · **Version :** MVP 0.8.1 · **Type :** UI et navigation uniquement

---

## 1. Fichiers modifiés

| Fichier | Modifications |
|---------|---------------|
| `mobile/src/screens/client/OrderTrackingScreen.js` | Navigation bouton « Nouvelle commande » |
| `mobile/src/screens/driver/DriverHomeScreen.js` | Layout carte (~50 %) + bouton en ligne réduit |

**Aucun autre fichier touché.** Backend, dispatch, sockets, DriverContext : inchangés.

---

## 2. Changements effectués

### Correctif 1 — Bouton « Nouvelle commande »

**Avant :** `navigation.navigate('SearchTab')` — onglet inexistant, aucune action.

**Après :**
```javascript
navigation.navigate('HomeTab', {
  screen: 'Home',
  params: { reset: Date.now() },
});
```

Retour à l'accueil client avec reset complet (recherche vide, pas de catégorie active).

### Correctif 2 — Carte livreur (~50 % hauteur)

**Avant :** `mapFrame: { flex: 1 }` — carte ~20 % à cause du bouton 200px.

**Après :** `height: SCREEN_H * 0.5` + `gap` réduit (`spacing.sm`).

### Correctif 3 — Bouton en ligne / hors ligne

**Avant :** 200×200 px, `fontSize: 14`.

**Après :** 100×100 px, `fontSize: 12`. Logique `toggleOnline` inchangée.

---

## 3. Diff résumé

```diff
OrderTrackingScreen.js
- navigation.navigate('SearchTab')
+ navigation.navigate('HomeTab', { screen: 'Home', params: { reset: Date.now() } })

DriverHomeScreen.js
+ import Dimensions, SCREEN_H
- mapFrame: flex 1, gap md
+ mapFrame: height 50% screen, gap sm
- onlineBtn: 200×200, fontSize 14
+ onlineBtn: 100×100, fontSize 12
```

---

## 4. Tests réalisés

| Test | Statut |
|------|--------|
| Lint fichiers modifiés | OK — aucune erreur |
| Backend non modifié | Confirmé |
| DriverContext non modifié | Confirmé |
| dispatch.js non modifié | Confirmé |

**Tests manuels recommandés :**
- Commande livrée → « Nouvelle commande » → accueil reset
- Écran livreur → carte ~50 %, bouton plus petit
- Flux commande complet (client → livreur → delivered)

---

## 5. Risques éventuels

| Risque | Niveau | Détail |
|--------|--------|--------|
| Navigation nested HomeTab | Faible | Pattern identique à l'onglet Home existant |
| Carte 50 % sur petits écrans | Faible | Hauteur proportionnelle via Dimensions |
| Bouton en ligne trop petit au toucher | Faible | 100px reste au-dessus du minimum iOS (44pt) |
| Régression dispatch / missions | Nul | Aucun fichier métier modifié |

---

*Rapport MVP 0.8.1 — Ma Zone — juin 2026*
