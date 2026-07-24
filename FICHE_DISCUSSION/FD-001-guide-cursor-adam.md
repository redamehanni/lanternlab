# FD-001 — Guide Cursor Adam — Système FICHE_DISCUSSION

| | |
|---|---|
| **Statut** | validé |
| **Date** | 2026-07-24 |
| **Auteur(s)** | Reda Mehanni (pour Adam / AdamY76) |
| **Phase / chantier** | Onboarding collaboration bi-équipe |
| **Références** | [FD-000](./FD-000-systeme-fiches-discussion.md), [README.md](./README.md), `.cursor/rules/fiche-discussion.mdc` |

---

> **À l'attention du Cursor d'Adam (AdamY76)**  
> Cette fiche te met au même niveau que le Cursor de Reda sur le fonctionnement des fiches de discussion. Lis-la en entier au premier `git pull`, puis consulte `INDEX.md` avant chaque chantier.

---

## 1. Contexte

Ma Zone est développé par **deux personnes** sur le **même repo GitHub** :

| Personne | GitHub | Environnement |
|----------|--------|---------------|
| Reda Mehanni | redamehanni | Cursor (Mac) |
| Adam | **AdamY76** | Cursor (son poste) |

Chacun code de son côté. Sans canal partagé, nos deux assistants Cursor risquent de **diverger** sur la vision, la philosophie et le périmètre des chantiers.

**Solution actée le 24/07/2026** : le dossier `FICHE_DISCUSSION/` à la racine du repo.

---

## 2. À quoi servent les fiches

Les fiches documentent ce que la doc technique ne couvre pas :

| FICHE_DISCUSSION | Doc technique (`CURRENT_ARCHITECTURE.md`, plans, API…) |
|------------------|--------------------------------------------------------|
| **Pourquoi** — vision, philosophie, concepts, décisions, phases | **Comment** — architecture, schémas, contrats, implémentation |

Elles **complètent** la doc existante. Elles ne la remplacent pas.

---

## 3. Où tout se trouve

```
MaZone-main/
├── FICHE_DISCUSSION/          ← TU COMMENCES ICI
│   ├── README.md              # Guide complet du processus
│   ├── INDEX.md               # Registre — TOUJOURS consulter en premier
│   ├── _TEMPLATE.md           # Modèle pour créer une nouvelle fiche
│   ├── FD-000-…               # Fiche fondatrice (cadre général)
│   └── FD-001-…               # Cette fiche (ton onboarding)
└── .cursor/rules/
    └── fiche-discussion.mdc   # Règle Cursor — chargée automatiquement
```

Après un `git pull`, Cursor charge la règle `.cursor/rules/fiche-discussion.mdc` **automatiquement** à chaque session.

---

## 4. Ton fonctionnement au quotidien (réflexe obligatoire)

### Avant de coder ou d'implémenter

1. Ouvre `FICHE_DISCUSSION/INDEX.md`.
2. Lis les fiches au statut **validé** liées au sujet demandé par Adam.
3. Vérifie qu'aucune décision actée ne contredit la demande.
4. Si contradiction ou zone grise → **demander à Adam** avant d'agir.

### Quand Adam (ou Reda) demande un résumé de vision / concept / phase

1. Copie `_TEMPLATE.md` → `FD-XXX-titre-court.md` (prochain numéro dans `INDEX.md`).
2. Rédige le brouillon en **français**, statut **brouillon**.
3. **Montre le brouillon à Adam — ne commit pas sans sa validation.**
4. Après validation : commit + ajoute une ligne dans `INDEX.md`.

### Quand une fiche PDF apparaît dans le dossier (upload manuel)

- Lis le PDF.
- Intègre son contenu à ta compréhension du projet.
- Propose si utile une version Markdown structurée pour homogénéiser le dossier.

---

## 5. Nommage et statuts

### Fichiers

```
FD-XXX-titre-court.md
```

- `XXX` = numéro séquentiel (`001`, `002`…)
- `titre-court` = kebab-case, sans accents dans le nom de fichier
- Exemple : `FD-003-mode-reception-ov.md`

