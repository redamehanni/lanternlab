# Ma Zone — Architecture actuelle

> Document de référence décrivant **l'état réel du code** au 25 juillet 2026, pas l'architecture cible.
> Stack : **Expo / React Native** (`mobile/`) + **Node.js / Express / SQLite** (`backend/`).

**Deux documents, deux rôles, ne pas les confondre.**

| Document | Répond à |
|---|---|
| **Celui-ci** | « Qu'est-ce qui existe aujourd'hui, et où ? » |
| `ROADMAP_ORGANE_ORCHESTRATION_MAZONE.md` (racine) | « Où va-t-on, selon quelles lois, dans quel ordre ? » — **document maître** |

En cas de contradiction entre ce document et le code, **le code et les tests tranchent**, et ce document doit être corrigé le jour même. Un document d'état en retard sur le code est plus nuisible qu'aucun document : il fait prendre des décisions sur une fiction.

**Où en est le chantier.** Les étapes **E0 à E8** de la roadmap sont livrées. E8 a ajouté une **famille de connecteurs** et son premier représentant, Shopify. Le récit des décisions et des écarts est dans `FICHE_DISCUSSION/FD-001-chantier-fondation-api-logiciels-commerciaux.md`.

---

## 1. Vue d'ensemble

```
┌─────────────────┐     HTTP REST + JWT      ┌──────────────────────────────┐
│  App mobile     │ ◄──────────────────────► │  backend/src/app.js          │
│  (3 rôles)      │     Socket.io (JWT auth) │  Express + Socket.io :4000   │
└─────────────────┘                          └──────────────┬───────────────┘
                                                            │
                                                            ▼
                                               ┌──────────────────────────────┐
│ SQLite backend/data/mazone.db│
                                               └──────────────────────────────┘
```

| Couche | Technologie |
|--------|-------------|
| Mobile | Expo, React Navigation (tabs + stacks), Axios, socket.io-client |
| API | Express, better-sqlite3, JWT, Socket.io, helmet, rate limiting |
| Persistance | SQLite WAL, `busy_timeout = 5000`, migrations incrémentales au démarrage |
| Temps réel | Socket.io avec rooms par utilisateur / boutique / commande / conversation |
| Tests | `node:test` (natif) — `npm test` dans `backend/` |

**Rôles utilisateur** : `client` | `merchant` | `driver` (table `users.role`). Les administrateurs vivent dans une table séparée (`admin_users`) avec un secret JWT distinct : un jeton citoyen n'est jamais accepté sur une route admin.

**`backend/src/index.js` démarre, `backend/src/app.js` construit.** La séparation existe pour que les tests montent un serveur complet sans lancer le processus.

---

## 2. Architecture en couches

C'est la lecture la plus utile du backend depuis les étapes 2 à 6, et elle se résume en une règle : **une couche ne saute jamais par-dessus la suivante.**

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ROUTES                                                                  │
│  src/routes/v1/  → contrat public versionné : intentions + projections   │
│  src/routes/     → surface historique /api, dépréciée (fin 31/01/2027)   │
│  Traduisent HTTP. Ne décident rien, ne composent rien.                   │
└───────────────┬──────────────────────────────────┬───────────────────────┘
                │ action multi-organe              │ action mono-organe
                ▼                                  │
┌──────────────────────────────────────────┐        │
│  ORCHESTRATION  src/lib/orchestration/   │        │
│  Déclare des INTENTIONS, exécute des     │        │
│  plans, compense, journalise.            │        │
│  Ne parle à AUCUN logiciel tiers.        │        │
└───────────────┬──────────────────────────┘        │
                ▼                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  ORGANES  orders/ · inventory/ · catalog/ · eventEngine/ · walletEngine  │
│  Décident. Chacun possède ses tables et son journal.                     │
└───────────────┬──────────────────────────────────────────────────────────┘
                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  NOYAU  src/lib/kernel/    bus · journal · idempotency · txn             │
│  Primitives. Ne décide rien.                                             │
└──────────────────────────────────────────────────────────────────────────┘

        ┌──────────────────────────────────────────────────────────┐
        │  INTEGRATION ENGINE  src/lib/integration/                │
        │  SEUL à traverser la frontière vers un logiciel tiers.   │
        │  Se DÉCLARE à l'orchestration ; elle ne le connaît pas.  │
        └──────────────────────────────────────────────────────────┘
