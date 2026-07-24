# Fiche de discussion — Diagnostic prod & stocks commerçants

**Nomenclature :** `fiche_de_discussion_*sujet*`  
**Fichier :** `fiche_de_discussion_diagnostic_prod_et_stocks.md`  
**Date :** 24 juillet 2026  
**Auteurs / interlocuteurs :** Adam + cousin (sync Cursor)  
**Version de référence :** Ma Zone ~v0.9.5.2 (labo / simulateur) — branche `main`  
**Statut :** Discussion ouverte — aucune décision technique encore commitée hors ce document  
**Objectif de la fiche :** Mettre les deux postes Cursor à jour sur le diagnostic du repo, la trajectoire « produit déployable », et le sujet stocks / autonomie commerçants.

---

## 1. Contexte de la conversation

Deux fils liés, dans le même échange :

1. **Audit / diagnostic** du monorepo : où on en est, ce qui bloque un déploiement professionnel.
2. **Stocks commerçants** : comment un commerçant peut gérer / synchroniser son inventaire de façon autonome ; bonnes pratiques data + architecture.

Document interne déjà aligné sur une partie du constat : `PORTRAIT_MAZONE_INVENTAIRE_ROADMAP.md` (section 6 — TODO déployable).

---

## 2. État des lieux — verdict

Ma Zone est un **prototype fonctionnel riche et bien structuré**, mais un projet **zéro-production** : labo local solide, pas encore un produit déployable.

### 2.1 Quatre briques qui cohabitent

| Brique | Stack | Volume (approx.) | Statut |
|--------|-------|------------------|--------|
| `mobile/` | Expo 56 / RN 0.85 / React 19 | ~16 700 lignes | **MVP actif** |
| `backend/` | Node/Express + better-sqlite3 + Socket.io | ~9 200 lignes | **MVP actif** |
| `src/` | Next.js 15 + Supabase | ~3 400 lignes | **Legacy** (maquette web) |
| `admin-web/` | Vite + React | petit | Labo interne |
| `MaZone/` | SwiftUI | squelette | Non branché |

**Produit vivant aujourd’hui :** `mobile/` + `backend/` (port 4000, REST + JWT + Socket.io, SQLite `backend/data/mazone.db`).

**Double stack :** le web Next.js/Supabase et le mobile/Node **ne partagent ni base ni logique métier**. Wallet, Identity, Event, Communication, World Factory n’existent que côté Node.

### 2.2 Points forts retenus

- Architecture backend en **moteurs** (`backend/src/lib/`) découplés des routes.
- Mobile organisé par rôle (`client` / `merchant` / `driver` / `deuxiemeAme`).
- Transactions SQLite sur validation panier / stock (atomique en mono-process).
- Documentation abondante (audits, plans, ADR, portrait).
- `.gitignore` correct (DB, uploads, env locaux).

### 2.3 Bloquants production (sévérité)

**Sécurité (bloquant)**

- Secrets JWT en fallback hardcodé dans le code (`mazone-secret-dev-2024`, admin équivalent) → le serveur démarre même sans env.
- CORS `origin: '*'` (HTTP + Socket.io).
- Pas de rate limit / helmet.
- Pas de validation d’entrée systématique (Zod/Joi…).
- Bac à sable / impersonation actif hors prod (`SANDBOX_MODE` / défaut selon `NODE_ENV`).

**Fiabilité**

- 0 test automatisé (seulement scripts manuels `backend/scripts/`).
- Pas de middleware d’erreur global ni handlers `uncaughtException` / `unhandledRejection`.
- Pas de CI/CD, pas de Docker.
- Pas de logger structuré (console).
- Lint uniquement côté Next.js racine ; rien sur backend/mobile.

**Clarté / dette**

- README / `vercel.json` parlent surtout du web legacy alors que le produit actif est le mobile.
- Racine saturée de PDF/HTML d’audit (~80 fichiers).
- Régressions historiques documentées sur le dispatch (file silencieuse, missions fantômes).

---

## 3. Feuille de route proposée (pas encore actée)

Ne pas mélanger les horizons.

