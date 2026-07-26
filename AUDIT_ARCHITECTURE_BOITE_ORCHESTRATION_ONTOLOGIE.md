# Audit d'architecture — Boîte d'orchestration & hypothèse ontologie

| | |
|---|---|
| **Nature** | Audit d'architecture (posture CTO) |
| **Date** | 2026-07-25 |
| **Auteur** | Cursor Reda |
| **Contexte** | Chantier « Fondation API compatible tous logiciels » — nouvelle hypothèse ontologie compilée |
| **Références** | FD-000 · FD-001 · Plan_Conception_API_Compatible_Logiciels_Commerciaux_V1 · walletRegistry.js · eventRegistry.js |
| **Statut** | Document d'analyse — décision recommandée, non validée humainement |

---

## Verdict en une phrase

**L'intuition est juste, l'outil est faux.** Séparer la connaissance métier déclarative de son exécution est exactement la bonne idée — Ma Zone le fait déjà partiellement. Mais formaliser cette connaissance en **ontologie** puis écrire un **compilateur ontologie → règles** est, pour Ma Zone en 2026, une fausse bonne idée : coût d'un formalisme conçu pour un autre problème, équipe de deux personnes, zéro commerçant en production.

**Recommandation : ne pas signer cette architecture.** Signer à la place une architecture CDM + registres déclaratifs + machines à états + process manager + Outbox (détaillée en §6–8).

---

## 0. Trois idées empilées — ne pas les confondre

Le message initial contient trois propositions de niveaux très différents. Les évaluer ensemble mène à une mauvaise décision.

| # | Proposition | Verdict |
|---|-------------|---------|
| 1 | **Stratégie** : intercaler Ma Zone entre le commerçant et sa régie logicielle, puis substituer brique par brique | **Excellente** — pattern Strangler Fig, meilleur atout stratégique |
| 2 | **Principe technique** : connaissance métier déclarative, exécution compilée/rapide | **Juste — et déjà partiellement fait** dans le code |
| 3 | **Implémentation** : ontologie formelle + compilateur vers règles d'exécution | **À rejeter** au stade actuel |

Le risque : la qualité de (1) et (2) sert de caution à (3). C'est le mécanisme qui produit les architectures qu'on ne peut plus maintenir trois ans plus tard.

---

## 1. Pertinente ou fausse bonne idée ?

**Fausse bonne idée**, pour quatre raisons dont la première est décisive.

### 1.1 Une ontologie suppose un monde ouvert. Le métier Ma Zone est un monde fermé.

Les ontologies (OWL, RDF, reasoners type HermiT/Pellet) reposent sur l'**hypothèse du monde ouvert** : ce qui n'est pas connu n'est pas faux, c'est inconnu. Puissant pour intégrer des vocabulaires hétérogènes écrits par des gens qui ne se parlent pas.

Le domaine Ma Zone est un monde **fermé** et transactionnel :

- « Cette unité n'est pas réservée » doit signifier *elle n'est pas réservée*, pas *on ne sait pas*.
- `available = on_hand - reserved - safety_buffer` doit être vrai **maintenant**, dans une transaction, avec un verrou.
- Une survente n'est pas une inconsistance logique à signaler — c'est de l'argent perdu et un client furieux.

