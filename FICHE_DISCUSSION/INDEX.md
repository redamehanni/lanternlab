# Index des fiches de discussion — Ma Zone

Registre central. **Mettre à jour à chaque nouvelle fiche validée.**

> **Reset 24/07/2026 :** les anciennes fiches (FD-001 à FD-004 et ancienne FD-000) ont été **supprimées**.  
> La numérotation a **repris** avec FD-000 puis cette nouvelle FD-001 (chapitre Fondation API) — sans lien avec les fiches annulées.

| ID | Titre | Statut | Date | Auteur(s) | Fichier |
|----|-------|--------|------|-----------|---------|
| FD-000 | Mise à niveau GLOBAL du Cursor Adam sur le projet Ma Zone | **validé** | 2026-07-24 | Reda (pour AdamY76) — **LECTURE OBLIGATOIRE** | [FD-000-mise-a-niveau-global-cursor-adam-ma-zone.md](./FD-000-mise-a-niveau-global-cursor-adam-ma-zone.md) |
| FD-001 | Chantier Fondation API compatible avec les logiciels commerciaux | **brouillon** (amendé Reda 25/07 — résultats E0 → E8) | 2026-07-24 | Adam + amendements Reda — validation Adam | [FD-001-chantier-fondation-api-logiciels-commerciaux.md](./FD-001-chantier-fondation-api-logiciels-commerciaux.md) |
| FD-002 | Mise à jour Cursor Adam — chantier Organe d'Orchestration (E0 → E8) | **brouillon** | 2026-07-26 | Reda (pour AdamY76) — **LECTURE PRIORITAIRE ADAM** | [FD-002-mise-a-jour-cursor-adam-chantier-orchestration-e0-e8.md](./FD-002-mise-a-jour-cursor-adam-chantier-orchestration-e0-e8.md) |

---

## Ordre de lecture

1. **`FD-000`** en entier (Cursor Adam : obligatoire ; Cursor Reda : en cas de doute)
2. Ce **`INDEX.md`** avant chaque chantier
3. **`FD-002`** — **Cursor Adam : lire en priorité** pour tout ce qui a été livré en code (E0 → E8, lois 16–17, famille de connecteurs)
4. **`FD-001`** si chantier Fondation API / interop / stock / connecteurs — **§14 en priorité avant d'ajouter un connecteur** (ce dont il hérite, ce qu'il ne doit pas refaire)
5. **`ROADMAP_ORGANE_ORCHESTRATION_MAZONE.md`** (racine) — **document maître du chantier** : lois d'architecture (dont la **Loi 17**, confinement du dialecte), 8 étapes, audit critique
6. Docs techniques liées (non-FD) :
   - [`Cartographie_Metier_V1.md`](./Cartographie_Metier_V1.md)
   - [`Plan_Conception_API_Compatible_Logiciels_Commerciaux_V1.md`](./Plan_Conception_API_Compatible_Logiciels_Commerciaux_V1.md) — **annexe technique** de la roadmap Orchestration depuis le 25/07 (CDM détaillé, matrice de conflits, contrat connecteur, contraintes SQLite, tranches A–F)

## Notes

- **2026-07-24 soir :** plan Fondation API aligné FD-000 (séquençage A–E, modes `mazone`/`pos`, Phase 0 avant D). Voir FD-001 §9.
- **2026-07-25, fin de journée :** **étapes E0 → E7 livrées.** Le contrat public `/api/v1` existe (19 opérations, `openapi.yaml` vérifiée dans les deux sens contre les routes réelles), la fin de vie de `/api` est **inscrite dans le code** (`backend/src/lib/sunset.js`, 31/01/2027), et un premier écran mobile commerçant est basculé derrière un drapeau. État réel du code : `CURRENT_ARCHITECTURE.md`. Récit et écarts : FD-001 §9 et §13.
- **2026-07-26 :** **sauvegarde complète E0 → E8** poussée sur GitHub. **FD-002** créée pour mettre à jour le Cursor d'Adam sur l'intégralité du chantier Organe d'Orchestration livré (349 tests, Loi 17, famille de connecteurs + Shopify). État réel : `CURRENT_ARCHITECTURE.md`.
- **2026-07-25, soir — E8 livrée, et son périmètre a changé sur consigne de Reda :** Shopify n'est traité que comme **premier représentant d'une famille de connecteurs**. Aucune décision d'architecture propre à un éditeur ; toute optimisation propre à un éditeur reste **confinée à son connecteur** ; le cœur (CDM, Orchestration, Integration Engine, API) n'évolue **jamais** pour les particularités d'un éditeur. Conséquence opposable : **Loi 17 — confinement du dialecte**, tenue par `test/connector-conformance.test.js`, 3 étapes CI et `scripts/check-loi-17.sh`. Sept mécanismes génériques sont nés de l'extraction (coffre chiffré, transport unique, HMAC à temps constant, *authorization code* déclaratif, curseurs durables, réconciliation, contexte de connecteur) ; le connecteur Shopify ne contient que 4 fichiers de dialecte. **349 tests au vert**, dont « 10 − 2 = 8 » en mode `pos` et 30 minutes de panne éditeur sans vente bloquée. Récit complet : FD-001 §14. État réel : `CURRENT_ARCHITECTURE.md` §3.6.
- **2026-07-25 :** le chantier devient **« Organe d'Orchestration »**. `ROADMAP_ORGANE_ORCHESTRATION_MAZONE.md` (racine) est le **document maître** ; le plan de conception API devient son **annexe technique**. En cas de divergence entre les deux, la roadmap prime. L'ordre des étapes change : filet de sécurité et CDM d'abord, `/api/v1` en fin de parcours (étape 7) et non au début, parce qu'un contrat écrit avant que les intentions existent est un contrat deviné. Voir aussi `AUDIT_ARCHITECTURE_BOITE_ORCHESTRATION_ONTOLOGIE.md` (rejet de l'ontologie exécutable).

## Hiérarchie en cas de conflit

1. Fiches **validées** dans `FICHE_DISCUSSION/` (FD-000 en premier ; FD-001 quand validée)
2. **`ROADMAP_ORGANE_ORCHESTRATION_MAZONE.md`** — document maître du chantier orchestration (prime sur son annexe technique)
3. Docs techniques récentes (`COMPTE_RENDU_*`, `CHANTIER_*`, plans de conception…)
4. Docs techniques datées (`CURRENT_ARCHITECTURE.md`, `PORTRAIT_*` — voir bandeaux d'alerte)
5. Le code
6. Intuition du Cursor ← **jamais suffisante seule**

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
