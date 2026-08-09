# LANTYP Material Lab — Plan d'étude

**Document :** plan de conception  
**Date :** 6 août 2026  
**Statut :** en attente de validation (pas de développement avant le go)  
**Auteur :** Reda Mehanni + Cursor  

---

## 1. Contexte et décision

### 1.1 Pourquoi arrêter la méthode actuelle

Aujourd'hui, chaque modification de matériau (verre, lumière, aberration chromatique, blur…) impose :

- modifier du code ;
- recompiler ;
- corriger des bugs ;
- relancer ;
- recommencer.

Cette boucle ne convient pas à un directeur artistique qui doit **créer des matériaux**, pas déboguer du GPU.

### 1.2 Décision proposée

Mettre temporairement en pause le développement de l'application principale sur le calage du verre, et créer un **projet séparé** :

**LANTYP Material Lab**

- Aucune logique métier Ma Zone.
- Aucune API.
- Aucune navigation.
- Aucun écran des Lanternes.
- Uniquement un espace de création de matériaux.

Le labo devient la **source officielle** de tous les matériaux LANTYP. L'app mobile ne fait qu'**importer les presets validés**.

### 1.3 Choix actés pour ce plan

| Sujet | Choix |
|-------|-------|
| Plateforme | Application web indépendante (Vite + React + Skia/CanvasKit) |
| Presets | Fichiers JSON écrits directement dans le dépôt (versionnés Git) |
| Moteur graphique | Même Skia que l'app mobile (`canvaskit-wasm` 0.41.0) |
| Shader | SkSL unique, partagé labo ↔ app |

---

## 2. Objectif du laboratoire

Créer une **carte de verre** au centre de l'écran, sur un **fond image librement remplaçable**, pour tester les réactions du matériau sur différents arrière-plans.

**Exigences d'usage :**

- Toutes les modifications visibles **instantanément**.
- Aucune recompilation.
- Aucun redémarrage.
- Travail **uniquement avec des curseurs** (et contrôles visuels associés).

**Philosophie :**

Expérimenter comme dans un logiciel de création graphique : déplacer un curseur, voir le résultat, comparer plusieurs versions, sauvegarder celles qui plaisent.

---

## 3. Paramètres à contrôler (cahier des charges DA)

### 3.1 Matière

- transparence
- opacité du verre
- couleur éventuelle du verre
- épaisseur perçue
- rayon des coins
- texture interne
- micro-bruit (noise)
- rugosité

### 3.2 Dépoli

- intensité du blur
- rayon du blur
- qualité du blur
- diffusion de la lumière

### 3.3 Réfraction

Contrôle de la déformation du fond observé à travers le verre :

- intensité de la réfraction
- largeur de la zone de réfraction
- uniquement sur les bords ou sur toute la surface
- douceur de la transition
- type de déformation (linéaire, organique, ondulée…)

### 3.4 Aberration chromatique

- intensité
- largeur
- uniquement sur les bords
- distance de séparation RGB
- orientation
- opacité
- comportement dynamique
- activation / désactivation de l'effet

### 3.5 Reflets

- intensité
- largeur
- position
- angle
- dureté
- couleur
- opacité
- déplacement du reflet en direct

### 3.6 Lumière

- intensité
- couleur
- température
- diffusion
- halo
- lumière interne
- lumière venant de l'extérieur
- interaction entre la lumière et le verre

### 3.7 Ombres

- opacité
- flou
- distance
- direction
- ombre externe
- ombre interne

### 3.8 Contours

- épaisseur
- couleur
- opacité
- lumière uniquement sur certaines parties
- contour continu ou discontinu

### 3.9 Animation (onglet dédié)

- légère lévitation
- vitesse
- amplitude
- respiration
- micro oscillation
- déplacement automatique des reflets
- déplacement automatique de l'aberration chromatique

Résultat visible immédiatement.

### 3.10 Presets

- enregistrer un preset
- charger un preset
- dupliquer un preset
- supprimer un preset
- comparer deux presets côte à côte

Exemples : Glass V1, Glass V2, Glass V3…

### 3.11 Export

Bouton **Exporter** → génération automatique d'un fichier JSON contenant tous les paramètres.

