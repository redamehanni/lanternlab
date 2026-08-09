# BASE — Lantype Glass (SkSL Figma)

**Statut :** base Figma Skia (6 août 2026)  
**Pourquoi :** `expo-blur` couple flou + opacité matériau. SkSL floute le fond **sans** plaque système.

## Pile

| Couche | Techno |
|--------|--------|
| Fond | `Image` fixe `porte-fond.png` |
| Verre | Skia `RuntimeEffect` (SKSL Figma) + `ImageShader` |
| Alignement | `bgOffset` = position carte − origine fond (`measureInWindow` + `scrollY`) |
| Texte | RN au-dessus |

## Fichiers

- `LanterneGlassCard.js` — composant Figma adapté
- `LanternsScreen.js` — scène + `useImage` partagé
- `porte-fond.png`

## Règles

- Référence = iOS simulateur / device (pas browser Cursor)
- Scroll = SharedValue (pas de `setState` par frame)
- Fond visible et ImageShader = **même cadre**
- Calage tint / CA / grain = uniforms SkSL ensuite
