# FD-000 — Système de fiches de discussion

| | |
|---|---|
| **Statut** | validé |
| **Date** | 2026-07-24 |
| **Auteur(s)** | Reda Mehanni, Adam (AdamY76) — cadre acté ensemble |
| **Phase / chantier** | Collaboration bi-équipe Cursor |
| **Références** | [README.md](./README.md), [CURRENT_ARCHITECTURE.md](../CURRENT_ARCHITECTURE.md) |

---

## 1. Contexte

Ma Zone est développé par **deux personnes** (Reda et Adam), chacune avec son **Cursor**, sur le **même dépôt GitHub**. Sans canal de vision partagée, les deux assistants risquent de diverger sur la philosophie, les priorités et le périmètre des chantiers.

## 2. Vision & philosophie

Les fiches de discussion sont le **langage commun** entre les deux « cerveaux » Cursor. Elles documentent :

- la **vision** produit,
- la **philosophie** Ma Zone,
- les **concepts** en gestation,
- les **décisions** actées,
- les **phases** du projet.

Elles ne remplacent pas l'architecture technique — elles la **orientent**.

## 3. Objectif

À chaque nouvelle idée ou phase, disposer d'une fiche validée dans `FICHE_DISCUSSION/` pour que Reda et Adam travaillent **dans la même direction**, même séparément.

## 4. Périmètre

### Inclus

- Dossier racine `FICHE_DISCUSSION/`
- Format Markdown structuré (`_TEMPLATE.md`)
- Nommage `FD-XXX-titre.md`
- Index central (`INDEX.md`)
- Lecture occasionnelle de PDF déposés manuellement
- Brouillon proposé par Cursor → validation humaine → commit

### Hors périmètre

- Remplacement de `CURRENT_ARCHITECTURE.md`, des plans PDF techniques, de la doc API
- Chat temps réel entre les deux IA
- Décisions techniques détaillées (schémas, routes, tables…) — restent dans la doc technique

## 5. Principes directeurs

1. **Brouillon d'abord** — l'IA propose, l'humain valide, puis commit.
2. **Une fiche = un fil de vision** — concept, phase ou décision majeure.
3. **Statut explicite** — brouillon / validé / archivé.
4. **Français** — toujours.
5. **Pas de dérive silencieuse** — si la vision change, nouvelle fiche ou mise à jour validée.
6. **Lire avant d'agir** — consulter `INDEX.md` et les fiches validées avant un chantier.

## 6. Étapes proposées

| # | Étape | Livrable | Statut |
|---|-------|----------|--------|
| 1 | Créer le dossier et le template | `FICHE_DISCUSSION/` | fait |
| 2 | Règle Cursor persistante | `.cursor/rules/fiche-discussion.mdc` | fait |
| 3 | Première fiche fondatrice | FD-000 (ce document) | fait |
| 5 | Adam pull et lit FD-001 | — | à faire (Adam) |
| 6 | Première fiche de phase réelle (FD-002+) | selon prochain chantier | à faire |

## 7. Décisions actées

| Date | Décision | Par |
|------|----------|-----|
| 2026-07-24 | Dossier dédié `FICHE_DISCUSSION/` à la racine | Reda + Adam |
| 2026-07-24 | Nommage `FD-XXX-titre.md` | Reda + Adam |
| 2026-07-24 | IA propose brouillon ; humain valide avant commit | Reda + Adam |
| 2026-07-24 | PDF manuels acceptés mais non référence | Reda + Adam |
| 2026-07-24 | Complète la doc technique, ne la remplace pas | Reda + Adam |

## 8. Questions ouvertes

- Quelle sera la **FD-001** (premier chantier documenté) ?
- Faut-il notifier l'autre quand une fiche est validée (Slack, issue GitHub…) ?

## 9. Notes pour les deux Cursor

- Adam (AdamY76) rejoint le repo à partir du **24/07/2026**.
- Avant toute implémentation significative : lire `FICHE_DISCUSSION/INDEX.md`.
- Quand Reda ou Adam demande un « résumé de vision » ou « pousser la fiche » : utiliser `_TEMPLATE.md`, statut **brouillon**, attendre validation.
- Tags Git et commits code restent séparés ; les fiches vivent ici.

---

*Fiche fondatrice — référence du processus de collaboration.*
