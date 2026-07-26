# FD-002 — Mise à jour Cursor Adam : chantier Organe d'Orchestration (E0 → E8)

| | |
|---|---|
| **Statut** | **brouillon** — rédigée par Cursor Reda pour AdamY76, validation Adam recommandée |
| **Date** | 2026-07-26 |
| **Auteur(s)** | Reda Mehanni (via Cursor Reda) |
| **Phase / chantier** | Organe d'Orchestration — **sauvegarde complète après livraison E0 → E8** |
| **Références** | [FD-000](./FD-000-mise-a-niveau-global-cursor-adam-ma-zone.md) · [FD-001](./FD-001-chantier-fondation-api-logiciels-commerciaux.md) · `ROADMAP_ORGANE_ORCHESTRATION_MAZONE.md` · `CURRENT_ARCHITECTURE.md` |

> **Pour le Cursor d'Adam (AdamY76) — LECTURE PRIORITAIRE**
>
> Cette fiche met à jour FD-000 sur **tout ce qui a été réalisé en code** depuis la FD-001 (24/07), qui décrivait le plan **avant** l'exécution. Le 25–26/07, le chantier « Fondation API » est devenu le chantier **« Organe d'Orchestration »**, et les **8 étapes (E0 → E8) sont livrées** — 349 tests au vert.
>
> **Ne pas contredire FD-000** sur la philosophie produit. Cette fiche **complète** FD-000 sur l'architecture backend récente, pas sur la Deuxième Âme ni le mobile citoyen.

---

## Table des matières

