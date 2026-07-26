# Organe d'Orchestration Ma Zone — Plan de construction

| | |
|---|---|
| **Nature** | Document maître de chantier (architecture + roadmap) |
| **Date** | 2026-07-25 |
| **Auteur** | Cursor Reda, sur décision Reda Mehanni |
| **Statut** | Document de référence du chantier — **E0 → E8 livrées le 25/07/2026** (349 tests au vert). État réel du code : `CURRENT_ARCHITECTURE.md` |
| **Version projet analysée** | v0.9.5.2 (tag `ma-zone-v0.9.5.2-labo-simulateur-xcode-24-07-26`) |
| **Références** | FD-000 (source de vérité globale) · FD-001 (récit du chantier) · `AUDIT_ARCHITECTURE_BOITE_ORCHESTRATION_ONTOLOGIE.md` |
| **Annexe technique** | `FICHE_DISCUSSION/Plan_Conception_API_Compatible_Logiciels_Commerciaux_V1.md` — absorbé par ce document |

> **Statut de l'annexe.** Le Plan de conception API (Cursor Adam, amendé Cursor Reda) n'est plus un plan autonome. Il devient l'**annexe technique** de ce document : CDM détaillé, matrice de conflits, contrat connecteur, contraintes SQLite, tranches A→F. En cas de divergence, **ce document prime**.

---

## Sommaire

- Partie 0 — Le constat qui fixe la trajectoire
- Partie 1 — Les lois d'architecture (17 lois, dont la **Loi 16** — frontière de substitution — et la **Loi 17** — confinement du dialecte)
- Partie 2 — Architecture cible
- Étape 0 — Socle de production
- Étape 1 — Le filet de sécurité et le vocabulaire
- Étape 2 — Le noyau
- Étape 3 — L'organe Orders
- Étape 4 — Inventory Engine
- Étape 5 — L'Organe d'Orchestration
- Étape 6 — Integration Engine et connecteur manuel
- Étape 7 — API v1 et bascule mobile
- Étape 8 — Famille de connecteurs, dont Shopify est le premier cas
- Horizon — Substitution progressive
- Partie 3 — Audit critique de cette roadmap

---

# Partie 0 — Le constat qui fixe la trajectoire

Trois faits issus du code actuel commandent tout l'ordre des étapes. Ils ne sont pas des opinions : ils sont vérifiables ligne par ligne.

## Fait 1 — L'orchestration existe déjà et elle marche

`backend/src/lib/eventEngine/orchestration.js` (237 lignes) fait exactement ce que nous voulons généraliser : l'Event Engine décide, puis appelle Wallet pour émettre un billet et Identity pour une lanterne. Il n'importe aucun SDK. Il ne réimplémente aucune règle d'un autre organe.

`backend/src/lib/eventEngine/bus.js` (66 lignes) est déjà un bus de faits domaine interne, distinct des sockets, avec 8 canaux nommés (`event.created`, `event.published`, `event.diffused`…).

**Conséquence.** L'Organe d'Orchestration n'est pas une invention risquée. C'est la promotion au rang de noyau d'un pattern qui tourne en interne depuis la v0.9.3. Le risque d'exécution s'effondre.

## Fait 2 — Orders n'est pas un organe

Contrairement à Wallet, Event et Identity, **il n'existe pas de `backend/src/lib/orders/`**.

| Symptôme | Localisation |
|----------|--------------|
| Création de commande dans une route | `backend/src/routes/orders.js` L102–161 |
| Stock décrémenté hors transaction | `routes/orders.js` L126 |
| Sockets émis **dans** la transaction | `routes/orders.js` L46–90 (checkout panier) |
| Aucun graphe de transitions | `lib/orderStatus.js` = liste de constantes (53 lignes) |
| Aucune idempotence | Double `POST /api/orders` = double commande |
| `PATCH /orders/:id/status` sans `requireRole` | `routes/orders.js` L219–240 |
| Aucun journal append-only | Pas de table `order_journal` |

**Conséquence.** On ne peut pas orchestrer un organe qui n'existe pas. Orders doit devenir un organe **avant** l'orchestration.

## Fait 3 — Zéro test automatisé

Aucun framework, aucun `*.test.js`, aucun script `npm test`, pas de `.github/workflows/`. Sept scripts headless manuels dans `backend/scripts/`.

**Conséquence.** Toucher au flux commande dans cet état est un pari, pas de l'ingénierie.

## L'ordre qui en découle

```
filet de sécurité  →  noyau  →  organes  →  orchestration  →  connecteurs  →  API
```

L'API `/api/v1` arrive **tard**, et c'est volontaire. Les 18 fichiers de routes actuels exposent des tables, pas des intentions. Écrire le contrat avant que les intentions existent produirait un contrat deviné, qu'il faudrait casser. Le squelette OpenAPI est en revanche rédigé dès l'Étape 1, comme document de conception.

---

# Partie 1 — Les lois d'architecture

Douze lois. Chacune est vérifiable mécaniquement (grep, test, revue de code). **Une loi qu'on ne peut pas vérifier n'est pas une loi, c'est un vœu.**

## 1.1 Critique des sept lois proposées

| Loi proposée | Verdict | Motif |
|--------------|---------|-------|
| « Le métier ne dépend jamais des logiciels » | **Conservée** → Loi 1 | Vérifiable par grep |
| « Un connecteur ne prend jamais une décision métier » | **Nuancée** → Loi 2 | Un connecteur décide en permanence de choses techniques (retry, pagination, mapping, rate limit). L'interdit porte sur la **création, l'annulation et la validation d'entités métier** |
| « Un organe ne connaît jamais les APIs externes » | **Supprimée** | Redondante avec la Loi 1. Deux lois qui disent la même chose affaiblissent les deux |
| « Chaque donnée possède un propriétaire » | **Renforcée** → Loi 3 | La propriété est au niveau de l'**attribut**, pas de l'entité. Sans cette précision la loi est inapplicable : `on_hand` et `reserved` du même produit ont deux propriétaires différents |
| « Le CDM représente la vérité interne de Ma Zone » | **Rejetée** → Loi 4 | **La plus dangereuse des sept.** Elle laisse croire que le CDM est un magasin de données. S'il en devient un, il devient un god object dont tous les organes dépendent |
| « Toute intention passe par l'Organe d'Orchestration » | **Rejetée** → Loi 5 | **La plus coûteuse.** Si une lecture de catalogue ou une action mono-organe traverse l'orchestrateur, celui-ci devient un goulot et un god object en 18 mois |
| « Les logiciels tiers remplaçables sans modifier les organes » | **Conservée** → Loi 6 | C'est le test de substitution, condition de la stratégie V2/V3 |

## 1.2 Lois de frontière

### Loi 1 — Aucun organe métier ne connaît un logiciel tiers

Aucun fichier de `backend/src/lib/<organe>/` n'importe un SDK, ne mentionne un nom de produit commercial, ni ne manipule un identifiant externe.

**Vérification :**
```bash
rg -i "shopify|lightspeed|zettle|chift|stripe" backend/src/lib --glob '!integration/**'
# doit retourner zéro
```

### Loi 2 — Un connecteur traduit et transporte, il ne décide pas

Il ne crée, n'annule et ne valide **jamais** une entité métier. Il expose `capabilities()`, `toCanonical()`, `fromCanonical()`, `pull()`, `push()`.

**Vérification :** aucun fichier de `backend/src/lib/integration/connectors/` n'écrit dans `orders`, `stock_levels` ou `events` autrement qu'en appelant un organe.

### Loi 3 — Chaque attribut a un propriétaire nommé

Pour tout attribut du CDM : exactement un rôle parmi **propriétaire**, **miroir**, **calculateur**.

| Attribut | Rôle |
|----------|------|
| `on_hand` | miroir en mode `pos`, propriétaire en mode `mazone` |
| `reserved` | **toujours** propriété de Ma Zone |
| `available` | **toujours** calculé |
| `safety_buffer` | propriétaire (politique magasin Ma Zone) |

**Vérification :** le CDM plante au boot si un attribut n'a pas de rôle déclaré.

### Loi 4 — Le CDM est un vocabulaire, pas un magasin

Il contient des schémas, des types, des invariants et la matrice de propriété. Il ne contient **aucune donnée, aucun accès base, aucun comportement**.

**Vérification :** `backend/src/lib/cdm/` n'importe jamais `db/index.js`. Test de dépendance automatisé.

### Loi 5 — L'orchestration commence à deux organes

Une action qui touche **un seul** organe et aucun système externe appelle cet organe directement. Dès qu'elle touche **deux** organes ou **un** système externe, elle devient une intention déclarée et passe par l'Organe d'Orchestration.

> Ce seuil est la seule chose qui empêche l'orchestrateur de devenir un god object. Il sera attaqué tous les mois par la facilité. Il doit être défendu en revue de code.

### Loi 6 — Test de substitution

Retirer un connecteur ne doit modifier **aucun** fichier hors de `backend/src/lib/integration/`. Vérifié à **chaque** ajout de connecteur, pas une fois par an.

### Loi 16 — L'Organe d'Orchestration ne dialogue jamais avec un logiciel tiers

