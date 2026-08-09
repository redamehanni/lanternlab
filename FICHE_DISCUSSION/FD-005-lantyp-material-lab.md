# FD-005 — LANTYP Material Lab (atelier officiel des matériaux)

| | |
|---|---|
| **Statut** | brouillon |
| **Date** | 2026-08-06 |
| **Auteur(s)** | Reda Mehanni / Cursor |
| **Phase / chantier** | Design System — matériaux LANTYPE |
| **Références** | [FD-000](./FD-000-mise-a-niveau-global-cursor-adam-ma-zone.md), `PLAN_LANTYP_MATERIAL_LAB.md`, `CHANTIER/lantype/` |

> **Ne pas contredire FD-000** sans mise à jour validée de FD-000 ou fiche plus récente.

---

## 1. Contexte

Le calage du verre « Lantype Glass » s'est fait jusqu'ici **dans le code de l'app mobile**. Chaque essai de matériau imposait : modifier du code, recompiler, corriger les bugs induits, relancer, recommencer.

Cette boucle a produit plusieurs sessions perdues sur des problèmes purement techniques (cartes invisibles, watcher Metro mort, couplage flou/opacité de `expo-blur`) sans avancer d'un pas sur la **direction artistique**.

Le directeur artistique n'a pas à être développeur GPU pour choisir une opacité.

## 2. Vision & philosophie

Le laboratoire devient **l'atelier officiel du Bâtisseur**.

Toutes les décisions graphiques naissent dans le labo. L'application mobile ne fait qu'**utiliser les matériaux validés**. Le labo devient donc la **source officielle du langage visuel de LANTYP**.

Ce n'est pas un « Glass Lab » : c'est un **Material Lab**. Le verre est simplement le premier matériau.

Application du principe FD-000 « surface compose, organe décide » au visuel : **le labo décide du matériau, la surface l'applique**.

## 3. Objectif

Disposer d'un logiciel de création de matériaux, séparé de l'app, dans lequel toute l'identité matérielle de LANTYP se conçoit au curseur avec aperçu instantané, et dont les presets JSON versionnés dans Git sont consommés tels quels par l'app mobile.

## 4. Périmètre

### Inclus

- Nouveau projet autonome `lantype-lab/` (Vite + React + TypeScript, port 5175)
- Rendu via CanvasKit (Skia web) avec le **même SkSL** que l'app mobile
- Éditeur de matériau piloté par schéma : Matière, Dépoli, Réfraction, Aberration chromatique, Reflets, Lumière, Ombres, Contours, Animation
- Mode Inspect (isolation de chaque couche)
- Comparaison A/B côte à côte **et** Before/After avec séparateur déplaçable
- Environnements lumineux de référence
- Bibliothèque de fonds de test
- Presets JSON versionnés dans le dépôt (créer, renommer, dupliquer, supprimer, recharger)
- Passerelle d'export vers `mobile/`

### Hors périmètre (explicitement)

- Toute logique métier Ma Zone (Lanternes, scan, statuts, Wallet, Event Engine)
- Toute API backend, tout appel réseau applicatif
- Toute navigation ou écran de l'app
- Tout déploiement production du labo

## 5. Principes directeurs

1. **Aucune recompilation lors des réglages.** Seule exception technique inévitable : la qualité du blur, dont le nombre d'échantillons doit être une constante de compilation SkSL. La régénération est alors automatique et imperceptible.
2. **Aperçu instantané** — tout réglage se voit à l'image suivante.
3. **Tout est manipulable visuellement** — aucun réglage ne doit exiger une modification manuelle du code.
4. **Priorité absolue à la fluidité du workflow créatif.**
5. **Architecture modulaire dès le premier jour** — ajouter métal, bois, eau, fumée, particules ne doit demander qu'un module, jamais une réécriture de l'interface.
6. **Le labo n'entre jamais en production** (règle FD-000 « sandbox / labo interdit en prod »). Seuls le JSON de preset et le shader généré traversent vers `mobile/` : ce sont des données de direction artistique, pas du code de labo.

## 6. Étapes proposées

| # | Étape | Livrable | Statut |
|---|-------|----------|--------|
| 1 | Fiche FD-005 | cette fiche | fait (brouillon) |
| 2 | Scaffold `lantype-lab/` | projet Vite autonome port 5175 | fait |
| 3 | Moteur CanvasKit | scène, fond, boucle de rendu | fait |
| 4 | Contrat matériau + UI générique | interface pilotée par schéma | fait |
| 5 | Matériau verre complet | 9 groupes de paramètres | fait |
| 6 | Inspect / comparaison / éclairages / fonds | outils d'analyse | fait |
| 7 | Presets sur disque | CRUD JSON versionné | fait |
| 8 | Passerelle mobile | `sync:mobile` + lecture preset | fait (LanterneGlassCard lit active.json) |

## 7. Décisions actées

| Date | Décision | Par |
|------|----------|-----|
| 2026-08-06 | Labo = application web indépendante, pas un écran de l'app | Reda |
| 2026-08-06 | Moteur Skia/CanvasKit partagé avec le mobile (`canvaskit-wasm` 0.41.0 = version de `@shopify/react-native-skia` 2.6.2) | Reda |
| 2026-08-06 | Presets = fichiers JSON versionnés dans Git, pas d'export manuel ni de stockage navigateur | Reda |
| 2026-08-06 | Le labo est la source officielle des matériaux ; l'app est consommatrice | Reda |
| 2026-08-06 | Material Lab et non Glass Lab — architecture modulaire multi-matériaux | Reda |

## 8. Questions ouvertes

- Cadrage du fond `porte-fond.png` dans l'app : `cover` (recadre le bas) vs `contain` vs réexport de l'illustration au bon ratio. L'asset actuel fait 481x1024 pour un cadre d'environ 402x690 points, donc il est aussi sous-résolu pour un écran @3x.
- Périmètre des matériaux suivants après le verre (lumière ? métal ?).
- Faut-il à terme un écran d'aperçu dans l'app mobile pour valider un preset sur iOS, ou la passe de validation manuelle suffit-elle ?

## 9. Notes pour les deux Cursor

- Le labo **ne contient aucune logique métier**. Toute tentation d'y brancher l'API est à refuser.
- Le shader SkSL est **écrit une seule fois** et partagé. Ne jamais forker une version « web » et une version « mobile » : c'est exactement ce qui a produit les dérives précédentes.
- Le rendu labo (WebGL) et le rendu iOS (Metal) partagent le même Skia et le même SkSL, mais pas le même GPU : le résultat est très proche, **pas garanti au pixel près**. Une passe de validation sur simulateur reste utile avant de figer un matériau.
- Incident du 6 août 2026 à connaître : Metro peut perdre son watcher de fichiers et servir un bundle périmé pendant des dizaines de minutes. Vérifier qu'une ligne `iOS Bundled` apparaît après chaque sauvegarde avant de conclure à un bug de rendu. C'est aussi la raison pour laquelle la passerelle labo → mobile **copie** les fichiers au lieu de les partager entre projets.

---

*Fiche générée depuis `_TEMPLATE.md` — valider avant commit.*
