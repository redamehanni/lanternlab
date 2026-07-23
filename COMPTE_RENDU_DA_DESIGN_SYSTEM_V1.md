# Compte rendu — Direction Artistique & Design System V1 (Deuxième Âme)

**Date :** 23 juillet 2026  
**Statut :** chantier livré  
**Périmètre :** Deuxième Âme uniquement (costume, pas le corps)

---

## Synthèse

Ma Zone possède désormais une **identité visuelle officielle** sur la face Deuxième Âme.

Ce n’est plus une UI « startup froide » (slate / bleu `#2563EB`). C’est un langage crème, terracotta, éditorial — pensé comme une fenêtre ouverte sur le quartier : cafés du soir, artisans, promenades, souvenirs heureux.

Les parcours, l’Event Engine, le Mode Réception, le SoulSwitchFab, la boîte aux lettres et les 6 portes sont **inchangés fonctionnellement**. Seul le costume a changé.

---

## Philosophie appliquée

| Intention | Traduction concrète |
|-----------|---------------------|
| Rues connues par cœur | Bannière poétique + ancrage lieu |
| Cafés / librairies / marchés | Pastels portes, cartes crème posées |
| Promenades du soir | Hero warm wash + typo serif |
| Quotidien simple / poèmes | Cormorant Garamond sur titres |
| Jamais froid | Fond `#F7F1EA`, ombres brunes ≤ 0.06 |
| Premium sans ostentation | Peu d’ombre, beaucoup d’air |
| Une seule main de studio | SoftIcon + Illustration registry |

---

## Principes du Design System

Document vivant : [`DESIGN_SYSTEM_DEUXIEME_AME.md`](DESIGN_SYSTEM_DEUXIEME_AME.md)

1. **Surface composes, organ decides** — inchangé ; la DA ne touche que la surface.
2. **Tokens AME** isolés du marketplace (`THEME` conservé pour Première Âme / Épée / Livreur).
3. **Illustrations par clé** — aucun composant ne `require` une image directement.
4. **Iconographie sémantique** — dictionnaire `AME_ICONS`, rendu `SoftIcon`.
5. **Motion calme** — `MOTION` (durées lentes, springs soft, stagger 70 ms).

---

## Nouveaux tokens (`AME`)

Fichier : `mobile/src/theme/ame.js`

### Palette

- `bg` `#F7F1EA` — papier
- `card` / `bgElevated` `#FFFBF7` — crème
- `text` `#2C2420` — encre chaude
- `accent` `#C4785A` — terracotta
- `primary` `#8B5E45` — ocre profond
- Accents portes désaturés : lavande, terracotta, sauge, bleu ciel, rose, violet doux (+ versions soft)

### Radius / spacing / shadow

- Radius plus généreux (`lg` 22, `xl` 28)
- `spacing.section` 28 pour le rythme vertical
- Ombres brunes chaudes, opacity ≤ 0.06

### Typographie

| Rôle | Font |
|------|------|
| Display / titres | Cormorant Garamond 500 / 600 / 700 |
| UI / corps | Source Sans 3 400 / 500 / 600 / 700 |

Chargement au boot dans `App.js` via `useAmeFonts()` ; splash crème pendant le load.

### Motion

Fichier : `mobile/src/theme/motion.js`  
FadeIn ~480 ms, springs soft/gentle/settle, press scale 0.975.

---

## Choix iconographiques

- Dictionnaire : `mobile/src/icons/ameIcons.js`
- Composant : `SoftIcon` — outline dans un puits pastel
- Tab bar SecondSoul : icônes Ionicons + **trait actif terracotta** sous l’icône
- Mailbox Mode Réception conservée (fanion levé / baissé) — pas remplacée par cloche/enveloppe maquette

---

## Choix de composition

### Accueil

1. Header : marque serif + « Bonjour {prénom} » + mailbox + avatar  
2. Hero : bannière illustrée + overlay poétique + stats Event Engine en bandeau crème  
3. Intention : carte crème, chips papier  
4. Section « Les portes d’entrée » (titre serif + sous-titre)  
5. Grille 2×3 aérée (rowGap 14, cartes pastel + illustration + flèche colorée)  
6. Murmures horizontaux (cartes xl radius, vignette, badge Nouveau)

### Respiration

- Marges section plus larges (`section` 28, murmures marginTop 32)
- Moins de bordures dures, ombres très légères
- Hiérarchie : serif pour guider le regard, sans-serif pour lire

---

## Animations ajoutées / adoucies

