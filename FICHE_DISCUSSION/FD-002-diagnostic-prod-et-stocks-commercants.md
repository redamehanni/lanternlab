# FD-002 — Diagnostic prod & stocks commerçants

| | |
|---|---|
| **Statut** | validé |
| **Date** | 2026-07-24 |
| **Auteur(s)** | Adam (AdamY76) + Reda Mehanni |
| **Phase / chantier** | Trajectoire déployable + autonomie inventaire commerçants |
| **Références** | [FD-004](./FD-004-contexte-complet-projet-adam.md), [PORTRAIT_MAZONE_INVENTAIRE_ROADMAP.md](../PORTRAIT_MAZONE_INVENTAIRE_ROADMAP.md), [CURRENT_ARCHITECTURE.md](../CURRENT_ARCHITECTURE.md), tag `ma-zone-v0.9.5.2-labo-simulateur-xcode-24-07-26` |

> **Origine :** fiche rédigée par Adam le 24/07/2026, migrée depuis `fiche_de_discussion_diagnostic_prod_et_stocks.md` vers le dossier `FICHE_DISCUSSION/` (format FD-XXX).

---

## 1. Contexte

Deux fils liés, dans le même échange :

1. **Audit / diagnostic** du monorepo : où on en est, ce qui bloque un déploiement professionnel.
2. **Stocks commerçants** : comment un commerçant peut gérer / synchroniser son inventaire de façon autonome ; bonnes pratiques data + architecture.

Document interne déjà aligné sur une partie du constat : `PORTRAIT_MAZONE_INVENTAIRE_ROADMAP.md` (section 6 — TODO déployable).

**Version de référence au moment de la fiche :** Ma Zone ~v0.9.5.2 (labo / simulateur) — branche `main`.

---

## 2. Vision & philosophie

Ma Zone est aujourd'hui un **prototype fonctionnel riche et bien structuré**, pas encore un **produit déployable**. Le labo local (mobile + backend Node) est solide ; la trajectoire prod et l'autonomie commerçante sur les stocks restent à acter.

**Produit vivant aujourd'hui :** `mobile/` + `backend/` (port 4000, REST + JWT + Socket.io, SQLite `backend/data/mazone.db`).

Principes Ma Zone inchangés (voir FD-000 / FD-001) : surface compose, organe décide ; Première Âme / Deuxième Âme ; moteurs découplés dans `backend/src/lib/`.

---

## 3. Objectif

Mettre les **deux Cursor** (Reda + Adam) au même niveau sur :

- le diagnostic du repo et les bloquants production ;
- la feuille de route « produit déployable » ;
- le chantier **stocks / autonomie commerçants** (niveaux 0 → 3).

**Aucune implémentation code n'est actée par cette fiche** — vision et décisions ouvertes documentées.

---

## 4. Périmètre

### Inclus

- État des lieux monorepo (4 briques)
- Bloquants prod (sécurité, fiabilité, dette)
- Feuille de route Phases 0–3 (proposition)
- Sujet stocks : existant, niveaux cibles, modèle data, limites actuelles
- Décisions ouvertes + bonnes pratiques cibles

### Hors périmètre

- Implémentation code (dans cette conversation / fiche)
- Choix final d'hébergeur (Railway / Render / Fly / VM)
- Design DA / Deuxième Âme (documenté ailleurs)

---

## 5. Principes directeurs

1. **Ne pas mélanger les horizons** — Phase 0 sécurité avant gros chantiers métier (recommandation implicite).
2. **Produit officiel = mobile + backend Node** — pas le web Next.js legacy pour la valeur métier récente.
3. **POS = source de vérité** (niveaux 2–3 stock) ; Ma Zone = miroir ; idempotence obligatoire.
4. **Séparer catalogue / inventaire / mouvements** avant scale Postgres.
5. **Rien de codé sans synchronisation** sur §8 (décisions ouvertes) et Phase 0.

---

## 6. État des lieux — verdict

### 6.1 Quatre briques qui cohabitent

| Brique | Stack | Volume (approx.) | Statut |
|--------|-------|------------------|--------|
| `mobile/` | Expo 56 / RN 0.85 / React 19 | ~16 700 lignes | **MVP actif** |
| `backend/` | Node/Express + better-sqlite3 + Socket.io | ~9 200 lignes | **MVP actif** |
| `src/` | Next.js 15 + Supabase | ~3 400 lignes | **Legacy** (maquette web) |
| `admin-web/` | Vite + React | petit | Labo interne |
| `MaZone/` | SwiftUI | squelette | Non branché |