On peut forcer le monde fermé (SHACL, contraintes d'unicité, closure axioms) — mais on paie le prix d'OWL sans en toucher les bénéfices.

### 1.2 Une ontologie décrit ce qui *est*. L'orchestration décrit ce qu'il *faut faire*.

Erreur de catégorie fréquente et coûteuse.

Une ontologie sait : « une Commande a des Lignes », « un Billet est un Objet Numérique ». Elle sait classifier, subsumer, détecter une incohérence.

Elle ne sait pas exprimer, nativement et de façon exécutable :

- appelle l'API Shopify, avec un `Idempotency-Key`, retry exponentiel, timeout 3 s ;
- si l'appel échoue après le débit du `reserved`, **compense** en libérant la réservation ;
- si le connecteur ne déclare pas la capacité `push_sales`, saute cette étape et notifie le commerçant ;
- émets un socket `product:stock_updated` aux commerçants (`on_hand`) et aux clients (`available` seulement).

Ce sont des **effets de bord ordonnés, faillibles et compensables**. Le vocabulaire : saga / process manager / outbox — pas la logique de description.

### 1.3 Le compilateur est la partie la plus chère et la moins prouvée

« Compiler l'ontologie en règles rapides » est la clef de voûte de l'hypothèse, et la brique la moins précisée. Significatif.

Écrire un compilateur, c'est :

- une phase de build supplémentaire sans CI mature ;
- des artefacts générés à versionner, diffuser, **débugger** ;
- une compétence rare, à maintenir dix ans, à deux.

**Scénario décisif :** 2 h du matin, un commerçant a survendu 4 unités. Avec organes + journal append-only (déjà en place) : lire le journal, lire la fonction, comprendre en dix minutes. Avec ontologie → règles générées : comprendre la règle générée, remonter à l'axiome, vérifier que le build prod correspond à la version lue. Un bug devient une enquête.

### 1.4 Formaliser une connaissance qu'on n'a pas encore

Une ontologie est rentable quand le domaine est **stable et connu**, et que le goulot est la cohérence de vocabulaires multiples.

Situation Ma Zone : zéro commerçant en production, zéro connecteur livré, modèle économique V0 non écrit. On formaliserait des **hypothèses**. Le formalisme ne les rend pas vraies — il les rend coûteuses à changer. Pire des deux mondes : rigidité sans validation terrain.

---

## 2. Quels problèmes l'idée résout-elle réellement ?

Trois problèmes réels visés — tous légitimes, aucun n'exige une ontologie.

| Problème | Description | Solution sans ontologie |
|----------|-------------|-------------------------|
| **Dispersion de la connaissance métier** | « Que se passe-t-il quand une commande est annulée ? » répondu à plusieurs endroits | CDM typé + registres déclaratifs + organes |
| **Traduction inter-logiciels** | « Stock » Shopify ≠ Zettle ≠ Lightspeed | CDM + ACL connecteurs + matrice propriétaire/miroir/calculateur |
| **Nouveau logiciel sans refactor du cœur** | Ajouter un POS ne doit pas toucher Inventory | `connectorRegistry` + pattern Open/Closed (déjà Wallet/Event) |

Le CDM du plan Fondation API + les registres existants résolvent déjà ces trois points, à un coût bien inférieur.

---

## 3. Quels nouveaux problèmes introduit-elle ?

| Problème introduit | Gravité |
|--------------------|---------|
| **Deux représentations qui dérivent** (ontologie source + règles générées) | Élevée |
| **Débogage à deux niveaux** (règle générée → axiome source) | Élevée |
| **Compétence rare à maintenir 10 ans** (bus factor = 1) | Élevée à 2 personnes |
| **Build step obligatoire** avant déploiement | Moyenne |
| **Tentation de tout mettre dans l'ontologie** (cas particuliers Shopify dans le méta-modèle) | Élevée |
| **Perte de lisibilité du code** | Moyenne |
| **Faux sentiment de complétude** (belle ontologie ≠ métier validé terrain) | Sournoise |
| **Contredit FD-000** : « Surface compose, organe décide » — un moteur central re-concentre la décision | Structurelle |

---

## 4. Ontologie ou approche plus simple ?

**Approche plus simple et plus robuste : oui — et déjà écrite dans le code.**

### Ce que fait déjà Ma Zone (ontologie-lite)

**Wallet Registry** (`backend/src/lib/walletRegistry.js`) :

- Kinds déclaratifs (`event_ticket`, `pickup_ticket`, …)
- Transitions d'état par kind
- Capacités avec `handledBy: 'wallet' | 'source' | 'device'`
- Validation fail-fast au boot (`validateCapabilityContract`)

**Event Registry** (`backend/src/lib/eventEngine/eventRegistry.js`) :

- Types d'événements déclaratifs
- Cycles de vie par type (`lifecycle.js`)
- Capacités connues (`canTicket`, `isLantern`, …)
- Open/Closed : nouveau type sans toucher le cœur

**Event Lifecycle** (`backend/src/lib/eventEngine/lifecycle.js`) :

- Graphe de transitions générique
- `canTransition(typeDef, from, to)` — exécution O(1), zéro raisonnement

C'est **exactement** le schéma décrit (connaissance déclarative → exécution rapide) sans ontologie, sans compilateur, sans build step. La « compilation » = chargement du module + validation au boot.

### Recommandation : généraliser, pas surcouche

Généraliser ce pattern à Inventory et Integration — pas inventer une quatrième couche ontologique au-dessus.

### Quand une vraie ontologie serait justifiée (déclencheurs futurs)

1. Plus de 15 connecteurs, maintenance des mappings domine la roadmap
2. Commerçants configurent eux-mêmes des automatisations sans déploiement
3. Assistant IA raisonne sur le domaine (même là : catalogue de commandes typées > logique de description)

Aucun de ces déclencheurs n'est présent aujourd'hui.

---

## 5. Construirais-je cette approche pour dix ans et des milliers de commerces ?

**Non.** L'argument « tenir dix ans » plaide **contre** l'ontologie.

Ce qui tient dix ans : le nombre de personnes capables de reprendre le système. CDM typé + machines à états + sagas lisibles + adapters isolés = reprenable par tout bon développeur. Pipeline ontologie → compilateur → règles = reprenable par quelqu'un qui a déjà fait ça (peu).

Ce qui tue les plateformes d'orchestration à dix ans :

| Risque réel | L'ontologie aide ? |
|-------------|-------------------|
| Fiabilité synchronisation (doublons, drift, compensations) | Non |
| Versions d'API tierces qui changent sans prévenir | Non |
| Observabilité (pourquoi ce stock est faux) | Non |
| Migration de données | Non |
| Ajouter un connecteur en une semaine | Non |

Un bon Outbox, un bon journal et de bons tests aident sur les cinq.

---

## 6. Architecture recommandée à la place

Six décisions structurantes — chaque brique éprouvée, déjà amorcée chez Ma Zone.

### 6.1 Schéma global

```
[Commerçant] → [API v1 Intentions] → [Politiques / invariants]
                                              ↓
                                    [Organes : Inventory, Orders, Event, Wallet]
                                              ↓
                                    [Process Manager — saga, compensation]
                                              ↓
                                    [Outbox / Inbox]
                                              ↓
                                    [Connecteurs ACL — toCanonical / fromCanonical]
                                              ↓
                                    [Logiciels externes : POS, e-commerce, hub]

[Registres déclaratifs — CDM, lifecycles, capabilities] — lus par toutes les couches, jamais exécutés
```

### 6.2 Les six briques

| # | Brique | Rôle |
|---|--------|------|
| 1 | **CDM typé versionné** | Schémas, invariants, matrice owner/mirror/calculator. Validation Zod/JSON Schema. Pas de comportement. |
| 2 | **Registres déclaratifs** | `connectorRegistry`, `movementRegistry`, `inventoryPolicyRegistry` — modèle `eventRegistry.js`. Fail-fast au boot. |
| 3 | **Machines à états explicites** | Un graphe par agrégat (Orders, Inventory, Event). Pas de graphe universel. |
| 4 | **Intention → Commande** | « Je ferme demain » → `CloseStoreExceptionally { storeId, date, reason }`. Boîte intelligente côté entrée. |
| 5 | **Process Manager (saga)** | Séquence effets multi-systèmes, compensation, idempotence. Plan = table de correspondance + `capabilities()` connecteur. |
| 6 | **Moteur de règles (plus tard, borné)** | Promos, seuils réassort, gates publication — variabilité humaine. Invariants stock = fonctions pures + tests. |

### 6.3 Coût comparé

| Approche | Effort estimé |
|----------|---------------|
| Architecture recommandée (plan Fondation API + process manager) | Quelques semaines |
| Ontologie + compilateur + règles générées | Plusieurs mois-homme avant le 1er commerçant servi |

---

## 7. Organisation précise de la « boîte intelligente »

Cinq étages. Règle : **on ne remonte jamais**.

| Étage | Rôle | Ce qu'il ne fait jamais |
|-------|------|-------------------------|
| **1. Intention** | Traduire geste commerçant → commande typée validée | Décider du métier |
| **2. Politique** | Autoriser/refuser, invariants, propriété par attribut | Appeler un système externe |
| **3. Organes** | Décider et transiger localement | Connaître Shopify |
| **4. Orchestration** | Séquencer effets multi-systèmes, compenser, idempotence | Règles métier propres à un organe |
| **5. Transport** | Outbox/Inbox/adapters/webhooks | Décider quoi que ce soit |

### Exemple : « J'annule une commande »

1. **Intention** : `CancelOrder { orderId, reason }` — validée
2. **Politique** : annulation permise dans cet état ? → machine à états Orders
3. **Organes** : Orders transitionne ; Inventory `release` ; Communication archive fil éphémère — transaction locale + Outbox **même transaction**
4. **Orchestration** : saga lit `capabilities()` du connecteur. Si `push_sales` → annulation POS ; sinon → notification commerçant « à faire manuellement »
5. **Transport** : worker Outbox publie, retente, journalise échec en conflit visible

---

## 8. Séparation des responsabilités

| Brique | Responsabilité | Autorité d'exécution | Emplacement cible |
|--------|----------------|----------------------|-------------------|
| **CDM** | Vocabulaire, schémas, propriété par attribut | Aucune — vocabulaire | `backend/src/lib/cdm/` |
| **Ontologie** | **Aucune au runtime.** Export dérivé (JSON-LD) pour doc/mapping si besoin | Jamais | Artefact généré, pas source |
| **Registres déclaratifs** | Types, cycles de vie, capacités, connecteurs | Lus, jamais exécutés | Pattern `eventRegistry.js` |
| **Moteur de règles** | Variabilité configurable (promos, seuils) | Bornée, auditée | Plus tard si besoin |
| **Orchestration** | Séquence, compensation, idempotence | Forte, sans règle métier organe | `backend/src/lib/orchestration/` |
| **Connecteurs (ACL)** | Traduire CDM ↔ dialecte externe, `capabilities()` | Nulle sur le métier | `backend/src/lib/integration/connectors/` |
| **Synchronisation** | Outbox, Inbox, réconciliation, conflits | Infrastructure | `backend/src/lib/integration/sync/` |
| **API** | Transport : commandes, projections, webhooks | Aucune | `backend/src/routes/v1/` |

**Renversement clé vs hypothèse ontologie :** l'ontologie n'est pas en amont, elle est en aval. Si besoin sémantique un jour → générer depuis le CDM. Dépendance : code → sémantique, jamais l'inverse.

---

## 9. Risques

### 9.1 Comparaison des deux approches

| Axe | Ontologie + compilateur | Architecture recommandée |
|-----|-------------------------|--------------------------|
| Performance runtime | Bonne après compilation — problème auto-créé | Bonne nativement ; coût réel = I/O, SQLite, API tierces |
| Maintenance | Élevée : compilateur, artefacts, expertise | Faible : JS lisible, patterns connus |
| Évolutivité | Théorique forte, pratique risquée | Forte : 3 registres Open/Closed en prod |
| Dette technique | Structurelle, difficile à sortir | Incrémentale, réversible |
| Débogage incident | Deux niveaux + build | Journal append-only + code |
| Bus factor | 1 | 2+ |

### 9.2 Risque non mentionné n°1 : les API tierces n'écrivent pas

La promesse « le commerçant ne dialogue plus qu'avec Ma Zone » dépend des **capacités d'écriture des API tierces** — souvent limitées, parfois inexistantes, rarement transactionnelles.

« Je ferme exceptionnellement demain » n'a souvent pas d'endpoint chez les caisses. Aucune ontologie ne créera cet endpoint.

**Conséquence produit :** l'interface doit assumer trois états par action — *fait automatiquement*, *fait partiellement*, *à faire vous-même*. Une boîte qui prétend tout faire et échoue en silence détruit la confiance plus vite qu'une boîte honnête sur ses limites.

### 9.3 Risque non mentionné n°2 : tension avec la position NF525

FD-000 et le plan affirment que Ma Zone n'est pas une caisse fiscale. Mais la vision « le commerçant ne dialogue plus qu'avec Ma Zone » implique qu'il **enregistre des ventes dans Ma Zone**. En France, dès qu'un logiciel enregistre les règlements de clients particuliers, la question réglementaire caisse se pose — et la V2 (POS Ma Zone) y va frontalement.

**À instruire avant** de construire l'orchestration d'écriture : peut redéfinir le périmètre V2, le calendrier, le choix de rester en lecture seule plus longtemps. Plus déterminant pour dix ans que ontologie vs registres.

---

## 10. Signerais-je cette architecture pour dix ans ?

**Non**, pas l'architecture ontologie + compilateur.

Refus non par ambition — par **déplacement d'effort au mauvais endroit**. Investir dans la représentation de la connaissance alors que les risques réels (sync fiable, capacités d'écriture API, conformité, vélocité connecteurs) ne sont pas adressés par l'ontologie.