> Ajoutée le 25/07/2026, après l'étape 5, sur décision Reda Mehanni. Numérotée 16 et non insérée dans l'ordre pour ne pas renuméroter des lois déjà citées dans le code.

L'Organe d'Orchestration orchestre des **intentions métier**, et rien d'autre. Il nomme des étapes canoniques (`integration.pushSale`), il ne sait pas ce qu'elles deviennent.

**N'appartiennent JAMAIS à `backend/src/lib/orchestration/` :**

| Ce qui est interdit | À qui cela appartient |
|---|---|
| Appel réseau sortant (`fetch`, client HTTP, SDK) | Connecteur |
| Authentification externe, OAuth, jeton, clé d'API, secret de tiers | Connecteur |
| Traduction de format, mapping de champs, `toCanonical` / `fromCanonical` | Connecteur |
| Identifiant externe, `external_bindings` | Integration Engine |
| Webhook entrant, signature, vérification d'origine | Integration Engine |
| File d'attente, `outbox` / `inbox`, réessai, DLQ | Integration Engine |
| Détail de protocole, pagination, limite de débit, format de date d'un éditeur | Connecteur |
| Nom d'un éditeur commercial, même en commentaire de code | Connecteur uniquement |
| Réconciliation, arbitrage de conflit de synchronisation | Integration Engine |

**Ce que l'orchestration a le droit de connaître :** le nom d'une opération canonique, et une **capacité** abstraite (`push_sales`, `pull_inventory`). Une capacité dit *« cette boutique sait faire ceci »*. Elle ne dit ni par quel logiciel, ni par quel protocole, ni avec quelles autorisations.

**Formulation opérationnelle.** Si l'on supprimait tout le dossier `backend/src/lib/integration/`, l'Organe d'Orchestration devrait continuer à compiler et à exécuter ses plans, les étapes `integration.*` étant simplement reportées à l'utilisateur (Loi 12). C'est déjà le cas depuis l'étape 5 : ces étapes existent, aucun connecteur n'existe, et une vente aboutit quand même.

**Pourquoi cette frontière est fondamentale.** Elle est la condition de la **substitution progressive**. La stratégie de Ma Zone est de remplacer, organe par organe, les logiciels du commerçant par les siens. Cela n'est possible que si retirer un logiciel tiers est un geste local : débrancher un connecteur. Le jour où un plan d'intention contient une ligne qui suppose l'existence d'un logiciel externe — un identifiant, un champ, une contrainte de format, un ordre d'appel imposé par un éditeur — la substitution cesse d'être un débranchement et devient une réécriture du cœur. C'est exactement ainsi que les plateformes d'intégration deviennent prisonnières des outils qu'elles prétendaient absorber : non par une grande décision, mais par vingt petites commodités.

**Vérification — automatisée, en trois contrôles :**

| Contrôle | Où |
|---|---|
| Aucun nom d'éditeur, aucune I/O réseau, aucune authentification externe, aucun webhook, aucune traduction, aucun identifiant externe dans `lib/orchestration/` | Test `LOI 16 : l'orchestration ne dialogue jamais avec un logiciel tiers` + étape CI `Loi 16` |
| Aucun fichier d'orchestration n'importe l'Integration Engine ni un connecteur | Test `LOI 16 : aucun fichier d'orchestration n'importe l'Integration Engine` |
| Une vente aboutit alors qu'aucun logiciel tiers n'est branché, l'étape externe étant **reportée** et non fatale | Test `LOI 16 : une vente aboutit alors qu'aucun logiciel tiers n'est branché` |

> **Deux pièges rencontrés en écrivant ces contrôles, à ne pas réintroduire.**
> **1.** L'analyse porte sur le **code**, jamais sur la prose : les commentaires de ce dossier doivent pouvoir parler de webhooks et de jetons pour dire ce qui est interdit. Les commentaires sont donc retirés avant analyse.
> **2.** Les **chaînes sont conservées** — c'est exactement là qu'un nom d'éditeur viendrait se cacher — et le retrait de commentaire ignore `//` précédé de `:`, sans quoi `https://shopify…` passerait pour un commentaire et dissimulerait l'infraction derrière son propre protocole.

L'unique point de contact autorisé est `orchestration/adapters/integration.js` : un adaptateur qui **nomme** des opérations canoniques sans en connaître aucune mise en œuvre — et qui, vérifié par test, n'importe rien du tout.

### Loi 17 — Le dialecte d'un éditeur ne sort jamais de son connecteur

> Ajoutée le 25/07/2026, au début de l'étape 8, sur consigne de cadrage de Reda Mehanni : *« Shopify est un simple premier représentant d'une famille de connecteurs. Le cœur de Ma Zone ne devra jamais évoluer en fonction des particularités d'un éditeur. »*

La Loi 16 protège l'**orchestration** d'un logiciel tiers. La Loi 17 protège **tout le reste du cœur** — CDM, organes, Integration Engine, API — des **particularités** d'un éditeur. Ce sont deux frontières différentes, et la seconde est celle qu'on franchit sans s'en apercevoir.

**La règle.** Aucun nom d'éditeur n'apparaît dans `backend/src` en dehors de `lib/integration/connectors/<éditeur>/`. Y compris dans le moteur d'intégration lui-même, y compris en commentaire, y compris « juste le temps de faire marcher ». Et un connecteur, en retour, n'a le droit de rien attraper de lui-même :

| Un connecteur ne fait jamais | Il reçoit à la place |
|---|---|
| Importer la base | Rien — il ne persiste pas, il traduit |
| Importer un organe (`orders`, `inventory`, `catalog`, `orchestration`, `kernel`) | Rien — décider n'est pas son métier (Loi 2) |
| Lire le coffre à secrets | `ctx.credentials`, déchiffré **paresseusement** pour lui |
| Appeler le réseau (`fetch`, `axios`, SDK) | `ctx.request`, avec délai, réessai et classification d'erreur |
| Chercher une correspondance externe | `ctx.externalIdFor({ entityType, entityId })` |
| Écrire sa configuration | `ctx.updateConfig(patch)` |

**Ce que le moteur a le droit de connaître :** un **contrat**. Des capacités, des ressources canoniques, un **mode de connexion** déclaré (`delegated` / `credentials` / `none`), des noms de secrets canoniques (`access_token`, jamais `shopify_token`), et un descripteur d'autorisation fait de fonctions que le connecteur fournit. Jamais un identifiant d'éditeur, jamais un `if`.

**Formulation opérationnelle, celle qui décide en revue de code.** Un mécanisme ne monte dans le moteur que **quand un deuxième éditeur en a besoin**. Tant qu'un seul en a besoin, il vit dans son connecteur. C'est précisément ce qui a produit les sept modules génériques de l'étape 8 : ils n'ont pas été devinés à l'avance, ils ont été **extraits** de ce qu'un éditeur allait dupliquer.

**Pourquoi cette loi vaut la peine d'être opposable.** Le coût d'un connecteur n'est pas son écriture, c'est le **précédent** qu'il crée. Un `if (connectorId === 'shopify')` dans le moteur ne coûte rien le jour où il est écrit ; il coûte le jour où le cinquième éditeur arrive et où plus personne ne sait quelle branche sert à quoi. Le même raisonnement vaut pour l'application mobile, avec un coût plus brutal : un écran qui nomme un éditeur transforme chaque nouveau connecteur en **livraison dans les magasins d'applications**.

**Vérification — automatisée, en quatre contrôles :**

| Contrôle | Où |
|---|---|
| Aucun nom d'éditeur dans `backend/src` hors de `connectors/<éditeur>/`. **La liste des éditeurs est déduite des dossiers de connecteurs** : le prochain est gardé sans que personne pense à l'ajouter | Étape CI `Loi 17` + test `le dialecte d'un éditeur ne sort pas de son dossier` |
| Aucun connecteur n'importe la base, un organe ou le coffre, et n'appelle pas `fetch` | Étape CI + `test/connector-conformance.test.js` |
| `integration_secrets`, `createDecipheriv` et `INTEGRATION_SECRET_KEY` n'existent que dans `integration/secrets.js` | Étape CI `les identifiants tiers ne sortent pas du coffre` |
| Les exigences de conformité s'appliquent à **tous les connecteurs enregistrés**, présents et futurs — la suite se branche sur le registre, pas sur une liste de fichiers | `test/connector-conformance.test.js` |

Les trois contrôles CI sont **jouables en local** — `./scripts/check-loi-17.sh` — parce qu'une règle qu'on découvre après un « push » est une règle qu'on apprend à contourner.

> **Un écart consigné, et pourquoi il n'en est pas un.** L'étape 8 a ajouté `bindings.resolveForOutlet` au **moteur** : une correspondance créée par une lecture de catalogue n'a pas d'établissement, alors qu'une notification de stock en porte un. La règle est **générique** — tout éditeur multi-établissements la rencontrera — et la refuser aurait poussé la compensation dans le connecteur, c'est-à-dire au mauvais endroit. Le test de la Loi 17 n'est pas « le moteur n'a pas changé », mais « le moteur n'a pas changé **pour un éditeur** ».