```

### 2.1 Le sens des dépendances, et pourquoi il compte

L'Integration Engine connaît l'orchestration et lui déclare ce qu'il sait faire. **L'inverse n'existe pas.** `lib/orchestration/adapters/integration.js` est un **emplacement vide** : il nomme trois opérations (`pushSale`, `pushCancel`, `pushStockMovement`) sans les mettre en œuvre et sans importer quoi que ce soit.

**Ce qui est réellement garanti, et par quoi.** Trois vérifications tiennent la frontière, et aucune ne repose sur la discipline de qui code :

1. **Aucun fichier de `lib/orchestration/` n'importe l'Integration Engine** — test structurel + contrôle CI.
2. **Une vente aboutit sans aucun connecteur branché**, l'étape externe étant **reportée** au commerçant — test `order.place` avec capacités vides.
3. **Un connecteur retiré du code alors que des boutiques l'ont encore branché ne casse rien** — la vente passe, l'étape est reportée.

**E8 a mis cette frontière à l'épreuve, et elle a tenu** : brancher un logiciel réel — autorisation déléguée, lecture de catalogue, notifications signées, poussée de stock — n'a modifié **aucun fichier** de `lib/orchestration/`. `adapters/integration.js` est resté l'emplacement vide qu'il était.

Il en découle que retirer un logiciel tiers est un **débranchement**, pas une réécriture. C'est la condition de la substitution progressive : le jour où un plan d'intention suppose l'existence d'un logiciel externe, remplacer ce logiciel cesse d'être un geste local.

### 2.2 Ce que chaque couche ne fait pas

| Couche | Ne fait **jamais** |
|---|---|
| Route | Décider, composer deux organes, écrire du SQL métier |
| Route `/api/v1` | Écrire hors d'une intention, sauf action **mono-organe** · exposer `on_hand` à un client |
| Orchestration | Contenir une règle métier, parler à un logiciel tiers, s'imposer pour une action mono-organe |
| Organe | Connaître un logiciel tiers, écrire les tables d'un autre organe |
| Noyau | Décider quoi que ce soit |
| Connecteur | Créer, annuler ou valider une entité métier · importer la base, un organe ou le coffre à secrets · appeler le réseau autrement que par `ctx.request` |
| Cœur (CDM, organes, orchestration, API, moteur d'intégration) | **Nommer un éditeur** (Loi 17, vérifiée en CI) |

---

## 3. Les organes

### 3.1 Noyau — `src/lib/kernel/`

Quatre primitives, extraites de code qui les dupliquait trois fois (Event, Wallet, Identity).

| Fichier | Rôle |
|---|---|
| `bus.js` | Transporte des faits **déjà arrivés**. Une erreur d'abonné n'interrompt jamais l'opération métier |
| `journal.js` | Écrit et relit un historique **append-only**. N'interprète rien |
| `idempotency.js` | Répond « déjà fait, voici le résultat » (table `idempotency_keys`) |
| `txn.js` | Garantit l'ordre **commit → effets**. Seul autorisé à retenir une émission socket |

`src/lib/eventEngine/bus.js` est devenu un **réexport mince** du bus du noyau : aucun appelant historique n'a été modifié.

### 3.2 Organe Orders — `src/lib/orders/`

Remplace l'ancien fichier unique `src/lib/orders.js` (supprimé). `require('../lib/orders')` résout vers `index.js`, donc les appelants historiques fonctionnent sans modification.

| Fichier | Rôle |
|---|---|
| `lifecycle.js` | Graphe de transitions explicite, **fail-fast** |
| `orderEngine.js` | Créer, transiter, annuler — transactionnel, journalisé |
| `orderJournal.js` | Table `order_journal` (append-only) |
| `placement.js` | Panier : plusieurs articles, échec partiel assumé |
| `projection.js` | `getFullOrder()` — vue enrichie |
| `subscribers.js` | **Effets de bord après commit** : sockets, notifications, conversations |

### 3.3 Organe Inventory — `src/lib/inventory/`

Le stock est à **triple état**. C'est la correction de la survente, et la raison d'être de l'étape 4.

```
available = max(0, on_hand - reserved - safety_buffer)
```

| Attribut | Propriétaire |
|---|---|
| `on_hand` | Ma Zone en mode `mazone` · **miroir** de la caisse en mode `pos` |
| `reserved` | **Toujours** Ma Zone. Aucune caisse ne sait ce que Ma Zone a promis à un client |
| `safety_buffer` | Ma Zone (politique commerciale du magasin) |
| `available` | **Calculé, jamais stocké** |

Opérations : `reserve`, `release`, `commit`, `adjust`, `syncOnHand`, `declareSellable`. Chaque mouvement est journalisé dans `stock_movements` **dans la même transaction** que l'écriture du niveau.

**`products.quantity` est devenu une projection de `available`.** Le mobile continue de le lire sans avoir été modifié. Un seul module l'écrit (vérifié en CI).

**Propriété du stock, depuis l'étape 6 :** en mode `mazone`, un connecteur qui déclare un `on_hand` est **refusé** (409) et l'Integration Engine en fait un conflit visible. La propriété du stock se donne, elle ne se prend pas — brancher une caisse ne change pas les quantités du commerçant à son insu.

### 3.4 Organe Catalog — `src/lib/catalog/`

**Périmètre volontairement étroit** : la déclaration d'un produit (création ou mise à jour par référence) et sa mise en vente. Créé à l'étape 6 pour que le connecteur d'import n'écrive pas lui-même dans `products`.

> **Dette connue et bornée :** deux chemins d'écriture coexistent sur `products` — l'Épée par `routes/products.js`, la déclaration en masse par cet organe. Aucun des deux n'écrit `quantity`.

### 3.5 Organe d'Orchestration — `src/lib/orchestration/`

| Fichier | Rôle |
|---|---|
| `intentRegistry.js` | Déclaration des intentions, **validée au démarrage** (un plan faux empêche le serveur de démarrer) |
| `processManager.js` | Exécute le plan, **compense en ordre inverse**, journalise chaque pas |
| `capabilities.js` | Une capacité dit « cette boutique sait faire ceci », jamais par quel logiciel |
| `organs.js` | Annuaire `organe.action` → fonction (résolution paresseuse) |
| `journal.js` | Table `orchestration_journal` |
| `adapters/` | Délégations minces vers les organes ; `integration.js` est un **emplacement vide** |

**Les six intentions déclarées, avec leur plan réel :**

| Intention | Plan (dans l'ordre) |
|---|---|
| `order.place` | `orders.create` *(compense : cancel)* → `dispatch.findDriver` → `integration.pushSale` *(optionnelle)* |
| `order.cancel` | `orders.assertClientOwns` → `orders.cancel` → `dispatch.reassignFreedDrivers` → `integration.pushCancel` *(optionnelle)* |
| `product.reserve` | `inventory.reserve` *(compense : release)* → `notifications.notifyReservation` → `integration.pushStockMovement` *(optionnelle)* |
| `store.close_exceptionally` | `catalog.deactivateStoreProducts` *(compense : reactivateProducts)* → `events.announceClosure` *(compense : retractAnnouncement)* → `notifications.notifyOpenOrders` |
| `event.claim_opportunity` | `events.loadOpportunity` → `wallet.claimOpportunity` *(compense : revokeClaimedObject)* → `events.markOpportunityAccepted` |
| `catalog.declare_product` | `catalog.declareProduct` → `inventory.declareSellable` |

**Lire un plan.** Une étape `optional` avec un `requires` est **reportée** quand la boutique n'a pas la capacité : la vente aboutit et ce qui n'a pas pu être fait est dit au commerçant. Une étape avec un `compensate` est défaite si une étape ultérieure échoue, **en ordre inverse**. Une étape sans compensation est soit lisible seulement, soit idempotente — jamais un oubli.

**Une intention commence à deux organes** (Loi 5). Le registre **refuse** une intention mono-organe : une action qui ne concerne qu'un organe s'adresse à cet organe directement. L'orchestration n'est pas un passage obligé, sinon elle devient un goulot et un god object.

### 3.6 Integration Engine — `src/lib/integration/`

Le moteur d'intégration est **une famille de mécanismes**, pas une collection d'intégrations. Depuis E8, il possède tout ce qui est commun à n'importe quel éditeur du marché, et rien de ce qui est propre à l'un d'eux.

| Fichier | Rôle |
|---|---|
| `contract.js` | Contrat Connector : capacités, **modes de connexion**, secrets exigés. Une capacité annoncée sans sa mécanique, ou un connecteur qu'on ne pourrait pas connecter, **empêchent le démarrage** |
| `connectorRegistry.js` | Sixième registre de Ma Zone. Un connecteur se **déclare**, il ne se câble pas |
| `installations.js` | Quel connecteur est branché sur quelle boutique (`integration_installations`), et le **débranchement** qui rend la procuration |
| `bindings.js` | `external_bindings` — **seul endroit du système** où vit un identifiant externe |
| `conflicts.js` | `sync_conflicts` — ce que Ma Zone a refusé, et pourquoi |
| `outbox.js` | File sortante : **6 tentatives**, backoff exponentiel depuis 15 s, puis **lettre morte** |
| `inbox.js` | File entrante : **5 tentatives**, backoff depuis 10 s. Déduplication en base, traitement asynchrone |
| `worker.js` | **Exactement un worker par file**, garanti par un bail en base qui expire |
| `sync.js` | Livraison sortante (**asynchrone** depuis E8) et ingestion entrante |
| `importer.js` | Inspection et import d'un fichier — parse, ne déclare pas |
| `declare.js` | **E8** : déclaration canonique d'un produit, partagée par tous les connecteurs. Le CSV a cessé d'être un chemin privilégié |
| `secrets.js` | **E8** : coffre AES-256-GCM. Clé maîtresse en environnement, **empreinte** de clé stockée à côté de chaque secret, purge au débranchement |
| `http.js` | **E8** : le **seul** transport sortant. Délai d'attente, 429 avec `Retry-After`, classification réessayable / définitif, **injectable** (d'où des tests hors ligne) |
| `signature.js` | **E8** : vérification HMAC à **temps constant**. Algorithme, encodage et en-tête déclarés par le connecteur |
| `oauth.js` | **E8** : flux *authorization code* générique. Jeton d'état à **usage unique** par écriture conditionnelle, `redirect_uri` construite par le moteur, échange, rafraîchissement optionnel |
| `cursors.js` | **E8** : `integration_cursors` — où en était la dernière lecture, par ressource |
| `puller.js` | **E8** : lecture incrémentielle (20 pages au plus par passe) et **réconciliation** périodique. Lit et enfile ; ne décide rien |
| `context.js` | **E8** : ce qu'un connecteur reçoit — `request`, `credentials` (déchiffrés **paresseusement**), `externalIdFor`, `updateConfig`. Il ne va rien chercher lui-même |
| `connectors/manual.js` | Le chemin du tableur : CSV et export |
| `connectors/shopify/` | **E8** : premier logiciel du marché. 4 fichiers, **tout le dialecte confiné ici** |

**Le connecteur `manual` n'est pas un jouet** : c'est le cas majoritaire des commerçants que Ma Zone adresse d'abord — un cahier ou un tableur. Il valide le contrat sans dépendre d'une API que nous ne contrôlons pas, et il reste le repli quand une connexion échoue.

**Trois modes de connexion, déclarés et pas devinés.** `delegated` (redirection chez l'éditeur), `credentials` (le commerçant colle une paire de clés) et `none`. Le second n'est pas un cas dégradé : une part importante des logiciels visés ne délivre pas de jeton par redirection. Un moteur qui ne connaîtrait que la redirection obligerait le connecteur suivant à **simuler un flux qui n'existe pas chez lui**.

**Webhooks :** `POST /api/integration/webhooks/:connectorId`, réponse **202** immédiate, aucun traitement dans la requête. La vérification appartient au connecteur — le moteur exige un verdict et n'accepte que « oui » —, et un connecteur qui ne sait pas vérifier reçoit **501**. Une notification non prouvée reçoit **401** et n'entre pas dans la file.

**Le coffre existe, et le refus d'E6 a changé de nature.** Un connecteur exigeant des identifiants ne se branche plus « faute de coffre » (501) mais **faute d'identifiants rangés** (409) : ils se déposent d'abord, par la connexion du logiciel, et le branchement les constate. Un jeton d'éditeur est une **procuration** : le débranchement l'efface et oublie les curseurs, tout en conservant les correspondances — sans elles, rebrancher recréerait des doublons chez l'éditeur.

#### Le premier connecteur — `connectors/shopify/`

| Fichier | Ce qu'il contient de propre à cet éditeur |
|---|---|
| `api.js` | Chemins d'URL, **version d'API épinglée** (`2026-07`, revue avant le **30/04/2027**), en-tête de jeton, pagination par curseur opaque |
| `mapping.js` | Variantes **aplaties**, `inventory_item_id` comme identité, HTML nettoyé, prix décimal |
| `webhooks.js` | Noms d'en-têtes, sujets d'abonnement, deux schémas de signature (notification et redirection) |
| `index.js` | L'assemblage : descripteur d'autorisation, capacités, abonnements idempotents |

**Deux décisions de ce connecteur méritent d'être connues**, parce qu'elles ne se devinent pas :

1. **L'identité externe d'un produit est son `inventory_item_id`**, pas la variante. C'est le seul identifiant présent dans **tous** les flux de cet éditeur ; choisir la variante aurait produit un catalogue parfait suivi de **chaque** notification de stock refusée en `unmapped_entity`.
2. **Une vente Ma Zone n'est pas une commande Shopify.** Elle est transmise comme un **ajustement relatif de stock**. Créer une commande entrerait dans la comptabilité d'un commerçant qui n'a rien demandé : numérotation fiscale, rapports de chiffre d'affaires, courriels de confirmation.

**Le mode `pos` est exercé pour la première fois**, et le compte est vérifié : une vente de 2 unités sur un stock de 10 laisse **8**, jamais 6. Ma Zone baisse `reserved`, l'éditeur baisse son stock physique, Ma Zone le recopie.

### 3.7 CDM — `src/lib/cdm/`

Dictionnaire métier interne : entités, types, et **propriété par attribut** (`owner` | `mirror` | `calculated`). **Aucun accès à la base** (vérifié en CI) — c'est un vocabulaire, pas un stockage.

Un attribut sans propriétaire déclaré **empêche le démarrage**. Deux tests comparent en permanence le CDM au schéma SQLite réel : un dictionnaire qui décrit une base qui n'existe plus est pire qu'aucun dictionnaire.

### 3.8 Organes antérieurs, inchangés

`eventEngine/` (initiatives, diffusions, opportunités), `walletEngine/`, `identityEngine/`, `communicationEngine/`, `worldFactory/` et `lab/` (bac à sable, **verrouillé en production**) fonctionnent comme avant. L'Event Engine a fourni le patron de registre que les cinq autres ont suivi.

---

## 4. Base de données — 45 tables

`backend/src/db/index.js` crée le schéma et applique les migrations au démarrage. Chaque organe crée ses propres tables au premier `require`.

### 4.1 Tables métier historiques

`users` · `stores` · `store_members` · `products` · `orders` · `missions` · `cart_items` · `promotions` · `conversations` · `messages` · `conversation_reads` · `client_addresses` · `store_favorites` · `driver_broadcast` · `driver_notifications` · `merchant_notifications` · `support_threads` · `support_messages` · `admin_users` · `demo_batches` · `demo_entities`

### 4.2 Tables des organes récents

| Table | Organe | Contenu |
|---|---|---|
| `stock_levels` | Inventory | `on_hand`, `reserved`, `safety_buffer`, `inventory_owner` |
| `stock_movements` | Inventory | Journal append-only de chaque mouvement, avec l'état résultant |
| `order_journal` | Orders | Chaque décision de commande |
| `catalog_journal` | Catalog | Chaque déclaration de produit |
| `orchestration_journal` | Orchestration | Chaque pas de chaque intention (`run_id`, `step`, `status`) |
| `idempotency_keys` | Noyau | « Déjà fait, voici le résultat » |
| `integration_installations` | Integration | Connecteurs branchés par boutique |
| `external_bindings` | Integration | Correspondances Ma Zone ↔ identifiants externes |
| `sync_conflicts` | Integration | Refus opposés à une source externe, avec leur raison |
| `integration_outbox` | Integration | File sortante (`pending` / `sent` / `dead`) |
| `integration_inbox` | Integration | File entrante (`received` / `processed` / `rejected` / `dead`) |
| `integration_workers` | Integration | Baux de worker (unicité) |
| `integration_secrets` | Integration | **E8** : identifiants tiers **chiffrés** (AES-256-GCM) + empreinte de la clé maîtresse |
| `integration_oauth_states` | Integration | **E8** : jetons d'état d'autorisation, à usage unique, durée de vie 10 min |
| `integration_cursors` | Integration | **E8** : où en était la dernière lecture, par boutique / connecteur / ressource |

Tables de l'Event Engine et des organes citoyens : `events` · `event_journal` · `event_diffusions` · `event_subscriptions` · `event_opportunity_inbox` · `digital_objects` · `digital_object_events` · `identity_events` · `identity_presentations`.

### 4.3 Statuts

**Commande** — le graphe vit dans `src/lib/orders/lifecycle.js` (le vocabulaire reste dans `src/lib/orderStatus.js`). Il est **déclaratif et fail-fast** : une transition non déclarée est refusée. Avant l'étape 3, aucun graphe n'existait et `delivered → picking_up` était accepté — une commande livrée pouvait repartir en préparation.

```
placed ──► pending_driver ──► driver_assigned ──► picking_up ──► picked_up ──► delivering ──► delivered
                  ▲                  │                 │
                  └──────────────────┴─────────────────┘   retour en file si un livreur abandonne
                                                            avant d'avoir récupéré le colis