- `FadeIn` recalibré (MOTION) — encre qui s’installe
- Stagger portes & murmures
- Apparition hero / intent bar décalée
- OpportunityBanner : spring soft + fade out 380 ms
- Transitions stack Âme : `fade_from_bottom` ~320 ms
- PressableScale : scale plus doux (0.975)

---

## Architecture illustrations

```
mobile/assets/illustrations/
  portes/ · murmures/ · banner/ · nav/ · header/ · placeholders/
mobile/src/illustrations/
  registry.js · Illustration.js
```

Clés : `banner.quartier`, `banner.quartierSoft`, `portes.*`, `murmures.default`, `header.mailbox`, `nav.*`

Placeholders V1 = washes pastel + bannière soft (marqués `placeholder: true`).  
Références DA copiées dans `docs/da-references/`.

---

## Fichiers créés

| Fichier | Rôle |
|---------|------|
| `mobile/src/theme/ame.js` | Tokens officiels Deuxième Âme |
| `mobile/src/theme/marketplace.js` | Ancien THEME isolé |
| `mobile/src/theme/motion.js` | Micro-interactions |
| `mobile/src/theme/fonts.js` | Chargement Cormorant + Source Sans 3 |
| `mobile/src/illustrations/registry.js` | Clé → asset |
| `mobile/src/illustrations/Illustration.js` | Composant Image via clé |
| `mobile/src/icons/ameIcons.js` | Langage iconographique |
| `mobile/src/components/ui/SoftIcon.js` | Icône en puits pastel |
| `mobile/src/components/ui/AmeCard.js` | Card / Badge / SectionTitle |
| `mobile/assets/illustrations/**` | Placeholders + README |
| `docs/da-references/**` | Images de référence validées |
| `DESIGN_SYSTEM_DEUXIEME_AME.md` | Contrat DA |
| `PLAN_DA_DESIGN_SYSTEM_V1_DEUXIEME_AME.md` | Plan validé |

---

## Fichiers modifiés (principaux)

| Fichier | Changement |
|---------|------------|
| `mobile/App.js` | Fonts + splash crème + StatusBar soul-aware |
| `mobile/src/theme/index.js` | Export THEME (market) + AME + MOTION |
| `mobile/src/data/deuxiemeAme.js` | `illustrationKey`, couleurs désaturées |
| `mobile/src/components/deuxiemeAme/*` | Costume DA complet |
| `mobile/src/screens/deuxiemeAme/*` | Tokens AME + typo |
| `mobile/src/components/common/SoulSwitchFab.js` | Pilule crème sur SecondSoul |
| `mobile/src/navigation/index.js` | `ameTabOptions`, `ameScreenOptions`, `AmeTabIcon` |
| `mobile/src/components/ui/FadeIn.js` | Motion calme |
| `mobile/package.json` | expo-font + Google Fonts |

---

## Ce qui n’a PAS changé (volontairement)

- Parcours utilisateur & architecture fonctionnelle
- Event Engine, Wallet, Mode Réception, OV, boîte aux lettres
- Position / rôle du SoulSwitchFab
- Scroll horizontal des murmures
- Première Âme, Épée, Livreur (THEME marketplace intact)
- Logique métier / API

---

## Recommandations — prochaines itérations

1. **Bibliothèque aquarelle officielle** — remplacer les placeholders (`placeholder: false`) porte par porte, puis nav / header / murmures.
2. **Photo hero propre** — image café crépuscule sans chrome UI ; brancher `banner.quartier`.
3. **Première Âme DA V2** — étendre le même langage (ou un cousin marketplace) pour une marque unifiée.
4. **Icônes custom SVG** — remplacer Ionicons dans SoftIcon / tab bar par traits aquarelle maison.
5. **Bannière dynamique** — brancher météo / saison / heure sur `WeatherHero` (slots déjà prévus).
6. **Wallet / Messages / Panier en SecondSoul** — pass DA léger sur ces stacks partagés (aujourd’hui tab bar Âme + contenu encore marketplace).
7. **Dark evening variant** — mode crépuscule optionnel aligné sur l’hero.

---

## Objectif atteint ?

Lorsqu’un habitant ouvre la Deuxième Âme, il voit désormais :

- un fond papier, pas un dashboard gris ;
- une marque et des titres qui évoquent un livre de quartier ;
- des portes illustrées, pas des tuiles SaaS ;
- une navigation terracotta calme ;
- une bascule d’Âme intégrée au même langage.

**L’identité graphique commence à raconter quelque chose avant la première interaction.**

---

*Ma Zone · Direction Artistique & Design System V1 · 23/07/2026*