### Phase 0 — Assainissement (1–2 jours)

- Crash au démarrage si `JWT_SECRET` / `ADMIN_JWT_SECRET` absents (supprimer fallbacks).
- `backend/.env.example` ; secrets hors code.
- **Décider** du sort de la stack Next.js/Supabase (voir §5).
- README racine aligné sur la réalité (mobile + Node).

### Phase 1 — Durcissement sécurité

- CORS allowlist, helmet, rate-limit sur auth.
- Validation Zod (ou équivalent) sur les routes.
- Middleware d’erreur + Pino + verrouillage sandbox hors `SANDBOX_MODE`.

### Phase 2 — Qualité & industrialisation

- Tests prioritaires : auth, commande, **dispatch**, reset démo.
- ESLint/Prettier backend + mobile.
- GitHub Actions (lint + tests + build).
- Dockerfile backend.

### Phase 3 — Déploiement & business

- SQLite → **PostgreSQL** (schéma Supabase existant réutilisable comme base).
- Hébergement HTTPS/WSS, env séparés, secrets.
- PSP (Stripe) : paiement, webhooks, remboursements.
- CGU / mentions / RGPD dans l’app.
- Builds App Store / Play Store.
- Monitoring (Sentry, etc.).

---

## 4. Sujet stocks — autonomie commerçants

### 4.1 Ce qui existe aujourd’hui

- Table `products` avec `quantity` + champ `barcode` peu/pas exploité pour le scan.
- Autonomie = **saisie manuelle** : `ManageStockScreen` (`−1` / `+1` / `+10`), `AddProductScreen`.
- API : `PATCH /api/products/:id/stock` (absolu ou delta).
- Décrément stock à la **validation panier** (transaction SQLite).
- Socket `product:stock_updated` (aujourd’hui en `io.emit` global, non scopé boutique).

**Constat :** la connexion autonome au stock réel du commerçant **n’a pas été pensée** au-delà de la saisie manuelle. Double-saisie = frein d’adoption en conditions réelles.

### 4.2 Quatre niveaux d’autonomie (cible)

| Niveau | Mécanisme | Pour qui |
|--------|-----------|----------|
| **0 — Manuel** (actuel) | Boutons +/− | Micro-commerçant / MVP |
| **1 — Assisté** | Scan code-barres (`expo-camera`), import CSV/Excel, seuils d’alerte | Sans logiciel de caisse |
| **2 — Connecté POS** | Synchro Square / SumUp / Zettle / Shopify / Lightspeed (API + webhooks) | Commerçant équipé |
| **3 — API publique Ma Zone** | Leur système pousse le stock vers Ma Zone | Chaînes / intégrateurs |

**Trajectoire recommandée dans la discussion :** Niveau 1 rapidement ; puis 1–2 connecteurs POS adaptés à la zone pilote (France : SumUp, Zettle, Square fréquents chez les petits commerces).

**Modèle de synchro (niveaux 2–3) :** POS = source de vérité ; Ma Zone = miroir ; webhooks push + pull de réconciliation ; **idempotence** via clé d’événement externe.

### 4.3 Modèle de données recommandé (cible)

Séparer ce qui est aujourd’hui fusionné dans `products.quantity` :

1. **Catalogue** — produit + variantes (`sku`, `barcode`, label).
2. **Inventaire** — `on_hand`, `reserved`, seuil de réassort, par emplacement/boutique.  
   Disponibilité vente = `on_hand - reserved`.
3. **Mouvements** — journal immuable (`sale`, `restock`, `adjustment`, `cancel`, `sync_pos`) avec `external_ref` pour l’idempotence POS.

**Pattern de réservation (anti-survente + anti-fantôme) :**

- Commande → `reserved += qty`
- Livraison → `on_hand -= qty` et `reserved -= qty`
- Annulation / timeout → libérer `reserved`

**Anti-survente portable SQLite → Postgres :**

```sql
UPDATE inventory SET reserved = reserved + :qty
WHERE id = :id AND (on_hand - reserved) >= :qty;
-- 0 ligne affectée → rupture, refuser
```