cancelled : atteignable depuis placed, pending_driver, driver_assigned, picking_up — PLUS APRÈS.
```

Deux arêtes méritent d'être connues. **`picking_up → pending_driver`** est le retour en file d'attente : sans elle, la commande resterait bloquée sur un livreur qui ne viendra jamais. Et **`picked_up` ferme l'annulation** : le colis est sorti de la boutique, la commande ne peut plus qu'aboutir.

**Alias legacy normalisés au démarrage** : `pending`, `searching_driver`, `offered` → `pending_driver` ; `accepted`, `accepted_by_driver` → `driver_assigned`. Ne pas s'appuyer sur ces alias comme statuts stables.

**Mission** (`missions.status`) : `available` · `offered` · `accepted` · `picking_up` · `picked_up` · `delivering` · `delivered` · `cancelled`. Missions **actives** bloquant le dispatch : `accepted`, `picking_up`, `picked_up`, `delivering`.

---

## 5. Flux d'une commande

```
CLIENT                    BACKEND                                LIVREUR
  │                          │                                      │
  │ POST /api/orders         │                                      │
  ├────────────────────────►│ routes/orders.js (traduit)           │
  │                          │   └─► orchestration.run('order.place')
  │                          │         1. orders.create             │
  │                          │            (transaction : commande,  │
  │                          │             réservation de stock,    │
  │                          │             journal)                 │
  │                          │         2. dispatch.findDriver       │
  │                          │         3. integration.pushSale      │
  │                          │            (optionnelle, selon       │
  │                          │             capacité de la boutique) │
  │                          │                                      │
  │                          │ APRÈS COMMIT — subscribers.js :      │
  │◄── order:status_updated ─┤   sockets, notifications, chat       │
