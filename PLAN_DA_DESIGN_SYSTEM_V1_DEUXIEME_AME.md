# Plan — Direction Artistique & Design System V1 (Deuxième Âme)

**Statut :** en attente de validation avant exécution  
**Date :** 23 juillet 2026  
**Périmètre V1 :** Deuxième Âme uniquement (extension Marketplace / Épée / Livreur plus tard)

---

## Intention du chantier

Jusqu’ici, Ma Zone a surtout construit des fondations techniques (Marketplace, Deuxième Âme, Event Engine, Wallet, boîte aux lettres, monde simulé, Opportunités Volantes).

Ce chantier ne concerne **pas** les fonctionnalités. Il concerne **l’émotion**.

> **Règle fondamentale :** on change le costume, pas le corps.  
> Pas de refonte d’architecture UX, pas de déplacement de fonctionnalités, pas de nouveaux parcours.

---

## Confirmation des références

Les deux images de référence sont reçues et prises en compte :

1. **Vision globale Accueil** — crème chaud, hero du café au crépuscule, titres élégants, portes en cartes pastel illustrées, murmures chaleureux, nav basse sobre.
2. **Banque d’icônes / illustrations** — style aquarelle artisanal pour header, 6 portes, murmures, barre d’état.

**Règle d’interprétation :** inspiration DA uniquement. On conserve le corps actuel (6 portes, routes, Mode Réception boîte aux lettres, SoulSwitchFab, AiIntentBar, OpportunityBanner, Wallet / Panier / Messages). On change le costume.

---

## Principes DA (contrat émotionnel)

| Principe | Traduction concrète |
|----------|---------------------|
| Quartier vivant, humain, intemporel | Crème / ivoire, pastels désaturés, terracotta léger, sauge, bleu doux |
| Respiration | Espacements plus généreux, moins de bordures dures, peu d’ombre |
| Éditorial + lisible | Titres serif aérés ; corps / UI sans-serif moderne (pas Inter / Roboto / Arial) |
| Illustrations = identité | Composants référencent des **clés d’assets**, jamais d’illustration générée en dur |
| Calme | Animations lentes (FadeIn existant, springs adoucis) |
| Anti-SaaS | Pas de bleu startup agressif, pas de glassmorphism, pas de néons |

### Palette cible (tokens)

Remplacer le thème actuel « Apple / Linear » (`#0A1628` / `#2563EB` / `#F8FAFC`) dans `mobile/src/theme/index.js` :

- Fond : ivoire / papier (`~#F7F1EA`)
- Surface carte : crème (`~#FFFBF7`)
- Texte : encre chaude (`~#2C2420`)
- Secondaire / muted : gris chauds
- Accents portes : lavande, terracotta, sauge, bleu ciel, rose poussiéreux, violet doux (désaturés)
- Accent UI global : terracotta / ocre doux (remplace le bleu `#2563EB`)
- Ombres : opacity ≤ 0.06, radius large, teinte brune chaude — surfaces « posées », pas flottantes

### Typographie

Via `@expo-google-fonts` (`expo-font` déjà présent) :

- Display / titres émotionnels : **Cormorant Garamond** (élégant, aéré)
- UI / corps : **Source Sans 3** (moderne, lisible, non-générique startup)

Chargement des fonts au boot dans `mobile/App.js` ; splash / loader crème pendant le chargement.

---

## Architecture illustrations (fondation durable)

```
mobile/assets/illustrations/
  README.md
  registry.js
  placeholders/
  portes/
  murmures/
  banner/
  nav/
  header/
```

API prévue :

```js
getIllustration('portes.lanternes') // → { source, alt }
```

Chaque composant consomme **uniquement la clé**. Remplacer une illustration officielle = changer le fichier + une ligne du registry, zéro refactor UI.

**V1 :** placeholders alignés sur la banque, marqués `placeholder: true`. Quand les illustrations finales arriveront, on swappe les fichiers.

---

## Ce qu’on restyle (corps inchangé)

### 1. Design System de base

