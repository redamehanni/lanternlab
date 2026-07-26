# FD-001 — Chantier Fondation API compatible avec les logiciels commerciaux

| | |
|---|---|
| **Statut** | **brouillon** — amendé Reda (Cursor) 24/07 soir, 25/07 (pivot Organe d'Orchestration), **puis 25/07 fin de journée (résultats E0 → E8, famille de connecteurs)** ; validation Adam requise |
| **Date** | 2026-07-24 (amendée 2026-07-25) |
| **Auteur(s)** | Adam (AdamY76) + Cursor Adam ; amendements Reda / Cursor Reda |
| **Phase / chantier** | Fondation API → **Organe d'Orchestration** (renommage du chantier, 25/07) |
| **Références** | [FD-000](./FD-000-mise-a-niveau-global-cursor-adam-ma-zone.md) · **`ROADMAP_ORGANE_ORCHESTRATION_MAZONE.md`** (racine — document maître) · [Cartographie_Metier_V1](./Cartographie_Metier_V1.md) · [Plan_Conception_API_Compatible_Logiciels_Commerciaux_V1](./Plan_Conception_API_Compatible_Logiciels_Commerciaux_V1.md) (**annexe technique**) · `AUDIT_ARCHITECTURE_BOITE_ORCHESTRATION_ONTOLOGIE.md` |

> **Ne pas contredire FD-000** sans mise à jour validée de FD-000 ou fiche plus récente.  
> **Cette fiche n’est pas du code.** Elle raconte *comment on en est arrivé* au plan de codage, pour que le Cursor de Reda (et tout futur Cursor) reprenne le fil sans rejouer les conversations.  
> **24/07 soir :** le plan de conception a été **amendé** pour coller parfaitement à Ma Zone (séquençage Horizon A, modes `mazone`/`pos`, T0–T3, Phase 0 avant D). MD = source de vérité ; PDF éventuellement stale.  
> **25/07 — PIVOT MAJEUR :** le chantier devient **« Organe d'Orchestration »**. Le document maître est désormais `ROADMAP_ORGANE_ORCHESTRATION_MAZONE.md` (racine) ; le plan de conception API devient son **annexe technique**. **L'ordre des étapes change** — voir §12.

---

## 1. Contexte

Ma Zone veut devenir l’outil qui **colle aux logiciels que les commerçants utilisent déjà** (POS, e-commerce, stock…), sans les forcer à abandonner leur caisse le jour 1, et **sans** que le cœur Ma Zone dépende d’un éditeur externe (Shopify, Lightspeed, etc.).

Ce chantier a démarré après le reset FICHE_DISCUSSION du 24/07/2026 (FD-000 seule référence). Il a produit une cartographie métier, un plan de conception, puis un **plan de codage** — **le code n’a pas encore été écrit** (directive Adam : ne pas build tout de suite).

**Pourquoi cette FD-001 maintenant ?**  
Pour synchroniser le Cursor de Reda : vision, décisions, artefacts, et état exact du chantier — sans qu’il doive lire tout l’historique de chat.

---

## 2. Vision & philosophie

- **Surface compose, organe décide** (FD-000) — les routes et adapters n’implémentent pas de règles métier.
- **Logiciels externes = adapters jetables** (Anti-Corruption Layer) — le cœur ne parle jamais le dialecte Shopify/Lightspeed.
- **CDM Ma Zone = dictionnaire interne**, pas « vérité de tout le commerce ». La propriété est **par attribut** (propriétaire / miroir / calculateur).
- **OV = stratégie de diffusion**, pas un type d’événement.
- **Wallet ≠ PSP**.
- Produit officiel = `mobile/` + `backend/` Node — pas de legacy Next.js.

---

## 3. Objectif du chapitre

Faire évoluer l’API Ma Zone pour l’interopérabilité multi-logiciels :

1. Contrats API métier versionnés (`/api/v1`) alignés sur un CDM.
2. Inventory Engine (stock à **triple état**) branché sur le flux commande.
3. Integration Engine + connecteurs (au minimum un chemin manuel/CSV ; natifs plus tard).
4. Sync fiable (Inbox / Outbox, idempotence, réconciliation) sous contraintes SQLite.

---

## 4. Périmètre

### Inclus (déjà produit — docs)

- Étude POS / stock / miroir (SumUp, Qonto, Lightspeed, Clictill, L’Addition, Zettle, Shopify, Vigilantia, Chift…).
- Encyclopédie métier [`Cartographie_Metier_V1`](./Cartographie_Metier_V1.md) (+ PDF).
- Plan de conception [`Plan_Conception_API_Compatible_Logiciels_Commerciaux_V1`](./Plan_Conception_API_Compatible_Logiciels_Commerciaux_V1.md) (+ PDF) — *anciennement* `Plan_Conception_API_Compatible_V1`.
- Plan de codage Cursor (*Codage Fondation API*) : tranches A, B, C, E — **pas encore exécuté**.

### Inclus (code — **livré** le 25/07/2026, E0 → E8)

- Schéma `stock_levels` / `stock_movements`, miroir `products.quantity` ← `available`.
- Inventory Engine + branchement orders / dispatch / missions / products.
- Integration Engine + `connectorRegistry` + connecteur `manual`.
- Outbox / Inbox / webhooks 202 / réconciliation.
- Routes `/api/v1/*` en parallèle de `/api/*` (compatibilité mobile totale).
- **Famille de connecteurs** (coffre à secrets, transport, HMAC, *authorization code*, curseurs) + **Shopify** comme premier cas d'application, sous **Loi 17**.

### Hors périmètre (explicite)

- Certification NF525 de Ma Zone comme caisse.
- Remplacement forcé du POS commerçant.
- GraphQL public, Kafka, microservices day-1.
- Commit / push sans demande Adam/Reda.

---

## 5. Chaîne du chapitre (où on en est)

```
1. Cartographie_Metier_V1          ← FAIT (doc métier, pas FD)
2. Plan_Conception_…_Logiciels…   ← FAIT + AMENDÉ Reda 24/07 → ANNEXE TECHNIQUE 25/07
3. FD-001 (cette fiche)           ← FAIT (brouillon) — récit + décisions Reda
4. Audit ontologie / orchestration ← FAIT 25/07 (ontologie exécutable REJETÉE)
5. ROADMAP_ORGANE_ORCHESTRATION   ← FAIT 25/07 — **DOCUMENT MAÎTRE** (lois + 8 étapes)
6. Code (E0 → E8 de la roadmap)   ← FAIT 25/07 — GO accordé, 8 étapes livrées
7. Amendement FD-001 (résultats)  ← FAIT — §13 (E0→E7) et §14 (E8)
```

**État au 24/07/2026 soir :** plan conception aligné FD-000 ; **aucune ligne de code** du chapitre n’est écrite.

**État au 25/07/2026 :** pivot Organe d'Orchestration acté ; roadmap maître écrite ; **GO code accordé par Reda**. L'ordre d'exécution n'est plus « tranches A/B/C/E » mais les **étapes E0 → E8** de la roadmap (voir §12).

**État au 25/07/2026, fin de journée :** **E0 → E8 livrées** (§13 et §14). Le contrat public `/api/v1` existe et est vérifié dans les deux sens contre les routes réelles ; la fin de vie de `/api` est inscrite dans le code ; et le moteur d'intégration possède désormais une **famille de connecteurs** dont Shopify est le premier cas d'application — tout le dialecte d'un éditeur confiné dans son dossier, sous **Loi 17** vérifiée en CI. 349 tests au vert.

---

## 6. Comment on en est arrivé là (récit)

### 6.1 Point de départ

Après FD-000, le fil Adam a travaillé le chapitre « Fondation API » avec une posture **architecte-chercheur** : d’abord comprendre le métier du commerce, ensuite concevoir l’API — pas l’inverse.

### 6.2 Étude des logiciels / POS

Recherche multi-sources sur caisses et stocks (FR + internationaux). Constats structurants :

- Les commerçants vivent déjà dans un **écosystème multi-logiciels**.
- Un **miroir naïf** « un compteur stock partagé partout » dérive et crée des surventes.
- Les APIs POS sont hétérogènes ; une Unified API (ex. Chift) peut couvrir le long-tail **sans** devenir le cerveau Ma Zone.
- Contrainte FR : ISCA / NF525 — Ma Zone ne se prétend pas caisse fiscale dans ce chapitre.

### 6.3 Cartographie_Metier_V1 (encyclopédie, pas FD)

Document unique consolidé (verticaux retail / CHR / épicerie / services inclus). Conclusions qui **contraignent** l’API :

| Conclusion | Impact |
|------------|--------|
| Besoin avant outil | Domaines API nommés par métier, pas par marque |
| Un attribut = un propriétaire | Matrice CDM + règles de conflit |
| Stock physique ≠ disponibilité promise | Triple état obligatoire |
| Données chaudes / froides | Sync différenciée |
| Miroir naïf = drift | Journal mouvements + réservation + réconciliation |

Étiquetage des affirmations : FAIT / PRATIQUE / ÉDITEUR / HYPOTHÈSE / DÉDUCTION.

### 6.4 Plan de conception (doc technique)

Traduit la cartographie en :

- Architecture **Ports & Adapters + ACL**.
- Surfaces : **REST + OpenAPI 3.1** `/v1` ; AsyncAPI pour webhooks ; **pas** GraphQL / Kafka V1.
- **CDM + matrice propriétaire | miroir | calculateur**.
- Trois vigilances normatives :
  1. **Conflits** — pas de LWW global ; POS gagne sur `on_hand` ; Ma Zone sur `reserved` ; `available` jamais écrit.
  2. **Triple état** — `available = on_hand - reserved - safety_buffer` ; interdit `products.quantity` comme seule vérité.
  3. **SQLite** — WAL déjà actif ; exiger `busy_timeout`, 1 worker Outbox + 1 Inbox, batch, webhook → 202 rapide.
- Roadmap code : **1er build A+B+C+E** ; D/F hors 1er build.
- Ancien « plan architecture interop » **absorbé** dans ce plan (pas de fiche architecture séparée).

**Renommage (24/07/2026) :**  
`Plan_Conception_API_Compatible_V1` → **`Plan_Conception_API_Compatible_Logiciels_Commerciaux_V1`**.

**Amendement Reda (24/07/2026 soir) :** séquençage Horizon A, modes `inventory_owner`, migration T0–T3 normative, Phase 0 min avant D — voir plan §1.6, §6.3, §6.6, §9.6, §11.

### 6.5 Plan de codage (Cursor, non exécuté)

Décisions de cadrage Adam :

| Choix | Décision |
|-------|----------|
| Périmètre 1er build | Tranches **A, B, C, E** (pas D/F Shopify réel) |
| Compatibilité | **Miroir total** : `products.quantity` = projection de `available` ; `/api/*` inchangé ; `/api/v1` en parallèle ; **mobile non modifié** |
| Pattern registres | Copier `eventRegistry` → `connectorRegistry` + `movementRegistry` |
| Migrations | `CREATE TABLE IF NOT EXISTS` + `addColumnIfMissing` (style existant `db/index.js`) |

Ancrage code actuel (à connaître avant de coder) :

- Stock = `products.quantity` décrémenté à la commande dans [`backend/src/routes/orders.js`](../backend/src/routes/orders.js), restauré à l’annulation dans [`backend/src/lib/dispatch.js`](../backend/src/lib/dispatch.js).
- Pas de `/api/v1`, pas d’outbox, pas de webhooks, pas de tests unitaires formels (scripts headless `backend/scripts/test-*.js`).
- Socket `product:stock_updated` avec champ `quantity`.

---

## 7. Principes directeurs (ne pas dévier)

1. Aucun `require('shopify')` (ou SDK POS) dans les organes Orders / Inventory — seulement via adapter.
2. Aucun `UPDATE products SET quantity` hors du module miroir de l’Inventory Engine.
3. `available` = calcul ; jamais vérité écrasable.
4. Webhook : persist Inbox + **202** ; métier async.
5. Un seul worker Outbox + un seul worker Inbox (pas N writers parallèles SQLite).
6. Ne pas créer une fiche « architecture interop » séparée — amender **cette** FD-001 après le code.
7. Ne pas committer sans demande explicite.
8. Modes `inventory_owner = mazone` (défaut) / `pos` — jamais double décrément `on_hand`.
9. Tranche D interdite avant A–E done + Phase 0 secrets/sandbox minimum.
10. Inventory = chantier **Horizon A** (anti-survente) ; parallèle dispatch P1–P3 OK.

---

## 8. Étapes & statut

| # | Étape | Livrable | Statut |
|---|-------|----------|--------|
| 1 | Étude POS / interop | Notes + canvas stratégie | **Fait** |
| 2 | Cartographie métier | `Cartographie_Metier_V1.md` + PDF | **Fait** |
| 3 | Plan de conception | `Plan_Conception_API_Compatible_Logiciels_Commerciaux_V1.md` | **Fait + amendé Reda** (PDF à régénérer) |
| 4 | FD récit chantier | Cette FD-001 | **Brouillon** (amendé Reda) |
| 5 | Plan de codage | Plan Cursor *Codage Fondation API* | **Fait** (non exécuté — resync plan amendé) |
| 6 | Code E0 → E7 | Socle, filet + CDM, noyau, Orders, Inventory, Orchestration, Integration, `/api/v1` | **Fait** (25/07) |
| 7 | Amendement FD-001 | Résultats / écarts E0 → E7 | **Fait** (§9 et §13) |
| 8 | Code E8 | **Famille de connecteurs** + Shopify comme premier cas d'application | **Fait** (25/07 — §9 et §14) |

---

## 9. Décisions actées

| Date | Décision | Par |
|------|----------|-----|
| 2026-07-24 | Reset FICHE_DISCUSSION ; FD-000 seule référence globale | Reda / Adam |
| 2026-07-24 | Chapitre = cartographie → conception → code → mémoire FD | Adam |
| 2026-07-24 | Cartographie = doc métier (pas FD) | Adam |
| 2026-07-24 | Plan conception = doc technique (pas FD) ; absorbe l’ex-« FD architecture » | Adam |
| 2026-07-24 | Stack V1 : REST OpenAPI `/v1`, ACL, CDM nuancé, Outbox/Inbox, hybride natifs+Chift ; pas GraphQL/Kafka | Adam |
| 2026-07-24 | Triple état + matrice conflits + contraintes SQLite = normatifs | Adam |
| 2026-07-24 | 1er build code = A+B+C+E ; compat miroir `quantity` ; mobile inchangé | Adam |
| 2026-07-24 | Renommage plan → `…_Logiciels_Commerciaux_V1` | Adam |
| 2026-07-24 | FD-001 = récit pour Cursor Reda ; code **pas** démarré tout de suite | Adam |
| 2026-07-24 | Inventory Engine = Horizon A (anti-survente) ; parallèle dispatch P1–P3 | **Reda** |
| 2026-07-24 | Critère bouclage chapitre = **A–E only** ; D/F hors 1er build + GO explicite | **Reda** (aligne Adam) |
| 2026-07-24 | Modes `inventory_owner = mazone` (défaut) / `pos` — `commit` différencié | **Reda** |
| 2026-07-24 | Migration `quantity` T0–T3 normative ; mobile lit miroir, n’écrit pas vérité | **Reda** |
| 2026-07-24 | Tranche D après A–E + Phase 0 min (secrets, sandbox) | **Reda** |
| 2026-07-24 | Plan conception amendé ; MD source de vérité (PDF stale OK temporairement) | **Reda** |
| 2026-07-25 | **Ontologie métier exécutable + compilateur de règles : REJETÉS.** Motifs : monde ouvert vs monde fermé, erreur de catégorie (décrire ≠ agir), bus factor 1 sur le compilateur, formalisation d'hypothèses non validées terrain | **Reda** (sur audit Cursor Reda) |
| 2026-07-25 | Chantier renommé **Organe d'Orchestration** ; `ROADMAP_ORGANE_ORCHESTRATION_MAZONE.md` = document maître | **Reda** |
| 2026-07-25 | Plan de conception API → **annexe technique** de la roadmap (CDM, matrice conflits, contrat connecteur, contraintes SQLite) | **Reda** |
| 2026-07-25 | **12 lois d'architecture** actées, chacune vérifiable mécaniquement. Deux lois initialement proposées **rejetées** : « le CDM est la vérité interne » (deviendrait un god object) et « toute intention passe par l'Orchestration » (goulot) | **Reda** |
| 2026-07-25 | **Loi 5 : l'orchestration commence à deux organes.** Une action mono-organe appelle l'organe directement | **Reda** |
| 2026-07-25 | **Nouvel ordre d'exécution : filet de sécurité + CDM d'abord** (E1), `/api/v1` en **fin** de parcours (E7). Un contrat écrit avant que les intentions existent est un contrat deviné | **Reda** |
| 2026-07-25 | Orders devient un **organe** (E3) **avant** Inventory (E4) : on ne peut pas orchestrer un organe qui n'existe pas | **Reda** |
| 2026-07-25 | Phase 0 = **Étape 0 explicite et bloquante**, avec critères de validation, mais détail volontairement léger (infrastructure connue) | **Reda** |
| 2026-07-25 | **GO code accordé** — exécution E0 → E8 | **Reda** |
| 2026-07-25 (E6) | **Un organe Catalog minimal est créé** (`lib/catalog/`) plutôt que de laisser le connecteur écrire dans `products`. Un connecteur qui crée une entité métier viole la Loi 2, et le jour où la règle de création change, personne ne va la corriger dans un connecteur. **Dette assumée et bornée :** deux chemins d'écriture coexistent sur `products` (l'Épée par `routes/products.js`, la déclaration en masse par l'organe) ; aucun des deux n'écrit `quantity` | Cursor Reda |
| 2026-07-25 (E6) | **Table `integration_installations` ajoutée**, absente de la roadmap. Sans elle, « cette boutique sait-elle pousser ses ventes ? » n'a pas de réponse : une capacité n'est pas une propriété du code mais d'une **boutique** | Cursor Reda |
| 2026-07-25 (E6) | **Écart au critère « diff de `orchestration/intents/` vide ».** Aucun plan existant n'a été modifié, mais **une intention a été ajoutée** : `catalog.declare_product`. Elle est un acte métier (déclarer un produit, puis le rendre vendable = deux organes, donc Loi 5), **pas** une contrainte de protocole. L'esprit du critère est tenu, sa lettre non — écart consigné plutôt que masqué | Cursor Reda |
| 2026-07-25 (E6) | **Un connecteur exigeant des identifiants est refusé au branchement (501)** tant qu'il n'existe pas de coffre à secrets. Plutôt qu'un chiffrement improvisé, le moteur refuse : la question « où vivent les secrets » sera donc posée **avant** E8, pas après | Cursor Reda |
| 2026-07-25 (E6) | **Loi 3 appliquée à `syncOnHand` — changement de comportement vs E4.** En mode `mazone`, un connecteur ne peut plus écraser `on_hand` : l'appel est refusé (409) et journalisé en conflit `owner_priority`. À l'étape 4 la permissivité était sans conséquence (aucun connecteur n'existait) ; elle en aurait une maintenant. Conséquence produit : **la propriété du stock se donne, elle ne se prend pas** — brancher une caisse ne change plus les quantités du commerçant à son insu. Le mode `pos` cesse d'être « déclaré, pas exercé » | Cursor Reda |
| 2026-07-25 (E6) | **`ExternalBinding` et `SyncConflict` passent `planned` → `live`** au CDM, avec les noms de champs de l'annexe technique (§4.4) et non ceux de l'esquisse E1. `SyncConflict` **n'a pas** de champ `resolution` : l'issue est toujours « Ma Zone garde sa valeur », ce qui varie est la **raison**. Un enum de résolution laisserait croire qu'un arbitrage silencieux en faveur de l'extérieur est possible | Cursor Reda |
| 2026-07-25 (E6) | **L'Outbox est le registre d'export du connecteur manuel** — pas de seconde table d'export. Deux tables donneraient deux vérités sur « qu'est-ce qui est parti, qu'est-ce qui reste à passer en caisse ». Les lettres mortes sont **visibles et relançables par le commerçant** (`GET/POST …/outbox/dead`, `…/retry`) | Cursor Reda |
| 2026-07-25 (E7) | **`/api/v1` publie 19 opérations et DEUX écritures seulement** : `POST /intents/{id}` (multi-organe) et `PATCH /inventory/{productId}` (mono-organe, Loi 5). Une troisième porte d'écriture est refusée par la CI. C'est la réponse mécanique au risque nommé par l'audit — « `/api/v1` devient un miroir de tables » — qui n'arrive jamais d'un coup mais une route pratique à la fois | Cursor Reda |
| 2026-07-25 (E7) | **Séparation des projections par liste blanche, pas par relecture.** Aucune réponse client ne part d'une ligne de base : elle est construite champ par champ (`routes/v1/projections.js`), et un garde récursif **échoue en 500** plutôt que de laisser fuir `on_hand`. Une fuite silencieuse se découvre par un tiers, une route cassée se découvre en dix secondes | Cursor Reda |
| 2026-07-25 (E7) | **La règle anti-fuite a été corrigée par un test qui échoue.** Le premier balayage interdisait `quantity` partout et signalait `GET /api/v1/intents`, où c'est le nom d'un **paramètre d'intention** — la quantité commandée. Deux listes désormais : quatre champs de gestion interdits partout, `quantity` interdit dans les seules projections de catalogue. Une règle qui crie pour rien finit désactivée | Cursor Reda |
| 2026-07-25 (E7) | **`PATCH /api/v1/inventory` déclare du PHYSIQUE en valeur absolue.** Tient la promesse écrite dans `inventoryEngine.js` à E4 (« cette traduction disparaît à l'étape 7 »). Conséquence assumée : en cas de saisie simultanée, **le dernier écrivain gagne**, là où les deltas de `/api` s'additionnaient. Compromis choisi parce que le réessai réseau est bien plus fréquent que la saisie simultanée — et le déclaratif rend le rejeu inoffensif, ce qui dispense cette route de clé d'idempotence | Cursor Reda |
| 2026-07-25 (E7) | **Écart au squelette OpenAPI de E1 : `compensated` n'est plus un statut de succès.** Une exécution compensée n'a produit aucun effet net ; la ranger dans un corps de 200 laisserait un intégrateur croire que sa commande existe. Deux schémas (`IntentResult`, `IntentFailure`) et un **422**, pour que le code HTTP et le corps disent la même chose. `processManager` remonte désormais ce qui a été défait, y compris les compensations **en échec** — le seul cas où Ma Zone laisse un état qu'elle sait faux | Cursor Reda |
| 2026-07-25 (E7) | **Fins de vie inscrites dans le code** (`lib/sunset.js`) : `/api` au **31/01/2027**, `products.quantity` au **30/04/2027**, dans cet ordre obligatoire. En-têtes `Deprecation`/`Sunset` (RFC 8594), compteur d'usage **par motif de route** (`GET /api/admin/api-usage`), et **un test qui échoue à l'échéance**. Une date qui ne fait rien quand elle arrive n'est pas une date, c'est un souhait | Cursor Reda |
| 2026-07-25 (E7) | **Ce qui n'est PAS publié est un choix, pas un retard** : ni messagerie (triple pile), ni panier, ni portefeuille, ni identité, ni transitions de livraison. On ne versionne que ce qui est passé derrière un organe ; publier une forme qu'on sait devoir refaire, c'est choisir entre s'interdire de la refaire et casser sa promesse de stabilité | Cursor Reda |
| 2026-07-25 (E7) | **Bascule mobile : un seul écran, drapeau à `false` par défaut** (`ManageStockScreen`, commerçant). Choisi parce que c'est le seul rôle qui **gagne** quelque chose — physique, promis et vendable séparés. **Écart au critère de la roadmap :** « mêmes tests E2E sur `/api` et `/api/v1` » n'est pas vérifiable, aucun harnais de test mobile n'existe dans le projet ; les deux chemins sont éprouvés côté serveur, le mobile à la main | Cursor Reda |
| 2026-07-25 (E8) | **Consigne de cadrage de Reda, avant toute ligne : Shopify n'est qu'un premier représentant d'une FAMILLE de connecteurs.** Aucune décision d'architecture ne doit être propre à cet éditeur si elle risque de compliquer l'arrivée de Lightspeed, SumUp, Zettle, WooCommerce, Sage ou d'un autre. Une optimisation propre à un éditeur reste **confinée à son connecteur**. Le cœur (CDM, Orchestration, Integration Engine, API) n'évolue **jamais** pour les particularités d'un éditeur | **Reda** |
| 2026-07-25 (E8) | **Loi 17 — confinement du dialecte**, conséquence opposable de la consigne ci-dessus. Le nom d'un éditeur n'apparaît nulle part dans `backend/src` hors de `connectors/<éditeur>/` ; un connecteur n'importe ni la base, ni un organe, ni le coffre à secrets, et n'appelle pas le réseau autrement que par `ctx.request`. **La liste des éditeurs gardés est déduite des dossiers de connecteurs** — le prochain est protégé sans que personne pense à l'ajouter. Vérifiée par `test/connector-conformance.test.js`, 3 étapes CI et `scripts/check-loi-17.sh` (jouable en local) | Cursor Reda |
| 2026-07-25 (E8) | **Le livrable de l'étape n'est pas le connecteur, c'est ce qui a été retiré du connecteur.** Sept mécanismes génériques sont nés en extrayant ce qu'un éditeur allait sinon dupliquer : coffre chiffré (`secrets.js`), transport unique (`http.js`), HMAC à temps constant (`signature.js`), *authorization code* déclaratif (`oauth.js`), curseurs durables (`cursors.js`), lecture incrémentielle et réconciliation (`puller.js`), contexte de connecteur (`context.js`). Le connecteur Shopify ne contient que quatre fichiers de dialecte | Cursor Reda |
| 2026-07-25 (E8) | **Trois modes de connexion déclarés — `delegated`, `credentials`, `none` — et pas seulement OAuth.** Une part importante des logiciels visés ne délivre pas de jeton par redirection. Un moteur qui ne connaîtrait que la redirection obligerait le connecteur suivant à **simuler un flux qui n'existe pas chez lui**, c'est-à-dire à mentir au moteur | Cursor Reda |
| 2026-07-25 (E8) | **Le refus d'E6 change de nature, pas de fermeté.** Un connecteur exigeant des identifiants ne se voit plus refuser « faute de coffre » (501) mais **faute d'identifiants rangés** (409) : ils se déposent d'abord, par la connexion du logiciel, et le branchement les constate. `INTEGRATION_SECRET_KEY` est **optionnelle au démarrage** — une instance sans aucun logiciel à connecter n'a pas de raison de refuser de démarrer ; le refus arrive là où il est actionnable | Cursor Reda |
| 2026-07-25 (E8) | **`PUBLIC_BASE_URL` est obligatoire pour une connexion déléguée et n'est JAMAIS déduite d'un en-tête** (`Host`, `X-Forwarded-Host`). Une URL de redirection choisie par l'appelant est un vol de jeton par redirection. Absente, la connexion refuse de commencer **en nommant la variable** | Cursor Reda |
| 2026-07-25 (E8) | **Le débranchement rend la procuration.** Un jeton d'éditeur est une procuration, pas une donnée : débrancher suspend, **efface les secrets** et oublie les curseurs — mais **conserve les correspondances** (`external_bindings`), sans quoi rebrancher recréerait des doublons chez l'éditeur. Le catalogue et le stock du commerçant restent intacts, et il reprend la main à la souris | Cursor Reda |
| 2026-07-25 (E8) | **La déclaration de produit quitte `importer.js` pour `declare.js`** : le CSV cesse d'être un chemin privilégié. C'est le vrai marqueur « famille » — sans ce déplacement, chaque connecteur lisant un catalogue aurait réécrit la boucle de déclaration, et l'aurait écrite un peu différemment | Cursor Reda |
| 2026-07-25 (E8) | **`sync.js` et `worker.js` deviennent asynchrones.** Jusqu'ici aucun connecteur ne faisait d'entrée-sortie réelle. Une livraison sortante attend maintenant un réseau, et un rejet de promesse non capturé dans une boucle de fond tuerait le processus : le lot est protégé, et une panne de 30 minutes chez l'éditeur est un test, pas une hypothèse | Cursor Reda |
| 2026-07-25 (E8) | **Écart consigné — `bindings.resolveForOutlet` ajouté au moteur.** Une correspondance créée par une lecture de catalogue n'a pas d'établissement, alors qu'une notification de stock en porte un : la résolution stricte refusait **chaque** notification en `unmapped_entity`. Le repli (exact, puis sans établissement) est une règle **générique** — tout éditeur multi-établissements la rencontrera — et non une rustine Shopify. La refuser aurait poussé la compensation dans le connecteur, c'est-à-dire au mauvais endroit | Cursor Reda |
| 2026-07-25 (E8) | **Deux décisions propres à Shopify, assumées et confinées.** (1) L'identité externe d'un produit est son `inventory_item_id`, seul identifiant présent dans **tous** les flux de cet éditeur ; choisir la variante aurait donné un catalogue parfait suivi de chaque notification de stock refusée. (2) **Une vente Ma Zone n'est pas une commande Shopify** : elle est transmise comme ajustement relatif de stock, pour ne pas entrer dans la comptabilité d'un commerçant qui n'a rien demandé (numérotation fiscale, rapports, courriels). Conséquence acceptée : le chiffre d'affaires Ma Zone se lit dans Ma Zone | Cursor Reda |
| 2026-07-25 (E8) | **`test/connector-conformance.test.js` : la suite se branche sur le REGISTRE, pas sur une liste de fichiers.** Le prochain connecteur hérite de ses tests le jour où il s'enregistre — notification non signée refusée, signature d'une autre clé refusée, mode de connexion cohérent, formulaire dessinable, dialecte confiné. Écrire la conformité connecteur par connecteur revenait à la réécrire moins bien chaque fois | Cursor Reda |
| 2026-07-25 (E8) | **Le mode `pos` est exercé pour la première fois, et le compte est vérifié : 10 − 2 = 8, jamais 6.** Ma Zone baisse `reserved`, l'éditeur baisse son stock physique, Ma Zone recopie. C'est la réponse au risque nommé depuis E4 (« double décrément »), désormais tenue par un test de bout en bout et non par une intention | Cursor Reda |
| 2026-07-25 (E8) | **L'écran mobile « Mes logiciels » ne nomme aucun éditeur** : il dessine ce que le backend décrit (mode, champs, portées). C'est la condition pour que le prochain logiciel du marché n'exige **pas une nouvelle version de l'application dans les magasins**. Un `if (connector.id === …)` dans cet écran transformerait chaque connecteur en livraison mobile | Cursor Reda |
| 2026-07-25 (E8) | **La frontière de la Loi 16 a tenu à l'épreuve du réel** : brancher un logiciel du marché n'a modifié **aucun fichier** de `lib/orchestration/`, et `adapters/integration.js` est resté l'emplacement vide qu'il était | Cursor Reda |
| 2026-07-25 (après E5) | **Loi 16 — frontière de substitution.** L'Organe d'Orchestration **ne dialogue jamais directement avec un logiciel tiers** : il orchestre des intentions métier uniquement. Traduction, authentification, mapping, webhook, synchronisation et protocole appartiennent **exclusivement** à l'Integration Engine et aux connecteurs. Gravée dans la roadmap (§1.2), dans les en-têtes d'architecture de `lib/orchestration/`, et rendue **opposable** par 3 tests + 1 étape CI | **Reda** |

---

## 10. Questions ouvertes

- ~~Validation Reda du plan / timing Inventory ?~~ → **Répondu** : plan amendé ; Inventory = Horizon A ; D après Phase 0 min.
- ~~Ontologie métier : bonne approche ?~~ → **Répondu 25/07** : rejetée (audit `AUDIT_ARCHITECTURE_BOITE_ORCHESTRATION_ONTOLOGIE.md`).
- **Reste :** validation Adam de la roadmap Orchestration.
- ~~Ordre exact des connecteurs natifs après `manual` (Shopify d'abord ?)~~ → **Répondu 25/07** : Shopify livré comme **premier représentant d'une famille**, la question de l'ordre perd son enjeu — le suivant hérite du moteur et de sa suite de conformité.
- **Nouveau (E8) — quel éditeur en second, et pour quel commerçant ?** La réponse utile n'est plus technique : elle dépend du parc réel des commerçants approchés. Le coût du deuxième connecteur est désormais son **dialecte seul** (≈ 4 fichiers).
- **Nouveau (E8) — roulement de la clé maîtresse du coffre.** Aujourd'hui la remplacer oblige chaque commerçant à reconnecter (dit clairement, grâce à l'empreinte de clé). Un vrai roulement reste à écrire : à instruire **avant** d'avoir beaucoup de logiciels branchés, pas après.
- **Nouveau (E8) — budget d'appels par éditeur.** Le moteur respecte un `Retry-After` reçu mais n'anticipe aucun quota. Deviendra faux avec plusieurs boutiques actives sur le même éditeur ; le point d'ajout est unique (`integration/http.js`).
- **Nouveau (E8) — confrontation à une vraie boutique.** Le mode `pos` est vérifié contre un logiciel factice : quotas réels, latence de notification et établissements multiples restent à éprouver sur le terrain.
- Seuil `SQLITE_BUSY` / Postgres → **chiffré 25/07** : plus de 200 messages Outbox en attente de façon soutenue déclenche la discussion (roadmap E6).
- **Modèle « une commande = un produit »** (pas de table `order_items`) : dette la plus lourde, correction repoussée après E5. Identifiée comme le choix le plus fragile de la roadmap.
- **Réglementation logiciels de caisse** : à instruire **avant** la V2 POS Ma Zone. Peut redéfinir le périmètre et le calendrier.
- Extension CHR / services au-delà des limites V1 documentées.

---

## 11. Notes pour les deux Cursor

### Les deux Cursor — lire en priorité

1. [FD-000](./FD-000-mise-a-niveau-global-cursor-adam-ma-zone.md) si doute philosophie.
2. **`ROADMAP_ORGANE_ORCHESTRATION_MAZONE.md`** (racine) — **document maître** : les 17 lois (dont la **Loi 16**, frontière de substitution, et la **Loi 17**, confinement du dialecte), les 8 étapes, l'audit critique. À lire **en entier** avant toute ligne de code.
3. Cette **FD-001** (contexte + décisions Adam **et** Reda).
4. [`Plan_Conception_API_Compatible_Logiciels_Commerciaux_V1.md`](./Plan_Conception_API_Compatible_Logiciels_Commerciaux_V1.md) — **annexe technique** : à consulter pour le détail CDM, la matrice de conflits, le contrat connecteur, les contraintes SQLite.
5. [`Cartographie_Metier_V1.md`](./Cartographie_Metier_V1.md) si besoin du « pourquoi métier ».
6. `AUDIT_ARCHITECTURE_BOITE_ORCHESTRATION_ONTOLOGIE.md` si la question de l'ontologie revient.

### Ce qu’il ne faut PAS faire

- Relancer une fiche « architecture interop » séparée.
- **Reproposer une ontologie exécutable ou un compilateur de règles** — rejetés le 25/07, motifs documentés.
- **Sauter l'Étape 1** (filet de sécurité + CDM). C'est la seule étape dont l'abandon invalide les sept autres.
- **Enregistrer une intention mono-organe** dans le registre d'orchestration (violation Loi 5 — l'orchestrateur deviendrait un god object).
- **Chaîner deux décisions métier par événement** (violation Loi 8 — chorégraphie intraçable).
- **Faire dialoguer l'Organe d'Orchestration avec un logiciel tiers** (violation Loi 16). Concrètement, dans `lib/orchestration/` : aucun appel réseau, aucun jeton ni secret d'éditeur, aucun mapping de format, aucun identifiant externe, aucun webhook, aucune file de synchronisation, aucun nom d'éditeur. Le piège à refuser en revue de code à l'étape 6 : ajouter une étape à un plan d'intention parce qu'un éditeur impose un ordre d'appel — cette séquence vit dans le `push()` du connecteur.
- **Émettre un socket ou faire un appel réseau dans une transaction** (violation Loi 7 — défaut existant dans `routes/orders.js` L46–90, à corriger).
- Traiter `products.quantity` comme vérité métier à faire évoluer côté client.
- Double décrément `on_hand` (MZ + POS).
- **Nommer un éditeur hors de `connectors/<éditeur>/`** (violation Loi 17). Le piège le plus courant est le plus innocent : un `if (connectorId === 'shopify')` dans le moteur « juste le temps de faire marcher ». C'est refusé par la CI, et jouable en local avant de pousser — `./scripts/check-loi-17.sh`.
- **Faire lire le coffre, la base ou un organe à un connecteur.** Ses identifiants lui sont **fournis** par `ctx`, son réseau passe par `ctx.request`. Un connecteur qui va chercher lui-même est un connecteur qu'on ne peut plus tester hors ligne.
- **Ajouter un mécanisme au cœur pour un seul éditeur.** Le bon réflexe : l'écrire dans le connecteur, et ne le remonter dans le moteur que **quand un deuxième éditeur en a besoin** — c'est exactement ce qui a produit les sept modules génériques d'E8.
- **Écrire un test de conformité propre à un connecteur.** La conformité s'écrit une fois, sur le registre (`connector-conformance.test.js`) ; ce qui est propre à un éditeur va dans son fichier de test dédié, hors ligne, avec un transport factice.
- **Déduire une URL de redirection ou de webhook d'un en-tête de requête.** C'est un vol de jeton par redirection. `PUBLIC_BASE_URL`, ou refus.
- Committer ou pousser sans demande.

### Artefacts utiles (chemins)

| Artefact | Chemin |
|----------|--------|
| Cartographie | `FICHE_DISCUSSION/Cartographie_Metier_V1.md` |
| Plan conception (**amendé**) | `FICHE_DISCUSSION/Plan_Conception_API_Compatible_Logiciels_Commerciaux_V1.md` |
| Cette fiche | `FICHE_DISCUSSION/FD-001-chantier-fondation-api-logiciels-commerciaux.md` |
| DB / stock actuel | `backend/src/db/index.js`, `backend/src/routes/orders.js` |
| Pattern registre | `backend/src/lib/eventEngine/eventRegistry.js` |
| **Modèle à copier pour le connecteur suivant** | `backend/src/lib/integration/connectors/shopify/` (4 fichiers : `api`, `mapping`, `webhooks`, `index`) |
| **Ce dont il héritera sans l'écrire** | `backend/src/lib/integration/` : `secrets`, `http`, `signature`, `oauth`, `cursors`, `puller`, `declare`, `context` |
| **Ses tests, écrits d'avance** | `backend/test/connector-conformance.test.js` (générique) + un fichier dédié hors ligne sur le modèle de `test/shopify-connector.test.js` |
| Contrôles d'architecture en local | `./scripts/check-loi-17.sh` |

### Après le code

Mettre à jour **cette même FD-001** (sections 5, 8, 9, 12 + sections « Résultats » 13 et 14) — ne pas créer une nouvelle FD pour raconter le même chapitre.

---

## 12. Pivot du 25/07 — correspondance tranches → étapes

Le vocabulaire « tranches A/B/C/D/E/F » du plan de conception reste valable **dans l'annexe technique**, mais **l'ordre d'exécution est celui de la roadmap maître**. Correspondance :

| Roadmap (ordre d'exécution) | Tranche annexe | Nouveauté vs plan initial |
|---|---|---|
| **E0** — Socle de production | Phase 0 | Rendue explicite et bloquante |
| **E1** — Filet de sécurité + CDM | (partie de A) | **Nouveau** : tests de caractérisation des 5 flux + correctifs autorisation. N'existait pas dans le plan initial |
| **E2** — Noyau (`kernel/`) | — | **Nouveau** : bus, journal, idempotence, txn extraits de l'existant |
| **E3** — Organe Orders | — | **Nouveau** : Orders devient un organe (machine à états, journal, idempotence) |
| **E4** — Inventory Engine | **B** | Inchangé sur le fond (triple état, T0–T3), mais posé sur un Orders propre |
| **E5** — Organe d'Orchestration | — | **Nouveau** : `intentRegistry` + `processManager` + compensation |
| **E6** — Integration + `manual` | **C + E** | Fusionnées : registre connecteur et Outbox/Inbox livrés ensemble |
| **E7** — API `/api/v1` | **A** | **Déplacée à la fin** (était première), et le déplacement a payé : le contrat publie des intentions qui existent, pas des tables. Le squelette écrit en E1 a servi de brouillon — un de ses statuts a d'ailleurs été corrigé à l'implémentation (§9) |
| **E8** — Famille de connecteurs + Shopify | **D** | **Élargie à l'exécution** : la tranche disait « connecteur Shopify », la consigne de Reda en a fait « **une famille dont Shopify est le premier cas** ». Le livrable a changé de nature — sept mécanismes génériques et une **Loi 17** opposable, plus quatre fichiers de dialecte |
| Horizon | **F** | Push POS, substitution progressive |

**Pourquoi ce réordonnancement.** Trois faits du code l'imposent :

1. `eventEngine/orchestration.js` et `eventEngine/bus.js` prouvent déjà le pattern → l'orchestration est une **généralisation**, pas une invention.
2. **Orders n'est pas un organe** (logique dans `routes/orders.js`, pas de graphe de transitions, pas d'idempotence, sockets dans la transaction) → il faut le créer avant de l'orchestrer.
3. **Zéro test automatisé** → toute restructuration sans filet est un pari.

**Trois conditions de signature** (roadmap Partie 3) : l'Étape 1 n'est pas négociable ; la Loi 5 est défendue en revue de code ; le déclencheur Postgres est surveillé dès E6.

---

## 13. Résultats du code — E0 → E7

Ce qui existe **réellement** dans `backend/` à cette date. À jour ; en cas de doute, le code et les tests tranchent.

| Étape | Livré | Où |
|---|---|---|
| **E0** | Secrets obligatoires (crash au boot), CORS en liste blanche, sandbox verrouillé en prod, helmet, rate limiting, logs structurés, CI GitHub Actions, sauvegardes | `src/config/`, `src/middleware/`, `.github/workflows/ci.yml` |
| **E1** | Harnais `node:test`, tests de caractérisation des 5 flux critiques, CDM (entités, propriété **par attribut**, validation) sans accès base, squelette OpenAPI | `src/lib/cdm/`, `test/`, `openapi/` |
| **E2** | Noyau : bus, journal, idempotence, `txn` garantissant **commit avant effets** | `src/lib/kernel/` |
| **E3** | Organe Orders : machine à états fail-fast, moteur transactionnel, `order_journal`, idempotence, effets de bord sortis de la transaction | `src/lib/orders/` |
| **E4** | Inventory Engine : `stock_levels` + `stock_movements`, triple état, modes `mazone`/`pos`, migration T0–T3, `products.quantity` devenu **projection** | `src/lib/inventory/` |
| **E5** | Organe d'Orchestration : `intentRegistry`, `processManager` (compensation, idempotence), `orchestration_journal`, capacités, **6 intentions** | `src/lib/orchestration/` |
| **E6** | Integration Engine : contrat Connector, registre, `integration_installations`, `external_bindings`, `sync_conflicts`, Outbox/Inbox avec backoff et DLQ, worker à bail unique, connecteur `manual` (CSV), organe Catalog minimal, routes « Mes intégrations » | `src/lib/integration/`, `src/lib/catalog/`, `src/routes/integration.js` |
| **E7** | API v1 : 19 opérations, `Idempotency-Key` **obligatoire** sur les intentions, projections séparées par audience avec garde anti-fuite, `PATCH` d'inventaire déclaratif, OpenAPI vérifiée **dans les deux sens**, fins de vie inscrites dans le code, `available` sur le socket, premier écran mobile basculé derrière un drapeau | `src/routes/v1/`, `src/lib/sunset.js`, `openapi/openapi.yaml`, `mobile/src/api/v1.js` |

**Filet à la fin de E7 :** 313 tests `node:test`, dont l'import de 500 articles suivi d'une vente, la déduplication d'un message reçu trois fois, la DLQ après six échecs, le refus du second worker, **quatre contrôles structurels** des Lois 2 et 16, et depuis E7 la **parité contrat ↔ routes réelles**, le rejeu d'une clé d'idempotence qui ne vend qu'une fois, et le balayage anti-fuite de `on_hand` sur toutes les routes client.

**Vérifié à la main, en plus des tests :** `lib/integration/` a été physiquement retiré, puis l'orchestration a démarré, déclaré ses 6 intentions et exécuté une vente — l'étape externe étant reportée avec un message en français. C'est la Loi 16 rendue littérale : la substitution est un débranchement.

**Ce qui n'est pas fait et qui reste vrai :** une commande = un produit (pas de table `order_items`) ; deux chemins d'écriture sur `products` ; deux API en parallèle jusqu'au 31/01/2027 ; messagerie, panier, portefeuille, identité et transitions de livraison absents de `/api/v1` ; un seul écran mobile basculé sur la surface versionnée.

---

## 14. Résultats du code — E8, la famille de connecteurs (25/07/2026)

**Ce que l'étape a réellement produit.** Le titre de la roadmap disait « premier connecteur externe ». La consigne de cadrage de Reda a déplacé le livrable : ce qui compte n'est pas le connecteur, c'est **ce qui a été retiré du connecteur** pour que le suivant n'ait plus à l'écrire.

| Ce qui appartient au moteur (aucun éditeur nommé) | Fichier | Ce que le connecteur suivant n'écrira pas |
|---|---|---|
| Coffre à secrets AES-256-GCM, empreinte de clé, purge au débranchement | `integration/secrets.js` | Son propre chiffrement — donc son propre bug de chiffrement |
| Transport sortant unique : délai, 429 avec `Retry-After`, réessayable / définitif, **injectable** | `integration/http.js` | Sa politique de réessai, et sa dépendance à un vrai réseau en test |
| Vérification HMAC à **temps constant**, algorithme et encodage déclarés | `integration/signature.js` | Une comparaison de signatures en `===`, c'est-à-dire une fuite par le temps |
| Flux *authorization code* : état à **usage unique**, `redirect_uri` construite, échange, rafraîchissement | `integration/oauth.js` | La partie du protocole où se cachent les vraies failles |
| Curseurs durables par ressource | `integration/cursors.js` | Relire tout le catalogue à chaque passe |
| Lecture incrémentielle + réconciliation périodique | `integration/puller.js` | Sa propre boucle de pagination et de rattrapage |
| Déclaration canonique de produit | `integration/declare.js` | Une seconde manière de créer un produit |
| Contexte du connecteur : `request`, `credentials` **paresseux**, `externalIdFor`, `updateConfig` | `integration/context.js` | Un accès direct à la base ou au coffre |

**Ce qui appartient à l'éditeur, et n'en sort pas** — `connectors/shopify/`, quatre fichiers : chemins et version d'API épinglée (`api.js`), variantes aplaties et identité par `inventory_item_id` (`mapping.js`), en-têtes et sujets de notification (`webhooks.js`), assemblage et descripteur d'autorisation (`index.js`).

**Loi 17, opposable et pas seulement écrite.** Trois contrôles CI plus `test/connector-conformance.test.js` : aucun nom d'éditeur dans `backend/src` hors de son dossier, aucun connecteur qui importe la base / un organe / le coffre / `fetch`, et un seul fichier autorisé à lire les procurations des commerçants. La liste des éditeurs gardés est **déduite des dossiers de connecteurs**, donc le suivant est protégé sans intervention. `./scripts/check-loi-17.sh` rejoue tout en local : une règle qu'on découvre après un « push » est une règle qu'on contourne.

**Filet : 349 tests** (313 avant l'étape). Les quatre qui décident si l'étape est réussie :

1. **Zéro double décrément en mode `pos`** — vente de 2 sur 10, résultat **8**, jamais 6. Ma Zone baisse `reserved`, l'éditeur baisse son physique, Ma Zone recopie.
2. **Trente minutes de panne chez l'éditeur ne bloquent aucune vente** — le commerce continue, les messages attendent, la livraison reprend au rétablissement.
3. **Une notification non signée, ou signée d'une autre clé, n'entre pas dans la file** (401) — appliqué à **tous** les connecteurs par la suite de conformité, pas seulement au premier.
4. **Le débranchement est réversible** — catalogue et stock intacts, secrets effacés, curseurs oubliés, correspondances conservées, commerçant qui reprend la main à la souris.

**Vérifié en plus des tests :** brancher un logiciel réel n'a modifié **aucun fichier** de `lib/orchestration/` ; `adapters/integration.js` est resté l'emplacement vide qu'il était. La Loi 16 a tenu à l'épreuve du réel.

**Côté commerçant :** un module « Mes logiciels » dans la famille *Piloter* de l'Épée, qui **ne nomme aucun éditeur** — il lit la description que le backend donne de chaque connecteur et la dessine. Le collage de catalogue y figure au même niveau que les logiciels : c'est le repli quand une connexion échoue, et le cas majoritaire des commerçants approchés d'abord.

**Ce qui n'est pas fait, et qu'il faut savoir avant de croire l'étape terminée :** aucun roulement de la clé maîtresse du coffre (la remplacer oblige à reconnecter, ce qui est **dit** grâce à l'empreinte) ; aucun budget d'appels par éditeur ; le rafraîchissement de jeton est écrit mais **non éprouvé** (le premier éditeur délivre un jeton sans expiration) ; une vente Ma Zone n'apparaît pas comme commande chez l'éditeur (choix assumé) ; la version d'API épinglée doit être revue avant le **30/04/2027**, ce qu'un test rappelle ; l'écran mobile n'est couvert par aucun test, faute de harnais mobile. Détail et position : `CURRENT_ARCHITECTURE.md` §10, dettes 14 à 19.

---

*Fiche générée depuis `_TEMPLATE.md` — amendée Cursor Reda 24/07/2026 soir, puis 25/07/2026 (pivot Organe d'Orchestration, résultats E0 → E7, puis famille de connecteurs E8) — valider avec Adam.*