COMMERÇANT ◄── order:new ────┤                                      │
  │                          │ Socket mission:assigned ────────────►│
  │                          │                                      │
  │                          │      PATCH /api/missions/:id/status  │
  │                          │◄─────────────────────────────────────┤
  │                          │ Si delivered : dispatch de la file   │
```

**Deux garanties nouvelles, à ne pas défaire.**

1. **Rien ne sort avant le commit.** Sockets et notifications sont émis par des abonnés, après la transaction. Une transaction annulée ne laisse plus derrière elle une notification pour une commande qui n'existe pas.
2. **La réservation de stock et la création de commande sont dans la même transaction.** Deux ventes simultanées sur la dernière unité ne passent plus toutes les deux — c'est testé.

**Ce que le client reçoit en plus :** un champ `pending`. Il liste ce que Ma Zone n'a **pas** pu faire (typiquement : la vente n'a pas été poussée vers le logiciel du commerçant, faute de connecteur). Ce qui n'a pas pu être fait est dit, jamais tu.

**Dispatch** (`src/lib/dispatch.js`, `src/lib/dispatchOffer.js`) : un livreur est éligible si `role = 'driver'`, `driver_online = 1`, et aucune mission active. Sinon la commande reste en `pending_driver` (file d'attente).

---

## 6. Socket.io

Fichier : `src/socket/handlers.js`.

| Room | Qui rejoint |
|---|---|
| `user_{id}` | Tous, à la connexion |
| `merchant_{id}` · `store_{storeId}` | Commerçants et membres de boutique |
| `drivers_available` | Livreurs **en ligne uniquement** |
| `order_{orderId}` | Sur `join:order`, **après contrôle d'accès** |
| `conv_{conversationId}` | Sur `join:conversation`, **après contrôle d'accès** |

> **Correctif d'étape 1 :** rejoindre une room de commande ou de conversation est désormais **autorisé** par `src/lib/access.js`. Avant, n'importe quel utilisateur authentifié pouvait rejoindre `order_{id}` et y lire la position du livreur et l'adresse de livraison. Un test le vérifie (`test/security/access.test.js`).

**Les 24 événements émis par le serveur**, relevés dans le code :

| Domaine | Événements |
|---|---|
| Commande | `order:new` · `order:status_updated` · `order:cancelled` |
| Mission | `mission:offered` · `mission:assigned` · `mission:accepted` · `mission:status_updated` · `mission:taken` · `mission:cancelled` |
| Messagerie | `message:new` · `chat:typing` · `conversation:updated` |
| Catalogue et stock | `product:created` · `product:updated` · `product:deleted` · `product:stock_updated` · `stock:reserved` |
| Boutique | `store:created` · `store:updated` · `store:closed_exceptionally` |
| Promotions | `promotion:created` · `promotion:updated` · `promotion:deleted` |
| Initiatives | `event:opportunity` |

`product:stock_updated` porte désormais **`available` et `quantity`**, avec la même valeur (E7). Ajouter un champ est sans risque ; en renommer un aurait cassé les applications déjà installées. `quantity` disparaîtra avec la projection dont il est le reflet — date dans `backend/src/lib/sunset.js`, après la mort de `/api`.

---

## 7. API REST

Deux surfaces coexistent depuis E7, et c'est la dette principale de cette étape — **bornée par une date inscrite dans le code**.

| Surface | Rôle | Fin de vie |
|---|---|---|
| **`/api/v1`** (`src/routes/v1/`) | Contrat public versionné : **intentions** et **projections**, décrit par `backend/openapi/openapi.yaml` | — |
| `/api` (18 fichiers de `src/routes/`) | Surface historique, porte de tout ce qui n'a pas encore d'organe | **31/01/2027**, en-têtes `Deprecation` et `Sunset` sur chaque réponse |

### 7.1 `/api/v1` — 19 opérations

| Domaine | Opérations |
|---|---|
| Intentions | `GET /intents` · `GET /intents/{id}` · **`POST /intents/{id}`** · `GET /intents/runs/{runId}` |
| Catalogue (client) | `GET /stores` · `GET /stores/{id}` · `GET /stores/{id}/products` · `GET /products/{id}` |
| Inventaire (boutique) | `GET /inventory?store_id=` · `GET /inventory/{productId}` · **`PATCH /inventory/{productId}`** · `GET /inventory/{productId}/movements` |
| Commandes | `GET /orders?store_id=` · `GET /orders/mine` · `GET /orders/{id}` · `GET /orders/{id}/journal` |
| Livraisons | `GET /deliveries/mine` |
| Intégrations | `GET /integrations` · `GET /integrations/{connectorId}/conflicts` |

**Deux écritures seulement, et les deux sont justifiées.** `POST /intents/{id}` pour toute action multi-organe ; `PATCH /inventory/{productId}` parce qu'un stock ne concerne qu'un organe (Loi 5). Une troisième porte est refusée par la CI.

| Règle de la surface v1 | Mécanisme |
|---|---|
| `Idempotency-Key` **obligatoire** sur une intention (**400** sans elle, 8 caractères minimum) | `routes/v1/intents.js` + test |
| Aucune réponse client ne contient `on_hand`, `reserved`, `safety_buffer`, `inventory_owner` | Listes blanches dans `routes/v1/projections.js`, garde récursif qui **échoue en 500** plutôt que de laisser fuir, balayage de toutes les routes client en test, contrôle CI sur le code |
| `PATCH /inventory` déclare des valeurs **cibles**, jamais des deltas | Rejeu sans danger, donc aucune clé exigée. Tient la promesse écrite dans `inventoryEngine.js` à E4 |
| Un tiers reçoit **404**, jamais 403 | `lib/access.js`, partagé avec `/api` et les sockets |
| Chaque réponse porte `MaZone-Api-Version: v1` | `routes/v1/index.js` |

### 7.2 `/api` — surface historique

| Préfixe | Contenu |
|---|---|
| `/api/auth` | Inscription, connexion (rate limiting renforcé) |
| `/api/users` · `/api/stores` · `/api/products` | Identité, boutiques, catalogue et stock |
| `/api/orders` | Commandes, panier, annulation, journal, trace d'orchestration |
| `/api/intents` | Intentions (E5), **clé d'idempotence optionnelle** ici, contrairement à v1 |
| `/api/integration` | « Mes logiciels » : branchement, **connexion déléguée et retour d'autorisation (E8)**, import CSV, export, réconciliation, conflits, lettres mortes, webhooks |
| `/api/missions` · `/api/drivers` | Livraison, disponibilité, revenus (commission **5 %**) |
| `/api/messages` · `/api/conversations` · `/api/communication` | Messagerie (**trois piles**, voir §10) |
| `/api/cart` · `/api/favorites` · `/api/promotions` · `/api/merchants` | Achat et commerce |
| `/api/wallet` · `/api/identity` · `/api/events` | Organes citoyens |
| `/api/admin` | Back-office, bac à sable, **santé des files de synchronisation** |

**Routes utiles à connaître :**

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/api/orders` | Client — passe par l'intention `order.place` |
| POST | `/api/orders/cart` | Client — panier, échec partiel possible |
| GET | `/api/orders/:id/journal` | Biographie d'une commande |
| GET | `/api/orders/:id/orchestration/:runId` | Trace d'une intention, pas à pas |
| POST | `/api/intents/:id` | Exécuter une intention déclarée |
| GET | `/api/integration/stores/:storeId` | État complet des logiciels d'une boutique, **formulaire de connexion inclus** — l'écran mobile ne connaît aucun éditeur |
| POST | `/api/integration/stores/:storeId/connect/:connectorId` | **E8** — commencer une connexion : renvoie une URL de consentement, ou branche directement |
| GET | `/api/integration/oauth/:connectorId/callback` | **E8** — retour du logiciel du commerçant. **Sans jeton Ma Zone** (c'est l'éditeur qui redirige un navigateur) : la preuve est le jeton d'état à usage unique. Répond une **page HTML**, pas du JSON |
| POST | `/api/integration/stores/:storeId/reconcile` | **E8** — « mon stock ne me paraît pas juste » : confronter Ma Zone et les logiciels |
| DELETE | `/api/integration/stores/:storeId/connectors/:connectorId` | **Débrancher** : suspend, efface les identifiants, oublie les curseurs. `?pause=1` suspend **sans** rendre la procuration |
| POST | `/api/integration/stores/:storeId/import` | Importer un catalogue CSV |
| GET | `/api/integration/stores/:storeId/export/sales` | Ventes à recopier en caisse (`?format=csv`) |
| GET | `/api/integration/stores/:storeId/conflicts` | Ce que Ma Zone a refusé, et pourquoi |
| GET | `/api/admin/integration/queues` | État des files + **seuil Postgres** (200 en attente) |
| GET | `/api/admin/api-usage` | **E7** : échéances de suppression + routes historiques encore appelées |