1. [Résumé exécutif (5 minutes)](#1-résumé-exécutif-5-minutes)
2. [Ce qui a changé depuis FD-001](#2-ce-qui-a-changé-depuis-fd-001)
3. [Document maître et hiérarchie](#3-document-maître-et-hiérarchie)
4. [Les 17 lois d'architecture (essentiel pour Adam)](#4-les-17-lois-darchitecture-essentiel-pour-adam)
5. [État du code — étape par étape](#5-état-du-code--étape-par-étape)
6. [Carte des nouveaux dossiers backend](#6-carte-des-nouveaux-dossiers-backend)
7. [API : deux surfaces coexistent](#7-api--deux-surfaces-coexistent)
8. [Mobile : ce qui a bougé](#8-mobile--ce-qui-a-bougé)
9. [Famille de connecteurs et Shopify (E8)](#9-famille-de-connecteurs-et-shopify-e8)
10. [Dette technique — honnête](#10-dette-technique--honnête)
11. [Ce qu'il NE FAUT PAS proposer (mis à jour)](#11-ce-quil-ne-faut-pas-proposer-mis-à-jour)
12. [Ordre de lecture pour reprendre le fil](#12-ordre-de-lecture-pour-reprendre-le-fil)
13. [Décisions actées depuis FD-001](#13-décisions-actées-depuis-fd-001)
14. [Questions ouvertes pour Adam](#14-questions-ouvertes-pour-adam)
15. [Notes opérationnelles pour le Cursor d'Adam](#15-notes-opérationnelles-pour-le-cursor-dadam)

---

## 1. Résumé exécutif (5 minutes)

| Aujourd'hui (26/07/2026) | Détail |
|---|---|
| **Chantier livré** | Organe d'Orchestration — étapes **E0 → E8** |
| **Tests backend** | **349** (`cd backend && npm test`) — tous au vert |
| **Document d'état** | `CURRENT_ARCHITECTURE.md` (mis à jour 25/07, reflète le code réel) |
| **Document maître** | `ROADMAP_ORGANE_ORCHESTRATION_MAZONE.md` (17 lois, 8 étapes) |
| **Contrat public** | `/api/v1` — 19 opérations, OpenAPI vérifiée en CI |
| **Surface historique** | `/api` — fin de vie **31/01/2027** (inscrite dans le code) |
| **Intégrations** | Famille de connecteurs générique + **Shopify** comme premier cas |
| **Lois nouvelles** | **Loi 16** (orchestration ≠ logiciels tiers) · **Loi 17** (dialecte confiné au connecteur) |

**Ce qui n'a PAS changé (FD-000 reste valide) :**

- Surface compose, organe décide
- Deuxième Âme **implémentée** (v0.9.3+) — pas « vision future »
- Opportunité Volante = diffusion, pas type d'événement
- Produit = `mobile/` + `backend/` Node
- Sandbox / labo **interdit en prod**

---

## 2. Ce qui a changé depuis FD-001

La FD-001 (24/07) racontait le **plan** et disait explicitement : *« le code n'a pas encore été écrit »*. Entre le 25 et le 26/07, **tout le plan a été exécuté**.

| Avant (FD-001, 24/07) | Maintenant (26/07) |
|---|---|
| Plan de codage, non exécuté | **E0 → E8 livrées** |
| Tranches A/B/C/E du plan initial | Réordonnées en **8 étapes** (roadmap maître) |
| `/api/v1` prévu en premier | `/api/v1` livré **en dernier** (E7) — le contrat décrit des intentions qui existent |
| Zéro test automatisé backend | **349 tests** `node:test` |
| `products.quantity` = vérité | **Projection** — fin de vie 30/04/2027 |
| Pas d'organe Orders | `lib/orders/` avec machine à états fail-fast |
| Pas d'Inventory Engine | `lib/inventory/` — triple état, modes `mazone`/`pos` |
| Pas d'Orchestration | `lib/orchestration/` — intentions, compensation, journal |
| Pas d'Integration Engine | `lib/integration/` — Outbox/Inbox, connecteurs, webhooks |
| Connecteur externe = futur | **Shopify** livré comme **premier représentant d'une famille** |
| Ontologie exécutable discutée | **Rejetée** (audit du 25/07) |

**Pivot du 25/07 :** le chantier s'appelle désormais **« Organe d'Orchestration »**. Le plan de conception API devient **annexe technique** de la roadmap, pas document autonome.

---

## 3. Document maître et hiérarchie

En cas de conflit :

1. **FD-000** (philosophie produit, Deuxième Âme, ce qu'il ne faut pas proposer)
2. **Fiches validées** dans `FICHE_DISCUSSION/` (cette FD-002 quand validée)
3. **`ROADMAP_ORGANE_ORCHESTRATION_MAZONE.md`** — lois + 8 étapes + audit
4. **`CURRENT_ARCHITECTURE.md`** — état réel du code (à tenir à jour)
5. **`Plan_Conception_API_…_V1.md`** — annexe technique (CDM détaillé, matrice conflits, contraintes SQLite)
6. Le code et les tests

---

## 4. Les 17 lois d'architecture (essentiel pour Adam)

Les lois sont **vérifiables mécaniquement** (tests + CI). Adam ne doit pas les contredire en revue de code.

| Loi | En une phrase | Piège à éviter |
|---|---|---|
| **1** | Aucun SDK tiers dans un organe | Importer Stripe dans `orders/` |
| **2** | Un connecteur ne décide pas — il traduit | Créer une commande dans un connecteur |
| **3** | Propriété du stock par attribut | Laisser une caisse écraser `on_hand` en mode `mazone` |
| **4** | Le CDM n'accède pas à la base | SQL dans `lib/cdm/` |
| **5** | L'orchestration commence à **deux organes** | Enregistrer une intention mono-organe |
| **6** | Registres déclaratifs, fail-fast au boot | Capacité annoncée sans mécanique |
| **7** | Aucune I/O réseau dans une transaction | Socket émis avant commit |
| **8** | Pas de chorégraphie par événement | Deux décisions enchaînées par le bus |
| **9** | Journal append-only | Modifier une ligne de journal |
| **10** | Idempotence sur les écritures publiques | `POST /api/v1/intents` sans `Idempotency-Key` |
| **11** | Un seul écrivain de `products.quantity` | Deuxième projection de stock legacy |
| **12** | Capacité absente = étape **reportée**, pas fatale | Faire échouer une vente faute de connecteur |
| **13** | SQLite = un écrivain, WAL, `busy_timeout` | Deux workers sur la même file |
| **14** | Commit avant effets (`txn.js`) | Notification pour une commande annulée |
| **15** | Projections par audience (liste blanche) | `on_hand` visible par un client |
| **16** | **L'orchestration ne parle jamais à un logiciel tiers** | Nom d'éditeur, fetch, webhook dans `lib/orchestration/` |
| **17** | **Le dialecte d'un éditeur reste dans son connecteur** | `if (connectorId === 'shopify')` dans le moteur |

**Loi 16 + Loi 17 = stratégie de substitution progressive.** Retirer un logiciel tiers est un **débranchement**, pas une réécriture du cœur.

Contrôle local avant push : `./scripts/check-loi-17.sh`

---

## 5. État du code — étape par étape

| Étape | Livré | Où regarder |
|---|---|---|
| **E0** Socle prod | Secrets obligatoires (crash boot), CORS, helmet, rate limit, CI, backups, logs | `backend/src/config/env.js`, `.github/workflows/ci.yml` |
| **E1** Filet + CDM | 5 flux caractérisés, CDM sans DB, OpenAPI squelette, correctifs ACL | `backend/test/flows/`, `backend/src/lib/cdm/` |
| **E2** Noyau | bus, journal, idempotency, txn (commit → effets) | `backend/src/lib/kernel/` |
| **E3** Organe Orders | Machine à états, journal, idempotence, subscribers hors transaction | `backend/src/lib/orders/` — **`routes/orders.js` amincie** |
| **E4** Inventory | `stock_levels`, `stock_movements`, modes `mazone`/`pos`, migration T0–T3 | `backend/src/lib/inventory/` |
| **E5** Orchestration | `intentRegistry`, `processManager`, compensation, 6 intentions | `backend/src/lib/orchestration/` |
| **E6** Integration | Connecteur `manual`/CSV, Outbox/Inbox, workers, bindings, conflits | `backend/src/lib/integration/` |
| **E7** API v1 | 19 opérations, projections séparées, sunset `/api`, 1 écran mobile | `backend/src/routes/v1/`, `backend/openapi/` |
| **E8** Famille connecteurs | 7 modules génériques + Shopify (4 fichiers dialecte), écran « Mes logiciels » | `connectors/shopify/`, `MesIntegrationsScreen.js` |

**Intentions déclarées (E5+) :** `order.place`, `order.cancel`, `catalog.declare_product`, `inventory.adjust_on_hand`, `inventory.sync_on_hand`, `integration.push_sale` (reportée si pas de connecteur).

---

## 6. Carte des nouveaux dossiers backend

```
backend/src/
├── app.js                    ← NEW : construction Express (tests montent sans lancer le process)
├── config/env.js             ← NEW : secrets, PUBLIC_BASE_URL, INTEGRATION_SECRET_KEY
├── lib/
│   ├── kernel/               ← E2 : bus, journal, idempotency, txn
│   ├── cdm/                  ← E1 : dictionnaire métier (PAS de DB)
│   ├── orders/               ← E3 : organe Orders (remplace lib/orders.js supprimé)
│   ├── inventory/            ← E4 : triple état, modes mazone/pos
│   ├── catalog/              ← E6 : déclaration produit minimale
│   ├── orchestration/        ← E5 : intentions + processManager
│   ├── integration/          ← E6–E8 : moteur + connecteurs/
│   │   └── connectors/
│   │       ├── manual.js     ← CSV / export
│   │       └── shopify/      ← 4 fichiers dialecte (api, mapping, webhooks, index)
│   ├── access.js             ← ACL partagée routes + sockets
│   ├── sunset.js             ← E7 : dates de fin de vie /api et quantity
│   └── logger.js             ← logs structurés
├── routes/
│   ├── v1/                   ← E7 : contrat public versionné
│   ├── integration.js        ← E6–E8 : Mes logiciels, connect, webhooks
│   └── intents.js            ← E5 : intentions (surface /api)
└── test/                     ← 349 tests
```

**Tables ajoutées (45 au total) :** `stock_levels`, `stock_movements`, `order_journal`, `catalog_journal`, `orchestration_journal`, `idempotency_keys`, `integration_*` (installations, bindings, conflicts, outbox, inbox, workers, secrets, oauth_states, cursors).

---

## 7. API : deux surfaces coexistent

| Surface | Rôle | Fin de vie |
|---|---|---|
| **`/api/v1`** | Contrat public : intentions + projections | — |
| **`/api`** | Surface historique (18 fichiers routes) | **31/01/2027** |

**Deux écritures seulement sur v1 :**

- `POST /api/v1/intents/{id}` — action multi-organe (`Idempotency-Key` **obligatoire**)
- `PATCH /api/v1/inventory/{productId}` — action mono-organe (Loi 5)

**Règle client :** aucune réponse client ne contient `on_hand`, `reserved`, `safety_buffer`. Un garde **échoue en 500** plutôt que de laisser fuir.

**Compteur d'usage legacy :** `GET /api/admin/api-usage`

---

## 8. Mobile : ce qui a bougé

| Fichier | Changement |
|---|---|
| `mobile/src/api/v1.js` | **NEW** — client `/api/v1` séparé |
| `mobile/src/config.js` | Drapeau `FEATURES.stockV1` (`EXPO_PUBLIC_V1_STOCK=1`) |
| `ManageStockScreen.js` | **Seul écran basculé v1** — lit `/api/v1/inventory`, déclare cible `on_hand` |
| `MesIntegrationsScreen.js` | **NEW (E8)** — « Mes logiciels », **ne nomme aucun éditeur** |
| `moduleRegistry.js` | Module `integrations` dans famille *Piloter* |
| `api/index.js` | Endpoints intégration (connect, disconnect, reconcile, import CSV) |

**Par défaut :** le mobile utilise encore `/api`. La bascule est **écran par écran**, derrière drapeau.

**Écart assumé :** aucun harnais de test mobile — les deux chemins sont éprouvés côté serveur.

---

## 9. Famille de connecteurs et Shopify (E8)

**Consigne de Reda (25/07) — à graver :**

> Shopify est un simple premier représentant d'une famille de connecteurs. Le cœur de Ma Zone ne devra jamais évoluer en fonction des particularités d'un éditeur.

**Ce que le moteur fournit (générique) :**

- Coffre secrets AES-256-GCM (`secrets.js`)
- Transport HTTP unique injectable (`http.js`)
- HMAC temps constant (`signature.js`)
- OAuth authorization-code déclaratif (`oauth.js`)
- Curseurs + réconciliation (`cursors.js`, `puller.js`)
- Déclaration produit unifiée (`declare.js`)
- Contexte connecteur (`context.js`) — `request`, `credentials`, `externalIdFor`

**Ce que Shopify apporte seul (4 fichiers) :**

- Version API épinglée `2026-07` (revue avant 30/04/2027)
- `inventory_item_id` comme identité externe (pas la variante)
- Vente Ma Zone = **ajustement de stock**, pas commande Shopify (ne pas polluer la compta du commerçant)

**Tests décisifs :**

- Mode `pos` : 10 − 2 = **8**, jamais 6
- 30 min de panne éditeur : ventes Ma Zone **non bloquées**
- Webhook non signé : **401**, n'entre pas dans la file
- Débranchement : catalogue intact, secrets effacés, correspondances conservées

**Variables d'environnement (voir `backend/.env.example`) :**

- `INTEGRATION_SECRET_KEY` — optionnelle au boot, requise au branchement
- `PUBLIC_BASE_URL` — jamais déduite d'un en-tête HTTP
- `INTEGRATION_<CONNECTEUR>_CLIENT_ID` / `_CLIENT_SECRET`

---

## 10. Dette technique — honnête

| # | Dette | Position |
|---|---|---|
| 1 | **Une commande = un produit** (pas de `order_items`) | Dette la plus lourde — non planifiée |
| 2 | Deux chemins d'écriture sur `products` (Épée + Catalog) | Bornée ; aucun n'écrit `quantity` |
| 3 | Un worker par file SQLite | Assumé ; seuil Postgres = 200 messages soutenus |
| 4 | Messagerie triple pile | Absente de `/api/v1` volontairement |
| 5 | Deux API en parallèle jusqu'au 31/01/2027 | Bornée par `sunset.js` + test d'échéance |
| 6 | Mode `pos` éprouvé factice, pas boutique réelle | À confronter terrain |
| 7 | Pas de roulement clé coffre | Reconnecter obligatoire si clé remplacée |
| 8 | Pas de budget d'appels par éditeur | Suffisant au démarrage |
| 9 | Rafraîchissement jeton non éprouvé | Shopify délivre jeton sans expiration |
| 10 | Vente Ma Zone ≠ commande chez l'éditeur | Choix assumé (E8) |
| 11 | Écran « Mes logiciels » non testé auto | Faute de harnais mobile |

Détail complet : `CURRENT_ARCHITECTURE.md` §10.

---

## 11. Ce qu'il NE FAUT PAS proposer (mis à jour)

**Toujours valide (FD-000) :**

- Reproposer une ontologie exécutable ou un compilateur de règles — **rejetés 25/07**
- Traiter la Deuxième Âme comme « vision future »
- Développer le legacy Next.js sans décision
- Sandbox en production

**Nouveau depuis le chantier Orchestration :**

- Sauter le filet de sécurité (E1) — invalide les 7 autres étapes
- Enregistrer une intention mono-organe (Loi 5)
- Faire dialoguer l'orchestration avec un logiciel tiers (Loi 16)
- Nommer un éditeur hors de `connectors/<éditeur>/` (Loi 17)
- Ajouter une 3e porte d'écriture dans `routes/v1/` (refusée par CI)
- Exposer `on_hand` à un client (Loi 12/15)
- Écrire un `if (connectorId === 'shopify')` dans le moteur ou le mobile
- Créer une commande Shopify pour une vente Ma Zone
- Commit / push sans demande explicite Reda/Adam

---

## 12. Ordre de lecture pour reprendre le fil

**Cursor Adam — avant toute proposition de code :**

1. **Cette FD-002** (vue d'ensemble du chantier livré)
2. **FD-000** §1–4, §22 (philosophie + interdits)
3. **`CURRENT_ARCHITECTURE.md`** (état réel — 15 min)
4. **`ROADMAP_ORGANE_ORCHESTRATION_MAZONE.md`** Partie 1 (lois) + étape concernée
5. **FD-001 §14** si travail sur un connecteur (ce dont il hérite)
6. **`Plan_Conception_…_V1.md`** seulement pour le détail CDM / matrice conflits

**Avant chaque chantier :** `git pull origin main` + lire `INDEX.md`.

---

## 13. Décisions actées depuis FD-001

| Date | Décision | Par |
|---|---|---|
| 2026-07-25 | Ontologie exécutable **rejetée** | Reda |
| 2026-07-25 | Chantier renommé **Organe d'Orchestration** | Reda |
| 2026-07-25 | 17 lois d'architecture, vérifiables en CI | Reda |
| 2026-07-25 | `/api/v1` en **fin** de parcours (E7), pas au début | Reda |
| 2026-07-25 | **Loi 16** — frontière de substitution | Reda |
| 2026-07-25 | **GO code E0 → E8** | Reda |
| 2026-07-25 | E0 → E7 livrées (313 tests) | Cursor Reda |
| 2026-07-25 | **Loi 17** — confinement du dialecte | Reda (consigne E8) |
| 2026-07-25 | E8 = **famille de connecteurs**, Shopify = premier cas | Reda |
| 2026-07-25 | Vente Ma Zone ≠ commande éditeur (ajustement stock) | Cursor Reda |
| 2026-07-26 | **Sauvegarde complète E0 → E8** poussée sur GitHub | Reda |

*(Détail exhaustif des écarts et décisions : FD-001 §9 et §14.)*

---

## 14. Questions ouvertes pour Adam

- **Validation de cette FD-002** et de la FD-001 amendée (passage brouillon → validé ?)
- **Validation de la roadmap** Organe d'Orchestration (17 lois, ordre E0–E8)
- **Quel connecteur en second ?** (Lightspeed, SumUp, Zettle, WooCommerce, Sage…) — dépend du parc commerçants, plus du technique
- **Réglementation logiciels de caisse** — à instruire avant V2 POS Ma Zone (roadmap Horizon)
- **Modèle « une commande = un produit »** — quand et comment corriger ?
- **Vente Ma Zone visible comme commande chez l'éditeur ?** — choix E8 = non ; à rediscuter si un commerçant le demande

---

## 15. Notes opérationnelles pour le Cursor d'Adam

### Démarrage et tests

```bash
cd backend && npm start          # API :4000
cd backend && npm test           # 349 tests — TOUJOURS avant commit
./scripts/check-loi-17.sh        # Contrôles architecture E8
cd backend && npm run backup     # Sauvegarde DB
```

### Secrets développement

- Générés automatiquement dans `backend/data/.dev-secrets.json` (gitignoré)
- `INTEGRATION_SECRET_KEY` posée en test dans `test/helpers/testServer.js`

### Collaboration Reda ↔ Adam

- **Reda** pilote le chantier Orchestration / interop via Cursor Reda
- **Adam** conserve la vision produit globale (FD-000)
- Nouvelle vision → brouillon FD-XXX depuis `_TEMPLATE.md` → **validation humaine** → commit + INDEX
- **Ne jamais** s'appuyer sur les anciennes FD supprimées (reset 24/07)

### Prochaines directions possibles (hors chantier E0–E8)

- Horizon — substitution progressive (organe Ma Zone remplace connecteur, sans changer l'API)
- Deuxième connecteur (coût = ~4 fichiers dialecte + tests dédiés hors ligne)
- Bascule mobile progressive vers `/api/v1` (écran par écran, drapeau)
- Correction dette `order_items`
- Confrontation terrain Shopify (boutique réelle)

---

*Fiche générée depuis `_TEMPLATE.md` — 26/07/2026 — Cursor Reda pour AdamY76. Valider avec Adam avant de passer en statut **validé** dans INDEX.md.*