## 1.3 Lois d'exécution

### Loi 7 — Aucune I/O réseau dans une transaction

Une transaction SQLite ne contient jamais d'émission socket, d'appel HTTP ni de notification. Les effets sont émis **après commit**.

> Cette loi corrige un défaut réel : `backend/src/routes/orders.js` L46–90 émet des sockets à l'intérieur de `db.transaction`.

**Vérification :** test qui échoue si un `emit` est appelé pendant une transaction ouverte.

### Loi 8 — Orchestration impérative, jamais chorégraphiée

L'enchaînement de deux décisions métier est **toujours explicite** dans un plan d'intention, lisible dans un seul fichier. Le bus de faits sert aux projections, aux notifications et aux sockets — **jamais** à déclencher une seconde décision métier.

> Une chaîne de décisions par événements est intraçable à 5 000 commerces.

### Loi 9 — Ce qui n'est pas journalisé n'est pas arrivé

Toute décision d'organe et toute étape d'intention s'écrivent dans un journal append-only, **dans la même transaction** que la décision.

**Modèles existants :** `event_journal`, `digital_object_events`.

### Loi 10 — Idempotence obligatoire aux frontières

Toute intention, tout webhook entrant et tout effet sortant portent une clé d'idempotence. **Rejouer ne change rien.**

**Modèles existants :** `walletEngine.consumeObject`, `identityEngine.verifyPresentation`.

### Loi 11 — Une valeur dérivable n'est jamais une vérité stockable

`available = on_hand - reserved - safety_buffer` se **calcule**. S'il est stocké, c'est un cache nommé comme tel, jamais une source. Toute écriture directe sur une valeur calculée est **rejetée**.

### Loi 12 — Honnêteté fonctionnelle

Quand un tiers ne sait pas faire ce que le commerçant demande, Ma Zone le **dit** dans l'interface. Une étape d'intention est soit exécutée, soit **explicitement reportée** à l'utilisateur. Jamais d'échec silencieux.

> C'est une loi produit autant qu'architecture. Elle borne la promesse « vous ne parlez plus qu'à Ma Zone » à ce qui est réellement tenable, parce que le plafond réel est contractuel (capacités d'écriture des API tierces), pas technique.

## 1.4 Lois de méthode

### Loi 13 — Pas de restructuration sans test de caractérisation

On n'ouvre pas un fichier pour le restructurer avant qu'un test fige son comportement actuel, **bugs compris**.

### Loi 14 — Toute étape est réversible en une journée

Chaque livraison passe derrière un flag ou reste additive. Aucun big bang, aucune migration destructive sans chemin de retour.

### Loi 15 — Toute variabilité nouvelle passe par un registre

Pas de `if (type === ...)` dans un cœur.

**Modèles existants (5 registres) :** `walletRegistry.js`, `eventEngine/eventRegistry.js`, `identityRegistry.js`, `worldFactory/recipeRegistry.js`, `lab/actionRegistry.js`. Validation fail-fast au boot, comme `validateCapabilityContract()`.

---

# Partie 2 — Architecture cible

```
┌──────────────────────────────────────────────────────────────────┐
│  SURFACES        Épée commerçant · App client · Laboratoire      │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  API             /api/v1 (intentions + projections)              │
│                  /api    (existant, maintenu jusqu'à bascule)    │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  ORGANE D'ORCHESTRATION                                          │
│    intentRegistry  ·  processManager  ·  orchestration_journal   │
│    Séquence · Compense · Journalise · Ne décide jamais           │
│    Ne connaît AUCUN logiciel tiers, AUCUN protocole (Loi 16)     │
└──────┬────────────────────────────────────────────┬──────────────┘
       │ appelle des organes                        │ nomme une opération
       │ par opérations nommées                     │ canonique + une capacité
       ▼                                            ▼
┌───────────────────────────────────┐  ┌───────────────────────────┐
│  ORGANES MÉTIER                   │  │  INTEGRATION ENGINE       │
│  Orders · Inventory · Dispatch    │  │  connectorRegistry        │
│  Event · Wallet · Identity        │  │  Outbox / Inbox           │
│  Communication                    │  │  Connecteurs (ACL)        │
│  Décident · Transigent · Journal  │  │  Traduisent · Transportent│
└──────────────┬────────────────────┘  └────────────┬──────────────┘
               ▼                                    │
┌───────────────────────────────────┐               │
│  NOYAU (kernel)                   │               │
│  bus · journal · idempotence · txn│               │
└───────────────────────────────────┘               │
                                                    │
  ═══════ FRONTIÈRE DE SUBSTITUTION (Loi 16) ═══════╪═══════════════
  Rien au-dessus ne sait ce qui vit en dessous.     │
  Tout ce qui est protocole, jeton, mapping,        │
  webhook, identifiant externe s'arrête ici.        ▼
                                        ┌───────────────────────────┐
                                        │  LOGICIELS TIERS          │
                                        │  POS · e-commerce · hub   │
                                        └───────────────────────────┘

        CDM (vocabulaire pur) ──── lu par organes et intégration
                              ──── ne stocke rien, ne décide rien
```

> **Lecture du schéma.** Un seul bloc traverse la frontière : l'Integration Engine. C'est ce qui rend la substitution progressive possible — retirer un logiciel du commerçant est un geste local sous la frontière, jamais une modification au-dessus.

## Dépendances entre étapes

```
E0 Socle prod ──┐
                ├──► E1 Filet + CDM ──► E2 Noyau ──► E3 Orders ──► E4 Inventory
                │                                                       │
                └── (E0 non bloquant pour E1/E2)                        ▼
                                                            E5 Orchestration
                                                                        │
                                              E6 Integration + manual ◄─┘
                                                        │
                                                        ▼
                                                  E7 API v1
                                                        │
                                                        ▼
                                          E8 Shopify (GO explicite)
```

---

# Étape 0 — Socle de production

> **Prérequis bloquant.** Volontairement moins détaillé que les étapes d'orchestration : c'est de l'infrastructure connue, pas de la conception.

## 1. Objectif

Rendre le déploiement possible. Aucun commerçant réel ne peut être servi tant que :

- `JWT_SECRET` a un fallback (`backend/src/middleware/auth.js` L2 → `'mazone-secret-dev-2024'`)
- `ADMIN_JWT_SECRET` a un fallback (`middleware/adminAuth.js` L12)
- CORS est en `origin: '*'` (`backend/src/index.js` L35 et L44–46)
- Le sandbox peut s'activer en production (`lib/sandbox.js`)

## 2. Vision

Un environnement de production réel, sur lequel un pilote fermé peut tourner.

## 3. Livrables

**A — Sécurité & ops**
- Secrets obligatoires : **crash au boot** si absents
- CORS en allowlist par environnement
- Sandbox verrouillé hors production (impossible à forcer)
- `helmet` + rate limiting
- Logs structurés + error tracking
- Environnements dev / staging / prod séparés

**B — Fiabilité**
- Sauvegardes de `backend/data/mazone.db` (procédure WAL explicite)
- CI GitHub Actions : lint + tests

**C — Business & distribution**
- PSP paiement réel
- CGU, support, litiges
- Backend HTTPS + WSS
- Publication stores

## 4. Responsabilités

Infrastructure pure. **Aucun** changement de logique métier, **aucun** nouveau fichier dans `lib/`.

## 5. Intégration avec l'existant

| Élément | Sort |
|---------|------|
| `backend/src/index.js` | Évolue (CORS, helmet, rate limit) |
| `middleware/auth.js`, `middleware/adminAuth.js` | Évoluent (secrets obligatoires) |
| `lib/sandbox.js` | Évolue (verrouillage prod) |
| Reste | Inchangé |

## 6. Critères de validation

- [ ] Démarrer sans `JWT_SECRET` fait **crasher** le process
- [ ] `SANDBOX_MODE=on` avec `NODE_ENV=production` est **refusé**
- [ ] Un paiement réel passe de bout en bout
- [ ] La CI est verte sur un commit

## 7. Dette technique

SQLite mono-instance non traité ici : **assumé et documenté**. La sauvegarde d'un fichier WAL demande une procédure explicite (checkpoint avant copie).

## 8. Préparation de la suite

La CI de l'Étape 0 est le support des tests de l'Étape 1. Sans elle, le filet de sécurité ne protège personne.

---

# Étape 1 — Le filet de sécurité et le vocabulaire

## 1. Objectif

Rendre le refactoring **possible**. Aujourd'hui toute modification du flux commande est un pari : zéro test, et trois trous de sécurité métier ouverts. On fige le comportement actuel avant d'y toucher, et on pose le vocabulaire que toutes les briques suivantes parleront.

## 2. Vision

Les cinq flux critiques sont couverts par des tests qui tournent en CI. Le CDM existe comme dictionnaire pur, sans base ni comportement. Les trous d'autorisation identifiés dans `AUDIT_ARCHITECTURE_MAZONE.md` sont fermés.

## 3. Livrables

**Harnais de test**
- `node:test` natif — **zéro dépendance nouvelle**
- Base SQLite en mémoire, isolée par test