### 7.3 Ce qui va disparaître, et quand — `src/lib/sunset.js`

Deux échéances sont **inscrites dans le code**, pas dans un document :

| Ce qui meurt | Date | Remplacé par |
|---|---|---|
| Routes `/api` non versionnées | **31/01/2027** | `/api/v1` |
| Projection `products.quantity` | **30/04/2027** | `available` |

L'ordre est une contrainte : `products.quantity` alimente les écrans que sert `/api`, le supprimer avant afficherait « 0 en stock » sur des produits disponibles. Un test vérifie cet ordre, et **échoue lorsqu'une échéance est dépassée** — une date qui ne fait rien quand elle arrive n'est pas une date. La question « qui appelle encore cette route ? » se lit dans `GET /api/admin/api-usage` (compteurs en mémoire, par motif de route, remis à zéro au redémarrage).

---

## 8. Garde-fous automatiques

C'est la partie la plus récente et la plus utile à connaître avant de coder : **plusieurs lois d'architecture sont opposables, pas seulement écrites.**

### 8.1 Tests — `backend/test/`

**349 tests** (`npm test` dans `backend/`), dont :

| Fichier | Couvre |
|---|---|
| `flows/*.test.js` | Les 5 flux critiques (création, annulation, panier, offre, statuts mission) — **tests de caractérisation** écrits avant toute restructuration |
| `security/access.test.js` | Qui peut lire une commande, changer un statut, rejoindre une room |
| `kernel.test.js` · `orders.test.js` · `inventory.test.js` | Noyau et organes |
| `orchestration.test.js` | Intentions, compensation, idempotence, **contrôles structurels de la Loi 16** |
| `integration.test.js` | Import de 500 articles puis vente, files, DLQ, conflits, worker unique, webhooks |
| `connector-conformance.test.js` | **E8 — le vrai livrable de l'étape.** Énumère les connecteurs **enregistrés** et applique à chacun les mêmes exigences : déclaration cohérente, mode de connexion, aucun nom d'éditeur dans le vocabulaire du moteur, **notification non signée refusée**, **signature d'une autre clé refusée**, dialecte confiné. Le connecteur suivant hérite de sa suite de tests le jour où il s'enregistre |
| `shopify-connector.test.js` | **E8 — hors ligne**, transport factice : connexion déléguée complète, jeton d'état à usage unique, **zéro double décrément en mode `pos`**, **30 minutes de panne sans blocage de vente**, webhook non signé refusé, réversibilité du débranchement, **échéance de la version d'API** |
| `cdm.test.js` · `cdm-schema-drift.test.js` | Cohérence du dictionnaire avec le schéma réel |
| `api-v1.test.js` | **Parité contrat ↔ routes réelles dans les deux sens**, idempotence obligatoire, rejeu sans double vente, balayage anti-fuite de `on_hand`, accès, en-têtes de dépréciation, échéances de suppression |
| `openapi.test.js` · `env.test.js` | Le document pour lui-même (lois, CDM, écritures publiées) et le refus de démarrer sans secrets |