- Refondre `mobile/src/theme/index.js` : colors, radius, shadow, spacing, typography (+ `fontFamily`)
- Enrichir / créer sous `mobile/src/components/ui/` : Card, boutons, badges, chips
- Documenter les principes dans `DESIGN_SYSTEM_DEUXIEME_AME.md`

### 2. Accueil — composition actuelle, costume nouveau

Fichiers pivots : `DeuxiemeAmeHomeScreen`, `AmeHeader`, `WeatherHero`, `AiIntentBar`, `PorteCard`, `MurmurCard`, `ModeReceptionPopover`

| Zone | Corps (conservé) | Costume (DA) |
|------|------------------|--------------|
| Header | Mailbox Mode Réception + profil | Fond crème, icônes plus douces, badge non-lus ; **pas** d’enveloppe messagerie |
| Hero / bannière | Stats Event Engine + ancrage lieu | Grande bannière illustrée (`banner.quartier`), overlay typo serif poétique, structure prête pour météo / saison / heure |
| AiIntentBar | Suggestions + placeholder IA | Carte crème, sparkle discret |
| Portes | 6 portes, mêmes routes, grille 2×3 | Cartes pastel + illustration aquarelle + flèche colorée ; `illustrationKey` dans `PORTES` |
| Murmures | Liste **horizontale** existante | Cartes plus chaleureuses, vignette illustrée, badge doux |
| SoulSwitchFab | Bascule d’Âme | Pilule crème / terracotta — intégré à la DA même absent de la maquette |
| OpportunityBanner | Flash OV | Restyle pastel / sérénité |

### 3. Navigation Deuxième Âme

Dans `mobile/src/navigation/index.js` : styles de tab bar **uniquement pour `DeuxiemeAmeTabs`** (terracotta doux, fond crème) — sans changer Première Âme / Épée / Driver.

### 4. Écrans secondaires Deuxième Âme

Pass de cohérence tokens sur Events, EventDetail, Lanterns, Participer, Mailbox, ModeReception, Surprise, etc. — même palette / typo / cartes, **sans** redessiner chaque parcours.

### 5. Hors périmètre V1

- Première Âme (Marketplace)
- Épée / Livreur
- Remplacement des placeholders par la bibliothèque officielle finale
- Illustrations animées / bannière dynamique météo réelle

---

## Décisions figées

1. **Périmètre V1** = Deuxième Âme uniquement (choix A confirmé).
2. **Typo** = Cormorant Garamond + Source Sans 3.
3. **Accent global Âme** = terracotta / ocre doux, pas bleu startup.
4. **Murmures** restent en scroll horizontal.
5. **Mailbox Mode Réception** reste la métaphore boîte aux lettres.
6. **SoulSwitchFab** restylé dans le langage DA.
7. **Illustrations** = registry + placeholders ; swap futur sans toucher aux composants.

---

## Ordre d’exécution (qualité > vitesse)

1. Tokens + fonts + App bootstrap
2. Registry illustrations + placeholders
3. Restyle composants Accueil (Header → Banner → Intent → Portes → Murmures)
4. SoulSwitchFab + tab bar SecondSoul + OpportunityBanner
5. Harmonisation écrans secondaires Âme
6. Relecture visuelle + compte rendu / PDF

---

## Livrables attendus en fin de chantier

- Design System tokens + fonts chargées
- Registry d’illustrations + placeholders
- Accueil Deuxième Âme transformé visuellement
- Composants Âme + tab bar + switch harmonisés
- Écrans secondaires Âme cohérents
- Compte rendu détaillé (principes, fichiers, prochaines itérations) + PDF

---

## Ce que ce plan ne fera pas

- Revoir l’architecture UX
- Déplacer ou supprimer des fonctionnalités
- Refaire la Deuxième Âme fonctionnellement
- Imposer la disposition exacte de la maquette quand elle diverge du corps actuel
- Dépendre d’illustrations générées automatiquement

---

*Document de validation — Ma Zone · Direction Artistique & Design System V1 · 23/07/2026*
