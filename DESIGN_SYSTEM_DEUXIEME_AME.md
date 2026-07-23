# Design System — Deuxième Âme V1

**Identité officielle visuelle de Ma Zone** (face Deuxième Âme).  
Date : 23 juillet 2026

---

## Contrat émotionnel

Ma Zone n’est pas une interface SaaS. C’est une fenêtre sur le quartier.

| Principe | Application |
|----------|-------------|
| Humain & intemporel | Crème / ivoire, pastels désaturés, terracotta |
| Respiration | Espacements généreux, peu de bordures dures |
| Éditorial | Titres serif (Cormorant Garamond), corps Source Sans 3 |
| Illustrations = identité | Clés de registry uniquement, jamais d’asset en dur |
| Calme | MOTION lent, FadeIn doux, springs soft |
| Anti-SaaS | Pas de bleu startup, pas de glassmorphism, pas de néons |

---

## Tokens (`AME`)

Fichier : `mobile/src/theme/ame.js`

### Couleurs clés

- Fond papier : `#F7F1EA`
- Surface carte : `#FFFBF7`
- Encre : `#2C2420`
- Accent terracotta : `#C4785A` / deep `#A35D42`
- Primary chaud : `#8B5E45`

### Typographie

- Display : `CormorantGaramond_600SemiBold` (titres émotionnels)
- UI : `SourceSans3_400Regular` → `700Bold`

### Ombres

Teinte brune (`#5C4030`), opacity ≤ 0.06 — surfaces **posées**, jamais flottantes.

### Motion (`MOTION`)

- FadeIn ~480 ms, translateY 14
- Springs soft / gentle / settle
- Stagger portes : 70 ms

---

## Illustrations

Registry : `mobile/src/illustrations/registry.js`  
Composant : `<Illustration name="portes.lanternes" />`

Règle d’or : **composant → clé → registry → asset**.  
Swap futur = une ligne dans le registry.

---

## Iconographie

Dictionnaire sémantique : `mobile/src/icons/ameIcons.js`  
Rendu : `<SoftIcon name="mailbox" />` — outlines dans un puits pastel.

Un seul langage : Ionicons / MaterialCommunity filtrés, jamais de mélange libre.

---

## Composants Design System

| Composant | Rôle |
|-----------|------|
| `AmeCard` / `AmeBadge` / `AmeSectionTitle` | Surfaces & badges |
| `SoftIcon` | Icônes dans puits pastel |
| `Illustration` | Images via registry |
| `FadeIn` | Apparitions calmes |

---

## Périmètre V1

Inclus : toute la Deuxième Âme (Accueil, portes, secondaires, tab bar, SoulSwitchFab côté second).  
Hors scope : Première Âme, Épée, Livreur (conservent `THEME` marketplace).

---

## Remplacer un placeholder

1. Déposer le fichier final dans `mobile/assets/illustrations/…`
2. Mettre à jour `registry.js` (`placeholder: false`)
3. Aucun changement UI
