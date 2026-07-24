# FICHE_DISCUSSION — Vision partagée Ma Zone

Ce dossier est le **fil rouge philosophique et produit** du projet Ma Zone.  
Il interconnecte les deux équipes Cursor (Reda + Adam) via GitHub : même vision, même direction, même langage.

## Rôle

| FICHE_DISCUSSION | Documentation technique (`CURRENT_ARCHITECTURE.md`, plans, API…) |
|------------------|------------------------------------------------------------------|
| Vision, philosophie, concepts, décisions, phases | Architecture, schémas, contrats, implémentation |
| **Pourquoi** et **dans quelle direction** | **Comment** c'est construit |

Les fiches **complètent** la doc technique — elles ne la remplacent pas.

## Qui écrit quoi

### Réflexe par défaut (référence)

Quand on vous demande de **résumer une action, un concept ou une phase en cours** :

1. Lire `INDEX.md` et les fiches **validées** liées au sujet.
2. Proposer un **brouillon** Markdown à partir de `_TEMPLATE.md`.
3. **Attendre validation** humaine (Reda ou Adam) avant commit.
4. Après validation : commit + mise à jour de `INDEX.md`.

### Exceptions (occasionnelles)

Reda ou Adam peut pousser **manuellement** une fiche (Markdown ou PDF) dans ce dossier.  
Dans ce cas, l'assistant doit :

- la **lire** (PDF inclus),
- l'**intégrer** à sa compréhension du projet,
- proposer si besoin une **version Markdown structurée** pour homogénéiser le dossier.

## Nommage

```
FD-XXX-titre-court.md
```

- `XXX` = numéro séquentiel sur 3 chiffres (`001`, `002`…)
- `titre-court` = kebab-case, en français sans accents dans le nom de fichier

Exemple : `FD-003-mode-reception-ov.md`

PDF manuels : `FD-XXX-titre.pdf` (même numérotation).

## Statuts

| Statut | Signification |
|--------|---------------|
| `brouillon` | Proposé par l'IA, en attente de validation |
| `validé` | Acté par Reda ou Adam — **référence de vision** |
| `archivé` | Phase terminée ou remplacée par une fiche plus récente |

## Avant toute nouvelle feature ou chantier

1. Consulter `INDEX.md`.
2. Lire les fiches **validées** pertinentes.
3. Vérifier qu'aucune décision actée ne contredit la demande.
4. Si la vision change : **nouvelle fiche** (ou mise à jour validée) — pas de dérive silencieuse.

## Fichiers de ce dossier

| Fichier | Rôle |
|---------|------|
| `README.md` | Ce guide |
| `INDEX.md` | Registre de toutes les fiches |
| `_TEMPLATE.md` | Modèle vierge à copier |
| `FD-000-…` | Fiche fondatrice du système |

## Langue

Toutes les fiches sont rédigées en **français**.
