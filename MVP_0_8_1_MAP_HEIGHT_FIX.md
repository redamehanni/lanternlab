# Ma Zone — MVP 0.8.1 — Correctif hauteur carte livreur

**Date :** juin 2026 · **Type :** Layout uniquement (aucun impact fonctionnel)

---

## 1. Fichier modifié

| Fichier | Modifié |
|---------|---------|
| `mobile/src/screens/driver/DriverHomeScreen.js` | Oui |
| Tout autre fichier (dispatch, sockets, DriverContext, PremiumMap, backend…) | Non |

---

## 2. Ancienne hauteur vs nouvelle hauteur

### Cause du problème

Le conteneur `mapFrame` avait bien `height: SCREEN_H * 0.5`, mais le composant `DriverMap` → `PremiumMap` utilise une **hauteur par défaut de 180 px** lorsqu'aucune prop `height` n'est passée.

Résultat : le cadre faisait 50 % de l'écran, mais la carte affichée restait à **180 px** — d'où l'impression d'une petite carte avec espace vide en dessous dans le cadre.

### Hauteurs

| | Valeur |
|---|--------|
| **Ancienne hauteur carte (réelle)** | **180 px** (défaut `PremiumMap`) |
| **Nouvelle hauteur carte** | **`Math.round(SCREEN_H * 0.5)`** — 50 % de la hauteur totale de l'écran |

### Exemples selon appareil

| Écran | SCREEN_H | MAP_HEIGHT (nouveau) |
|-------|----------|----------------------|
| iPhone 15/16 (~844 pt) | 844 | **422 px** |
| iPhone 17 Pro (~874 pt) | 874 | **437 px** |
| Web Cursor (~800 px) | 800 | **400 px** |

**Gain typique :** de 180 px → ~400–440 px (**+120 à +150 %** de surface cartographique).

---

## 3. Modifications appliquées

```javascript
const MAP_HEIGHT = Math.round(SCREEN_H * 0.5);

<DriverMap
  lat={lat}
  lng={lng}
  zoom={14}
  height={MAP_HEIGHT}
  style={styles.mapStretch}
/>
```

Styles :
- `mapFrame.height` → `MAP_HEIGHT` (aligné sur la carte)
- `mapStretch` → `{ width: '100%', height: MAP_HEIGHT }`
- `content` → padding horizontal/bas uniquement (carte en haut de l'écran)

---

## 4. Nouveau layout obtenu

```
┌─────────────────────────────┐
│                             │
│         CARTE               │  ← ~50 % SCREEN_H (interactive)
│      (MAP_HEIGHT)           │
│                             │
├─────────────────────────────┤
│   Message broadcast Ma Zone │
├─────────────────────────────┤
│      Bouton EN LIGNE        │
└─────────────────────────────┘
│        Tab bar              │
```

- Carte commence en haut de la zone contenu (sans padding top)
- Moitié supérieure de l'écran = surface cartographique réelle
- Style premium conservé (borderRadius, ombre, bordure)
- Mode plein écran inchangé (`fullScreen` sur branche séparée)

---

## 5. Risques éventuels

| Risque | Niveau | Détail |
|--------|--------|--------|
| Dispatch / missions / sockets | **Nul** | Aucun fichier métier touché |
| Carte non interactive | **Nul** | PanResponder / MapView inchangés dans PremiumMap |
| Plein écran cassé | **Nul** | Branche `fullscreen` non modifiée |
| Bouton en ligne | **Nul** | Styles et `toggleOnline` inchangés |
| Rotation écran | **Faible** | `Dimensions.get` au mount — hauteur fixée au chargement (comportement existant) |
| Très petits écrans | **Faible** | 50 % reste proportionnel |

**Risque global : Faible** — correction strictement visuelle, 1 fichier.

---

## 6. Validation

- [ ] Carte occupe visuellement ~50 % de l'écran (hors mission active)
- [ ] Carte interactive (pan, zoom)
- [ ] Bouton « Plein écran » fonctionne
- [ ] Bouton en ligne / hors ligne fonctionne
- [ ] Aucun impact sur réception de commandes

**Note :** si une mission est active, l'écran passe automatiquement en mode plein écran — le layout accueil n'est pas visible (comportement existant).

---

*Rapport MVP 0.8.1 — Correctif hauteur carte livreur — Ma Zone*