Le harnais (`test/helpers/testServer.js`) monte un vrai serveur sur une base temporaire et vide les tables entre chaque test. Les workers de synchronisation sont **éteints** en test : une boucle de fond rendrait les assertions non déterministes.

### 8.2 CI — `.github/workflows/ci.yml`

Au-delà des tests, la CI refuse un code qui viole une loi :

| Contrôle | Refuse |
|---|---|
| **Loi 1** | Un SDK tiers importé dans un organe |
| **Loi 4** | Un accès base dans le CDM |
| **Loi 5** | Une route d'organe qui décide · une règle métier dans un plan d'intention · **une écriture dans `routes/v1/` hors de `intents.js` et `inventory.js`** |
| **Loi 11** | Un second écrivain de `products.quantity` |
| **Loi 12** | **Un fichier de surface client de `routes/v1/` qui nomme `on_hand` ou `safety_buffer`** |
| **Loi 16** | Dans `lib/orchestration/` : un nom d'éditeur, un appel réseau, un jeton, un webhook, une traduction de format, un identifiant externe |
| **Loi 17** | **Un nom d'éditeur ailleurs que dans `connectors/<éditeur>/`** — partout dans `backend/src`, y compris dans le moteur d'intégration. La liste des éditeurs est **déduite des dossiers de connecteurs** : le prochain sera gardé sans que personne pense à l'ajouter |
| **Loi 17** | Un connecteur qui importe la base, un organe ou le coffre, ou qui appelle `fetch` |
| **E8** | `integration_secrets`, `createDecipheriv` ou `INTEGRATION_SECRET_KEY` hors du coffre : **un seul fichier** lit les procurations des commerçants |
| — | Un secret de développement historique réapparu en dur |

Les trois contrôles de l'étape 8 sont **jouables en local** avant de pousser — une règle qu'on découvre après un « push » est une règle qu'on contourne :