Exemple :

```json
{
  "glass": {
    "opacity": 0.12,
    "blur": 18,
    "refraction": 0.7,
    "chromaticAberration": {
      "enabled": true,
      "strength": 0.35,
      "width": 10
    },
    "reflection": {
      "intensity": 0.28
    },
    "shadow": {
      "blur": 24
    }
  }
}
```

L'application principale charge ensuite ce preset — le labo reste la source officielle.

### 3.12 Vision à terme

Le labo est conçu dès aujourd'hui pour accueillir de futurs éditeurs de matériaux :

- verre
- lumière
- métal
- bois
- papier
- eau
- fumée
- particules
- effets lumineux

---

## 4. Architecture proposée

### 4.1 Principe directeur

Le labo **fabrique** les matériaux. L'app mobile **consomme** les presets.

```
Curseurs du labo
    → preset JSON versionné dans Git
    → npm run sync:mobile
    → LanterneGlassCard lit le preset

Shader SkSL unique
    → rendu labo (CanvasKit / navigateur)
    → rendu app (Skia / iOS Metal)
```

Le shader SkSL est écrit **une seule fois**. Aucune réécriture, aucune traduction entre web et mobile.

### 4.2 Emplacement dans le dépôt

Nouveau dossier racine : **`lantype-lab/`**

Autonome, sur le modèle de `admin-web/`, mais :

- port **5175** (5174 = admin-web, 8081 = Metro mobile)
- aucune dépendance au backend Ma Zone

### 4.3 Stack technique

| Couche | Technologie |
|--------|-------------|
| UI | Vite + React + TypeScript |
| Rendu | CanvasKit WASM (Skia web) |
| Version CanvasKit | **0.41.0** (alignée sur `@shopify/react-native-skia` 2.6.2 mobile) |
| Shader | SkSL paramétré (RuntimeEffect) |
| Presets | JSON dans `lantype-lab/presets/glass/` |
| Fonds test | Images dans `lantype-lab/backgrounds/` |
| Écriture disque | Plugin Vite (routes dev locales) |

### 4.4 Contrat matériau (extensibilité)

Toute l'interface est **générée** à partir d'un schéma de paramètres. Ajouter le métal ou le bois plus tard = un module + une ligne de registre, **sans réécrire l'UI**.

```ts
export type MaterialModule = {
  id: 'glass';
  label: 'Verre';
  schema: ParamGroup[];           // pilote panneaux et curseurs
  buildShader(p: Params): string;  // source SkSL
  buildUniforms(p: Params, t: number): Uniforms;
};
```

Types de contrôles : curseur, couleur, interrupteur, liste déroulante, cadran d'angle.

### 4.5 Shader verre paramétré

Le SkSL actuel (`LanterneGlassCard.js`) contient des constantes figées (`blurBg(coord, 14.0)`, `tintStr = 0.65`). Il sera réécrit en version **pilotée par uniforms**, organisée en neuf groupes = neuf onglets du labo.

Environ **50 paramètres** au total.

**Contrainte SkSL importante :** le nombre d'échantillons d'une boucle de blur doit être une **constante de compilation**. Le curseur « qualité du blur » régénère donc le shader source et le recompile (~quelques ms, imperceptible). Tous les autres curseurs passent par des uniforms → **instantanés**.

### 4.6 Presets versionnés Git

Plugin Vite en développement :

- lister / lire / enregistrer / renommer / dupliquer / supprimer
- écriture dans `lantype-lab/presets/glass/*.json`
- JSON indenté, clés ordonnées → diffs Git lisibles

Forme cible d'un preset :

```json
{
  "id": "glass-v1",
  "name": "Glass V1",
  "material": "glass",
  "params": {
    "matiere": { "opacity": 0.12, "tint": "#0A0602", "radius": 16 },
    "depoli": { "blur": 18, "quality": 3 },
    "refraction": { "strength": 0.7, "edgeOnly": true },
    "aberration": { "enabled": true, "strength": 0.35, "width": 10 }
  }
}
```

**Comparaison A/B :** deux cartes côte à côte, chacune avec son preset, même fond.