### 4.4 Limites actuelles à corriger avant Postgres

- Pas de réservation → risque stock fantôme / litiges à l’annulation.
- Pas de journal de mouvements → pas d’audit / réconciliation.
- Pas de variantes / multi-emplacements.
- Anti-survente OK en SQLite mono-thread ; **cassera sous accès concurrents Postgres**.

---

## 5. Décisions ouvertes (à trancher à deux)

### 5.1 Stack Next.js / Supabase

Question posée ; réponse Adam : **pas encore décidé** — aide à décider.

**Recommandation formulée dans la conversation (à valider) :**

| Élément | Proposition |
|---------|-------------|
| UI Next.js (`src/`) | **Archiver** (branche `legacy-web` ou `archive/`) — diverge trop du mobile |
| Schéma Supabase / Postgres | **Garder** comme référence pour la future base prod du backend |
| `vercel.json` | Neutraliser tant que le web est en pause |
| Produit officiel | **mobile + backend Node** |

Raison : maintenir web + mobile sans backend partagé = double charge pour zéro valeur métier récente (Wallet, Events, etc. absents du web).

### 5.2 Autres points non tranchés

- Quel PSP (Stripe vs autre) en Phase 3.
- Quels POS prioriser pour la zone pilote.
- Timing : Phase 0 sécurité d’abord vs chantier inventaire d’abord (recommandation implicite : Phase 0 avant tout chantier métier).
- Ranger les docs racine dans `docs/` (oui/non, quand).

---

## 6. Bonnes pratiques / outils évoqués (état de l’art cible)

| Domaine | Proposition |
|---------|-------------|
| DB | Postgres + migrations versionnées (**Drizzle** ou **Prisma**) ; index recherche |
| API | Zod, OpenAPI, idempotence endpoints sensibles, routes = transport / `lib/` = métier |
| Temps réel | Rooms socket (`store_${id}`, `order_${id}`) au lieu d’`io.emit` global |
| Observabilité | Pino, Sentry, métriques |
| Types | TypeScript côté backend (le web est déjà TS strict) |
| Qualité | Vitest + Supertest ; tests dispatch & stock en priorité |
| Ops | Docker, env séparés, GitHub Actions, feature flags, Conventional Commits, ADR dans `docs/` |

---

## 7. Périmètre volontairement hors scope de cette fiche

- Implémentation code (aucun changement métier n’a été fait dans cette conversation).
- Choix final d’hébergeur (Railway / Render / Fly / VM).
- Design DA / Deuxième Âme (déjà documenté ailleurs).

---

## 8. Prochaines actions possibles (pour la prochaine discussion)

1. Trancher §5.1 (legacy web) et l’écrire ici ou en ADR.
2. Lancer **Phase 0** (secrets + README + éventuellement archive web).
3. Ou rédiger un **ADR Inventaire** (schéma catalogue / inventory / movements + plan de migration depuis `products.quantity`).
4. Ou suite de tests automatisés du dispatch (cœur fragile).

---

## 9. Documents liés

| Doc | Rôle |
|-----|------|
| `PORTRAIT_MAZONE_INVENTAIRE_ROADMAP.md` | Inventaire + TODO déployable (aligné) |
| `CURRENT_ARCHITECTURE.md` | Architecture courante |
| `GUIDE-DEBUTANT.md` | Démarrage local MVP |
| `README.md` | À mettre à jour (encore centré legacy web) |
| `backend/src/routes/products.js` | Stock actuel |
| `mobile/src/screens/merchant/ManageStockScreen.js` | UI stock manuelle |
| `backend/src/db/index.js` | Schéma SQLite |

---

## 10. Message pour le Cursor du cousin

Cette fiche résume **uniquement** la conversation du 24/07/2026 (diagnostic monorepo + trajectoire prod + stocks autonomes).  
Rien n’a été codé. Les décisions §5 restent ouvertes.  
Avant de travailler sur inventaire ou déploiement, se synchroniser sur §5.1 (sort du web Next.js) et sur la Phase 0 sécurité.