```bash
./scripts/check-loi-17.sh
```

---

## 9. Mobile — bascule commencée, un écran migré, un écran nouveau

**Aucun fichier de `mobile/` n'avait été modifié par les étapes E0 à E6.** E7 ouvre la bascule, **derrière un drapeau, écran par écran**, et `/api` reste la valeur par défaut : une application mobile ne se met pas à jour parce qu'un backend a été livré.

| Élément | État |
|---|---|
| `mobile/src/config.js` → `FEATURES.stockV1` | `false` par défaut · activation par `EXPO_PUBLIC_V1_STOCK=1` |
| `mobile/src/api/v1.js` | Client de la surface versionnée, séparé de `api/index.js` pour que l'avancement de la migration se lise en une recherche |
| `ManageStockScreen` (commerçant) | **Seul écran basculé.** Rendu inchangé ; les nombres viennent de `/api/v1/inventory`, le bouton `+` déclare une **cible** de stock physique, et le commerçant voit enfin « X en rayon · Y promis » |
| `MesIntegrationsScreen` (commerçant) | **E8 — « Mes logiciels »**, module de la famille *Piloter* de l'Épée. **Ne nomme aucun éditeur** : il lit la description que le backend donne de chaque connecteur (mode de connexion, champs à demander, portées) et la dessine. Le collage de catalogue y figure **au même niveau** que les logiciels, et le journal de conflits est visible |

**Pourquoi l'écran des logiciels ne connaît aucun éditeur.** C'est la condition pour que le prochain logiciel du marché n'ajoute **pas une ligne** au mobile — donc pour qu'il n'exige pas une nouvelle version de l'application dans les magasins. Un `if (connector.id === …)` dans cet écran transformerait chaque connecteur en livraison mobile.

**Pourquoi le commerçant d'abord.** C'est le seul rôle qui gagne quelque chose : la v1 sépare physique, promis et vendable, là où `/api` ne pouvait donner qu'un nombre et devait **deviner** ce que le commerçant voulait dire en le réenregistrant. Les écrans client ne gagneraient rien aujourd'hui — `available` leur arrive déjà sous le nom `quantity` — et migrer sans bénéfice serait du risque gratuit.

**Écart assumé avec la roadmap :** le critère « le mobile fonctionne sur `/api` et sur `/api/v1` avec les mêmes tests E2E » n'est **pas** vérifié mécaniquement — il n'existe aucun harnais de test mobile dans le projet. Les deux chemins sont éprouvés côté serveur ; le mobile l'est à la main.

### Client
Tabs : Accueil, Panier, Commandes, Menu. Écrans clés : `HomeScreen`, `OrderConfirmScreen`, `OrderTrackingScreen`, `ClientOrdersScreen`.

### Commerçant
Tabs : Boutique, Commandes, Boîte de réception, Profil. Écrans clés : `DashboardScreen`, `MerchantOrdersScreen`.

### Livreur
Tabs : Accueil, Revenu, Boîte de réception, Menu. Écran principal `DriverHomeScreen` (carte + bouton en ligne + `MissionDrawer`), contexte `DriverContext` (listener `mission:assigned`), carte `PremiumMap.native.js` / `.web.js`.

| Fichier | Responsabilité |
|---|---|
| `mobile/src/context/AppContext.js` | Auth, token, connexion socket |
| `mobile/src/context/DriverContext.js` | État livreur, listener `mission:assigned` |
| `mobile/src/components/driver/MissionDrawer.js` | Workflow course |
| `mobile/src/config.js` | URLs API, labels de statuts |
| `mobile/src/api/index.js` | Client HTTP Axios |

**Présents mais non branchés** : `NewCourseOfferModal.js`, `MissionsScreen.js`, `ActiveMissionScreen.js`.

---

## 10. Dette technique connue

À jour, honnête, et à ne pas redécouvrir par surprise.