**Fonds :** glisser-déposer → `lantype-lab/backgrounds/`.

### 4.7 Passerelle vers l'app mobile

Script `npm run sync:mobile` :

- copie le preset validé + shader généré vers `mobile/src/theme/materials/glass/`
- `LanterneGlassCard.js` lit le preset (plus de valeurs en dur)

**Pourquoi copie et pas lien direct ?** Metro (bundler mobile) devient fragile quand il surveille des fichiers hors de `mobile/` — incident récent du 6 août 2026.

**Prod :** rien du labo n'entre en production. Seuls JSON + shader généré traversent → données DA. Conforme FD-000 (sandbox / labo interdit en prod).

### 4.8 Limites connues

| Point | Détail |
|-------|--------|
| Même Skia, GPU différent | WebGL (navigateur) vs Metal (iOS) |
| Rendu | Très proche, pas garanti pixel-perfect |
| Couleurs | Légères différences possibles |
| Validation finale | Une passe simulateur iOS **à la fin**, pas en boucle |

---

## 5. Ce que le labo ne contient PAS

- Logique métier Ma Zone (Lanternes, scan, statuts, API)
- Navigation React Navigation
- Backend / SQLite / JWT
- Écrans Deuxième Âme
- Déploiement production

---

## 6. Gouvernance projet

1. `git pull origin main` avant tout chantier.
2. Brouillon **`FICHE_DISCUSSION/FD-005-lantyp-material-lab.md`** depuis `_TEMPLATE.md`.
3. Validation humaine Reda + Adam.
4. Commit + entrée dans `FICHE_DISCUSSION/INDEX.md`.
5. Puis seulement : développement du labo.

---

## 7. Plan de livraison (phases)

### Phase 0 — Gouvernance

- Rédiger FD-005 (brouillon)
- Validation humaine

### Phase 1 — Fondations (MVP labo)

- Créer `lantype-lab/` : Vite + React + TS, port 5175
- Épingler `canvaskit-wasm@0.41.0`
- Moteur CanvasKit : stage, fond ImageShader, carte rounded-rect
- Contrat `MaterialModule` + UI générique par schéma
- Onglets Matière + Dépoli + Aberration (premier shader paramétré)
- 1 preset par défaut + sauvegarde JSON sur disque

**Livrable Phase 1 :** curseurs visibles, carte qui réagit en direct, 1 preset enregistrable.

### Phase 2 — Complétude verre

- Onglets Réfraction, Reflets, Lumière, Ombres, Contours
- Onglet Animation (temps, lévitation, respiration)
- Comparaison A/B
- Fonds remplaçables (drag & drop)
- Bibliothèque presets (CRUD complet)

**Livrable Phase 2 :** cahier des charges DA couvert, workflow preset complet.

### Phase 3 — Passerelle app

- Bouton Exporter + `npm run sync:mobile`
- `LanterneGlassCard.js` lit preset + shader générés
- Validation rendu simulateur iOS (1 passe finale)

**Livrable Phase 3 :** un matériau créé dans le labo visible dans l'app sans toucher au code.

---

## 8. Checklist de validation (pour le go)

Cocher avant de lancer le développement :

- [ ] Le principe « labo = source officielle, app = consommateur » est validé
- [ ] Le choix web + CanvasKit 0.41.0 est validé
- [ ] Les presets JSON dans Git (pas export manuel) sont validés
- [ ] La pause calage verre dans l'app est acceptée
- [ ] FD-005 rédigée et validée
- [ ] Phase 1 seule suffit pour un premier go, ou go direct Phases 1–3

---

## 9. Références techniques existantes

| Fichier | Rôle |
|---------|------|
| `mobile/src/components/deuxiemeAme/LanterneGlassCard.js` | Shader SkSL actuel (base à paramétrer) |
| `mobile/src/theme/lantype.js` | Tokens LANTYPE |
| `CHANTIER/lantype/BASE_LANTYPE_GLASS.md` | Contrat verre actuel |
| `admin-web/vite.config.js` | Modèle projet Vite autonome |
| `FICHE_DISCUSSION/FD-000-…md` | Règles sandbox / prod |

---

*Document généré pour étude — en attente de validation avant implémentation.*