**Tests de caractérisation — 5 flux**
1. Création commande directe (`POST /api/orders`)
2. Checkout panier multi-articles (`POST /api/orders/cart`)
3. Annulation client avec restock (`POST /api/orders/:id/cancel`)
4. Cycle offre 20 s : proposition, expiration, réattribution
5. Transition de statut mission (`PATCH /api/missions/:id/status`)

**CDM — `backend/src/lib/cdm/`**

| Fichier | Contenu |
|---------|---------|
| `entities.js` | Store, Product, Variant, StockLevel, StockMovement, Order, Delivery, Customer, ExternalBinding, SyncConflict |
| `ownership.js` | Matrice attribut → propriétaire / miroir / calculateur |
| `validate.js` | Validation de schéma |
| `index.js` | Façade + validation fail-fast au boot |

**Contrat d'API**
- Squelette OpenAPI 3.1 dans `backend/openapi/` — **document de conception uniquement**, aucune route implémentée

**Correctifs de sécurité métier**
- `requireRole` + vérification d'ownership sur `PATCH /api/orders/:id/status` (`routes/orders.js` L219–240)
- Ownership sur `GET /api/orders/:id`
- ACL sur les join de rooms socket (`socket/handlers.js` L49–62)

## 4. Responsabilités

**CDM**

| Question | Réponse |
|----------|---------|
| Que fait-il ? | Définit les noms, les types, les invariants, et qui possède quoi |
| Que ne fait-il **surtout pas** ? | Ne stocke rien, ne lit rien en base, ne décide rien |
| De quoi est-il propriétaire ? | Du vocabulaire uniquement |
| Que délègue-t-il ? | Toute vérité aux organes |

**Harnais de test** — reproduit l'état du système, n'introduit aucun code de production.

## 5. Intégration avec l'existant

| Sort | Éléments |
|------|----------|
| **Conservés tels quels** | Les 5 registres existants, Wallet, Event, Identity, Communication, World Factory, Lab |
| **Évoluent** | `routes/orders.js` et `socket/handlers.js` — **autorisations uniquement**, sans changement de logique |
| **Disparaissent** | Rien |

**Éviter la réécriture :** le CDM décrit d'abord le schéma **réel actuel**, y compris `products.quantity`. On documente l'existant avant de proposer la cible.

## 6. Critères de validation

- [ ] `npm test` existe et passe en CI
- [ ] Les 5 flux ont au moins un test nominal **et** un test d'échec
- [ ] Un utilisateur A ne peut plus lire ni modifier la commande d'un utilisateur B, ni rejoindre sa room socket — test dédié
- [ ] Retirer une entrée de `ownership.js` fait **crasher le boot**
- [ ] `backend/src/lib/cdm/` n'importe jamais `db/index.js` — test de dépendance

## 7. Dette technique

| Risque | Mitigation |
|--------|------------|
| Les tests figent aussi les **bugs** actuels | Chaque bug figé marqué `// COMPORTEMENT ACTUEL, À CORRIGER EN E3` pour ne pas devenir une spécification par accident |
| Le CDM peut dériver du schéma réel | Un test compare les colonnes déclarées au CDM avec le schéma SQLite effectif |

## 8. Préparation de la suite

Sans le filet, l'Étape 3 est impossible : on ne restructure pas le flux commande à l'aveugle. Sans le CDM, le noyau de l'Étape 2 n'a pas de vocabulaire pour nommer les faits.

---

# Étape 2 — Le noyau

## 1. Objectif

Extraire du code existant les trois primitives dont tous les organes ont besoin, **avant de les dupliquer une sixième fois**. Le bus de faits, le journal append-only et l'idempotence sont déjà implémentés trois fois chacun :

| Primitive | Implémentations existantes |
|-----------|----------------------------|
| Bus de faits | `eventEngine/bus.js` |
| Journal append-only | `event_journal`, `digital_object_events`, `identity_events` |
| Idempotence | `walletEngine.consumeObject`, `identityEngine.verifyPresentation`, `eventEngine.journal` |

## 2. Vision

`backend/src/lib/kernel/` fournit bus, journal et idempotence à tous les organes. **Aucun changement de comportement observable.** Étape purement structurelle, donc à risque minimal — et elle évite de faire deux fois le travail sur Orders et Inventory.

## 3. Livrables

| Fichier | Rôle |
|---------|------|
| `kernel/bus.js` | Promotion de `eventEngine/bus.js`, généralisé. Nommage `<organe>.<fait_au_passé>` : `order.created`, `inventory.reserved`, `order.cancelled` |
| `kernel/journal.js` | Écriture append-only générique, table par organe, même transaction que la décision |
| `kernel/idempotency.js` | Table `idempotency_keys` : scope, clé, résultat, expiration |
| `kernel/txn.js` | Helper de transaction qui **collecte** les faits et ne les émet qu'**après commit** — application mécanique de la Loi 7 |

`eventEngine/bus.js` devient un **réexport mince** du noyau : aucun appelant modifié.

## 4. Responsabilités

| Brique | Fait | Ne fait **surtout pas** | Propriétaire de | Délègue |
|--------|------|-------------------------|-----------------|---------|
| **Bus** | Transporte des faits **déjà arrivés** | Ne décide rien, ne peut rien annuler, n'est jamais dans le chemin d'une décision métier (Loi 8) | Rien | Tout |
| **Journal** | Écrit et relit l'historique | N'interprète **jamais** le contenu | L'historique | L'interprétation aux organes |
| **Idempotence** | Répond « déjà fait, voici le résultat » | Ne connaît aucun métier | Les clés | Tout |
| **txn** | Garantit l'ordre commit → effets | — | Rien | — |

> `txn.js` est le **seul** endroit du système qui a le droit de retenir des émissions.

## 5. Intégration avec l'existant

| Sort | Éléments |
|------|----------|
| **Conservés** | `eventEngine/index.js`, `walletEngine.js`, `identityEngine.js` gardent leurs journaux et clés d'idempotence actuels. **On ne migre pas ce qui marche** |
| **Évoluent** | `eventEngine/bus.js` → réexport ; `eventEngine/subscribers/index.js` s'abonne via le noyau |
| **Disparaissent** | Rien |

**Éviter la réécriture :** on n'unifie **pas** rétroactivement les journaux existants. Les nouveaux organes utilisent le noyau ; les anciens migrent seulement s'ils sont déjà ouverts pour une autre raison.

## 6. Critères de validation

- [ ] Les tests de l'Étape 1 passent **sans modification** — preuve de non-régression
- [ ] Un fait émis dans une transaction **annulée** n'est jamais délivré
- [ ] Aucun `emit` socket n'a lieu pendant une transaction ouverte
- [ ] Rejouer deux fois la même clé d'idempotence renvoie le même résultat et n'écrit **qu'une** fois

## 7. Dette technique

| Risque | Position |
|--------|----------|
| Deux mécanismes de journal coexistent longtemps | **Accepté** : la migration forcée coûterait plus que la duplication |
| Le bus en process ne survit pas à un redémarrage | **Volontaire** : le bus sert aux projections, pas aux décisions. La durabilité arrive avec l'Outbox (E6), uniquement pour les frontières externes |

## 8. Préparation de la suite

Orders (E3) et Inventory (E4) naissent directement avec journal, idempotence et émission post-commit. Sans le noyau, il faudrait les retrofitter — donc les ouvrir deux fois.

---

# Étape 3 — L'organe Orders

## 1. Objectif

Transformer le flux **le plus critique et le plus fragile** du produit en organe au sens FD-000. Aujourd'hui la création de commande enchaîne neuf effets dans un fichier de route, sans transaction englobante, sans graphe de transitions, sans idempotence.

> C'est la seule brique du système où **l'argent et le stock se croisent**, et c'est la moins protégée.

## 2. Vision

`backend/src/lib/orders/` existe comme organe, avec le même niveau de rigueur que Wallet et Event : machine à états fail-fast, journal append-only, idempotence, transaction propre. Les routes deviennent minces. **Le comportement observable ne change pas.**

## 3. Livrables

| Livrable | Détail |
|----------|--------|
| `orders/lifecycle.js` | Graphe explicite sur le modèle exact de `eventEngine/lifecycle.js` L32–59, avec `canTransition(from, to)` **fail-fast**. Statuts existants conservés : `placed`, `pending_driver`, `driver_assigned`, `picking_up`, `picked_up`, `delivering`, `delivered`, `cancelled` |
| `orders/orderEngine.js` | `createOrder`, `cancelOrder`, `transitionOrder`, `getOrder`. **Une** transaction par opération |
| Table `order_journal` | Sur le modèle de `event_journal` |
| Idempotence | En-tête `Idempotency-Key` ; un double POST ne crée qu'une commande |
| Extraction des effets | Notification commerçant, conversation client-commerçant, sockets → **subscribers du bus**, hors transaction |
| `lib/orderStatus.js` | Devient un réexport de `orders/lifecycle.js` — ne casse aucun import mobile ni backend |

## 4. Responsabilités

**orderEngine**