| # | Dette | Position |
|---|---|---|
| 1 | **Une commande = un produit** (pas de table `order_items`). Un panier de N articles crée N commandes | **La dette la plus lourde.** Identifiée comme le choix le plus fragile de la roadmap. Correction non planifiée |
| 2 | **Deux chemins d'écriture sur `products`** (Épée, organe Catalog) | Bornée ; aucun des deux n'écrit `quantity` |
| 3 | **Un seul worker par file** — point de défaillance et plafond de débit | Assumé tant que la base est SQLite. **Déclencheur chiffré : plus de 200 messages en attente de façon soutenue → discussion Postgres.** Visible dans `/api/admin/integration/queues` |
| 4 | **Messagerie en triple pile** (`/api/messages`, `/api/conversations`, `/api/communication`) | **Volontairement absente de `/api/v1`** : trois formes concurrentes rendent la question « laquelle publier ? » sans réponse. À trancher avant la fin de vie de `/api` |
| 5 | ~~`external_bindings` sans connecteur réel~~ | **Payée (E8)** : la table est exercée par un logiciel réel. Elle a révélé un manque — une correspondance créée par une lecture de catalogue n'a pas d'établissement, alors qu'une notification de stock en porte un — traité par `bindings.resolveForOutlet` (repli sur la correspondance sans établissement) |
| 6 | **File d'attente silencieuse** : livreur hors ligne ou occupé → la commande reste `pending_driver` sans erreur visible côté client | Comportement d'origine, non corrigé |
| 7 | **Mode `pos` éprouvé contre un logiciel factice, pas contre une vraie boutique** | **Partiellement payée (E8)** : le compte « 10 − 2 = 8 » est vérifié de bout en bout, panne de 30 minutes comprise. Reste à confronter à une boutique réelle : quotas d'appel réels, latence de notification, établissements multiples |
| 8 | **Mission fantôme** : une mission `accepted` en base bloque `findAvailableDriver()` même quand l'interface livreur paraît libre (tiroir fermé) | Comportement d'origine, non corrigé. Vérifier la base avant de conclure à un bug de dispatch |
| 9 | **Réseau mobile** : `mobile/src/config.js` utilise `localhost` / `10.0.2.2` ; un téléphone physique exige `EXPO_PUBLIC_API_URL` | Inchangé |
| 10 | **Deux API en parallèle** pendant plusieurs mois, donc deux formes de réponse à maintenir | **Bornée** : date de mort dans `lib/sunset.js`, en-têtes `Sunset`, compteur d'usage par route, test qui échoue à l'échéance |
| 11 | **Compteurs d'usage en mémoire** : un redémarrage les remet à zéro | Assumé — une écriture SQLite par requête pour de la télémétrie serait un mauvais échange sur une base à un seul écrivain. Répond quand même à « cette route est-elle encore appelée ? » |
| 12 | **`PATCH /api/v1/inventory` : dernier écrivain gagne** si deux membres d'une équipe modifient le même produit en même temps (l'API historique, en deltas, additionnait) | Compromis choisi : le réessai réseau est bien plus fréquent que la saisie simultanée, et l'écran affiche toujours la valeur retenue par le serveur |
| 13 | **Livraison, panier, messagerie, portefeuille, identité absents de `/api/v1`** | Volontaire : on ne versionne que ce qui est passé derrière un organe. Publier une forme qu'on sait devoir refaire, c'est s'interdire de la refaire |
| 14 | **La clé maîtresse du coffre ne se remplace pas encore sans casse** : la changer rend illisibles tous les jetons rangés, et chaque commerçant doit reconnecter | Borné et **dit** : une empreinte de clé est stockée à côté de chaque secret, donc le message est « reconnectez votre logiciel », pas une erreur de déchiffrement. Un vrai roulement (déchiffrer avec l'ancienne, rechiffrer avec la nouvelle) reste à écrire |
| 15 | **Aucun budget d'appels par éditeur** : le moteur respecte un `Retry-After` reçu mais n'anticipe pas un quota | Suffisant à un connecteur et à des volumes de démarrage ; deviendra faux avec plusieurs boutiques actives sur le même éditeur. Le point d'ajout est unique (`integration/http.js`), ce qui est la raison d'exister de ce fichier |
| 16 | **Le rafraîchissement de jeton n'est exercé par aucun logiciel réel** : le premier connecteur délivre un jeton sans expiration | La mécanique est écrite et générique, mais **non éprouvée**. À ne pas croire acquise au branchement d'un éditeur qui, lui, fait expirer ses jetons |
| 17 | **Une vente Ma Zone n'apparaît pas comme une commande chez l'éditeur**, seulement comme un mouvement de stock | Choix assumé (§3.6) : ne pas polluer la comptabilité d'un commerçant. Conséquence : son chiffre d'affaires Ma Zone se lit dans Ma Zone, pas dans son logiciel. À rediscuter si un commerçant demande l'inverse — ce serait alors une **capacité déclarée**, pas un changement du cœur |
| 18 | **La version d'API du premier connecteur est épinglée à `2026-07` et doit être revue avant le 30/04/2027** | Un test **échoue** à l'approche de l'échéance. Le mécanisme est propre à ce connecteur : chaque éditeur a son propre rythme de dépréciation, et le cœur n'a pas à connaître ces calendriers |
| 19 | **L'écran « Mes logiciels » n'est couvert par aucun test** | Même écart que E7 : il n'existe aucun harnais de test mobile. Le backend qui le nourrit est testé ; l'écran est éprouvé à la main |

---

## 11. Démarrage local

```bash
# Terminal 1 — API
cd backend && npm start          # → http://localhost:4000

# Terminal 2 — Mobile
cd mobile && npm run ios         # Expo

# Tests (avant tout commit)
cd backend && npm test

# Sauvegarde de la base
cd backend && npm run backup
```

```bash
# Contrôles d'architecture jouables en local (étape 8)
./scripts/check-loi-17.sh
```

**Variables d'environnement.** En production, l'absence de `JWT_SECRET` ou `ADMIN_JWT_SECRET` **fait échouer le démarrage** — c'est délibéré, et testé. En développement, `backend/src/config/env.js` **génère** des secrets aléatoires et les conserve dans `backend/data/.dev-secrets.json` (gitignoré) : stables entre deux redémarrages, donc les sessions survivent, sans qu'aucun secret ne soit committé. Les deux secrets de développement historiques — publics, donc compromis — ne peuvent plus réapparaître : la CI le vérifie.

Base de données : `backend/data/mazone.db` (créée automatiquement). `MAZONE_DB_PATH` permet d'en ouvrir une autre — c'est ce que fait chaque fichier de test, sur une base jetable qui lui est propre.

**Variables des intégrations (E8), toutes documentées dans `backend/.env.example`** :

| Variable | Absente ⇒ |
|---|---|
| `INTEGRATION_SECRET_KEY` (32 octets base64) | Le démarrage réussit ; c'est le **branchement** d'un logiciel exigeant des identifiants qui refuse. Une instance sans aucun logiciel à connecter n'a pas de raison de refuser de démarrer — mais **ne pas perdre cette clé** (dette 14) |
| `PUBLIC_BASE_URL` | Les connexions déléguées refusent de commencer, **en nommant la variable**. Elle n'est jamais déduite de `Host` ni de `X-Forwarded-Host` : une URL de redirection choisie par l'appelant est un vol de jeton par redirection |
| `INTEGRATION_<CONNECTEUR>_CLIENT_ID` / `_CLIENT_SECRET` | Le connecteur concerné refuse la connexion. Le **nom est dérivé de l'identifiant du connecteur** : ajouter un éditeur ne touche aucune ligne de configuration |

---

## 12. Tenir ce document à jour

À la fin de chaque étape de la roadmap, mettre à jour **ce fichier** en même temps que le code :

1. Les sections **2, 3 et 4** si des organes ou des tables apparaissent.
2. La section **7** si des routes apparaissent.
3. La section **8** si des tests ou des contrôles CI apparaissent.
4. La section **10** — dette **ajoutée** comme dette **résolue**. Une dette effacée sans être payée est un mensonge qui coûte plus cher que la dette.
5. **Régénérer les versions lisibles**, sinon le HTML et le PDF racontent l'architecture du mois dernier :

```bash
python3 scripts/generate-plan-ux-pdf.py CURRENT_ARCHITECTURE
```

Le récit des décisions va dans `FICHE_DISCUSSION/FD-001-chantier-fondation-api-logiciels-commerciaux.md`, pas ici. Ce document dit **ce qui est**, jamais pourquoi on l'a décidé.

---

*Mis à jour le 25/07/2026 après l'étape 8 (famille de connecteurs, Shopify comme premier cas d'application, Loi 17). Étapes E0 → E8 livrées, 349 tests au vert.*