**Double stack :** le web Next.js/Supabase et le mobile/Node **ne partagent ni base ni logique métier**. Wallet, Identity, Event Engine, Communication, World Factory n'existent que côté Node.

### 6.1 bis — Organes et faces livrés (post-v0.9.2)

Au-delà du cœur marketplace, **déjà implémentés** (tags v0.9.3 → v0.9.5.2) :

| Domaine | État | Référence |
|---------|------|-----------|
| **Event Engine** | Organe complet + routes + Épée | `COMPTE_RENDU_EVENT_ENGINE.md` |
| **Deuxième Âme v1** | Face client (6 portes, Mode Réception, OV, Murmures) | [FD-004](./FD-004-contexte-complet-projet-adam.md) §10 |
| **Design System AME** | Tokens + illustrations Deuxième Âme | v0.9.5 |
| **Laboratoire iOS** | Impersonation Xcode + deep link `labToken` | v0.9.5.2 |

> **Attention :** le [PORTRAIT](../PORTRAIT_MAZONE_INVENTAIRE_ROADMAP.md) §4.6 et §J indiquent encore « Deuxième Âme non réalisée » — **obsolète**. Source à jour : [FD-004](./FD-004-contexte-complet-projet-adam.md).

### 6.2 Points forts retenus

- Architecture backend en **moteurs** (`backend/src/lib/`) découplés des routes.
- Mobile organisé par rôle (`client` / `merchant` / `driver` / `deuxiemeAme`).
- Transactions SQLite sur validation panier / stock (atomique en mono-process).
- Documentation abondante (audits, plans, ADR, portrait).
- `.gitignore` correct (DB, uploads, env locaux).

### 6.3 Bloquants production

**Sécurité (bloquant)**

- Secrets JWT en fallback hardcodé (`mazone-secret-dev-2024`, admin équivalent).
- CORS `origin: '*'`.
- Pas de rate limit / helmet.
- Pas de validation d'entrée systématique (Zod/Joi…).
- Bac à sable / impersonation actif hors prod.

**Fiabilité**

- 0 test automatisé (scripts manuels `backend/scripts/` seulement).
- Pas de middleware d'erreur global ni handlers `uncaughtException` / `unhandledRejection`.
- Pas de CI/CD, pas de Docker.
- Pas de logger structuré.
- Lint uniquement côté Next.js racine.

**Clarté / dette**

- README / `vercel.json` centrés legacy web.
- Racine saturée de PDF/HTML d'audit.
- Régressions historiques documentées sur le dispatch.

---

## 7. Étapes proposées (feuille de route — non actée)

### Phase 0 — Assainissement (1–2 jours)

- Crash au démarrage si `JWT_SECRET` / `ADMIN_JWT_SECRET` absents.
- `backend/.env.example` ; secrets hors code.
- **Décider** du sort de la stack Next.js/Supabase (voir §9).
- README racine aligné sur mobile + Node.

### Phase 1 — Durcissement sécurité

- CORS allowlist, helmet, rate-limit auth.
- Validation Zod sur les routes.
- Middleware d'erreur + Pino + verrouillage sandbox.

### Phase 2 — Qualité & industrialisation

- Tests : auth, commande, **dispatch**, reset démo.
- ESLint/Prettier backend + mobile.
- GitHub Actions ; Dockerfile backend.

### Phase 3 — Déploiement & business

- SQLite → **PostgreSQL** (schéma Supabase réutilisable).
- HTTPS/WSS, env séparés, PSP (Stripe), CGU/RGPD, stores, monitoring.

---

## 8. Sujet stocks — autonomie commerçants

### 8.1 Existant

- Table `products` : `quantity` + `barcode` peu exploité.
- Autonomie = saisie manuelle : `ManageStockScreen`, `AddProductScreen`.
- API : `PATCH /api/products/:id/stock`.
- Décrément à validation panier (transaction SQLite).
- Socket `product:stock_updated` (`io.emit` global, non scopé boutique).

**Constat :** pas de connexion autonome au stock réel au-delà de la saisie manuelle.

### 8.2 Quatre niveaux d'autonomie (cible)

| Niveau | Mécanisme | Pour qui |
|--------|-----------|----------|
| **0 — Manuel** (actuel) | Boutons +/− | Micro-commerçant / MVP |
| **1 — Assisté** | Scan code-barres, import CSV, seuils d'alerte | Sans logiciel de caisse |
| **2 — Connecté POS** | Square / SumUp / Zettle / Shopify / Lightspeed | Commerçant équipé |
| **3 — API publique Ma Zone** | Push stock depuis leur système | Chaînes / intégrateurs |