| Question | Réponse |
|----------|---------|
| Que fait-il ? | Décide de la validité d'une commande et de ses transitions, transige, journalise, émet des faits |
| Que ne fait-il **surtout pas** ? | Il n'appelle **pas** le dispatch, il ne décrémente **pas** le stock, il n'émet **aucun** socket, il ne connaît **aucun** logiciel tiers |
| De quoi est-il propriétaire ? | `orders`, `order_journal`, le cycle de vie |
| Que délègue-t-il ? | Réservation de stock → Inventory (E4) · Attribution livreur → Dispatch · Notification et socket → subscribers du bus · Séquence complète → Orchestration (E5) |

## 5. Intégration avec l'existant

| Sort | Éléments |
|------|----------|
| **Conservés** | `lib/dispatch.js`, `lib/dispatchOffer.js`, `lib/missions.js` **inchangés**. On ne touche pas au dispatch en même temps que la commande |
| **Évoluent** | `routes/orders.js` passe de ~240 lignes à une fine couche HTTP ; `lib/orders.js` (23 lignes, lecture) est absorbé |
| **Disparaissent** | Les appels directs à `db` depuis `routes/orders.js` |

**Éviter la réécriture :** le décrément de `products.quantity` **reste en place**, déplacé tel quel dans l'organe. Il sera remplacé à l'Étape 4, pas maintenant. **Une seule transformation à la fois.**

## 6. Critères de validation

- [ ] Les tests de caractérisation de l'Étape 1 passent **sans modification**
- [ ] Une transition interdite renvoie **409** et n'écrit rien — un test par transition interdite
- [ ] Deux POST avec la même `Idempotency-Key` produisent **une** commande et la **même** réponse
- [ ] `rg "db\.(prepare|transaction)" backend/src/routes/orders.js` retourne **zéro**
- [ ] Un échec au milieu d'une création ne laisse ni commande orpheline ni mission orpheline
- [ ] Aucun `emit` socket à l'intérieur d'une transaction — test structurel

## 7. Dette technique

| Dette | Position |
|-------|----------|
| **Une commande = un produit** | Pas de table `order_items` ; le checkout panier crée N commandes. **Dette la plus lourde du système**, volontairement non traitée ici : la corriger en même temps que l'extraction de l'organe ferait deux changements structurels simultanés sur le chemin critique. À traiter **après E5**, quand le filet sera plus épais |
| Le dispatch reste couplé | `createOrderWithDispatch` appelle encore l'organe. Découplé en E5 en devenant une étape d'intention |

## 8. Préparation de la suite

Inventory a besoin d'un **point d'appel unique et transactionnel** pour `reserve` et `commit`. Cet appel n'existe pas tant que la création de commande est éparpillée dans une route. L'Orchestration a besoin d'organes qui exposent des opérations **nommées et compensables**.

---

# Étape 4 — Inventory Engine

## 1. Objectif

Supprimer la survente et ouvrir le **chemin d'adoption A**. `products.quantity` est un compteur unique décrémenté en trois endroits et ré-incrémenté en un seul (`dispatch.js` L252–253). Il ne distingue pas le stock physique de la disponibilité commercialisable, donc **toute commande simultanée peut survendre**.

## 2. Vision

Le triple état est en place. `available = on_hand - reserved - safety_buffer` est **calculé**, jamais stocké comme vérité. Un commerçant sans caisse peut tenir son stock dans Ma Zone dès le premier jour. **Le mobile n'a pas changé d'une ligne.**

## 3. Livrables

**Modules — `backend/src/lib/inventory/`**

| Fichier | Rôle |
|---------|------|
| `inventoryEngine.js` | Façade des opérations |
| `stockLevels.js` | Lecture/écriture des niveaux |
| `movements.js` | Journal append-only des mouvements |
| `policy.js` | `safety_buffer`, `inventory_owner` |

**Tables**
- `stock_levels` : `on_hand`, `reserved`, `safety_buffer`, `inventory_owner`
- `stock_movements` : append-only

**Opérations**
`syncOnHand` · `reserve` · `release` · `commit` · `adjust` · `getSellableQty` · `recomputeAvailable`

**Modes `inventory_owner`**

| Mode | Qui écrit `on_hand` | `commit` livraison MZ | Disponibilité |
|------|---------------------|----------------------|---------------|
| `mazone` | Inventory (Épée, CSV, adjust) | Baisse `on_hand` **et** `reserved` | **Défaut** |
| `pos` | Adapter miroir POS | Baisse **seulement** `reserved` | Après E8 |

**Migration T0 → T3** (annexe technique)

| Phase | Comportement |
|-------|--------------|
| T0 | Tables + backfill ; `products.quantity` devient **projection lecture** de `available` |
| T1 | Flux commande via `reserve` / `release` / `commit` |
| T2 | Connecteurs touchent `on_hand` **uniquement** via `syncOnHand` |
| T3 | Dépréciation des UPDATE directs |

## 4. Responsabilités

**inventoryEngine**

| Question | Réponse |
|----------|---------|
| Que fait-il ? | Seul écrivain de `reserved`. Seul écrivain de `on_hand` en mode `mazone`. Journalise chaque mouvement |
| Que ne fait-il **surtout pas** ? | Il ne connaît ni commande, ni client, ni livraison, ni logiciel tiers. Il ne décide **pas** si une vente est légitime — seulement si le stock permet une réservation |
| De quoi est-il propriétaire ? | `stock_levels`, `stock_movements` |
| Que délègue-t-il ? | Décision de vendre → Orders · Séquence → Orchestration · Miroir externe → Integration |

## 5. Intégration avec l'existant

| Sort | Éléments |
|------|----------|
| **Conservés** | `routes/products.js`, `routes/cart.js`, `routes/promotions.js` continuent de lire `quantity`, devenu projection |
| **Évoluent** | `orders/orderEngine.js` remplace son `UPDATE products SET quantity` par `inventory.reserve` puis `commit` ; `dispatch.js` L252–253 remplace le restock par `inventory.release` |
| **Disparaissent** | **Tous** les `UPDATE products SET quantity` hors du miroir Inventory |

**Éviter la réécriture :** les **7 écrans client** et **2 écrans commerçant** qui lisent `quantity` ne sont **pas touchés**. `product:stock_updated` continue de porter `quantity`, alimenté par la projection. La bascule mobile se fera à l'Étape 7, avec l'API v1.

Écrans concernés (non touchés en E4) : `ProductDetailScreen`, `StoreDetailScreen`, `SearchScreen`, `CartScreen`, `HomeScreen`, `ManageStockScreen`, `AddProductScreen`.

## 6. Critères de validation

- [ ] `rg "SET quantity" backend/src` ne retourne **que** le fichier de projection Inventory
- [ ] **Deux commandes concurrentes sur la dernière unité : une réussit, l'autre reçoit 409.** Test de concurrence **obligatoire**, pas optionnel
- [ ] Annuler une commande restitue **exactement** la quantité réservée, jamais plus
- [ ] `available` ne peut **pas** être écrit par une route — test de rejet
- [ ] Un commerçant sans connecteur peut créer un produit, saisir son stock et vendre de bout en bout
- [ ] Le mobile fonctionne **sans aucune modification** — tests de l'Étape 1 inchangés

## 7. Dette technique

| Risque | Mitigation |
|--------|------------|
| La projection `products.quantity` est une **double écriture** | Job de réconciliation + test comparant projection et calcul après chaque mouvement |
| Le mode `pos` est déclaré mais non exercé avant E8 | Ne pas l'implémenter plus loin que le **contrat** tant qu'aucun connecteur ne l'utilise |
| Les promotions gardent leur propre stock (`promotions.remaining_quantity`), **non compensé à l'annulation** | Bug existant, **corrigé dans cette étape** puisqu'on est déjà dans le sujet |

## 8. Préparation de la suite

`reserve` et `commit` sont **exactement** les opérations compensables dont le process manager a besoin. Sans elles, une intention de vente n'a rien à compenser en cas d'échec.

---

# Étape 5 — L'Organe d'Orchestration

## 1. Objectif

Donner un lieu **unique et traçable** aux actions qui traversent plusieurs organes. Aujourd'hui une création de commande enchaîne neuf effets répartis entre une route, `dispatch.js`, `dispatchOffer.js`, `conversations.js` et quatre émissions socket, sans plan lisible et sans compensation.

> Personne ne peut répondre à « que se passe-t-il exactement quand je vends ? » en lisant un seul fichier.

## 2. Vision

Une intention métier est déclarée dans un registre, son plan est lisible d'un coup d'œil, chaque étape est journalisée, et un échec déclenche des compensations explicites. C'est la généralisation directe de `eventEngine/orchestration.js`, qui fait déjà cela pour Event → Wallet + Identity.

## 3. Livrables

| Livrable | Détail |
|----------|--------|
| `orchestration/intentRegistry.js` | Modèle exact de `eventRegistry.registerType`, validation fail-fast au boot |
| `orchestration/processManager.js` | Exécution séquentielle, journalisation par étape, compensation en ordre inverse, idempotence par intention |
| Table `orchestration_journal` | intention, étape, statut, résultat, erreur, horodatage |
| 4 intentions initiales | `order.place`, `order.cancel`, `product.reserve`, `store.close_exceptionally` |
| Négociation de capacités | Une étape peut déclarer `requires` et `optional`. Capacité manquante → étape **reportée à l'utilisateur** au lieu d'échouer en silence (Loi 12) |
| Migration | `eventEngine/orchestration.js` → cinquième intention |