Critère dur : refuser une architecture dont **une seule personne** peut assurer la maintenance.

### Ce que je signerais

- Stratégie boîte d'orchestration + substitution progressive (Strangler Fig)
- CDM typé + registres déclaratifs (modèle Wallet/Event existant)
- Machines à états explicites
- Process manager avec compensation
- Outbox fiable
- Connecteurs strictement isolés en ACL

Moins impressionnant sur un schéma. Debout, lisible et modifiable en 2036.

### Réexamen ontologie (déclencheurs)

Si dans 3 ans : 20+ connecteurs, maintenance mappings étouffe, ou commerçants configurent automatisations → introduire couche sémantique **dérivée** du CDM. Gagnée par l'expérience, pas postulée.

---

## 11. Recommandations immédiates

| # | Action | Priorité |
|---|--------|----------|
| 1 | **Acter la stratégie, refuser l'implémentation** : boîte d'orchestration + substitution progressive = oui ; ontologie exécutable = non (avec déclencheurs §4) | Immédiat |
| 2 | **Ajouter chapitre orchestration au plan Fondation API** : couche Intention → Commande + process manager (manquent aujourd'hui) | Court terme |
| 3 | **Instruire question conformité caisse** avant conception écriture vers POS | Avant Tranche D |
| 4 | **Formaliser en FD-002** (optionnel) : décision d'architecture, alternatives écartées, déclencheurs réexamen — pour aligner les deux Cursor | Si validation humaine |

---

## Annexe — Alignement avec le code existant

| Pattern existant | Fichier | Leçon pour Fondation API |
|------------------|---------|--------------------------|
| Registre Open/Closed | `walletRegistry.js` | Modèle pour `connectorRegistry` |
| Lifecycle déclaratif | `eventEngine/lifecycle.js` | Modèle pour Inventory state machine |
| Capabilities + handledBy | `walletRegistry.js` | Modèle pour effets orchestration délégués |
| Fail-fast validation | `validateCapabilityContract()` | À reproduire sur tout registre |
| Journal append-only | Wallet ledger, Event journal | Base observabilité orchestration |

**Principe FD-000 respecté :** « Surface compose, organe décide » — la décision métier reste dans l'organe ; l'orchestration séquence sans décider.

---

*Document généré le 2026-07-25 — Cursor Reda — Audit posture CTO, chantier Fondation API.*