### Statuts

| Statut | Signification | Peut guider le code ? |
|--------|---------------|------------------------|
| **brouillon** | Proposé par Cursor, en attente validation humaine | Non — attendre |
| **validé** | Acté par Reda ou Adam | **Oui — référence de vision** |
| **archivé** | Phase terminée ou remplacée | Non — lire la fiche plus récente |

---

## 6. Principes Ma Zone (ne pas contredire sans nouvelle fiche validée)

Ces principes traversent tout le projet. Toute fiche ou implémentation doit rester cohérente :

1. **Surface compose, organe décide** — l'UI orchestre ; la logique métier vit dans les organes (Event Engine, Wallet, Identity…).
2. **Deux Âmes** — Première Âme (marketplace / commerce) et Deuxième Âme (vie de quartier / Accueil, Messages, Wallet, Panier).
3. **Event Engine** — occurrences de la ville ; Mode Réception + Opportunités Volantes = diffusion, pas un type d'événement.
4. **Open/Closed** — nouveaux types/canaux via registres, pas de `if (type === …)` dans le cœur.
5. **Sandbox / Laboratoire** — impersonation acteurs démo ; bac à sable séparé de la prod.
6. **Langue** — fiches et communication produit en **français**.

Pour l'architecture détaillée : `CURRENT_ARCHITECTURE.md`.

---

## 7. Ce que tu ne dois pas faire

- Implémenter une **grosse évolution** sans avoir lu les fiches validées pertinentes.
- **Committer une fiche** sans validation explicite d'Adam ou Reda.
- **Remplacer** la doc technique par une fiche de discussion.
- **Dériver silencieusement** — si la vision change, nouvelle fiche ou mise à jour validée.
- Ignorer une fiche PDF déposée manuellement dans le dossier.

---

## 8. Workflow Git avec Reda

1. **Avant de commencer** : `git pull` pour récupérer les dernières fiches et le code.
2. **Pendant le travail** : commits code classiques sur `main` (ou branche si convenu).
3. **Fiche de vision** : brouillon → validation Adam → commit dans `FICHE_DISCUSSION/` + MAJ `INDEX.md`.
4. **Tags / releases** : uniquement quand Reda ou Adam le demande explicitement.

État connu au 24/07/2026 :

- Dernier tag : `ma-zone-v0.9.5.2-labo-simulateur-xcode-24-07-26`
- Repo : https://github.com/redamehanni/Ma-zone

---

## 9. Première action recommandée pour Adam

1. `git pull origin main`
2. Lire cette fiche (FD-001) en entier
3. Lire [FD-000](./FD-000-systeme-fiches-discussion.md)
4. Parcourir `FICHE_DISCUSSION/README.md`
5. Confirmer à Adam que le processus est compris
6. Avant le prochain chantier : consulter `INDEX.md`

---

## 10. Décisions actées (24/07/2026)

| Décision | Détail |
|----------|--------|
| Dossier dédié | `FICHE_DISCUSSION/` à la racine — pas mélangé au code |
| Format | Markdown structuré ; PDF occasionnels acceptés |
| Rédaction | **Cursor propose brouillon** → humain valide → commit |
| Langue | Français |
| Nommage | `FD-XXX-titre.md` |
| Complément | Ne remplace pas la doc technique |
| Règle Cursor | `.cursor/rules/fiche-discussion.mdc` — `alwaysApply: true` |

---

## 11. Notes pour synchronisation Reda ↔ Adam

- Reda et Adam peuvent chacun pousser des fiches **après validation** de l'autre si le sujet le mérite — en pratique, valider chez soi suffit pour une fiche de vision.
- En cas de doute sur une décision de l'autre équipe : lire la fiche validée correspondante avant de contester ou refactorer.
- Prochaine fiche métier attendue : **FD-003+** (après FD-002 diagnostic prod & stocks).

---

*Fiche d'onboarding Cursor Adam — validée par Reda le 24/07/2026.*