**Forme d'une déclaration :**

```js
defineIntent({
  id: 'order.cancel',
  actors: ['client', 'merchant'],
  params: { orderId: 'number', reason: 'string?' },
  plan: () => [
    { organ: 'orders',      action: 'cancel',        compensate: 'restore' },
    { organ: 'inventory',   action: 'release',       compensate: 'reserve' },
    { organ: 'dispatch',    action: 'cancelMission', compensate: null },
    { organ: 'integration', action: 'pushCancel', optional: true, requires: 'push_sales' },
  ],
});
```

## 4. Responsabilités

| Brique | Fait | Ne fait **surtout pas** | Propriétaire de |
|--------|------|-------------------------|-----------------|
| **intentRegistry** | Déclare les intentions, acteurs autorisés, paramètres, plan | Aucune logique métier — un plan est une **liste**, pas un algorithme | Les déclarations |
| **processManager** | Séquence, journalise, compense, garantit l'idempotence | Ne calcule aucune règle métier, ne lit ni n'écrit aucune table d'organe, ne connaît aucun logiciel tiers, **n'est jamais appelé pour une action mono-organe** (Loi 5) | `orchestration_journal` |

**Délègue :** toute décision à l'organe concerné, toute traduction externe à Integration.

### Frontière avec les logiciels tiers — Loi 16

L'Organe d'Orchestration **ne dialogue jamais directement avec un logiciel tiers**. Il orchestre des intentions métier uniquement.

Ce qu'un plan d'intention exprime au maximum : *« à cette étape, la vente devrait partir vers le logiciel du commerçant, si cette boutique en a la capacité »*. Il l'exprime par un nom d'opération canonique (`integration.pushSale`) et une capacité abstraite (`push_sales`). Il n'exprime jamais **vers quel logiciel**, **par quel protocole**, **avec quelles autorisations**, **dans quel format**, ni **avec quel identifiant externe**.

Traduction, authentification, mapping, webhook, synchronisation, réessai, réconciliation : tout cela appartient **exclusivement** à l'Integration Engine et aux connecteurs (étape 6). Voir Loi 16 pour le tableau complet des interdits et sa vérification automatisée.

**Constat au terme de l'étape 5 :** aucun connecteur n'existe, les étapes `integration.*` sont déclarées, aucune n'est exécutée, et une vente aboutit quand même en reportant l'étape à l'utilisateur. La frontière n'est donc pas une intention pour plus tard — elle est déjà tenue, et vérifiée par test.

## 5. Intégration avec l'existant

| Sort | Éléments |
|------|----------|
| **Conservés** | **Tous** les organes. L'orchestrateur les appelle, il ne les modifie pas |
| **Évoluent** | `routes/orders.js` appelle `orchestration.run('order.place', params)` ; `dispatch.js` expose `cancelMission` comme opération nommée au lieu d'être appelé en cascade |
| **Disparaissent** | `createOrderWithDispatch` comme fonction composite — son contenu devient **deux étapes d'un plan** |

**Éviter la réécriture :** le dispatch garde sa logique interne intacte, **y compris ses timers mémoire**. On l'orchestre, on ne le réécrit pas.

## 6. Critères de validation

- [ ] Lire `order.place` dans **un seul fichier** suffit à comprendre tous ses effets
- [ ] Un échec injecté à l'étape N déclenche les compensations de N-1 à 1 — test par intention
- [ ] Rejouer une intention avec la même clé ne produit **aucun** effet supplémentaire
- [ ] Une étape `optional` dont la capacité manque produit un **rapport utilisateur explicite**, pas une erreur 500
- [ ] Une intention déclarée avec un organe inconnu fait **crasher le boot**
- [ ] **Aucune** intention mono-organe n'est enregistrée — revue de code sur la Loi 5
- [ ] **Loi 16** — `backend/src/lib/orchestration/` ne contient aucun nom d'éditeur, aucune I/O réseau, aucun protocole, aucun identifiant externe. Vérifié par test structurel **et** en CI

## 7. Dette technique

| Risque | Gravité | Mitigation |
|--------|---------|------------|
| **L'orchestrateur attire le métier** | **Risque principal du plan entier.** En 18 mois, un plan peut contenir des `if` de cas particuliers | Test structurel qui échoue si un fichier de `orchestration/` contient une condition métier + Loi 5 en revue |
| Exécution en process | Un crash au milieu d'une intention laisse un plan partiellement exécuté | Le journal permet la reprise manuelle. Une file durable arrive quand le volume l'exige, **pas avant** |
| Séquencement strictement séquentiel | Suffisant à l'échelle visée | Documenté comme point de réexamen |

## 8. Préparation de la suite

Un connecteur n'est plus qu'une **étape de plan supplémentaire**. Sans le process manager, chaque connecteur devrait réimplémenter sa propre compensation — exactement le piège qui rend les plateformes d'intégration immaintenables.

---

# Étape 6 — Integration Engine et connecteur manuel

## 1. Objectif

Poser le contrat de connecteur et le prouver sur **le seul connecteur qui ne dépend d'aucun tiers**.

> Valider le contrat sur Shopify d'abord reviendrait à debugger simultanément notre architecture **et** une API externe.

## 2. Vision

`backend/src/lib/integration/` existe avec son registre, son contrat, son Outbox et son Inbox. Le connecteur `manual` (saisie Épée, import CSV) tourne en production. **Aucun organe ne connaît un logiciel tiers.**

## 3. Livrables

| Livrable | Détail |
|----------|--------|
| `integration/connectorRegistry.js` | Même pattern que les 5 registres existants |
| Contrat Connector | `capabilities()`, `authenticate()`, `pull()`, `push()`, `subscribeWebhooks()`, `verifyWebhook()`, `toCanonical()`, `fromCanonical()` |
| Connecteur `manual` | Import CSV, saisie Épée, export |
| Tables | `external_bindings`, `sync_conflicts`, `outbox`, `inbox` |
| Outbox | Écriture dans la **même transaction** que la décision · **un** worker · retry avec backoff · DLQ |
| Inbox | ACK rapide en **202** · déduplication par clé d'idempotence · traitement asynchrone par lots |
| Contraintes SQLite | `busy_timeout` à 5000 ms · **exactement** 1 worker Outbox et 1 worker Inbox |

## 4. Responsabilités

| Brique | Fait | Ne fait **surtout pas** | Propriétaire de |
|--------|------|-------------------------|-----------------|
| **connectorRegistry** | Déclare les connecteurs et leurs capacités | Ne traduit rien | Les déclarations |
| **Connecteur** | Traduit CDM ↔ dialecte externe, transporte | Ne crée, n'annule et ne valide **jamais** une entité métier (Loi 2) | Ses `external_bindings` |
| **Outbox / Inbox** | Garantissent la livraison **au moins une fois** à travers une frontière réseau | Ne décident rien | Les files |

**Délègue :** toute décision aux organes, toute séquence à l'Orchestration.

### L'Integration Engine est le SEUL à traverser la frontière — Loi 16

Tout ce qui suit appartient à cette étape et **à elle seule**. Rien de cela ne doit remonter dans `orchestration/`, ni redescendre dans un organe métier :

**authentification externe** · OAuth, jetons, rotation, secrets d'éditeur — **traduction** : `toCanonical` / `fromCanonical`, mapping de champs, formats de date, unités, arrondis — **identifiants externes** : `external_bindings`, l'unique endroit du système où un identifiant d'un logiciel tiers est stocké — **webhooks** : réception, vérification de signature, ACK, déduplication — **synchronisation** : `pull`, `push`, pagination, limites de débit, réessai, backoff, DLQ — **réconciliation** : détection de divergence, arbitrage, `sync_conflicts`.

**Le contrat d'ignorance mutuelle, dans les deux sens :**

| Question | Qui sait répondre | Qui ne doit jamais savoir |
|---|---|---|
| *Vers quel logiciel part cette vente ?* | Integration Engine | Orchestration, organes |
| *Quel est l'identifiant Shopify de ce produit ?* | Connecteur, via `external_bindings` | Orchestration, organes, CDM |
| *Cette boutique peut-elle pousser ses ventes ?* | Integration Engine, qui **déclare une capacité** | — l'Orchestration lit la capacité, jamais sa cause |
| *Dans quel ordre enchaîner vente, stock et livraison ?* | Orchestration | Integration Engine, connecteurs |
| *Le stock physique de ce produit fait-il autorité ici ?* | Organe Inventory, via `inventory_owner` | Connecteur, qui ne fait que **déclarer** un `on_hand` |

C'est cette double ignorance qui fait de la **substitution progressive** un débranchement et non une réécriture. Un connecteur se retire ; une dépendance diffuse ne se retire pas.

