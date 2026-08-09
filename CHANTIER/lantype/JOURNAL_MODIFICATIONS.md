# Journal — Lantype

## 6 août 2026 — Intégration composant Figma (SkSL)

**Pourquoi :** BlurView couple flou/opacité. Figma livre un shader Skia qui floute le fond via `ImageShader`.

### Livré
- `npx expo install @shopify/react-native-skia`
- `LanterneGlassCard` = SKSL Figma + measure + scroll SharedValue
- `LanternsScreen` = fond fixe + `useImage` partagé
- Alignement `bgOffset` vs cadre fond (sous header)

### Suite calage DA
- tintStr / grain / CA dans le SKSL
- densifier kernel blur si « carreaux »

## 6 août 2026 — Cause racine des « cartes qui n'apparaissent pas »

**Ce n'était ni Skia ni le SKSL.** L'`Image` de fond était stylée avec
`...StyleSheet.absoluteFillObject` **plus** `width: '100%'` / `height: '100%'` :
dans cette combinaison elle était comptée dans le flux normal, prenait toute la
hauteur disponible et laissait `height: 0` au `ScrollView`. Tout le contenu
(texte, bouton scan, cartes) existait mais mesurait zéro.

Mesure qui a tranché : `onLayout` du conteneur interne → `y=690, height=0`,
puis `y=0, height=690` après correction.

### Correctif
- Fond = `View` en `position: absolute` contenant une `Image` en `flex: 1`
  (`resizeMode="cover"`). Ne jamais remettre width/height en % sur l'`Image`.
- `zIndex: 1` sur le `ScrollView` pour garantir la peinture au-dessus du fond.
- `Animated.ScrollView` remplacé par un `ScrollView` standard : `scrollY` est
  alimenté depuis `onScroll` en JS, ce qui suffit pour les uniforms du shader.

### Piège de diagnostic rencontré
Metro avait perdu son watcher : ~35 min de code jamais exécuté par l'app, ce qui
faisait croire à un bug de rendu figé. Réflexe : vérifier qu'une ligne
`iOS Bundled` apparaît après chaque sauvegarde avant de conclure quoi que ce soit.

### Reste à caler (DA, pas un bug)
- Cadrage du fond en `cover` : le bas de l'illustration (lanterne, sol) sort du
  cadre. À trancher `cover` vs `contain` avec la DA.

## 7 août 2026 — LANTYP Material Lab (premier bootstrap)

**Décision :** pause du calage verre dans l'app. Création de `lantype-lab/`,
atelier web autonome (Vite + React + CanvasKit 0.41.0 full / RuntimeEffect).

### Livré
- Projet `lantype-lab/` port **5175**
- Shader verre SkSL paramétré (~50 uniforms) — compile OK sous CanvasKit
- UI curseurs générée par schéma (9 onglets)
- Mode Inspect, A/B, Before/After, éclairages, fonds, presets JSON sur disque
- FD-005 brouillon + `PLAN_LANTYP_MATERIAL_LAB.pdf`
- `npm run sync:mobile -- <id>` copie le preset vers mobile

### Lancer
```bash
cd lantype-lab && npm run dev
# → http://localhost:5175
```

### Suite
- Brancher `LanterneGlassCard` sur `mobile/src/theme/materials/glass/active.json`
- Enrichir la bibliothèque de fonds
- Valider FD-005 puis INDEX

## 7 août 2026 — Passerelle labo → app

`LanterneGlassCard` lit désormais le preset Material Lab.

```bash
cd lantype-lab
npm run sync:mobile -- glass-v1
# ou un export :
npm run sync:mobile -- ~/Downloads/mon-verre.json
```

Fichiers generes : `mobile/src/theme/materials/glass/{active.json,runtime.js,index.js,meta.json}`.

Note : l'animation temporelle du preset n'est pas encore pilotee frame-par-frame
cote mobile (time=0). Le rendu statique du materiau est bien celui du JSON.
