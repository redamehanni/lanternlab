# Index des fiches de discussion — Ma Zone

Registre central. **Mettre à jour à chaque nouvelle fiche validée.**

> **Reset 24/07/2026 :** les anciennes fiches (FD-001 à FD-004 et ancienne FD-000) ont été **supprimées**.  
> La numérotation a **repris** avec FD-000 puis cette nouvelle FD-001 (chapitre Fondation API) — sans lien avec les fiches annulées.

| ID | Titre | Statut | Date | Auteur(s) | Fichier |
|----|-------|--------|------|-----------|---------|
| FD-000 | Mise à niveau GLOBAL du Cursor Adam sur le projet Ma Zone | **validé** | 2026-07-24 | Reda (pour AdamY76) — **LECTURE OBLIGATOIRE** | [FD-000-mise-a-niveau-global-cursor-adam-ma-zone.md](./FD-000-mise-a-niveau-global-cursor-adam-ma-zone.md) |
| FD-001 | Chantier Fondation API compatible avec les logiciels commerciaux | **brouillon** | 2026-07-24 | Adam (AdamY76) — pour Cursor Reda | [FD-001-chantier-fondation-api-logiciels-commerciaux.md](./FD-001-chantier-fondation-api-logiciels-commerciaux.md) |

---

## Ordre de lecture

1. **`FD-000`** en entier (Cursor Adam : obligatoire ; Cursor Reda : en cas de doute)
2. Ce **`INDEX.md`** avant chaque chantier
3. **`FD-001`** si chantier Fondation API / interop / stock / connecteurs
4. Docs techniques liées (non-FD) :
   - [`Cartographie_Metier_V1.md`](./Cartographie_Metier_V1.md)
   - [`Plan_Conception_API_Compatible_Logiciels_Commerciaux_V1.md`](./Plan_Conception_API_Compatible_Logiciels_Commerciaux_V1.md)

## Hiérarchie en cas de conflit

1. Fiches **validées** dans `FICHE_DISCUSSION/` (FD-000 en premier ; FD-001 quand validée)
2. Docs techniques récentes (`COMPTE_RENDU_*`, `CHANTIER_*`, plans de conception…)
3. Docs techniques datées (`CURRENT_ARCHITECTURE.md`, `PORTRAIT_*` — voir bandeaux d'alerte)
4. Le code
5. Intuition du Cursor ← **jamais suffisante seule**

## Comment ajouter une entrée

1. Prendre le prochain numéro (`FD-002`, …).
2. Créer le fichier depuis `_TEMPLATE.md`.
3. Ajouter une ligne dans le tableau ci-dessus.
4. Commit **après validation humaine** (Reda et/ou Adam).

## Historique migrations

| Ancien emplacement | Nouveau | Commit |
|--------------------|---------|--------|
| `fiche_de_discussion_diagnostic_prod_et_stocks.md` (racine) | ~~FD-002~~ → **annulé** (reset 24/07) | — |
| FD-001 à FD-004 (24/07 matin) | **Supprimées** — remplacées par FD-000 unique | 2026-07-24 |
| `Plan_Conception_API_Compatible_V1.md` | `Plan_Conception_API_Compatible_Logiciels_Commerciaux_V1.md` | 2026-07-24 (renommage) |