**Le piège concret à refuser en revue de code.** Le premier connecteur réel imposera une contrainte de séquence — « il faut créer le client chez l'éditeur avant de pousser la commande ». La solution facile est d'ajouter une étape à `order.place`. C'est la mauvaise. Cette séquence est un **détail du connecteur** : elle vit dans son `push()`, pas dans un plan d'intention. Le jour où un plan porte l'ordre d'appel d'un éditeur, Ma Zone travaille pour cet éditeur.

## 5. Intégration avec l'existant

| Sort | Éléments |
|------|----------|
| **Conservés** | **Tous** les organes, sans une ligne modifiée. C'est le test de la Loi 6, appliqué dès le premier connecteur |
| **Évoluent** | Les intentions gagnent des étapes `integration`, toujours en `optional` tant qu'aucun connecteur réel n'est branché |
| **Disparaissent** | Rien |

**Éviter la réécriture :** la saisie de stock de l'Épée actuelle **devient l'implémentation** du connecteur `manual`, pas une réimplémentation.

## 6. Critères de validation

- [ ] Un commerçant importe un CSV de 500 produits et vend dans la foulée
- [ ] `rg -i "shopify|lightspeed|zettle|chift" backend/src/lib --glob '!integration/**'` retourne **zéro**
- [ ] **Loi 16** — aucun plan d'intention n'a gagné une étape imposée par un protocole externe. Le diff de `orchestration/intents/` sur toute l'étape 6 doit être **vide**
- [ ] **Loi 16** — l'orchestration continue de démarrer et d'exécuter ses plans si l'on renomme `backend/src/lib/integration/`
- [ ] Supprimer le dossier du connecteur `manual` ne casse la compilation d'**aucun** organe
- [ ] Un webhook rejoué trois fois ne produit **qu'un** effet
- [ ] Un échec Outbox répété finit en **DLQ visible** en administration, jamais perdu en silence
- [ ] Deux workers Outbox lancés simultanément : le second **refuse de démarrer**

## 7. Dette technique

| Risque | Position |
|--------|----------|
| Le worker unique est un point de défaillance **et** un plafond de débit | Choix assumé tant que SQLite est la base. **Déclencheur de réexamen chiffré maintenant : plus de 200 messages Outbox en attente de façon soutenue** |
| `external_bindings` sans connecteur réel = conception non validée | La structure reste minimale ; on l'enrichit au premier connecteur réel |

## 8. Préparation de la suite

L'API v1 peut enfin exposer un domaine Integrations **qui existe vraiment**. Et Shopify (E8) devient l'ajout d'un fichier, pas un chantier.

---

# Étape 7 — API v1 et bascule mobile

## 1. Objectif

Exposer les intentions et les projections sous un contrat stable et versionné.

> Cette étape arrive **tard volontairement** : les 18 fichiers de routes actuels exposent des tables, pas des intentions. Écrire le contrat avant que les intentions existent aurait produit un contrat deviné, qu'il aurait fallu casser.

## 2. Vision

`/api/v1` coexiste avec `/api`. Le mobile bascule **écran par écran**. Le contrat OpenAPI est la source, le code le suit.

## 3. Livrables

| Livrable | Détail |
|----------|--------|
| `backend/src/routes/v1/` | Domaines : Stores, Catalog, Inventory, Cart, Orders, Deliveries, Customers, Events, Opportunities, Wallet (lecture), Identity, Communication, Integrations, Stats |
| `POST /api/v1/intents/:id` | Exécution d'une intention déclarée, `Idempotency-Key` **obligatoire** |
| Séparation stricte des projections | `GET /api/v1/products/:id` (client) expose `available`, **jamais** `on_hand` · `GET /api/v1/inventory/:productId` (commerçant) expose les 4 valeurs |
| OpenAPI 3.1 | Complète, générée et **vérifiée en CI** contre les routes réelles |
| Bascule mobile | Progressive, derrière un flag, écran par écran, en commençant par les écrans **commerçant** |
| Socket | `product:stock_updated` porte désormais `available` explicitement, sans casser `quantity` |

## 4. Responsabilités

**API v1**

| Question | Réponse |
|----------|---------|
| Que fait-elle ? | Transporte, authentifie, valide la **forme** |
| Que ne fait-elle **surtout pas** ? | Ne décide rien, ne compose rien, n'appelle **jamais** deux organes elle-même |
| Que délègue-t-elle ? | Action multi-organe → Orchestration · Action mono-organe → l'organe |

## 5. Intégration avec l'existant

| Sort | Éléments |
|------|----------|
| **Conservés** | **Toutes** les routes `/api` actuelles, jusqu'à la bascule complète du mobile |
| **Évoluent** | Les écrans mobiles, **un par un** |
| **Disparaissent** | À terme : `/api/messages` et `/api/conversations`, déjà identifiés comme pile legacy en triple. **Pas avant** que `/api/v1/communication` soit branché |

**Éviter la réécriture :** aucun écran mobile n'est refait, seuls les appels changent.

## 6. Critères de validation

- [ ] Un test de contrat vérifie **chaque** route contre l'OpenAPI
- [ ] **Aucune** réponse client ne contient `on_hand` — test automatisé sur toutes les routes client
- [ ] Le mobile fonctionne sur `/api` **et** sur `/api/v1` selon un flag, avec les mêmes tests E2E
- [ ] Une intention appelée sans `Idempotency-Key` renvoie **400**

## 7. Dette technique

| Risque | Mitigation |
|--------|------------|
| Deux API en parallèle pendant plusieurs mois | Date de fin de vie de `/api` **inscrite dans le code** + compteur d'usage par route pour savoir quand couper |
| `/api/v1` devient un miroir de tables au lieu d'un contrat d'intentions | Toute route qui **écrit** et touche plus d'un organe doit passer par `/intents` |

## 8. Préparation de la suite

Un partenaire externe, un connecteur tiers ou un futur POS Ma Zone consomment désormais un **contrat stable** au lieu de l'intérieur du système.

---

# Étape 8 — Famille de connecteurs, dont Shopify est le premier cas

> **Livrée le 25/07/2026.** GO Reda, avec une **consigne de cadrage qui a changé le livrable** : *« Shopify est un simple premier représentant d'une famille de connecteurs. À aucun moment une décision d'architecture ne devra être spécifique à Shopify si elle risque de compliquer demain l'arrivée de Lightspeed, SumUp, Zettle, WooCommerce, Sage ou d'autres logiciels. Le cœur de Ma Zone ne devra jamais évoluer en fonction des particularités d'un éditeur. »*
>
> Cette consigne a produit la **Loi 17** (§1.2) et déplacé l'objet de l'étape : le livrable n'est pas le connecteur, c'est **ce qui a été retiré du connecteur**.

## 1. Objectif

Ouvrir le **chemin d'adoption B** et confronter le contrat de connecteur à une vraie API tierce, avec ses webhooks, ses quotas et ses pannes — **en construisant la famille, pas le cas particulier**.

## 2. Vision

Un commerçant connecte son logiciel, son catalogue et son `on_hand` se mettent en miroir, le mode `inventory_owner = pos` est exercé pour la première fois. Et le **deuxième** éditeur n'aura à écrire que son dialecte.

## 3. Livrables

**Génériques — aucun éditeur nommé, dans `lib/integration/` :**