**Trajectoire recommandée :** Niveau 1 rapidement ; puis 1–2 connecteurs POS zone pilote (France : SumUp, Zettle, Square).

### 8.3 Modèle de données cible

1. **Catalogue** — produit + variantes (`sku`, `barcode`).
2. **Inventaire** — `on_hand`, `reserved`, seuil ; dispo = `on_hand - reserved`.
3. **Mouvements** — journal immuable avec `external_ref` (idempotence POS).

**Réservation :** commande → `reserved += qty` ; livraison → `on_hand -= qty` ; annulation → libérer `reserved`.

### 8.4 Limites actuelles (avant Postgres)

- Pas de réservation → stock fantôme possible.
- Pas de journal → pas d'audit / réconciliation.
- Anti-survente OK SQLite mono-thread ; **cassera sous concurrence Postgres**.

---

## 9. Décisions actées

| Date | Décision | Par |
|------|----------|-----|
| 2026-07-24 | Cette fiche migre au format `FICHE_DISCUSSION/FD-002` | Reda + Adam |
| 2026-07-24 | Produit vivant = `mobile/` + `backend/` Node | Adam (constat acté dans la discussion) |

---

## 10. Questions ouvertes (à trancher à deux)

### 10.1 Stack Next.js / Supabase

| Élément | Proposition (non actée) |
|---------|-------------------------|
| UI Next.js (`src/`) | **Archiver** (`legacy-web` / `archive/`) |
| Schéma Supabase / Postgres | **Garder** comme ref future base prod backend |
| `vercel.json` | Neutraliser tant que web en pause |
| Produit officiel | **mobile + backend Node** |

### 10.2 Autres

- Quel PSP (Stripe vs autre) en Phase 3.
- Quels POS prioriser zone pilote.
- Timing : Phase 0 d'abord vs inventaire d'abord.
- Ranger docs racine dans `docs/` (oui/non, quand).

---

## 11. Bonnes pratiques cibles (état de l'art)

| Domaine | Proposition |
|---------|-------------|
| DB | Postgres + migrations (Drizzle / Prisma) |
| API | Zod, OpenAPI, idempotence ; routes = transport / `lib/` = métier |
| Temps réel | Rooms socket (`store_${id}`, `order_${id}`) |
| Observabilité | Pino, Sentry |
| Qualité | Vitest + Supertest ; dispatch & stock en priorité |
| Ops | Docker, GitHub Actions, ADR dans `docs/` |

---

## 12. Prochaines actions possibles

1. Trancher §10.1 (legacy web) → ADR ou mise à jour fiche.
2. Lancer **Phase 0** (secrets + README + archive web).
3. Rédiger **ADR Inventaire** (catalogue / inventory / movements + migration).
4. Suite tests automatisés dispatch.

---

## 13. Documents liés

| Doc | Rôle |
|-----|------|
| [PORTRAIT_MAZONE_INVENTAIRE_ROADMAP.md](../PORTRAIT_MAZONE_INVENTAIRE_ROADMAP.md) | Inventaire + TODO déployable |
| [CURRENT_ARCHITECTURE.md](../CURRENT_ARCHITECTURE.md) | Architecture courante |
| [GUIDE-DEBUTANT.md](../GUIDE-DEBUTANT.md) | Démarrage local MVP |
| `backend/src/routes/products.js` | Stock actuel |
| `mobile/src/screens/merchant/ManageStockScreen.js` | UI stock manuelle |
| `backend/src/db/index.js` | Schéma SQLite |

---

## 14. Notes pour les deux Cursor

Cette fiche résume la conversation du **24/07/2026** (diagnostic monorepo + trajectoire prod + stocks autonomes). **Rien n'a été codé** dans ce fil initial. Les décisions §10 restent ouvertes.

**État code :** depuis v0.9.3, Deuxième Âme v1 et Event Engine sont **livrés** — voir §6.1 bis et [FD-004](./FD-004-contexte-complet-projet-adam.md). **Décisions deploy :** [FD-003](./FD-003-decisions-prioritaires-objectif-deployable.md) (brouillon amendé).

**Avant inventaire ou déploiement :** se synchroniser sur §10.1 (sort du web Next.js) et **Phase 0 sécurité**.

Reda : lire cette fiche + FD-004 + FD-003 avant tout chantier prod ou stock.  
Adam : source originale conservée dans l'historique Git (`fiche_de_discussion_diagnostic_prod_et_stocks.md`, commit `7a1d4eb`).

---

*Fiche migrée et harmonisée — référence vision partagée Reda + Adam.*