- `secrets.js` — coffre AES-256-GCM par installation, empreinte de clé, purge au débranchement (lève le refus 501 de l'étape 6)
- `http.js` — **seul** transport sortant : délai, 429 avec `Retry-After`, réessayable / définitif, **injectable** (donc tests hors ligne)
- `signature.js` — vérification HMAC à **temps constant**, algorithme et encodage déclarés par le connecteur
- `oauth.js` — *authorization code* générique : état à **usage unique**, `redirect_uri` construite par le moteur, échange, rafraîchissement
- `cursors.js` + `puller.js` — lecture incrémentielle durable et réconciliation périodique
- `declare.js` — déclaration canonique de produit partagée (le CSV cesse d'être un chemin privilégié)
- `context.js` — ce qu'un connecteur reçoit : `request`, `credentials` paresseux, `externalIdFor`, `updateConfig`
- `contract.js` — **trois modes de connexion déclarés** : `delegated`, `credentials`, `none`

**Propres à un éditeur — `connectors/shopify/`, quatre fichiers :** chemins et version d'API épinglée, variantes aplaties et identité par `inventory_item_id`, en-têtes et sujets de notification, assemblage.

**Surfaces :** `connect`, retour d'autorisation, `reconcile`, débranchement avec purge des secrets ; écran Épée **« Mes logiciels »** qui **ne nomme aucun éditeur** (il dessine ce que le backend décrit), avec le collage de catalogue **au même niveau** en repli ; journal de conflits visible par le commerçant.

## 4. Responsabilités

Identiques à l'Étape 6, plus la **Loi 17**. Le connecteur ne décide rien, ne persiste rien, n'attrape rien lui-même : il **reçoit** son réseau et ses identifiants. Le mode `pos` change **uniquement qui écrit `on_hand`**, jamais qui décide de vendre.

## 5. Intégration avec l'existant

**Aucun organe modifié, et aucun fichier de `lib/orchestration/` modifié** — la Loi 16 a tenu à l'épreuve d'un logiciel réel. C'est le critère de réussite de toute l'architecture, pas un effet secondaire.

## 6. Critères de validation

- [x] **Zéro double décrément** : une vente Ma Zone en mode `pos` baisse `reserved`, **jamais** `on_hand` — vérifié de bout en bout, 10 − 2 = 8
- [x] Déconnecter le connecteur laisse le commerçant opérationnel en mode `mazone` — catalogue et stock intacts, secrets effacés, curseurs oubliés, correspondances conservées
- [x] Une panne de l'éditeur de **30 minutes** ne bloque **aucune** vente Ma Zone
- [x] **Loi 17** — aucun nom d'éditeur hors de son dossier, aucun connecteur qui touche la base / un organe / le coffre / le réseau en direct
- [x] La suite de conformité s'applique à **tous** les connecteurs enregistrés, présents et futurs
- [~] **Aucun fichier hors `integration/` modifié** — **écart consigné** : `routes/integration.js` (nouvelles surfaces), `config/env.js` (deux variables), `mobile/` (écran « Mes logiciels »), CI et tests. Aucun **organe**, aucune **intention**, aucun **fichier d'orchestration**. L'esprit du critère est tenu ; sa lettre supposait qu'un connecteur ne se connecte pas depuis une interface

## 7. Dette technique

Dépendance à une API tierce qui changera. Mitigation en place : version d'API **épinglée**, échéance de revue (30/04/2027) qui **fait échouer un test**, tests hors ligne sur un transport factice.

**Reste ouvert, et nommé** : pas de roulement de la clé maîtresse du coffre (la remplacer oblige à reconnecter, ce qui est **dit** grâce à l'empreinte) ; pas de budget d'appels par éditeur ; rafraîchissement de jeton écrit mais **non éprouvé** ; une vente Ma Zone n'apparaît pas comme commande chez l'éditeur (choix assumé, pour ne pas entrer dans la comptabilité du commerçant) ; écran mobile non testé, faute de harnais.

## 8. Préparation de la suite

**Le deuxième connecteur ne coûte plus que son dialecte** — quatre fichiers — et hérite du coffre, du transport, de la vérification de signature, de l'autorisation déléguée, des curseurs, de la réconciliation… **et de sa suite de tests de conformité, le jour où il s'enregistre**. C'est la condition de la Phase 2 de la roadmap d'adoption.

---

# Horizon — Substitution progressive

Pas une étape : un **principe de conception à respecter dès maintenant**.

Remplacer une brique revient à :

1. Écrire un organe Ma Zone
2. Basculer `inventory_owner` ou l'équivalent du domaine concerné

**Aucune intention, aucun contrat d'API et aucune surface ne change.** C'est ce qui rend la stratégie V1 → V2 → V3 possible sans reconstruction.

## Point de vigilance majeur — à instruire avant toute ligne de code

Le POS Ma Zone (V2) est le premier candidat à la substitution. Dès lors qu'un commerçant **enregistre des règlements de clients particuliers** dans Ma Zone, la question de la **réglementation applicable aux logiciels de caisse** se pose.

Cette question peut redéfinir le périmètre de la V2 et son calendrier. **Elle est plus déterminante pour dix ans que n'importe quel choix technique de ce document.**

---

# Partie 3 — Audit critique de cette roadmap

## Les trois plus grands risques

### 1. SQLite est un plafond dur, et ce plan le repousse

Tout le design Outbox/Inbox suppose un worker unique et une seule instance. Postgres n'est donc pas une option future, **c'est une échéance**. En le repoussant, j'accepte que la migration se fasse **sous pression** plutôt qu'au calme.

**Atténuation :** le déclencheur est chiffré dès l'Étape 6 (plus de 200 messages Outbox en attente de façon soutenue), et aucun organe n'écrit de SQL spécifique à SQLite.

### 2. L'Organe d'Orchestration peut devenir un god object

C'est le **risque structurel du plan**. Un registre d'intentions attire les cas particuliers exactement comme un moteur de règles.

**Trois défenses :**
1. La Loi 5, qui interdit les intentions mono-organe
2. Un test structurel qui échoue sur une condition métier dans `orchestration/`
3. Le fait qu'un plan soit une **liste déclarative**, pas du code impératif

Si ces trois défenses cèdent, l'architecture se dégrade en deux ans.

### 3. Le rythme

Huit étapes, deux personnes, zéro test au départ. Le risque le plus probable n'est **pas** un mauvais choix technique : c'est un **abandon à l'Étape 1**, parce que le filet de sécurité coûte plus que prévu et ne produit aucune fonctionnalité visible.

**Atténuation :** limiter strictement l'Étape 1 à cinq flux, et accepter que ces tests soient imparfaits.

## Les choix qui me semblent encore fragiles

| Choix | Pourquoi c'est fragile |
|-------|------------------------|
| **Une commande = un produit** | Pas de table `order_items` ; le checkout panier crée N commandes. Je repousse la correction après E5 pour ne pas cumuler deux refontes sur le chemin critique, mais **c'est le choix de ce plan dont je suis le moins sûr**. Un commerçant CHR ou un panier avec remise globale le fera exploser plus tôt que prévu |
| **La projection `products.quantity`** | Une double écriture est toujours une source de désynchronisation. Je la garde pour ne pas toucher au mobile, mais « temporaire » a une fâcheuse tendance à durer trois ans. Il faut une **date de suppression inscrite à l'Étape 7** |
| **Les intentions codées, non configurables** | Correct aujourd'hui. Le jour où un commerçant voudra sa propre variante de « je vends », il faudra soit multiplier les intentions, soit introduire de la configuration. Je préfère ce problème au problème inverse, mais il arrivera |
| **Le dispatch reste largement intact** | Ses timers en mémoire sont perdus au redémarrage et une mission peut rester bloquée en `offered`. Je l'orchestre **sans le réparer**, ce qui laisse un défaut de fiabilité connu dans le chemin critique |

## Ce que je remettrais en question après 50 commerçants

- **La granularité des intentions.** Quatre est probablement trop peu, et les bonnes ne sont sans doute pas exactement celles que j'ai choisies. C'est le terrain qui les dictera.
- **Le modèle une commande = un produit.** Je m'attends à ce qu'il casse en premier.
- **L'hypothèse que le connecteur manuel/CSV suffit au chemin A.** Le scan de codes-barres et la synchronisation de prix vont remonter vite.
- **La couverture réelle des `capabilities()`.** La promesse « vous ne parlez plus qu'à Ma Zone » sera testée par le premier commerçant qui demandera une action que son POS ne sait pas recevoir.

## Ce que je remettrais en question après 5 000 commerçants

- **SQLite → Postgres : certain.** Ce n'est pas une question.
- **Le process manager en process → file durable** avec reprise après crash et exécution parallèle des étapes indépendantes.
- **Le worker unique → plusieurs consommateurs** avec élection de leader.
- **Probablement l'extraction de l'Integration Engine en service séparé**, parce que son profil de charge et de panne n'a rien à voir avec celui des organes.
- **L'observabilité par intention.** À cette échelle, la question devient « quel pourcentage des intentions `order.place` a compensé hier, et pourquoi ». Le journal seul n'y répondra plus.
- **Le multi-magasin et le multi-entrepôt**, absents de ce plan.

## Signerais-je ce plan pour dix ans ?

**Oui, sous trois conditions.** Sans elles, la réponse est non.

### Condition 1 — L'Étape 1 n'est pas négociable

Si le filet de sécurité est sauté pour aller plus vite, tout le reste devient un pari. **C'est la seule étape de ce plan dont l'abandon invalide les sept autres.**

### Condition 2 — La Loi 5 est défendue en revue de code

Le seuil de deux organes est la seule chose qui sépare un orchestrateur d'un god object. Elle sera attaquée tous les mois par la facilité.

### Condition 3 — Le déclencheur Postgres est surveillé dès l'Étape 6

Migrer sous pression, avec des commerçants en production, coûte dix fois le prix d'une migration anticipée.

### Pourquoi je signe

Ce plan ne demande à l'équipe de maîtriser **aucune technologie qu'elle ne maîtrise pas déjà**. Chaque brique est la généralisation d'un pattern qui tourne dans le code aujourd'hui :

| Brique cible | Pattern source existant |
|--------------|------------------------|
| Registres | `walletRegistry.js` |
| Machines à états | `eventEngine/lifecycle.js` |
| Journaux | `event_journal` |
| Idempotence | `walletEngine.consumeObject` |
| Bus de faits | `eventEngine/bus.js` |
| Orchestration | `eventEngine/orchestration.js` |

> **La plus petite architecture capable de tenir dix ans n'est pas celle qui ajoute le plus de concepts, c'est celle qui en généralise le moins possible.**

### Ce que ce plan ne résout pas

Et qu'aucune architecture ne résoudra : le plafond réel de la promesse « vous ne parlez plus qu'à Ma Zone » n'est **pas technique, il est contractuel**. Il dépend des capacités d'écriture des API tierces et des partenariats.

**La Loi 12 est là pour que le produit soit honnête sur ce plafond au lieu de le masquer.**

---

*Document maître — Cursor Reda — 2026-07-25. Absorbe le Plan de conception API, qui devient annexe technique.*
