# Audit technique — Wallet Engine v1 (Ma Zone)

**Date :** 14 juillet 2026  
**Périmètre :** Revue d'architecture read-only — aucune modification du moteur  
**Public :** Architecte logiciel / revue indépendante avant validation définitive  
**Version auditée :** Implémentation post-conception B / B+ / B++ (Phase II, première version professionnelle)

---

## Résumé exécutif

Le Wallet Engine v1 de Ma Zone est le **premier organe transversal** implémenté selon la philosophie validée en conception : registre personnel des objets numériques du citoyen, générique, extensible via un registre de types, avec journal append-only et projection d'état courant.

**Verdict : fondation architecturale saine (note CTO : B+, 14/20).** Le noyau transactionnel est robuste, lisible et aligné avec les conventions Ma Zone (`lib/` + routes + context mobile). **Aucun organe métier existant (Orders, Dispatch, Promotions, Communication) n'est encore branché** — seul un script de démonstration (`seed-wallet-demo.js`) émet des objets. C'est le principal risque opérationnel, pas un défaut de conception.

**Recommandation :** valider la fondation pour intégration progressive ; traiter l'autorisation inter-organes et le premier branchement Orders → `pickup_ticket` avant toute montée en charge.

---

## 1. Vision générale

### 1.1 Comment le Wallet Engine a été construit

Le Wallet Engine a été développé en respectant intégralement la trajectoire de conception **B → B+ → B++** :

- **Architecture B** : objet générique (`DigitalObject`), registre de types, machine à états, ledger append-only, projection pour lectures rapides.
- **B+** : séparation entitlement (couche dure) / présentation (couche souple), capacités déclaratives, facette souvenir post-consommation.
- **B++** : politique de rétention (`retention`), familles UX, préparation des guards contextuels et relations (non implémentés).

L'implémentation suit le **pattern organe Ma Zone** déjà éprouvé par `communicationEngine.js` et `dispatch.js` : module CommonJS dans `backend/src/lib/`, routes REST dans `backend/src/routes/`, tables SQLite au boot dans `db/index.js`, context React Native côté mobile.

### 1.2 Philosophie

> Le Wallet est le **registre personnel des objets numériques** du citoyen — pas un portefeuille financier, pas un moteur métier.

Chaque objet possède une identité (`kind`), un cycle de vie gouverné, des capacités contextuelles (déclarées, pas exécutées par le cœur), et peut survivre à la consommation de son droit principal (facette souvenir). Tous les objets parlent le **même langage architectural** ; leur sens métier reste dans le `payload` opaque et dans l'organe émetteur.

### 1.3 Responsabilité exacte

| In scope (Wallet) | Out of scope (autres organes) |
|-------------------|-------------------------------|
| Stocker les objets numériques du citoyen | Logique promotions, événements, commandes |
| Gouverner les transitions d'état (issue, consume, revoke) | Interpréter le contenu du `payload` |
| Journaliser chaque transition (audit + biographie) | Exécuter les actions métier des capacités |
| Valider les transitions via le registre de types | Identifier physiquement (QR Identity) |
| Exposer capacités et familles pour l'UI | Contenu live riche (résolu chez l'émetteur) |
| Émettre événements socket `wallet:*` | Routage inter-organes (Event Engine futur) |

### 1.4 Pourquoi cette architecture

| Approche | Décision |
|----------|----------|
| CRUD simple (`wallet_items`) | Rejetée — faible auditabilité, risque double-dépense |
| **B : registre + états + ledger + projection** | **Retenue** — auditable, extensible, compatible SQLite |
| Event Sourcing complet (C) | Reporté — surdimensionné MVP ; le ledger actuel en est le précurseur |

Le choix garantit qu'ajouter un type d'objet = **déclarer un `kind` dans le registre**, sans modifier le cœur transactionnel (Open/Closed).

---

## 2. Architecture

### 2.1 Schéma global

```
┌─────────────────────────────────────────────────────────────────────────┐
│  MOBILE (client)                                                        │
│  WalletTab → WalletStack                                                │
│    WalletScreen (hub familles) → WalletFamilyScreen → WalletObjectDetail│
│  WalletContext ← GET /api/wallet ← socket wallet:object_*               │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTP (lecture) + WebSocket
┌───────────────────────────────▼─────────────────────────────────────────┐
│  BACKEND                                                                │
│  routes/wallet.js (GET only, verifyToken)                               │
│       ↓                                                                 │
│  walletEngine.js ──→ walletRegistry.js (kinds, transitions, caps)      │
│       ↓                                                                 │
│  digital_objects (projection) + digital_object_events (ledger)          │
└───────────────────────────────▲─────────────────────────────────────────┘
                                │ in-process (require)
┌───────────────────────────────┴─────────────────────────────────────────┐
│  ORGANES ÉMETTEURS (futurs / démo)                                      │
│  Orders, Event, Marketing, QR Identity, seed-wallet-demo.js           │
│  → issueObject / consumeObject / revokeObject                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Backend — fichiers et responsabilités

| Fichier | Responsabilité |
|---------|----------------|
| [`backend/src/lib/walletRegistry.js`](backend/src/lib/walletRegistry.js) | Registre déclaratif : statuts, familles, kinds, transitions, capacités, rétention. Point d'extension unique (Open/Closed). |
| [`backend/src/lib/walletEngine.js`](backend/src/lib/walletEngine.js) | Moteur transactionnel : commandes (issue/consume/revoke), requêtes, projection enrichie, émission socket. Aucune logique métier par kind. |
| [`backend/src/routes/wallet.js`](backend/src/routes/wallet.js) | API HTTP **lecture seule** pour le propriétaire authentifié. |
| [`backend/src/db/index.js`](backend/src/db/index.js) | Schéma `digital_objects` + `digital_object_events` + index. |
| [`backend/src/index.js`](backend/src/index.js) | Montage `app.use('/api/wallet', walletRoutes)`. |
| [`backend/scripts/seed-wallet-demo.js`](backend/scripts/seed-wallet-demo.js) | Outil dev : peuple un Wallet client avec 6 objets de démo. |

### 2.3 Mobile — fichiers et responsabilités

| Fichier | Responsabilité |
|---------|----------------|
| [`mobile/src/context/WalletContext.js`](mobile/src/context/WalletContext.js) | Provider client : fetch familles, refresh socket-driven, hook `useWallet()`. |
| [`mobile/src/screens/client/WalletScreen.js`](mobile/src/screens/client/WalletScreen.js) | Hub principal : 6 familles d'objets (pattern `ClientMessagingHomeScreen`). |
| [`mobile/src/screens/client/WalletFamilyScreen.js`](mobile/src/screens/client/WalletFamilyScreen.js) | Liste des objets d'une famille. |
| [`mobile/src/screens/client/WalletObjectDetailScreen.js`](mobile/src/screens/client/WalletObjectDetailScreen.js) | Fiche objet : payload, capacités, biographie (ledger). |
| [`mobile/src/screens/client/walletStatus.js`](mobile/src/screens/client/walletStatus.js) | Libellés/couleurs statuts UI. |
| [`mobile/src/api/index.js`](mobile/src/api/index.js) | 6 exports GET wallet. |
| [`mobile/src/navigation/index.js`](mobile/src/navigation/index.js) | `WalletStack` + onglet `WalletTab` (4e tab client). |
| [`mobile/App.js`](mobile/App.js) | `<WalletProvider>` dans l'arbre de providers. |

### 2.4 Modèle de données

**Table `digital_objects` (projection d'état courant)**

| Colonne | Type | Rôle |
|---------|------|------|
| `id` | TEXT PK | UUID v4 |
| `owner_id` | TEXT FK → users | Propriétaire (citoyen) |
| `kind` | TEXT | Type déclaré dans le registre |
| `family` | TEXT | Regroupement UX (billets, retraits…) |
| `status` | TEXT | État entitlement courant |
| `retention` | TEXT | ephemeral / keepsake / entitlement_only |
| `payload` | TEXT (JSON) | **Opaque** au moteur |
| `source_engine` | TEXT | Organe émetteur |
| `source_ref` | TEXT | Référence externe (résolution live future) |
| `zone_id` | TEXT | Zone-aware (nullable) |
| `expires_at` | TEXT | Expiration déclarée (nullable, non enforced) |
| `created_at`, `updated_at` | TEXT | Horodatage |

**Table `digital_object_events` (ledger append-only)**

| Colonne | Type | Rôle |
|---------|------|------|
| `id` | TEXT PK | UUID |
| `object_id` | TEXT FK | Objet concerné |
| `type` | TEXT | issued, consumed, revoked, … |
| `from_status`, `to_status` | TEXT | Transition |
| `payload` | TEXT (JSON) | Données événement (ex. reason revoke) |
| `actor_engine` | TEXT | Organe acteur |
| `idempotency_key` | TEXT | Anti double-consommation (index unique partiel) |
| `created_at` | TEXT | Horodatage immuable |

### 2.5 Services publics du moteur (interface in-process)

**Commandes (écritures — appelées par les organes, pas exposées HTTP client) :**

```javascript
issueObject({ ownerId, kind, payload, sourceEngine, sourceRef?, zoneId?, expiresAt? }, io?)
consumeObject({ objectId, consumerEngine, idempotencyKey? }, io?)
revokeObject({ objectId, reason?, actorEngine }, io?)
```

**Requêtes (lectures) :**

```javascript
getObjectsByOwner(ownerId, { family?, kind?, status? })
getWalletByFamilies(ownerId)          // vue hub mobile
getObjectById(objectId, ownerId?)     // contrôle propriétaire si ownerId fourni
getCapabilitiesForObject(objectId, ownerId?)
getObjectEvents(objectId, ownerId?)     // biographie / ledger
getFamilies() / listKinds()             // métadonnées registre
```

### 2.6 Routes HTTP (lecture seule)

| Méthode | Route | Rôle |
|---------|-------|------|
| GET | `/api/wallet` | Vue par familles (écran principal) |
| GET | `/api/wallet/families` | Catalogue familles |
| GET | `/api/wallet/objects` | Liste plate (filtres query) |
| GET | `/api/wallet/objects/:id` | Détail objet |
| GET | `/api/wallet/objects/:id/capabilities` | Menu actions |
| GET | `/api/wallet/objects/:id/events` | Biographie ledger |

Toutes protégées par `verifyToken`. **Aucune route POST/PATCH/DELETE** — décision sécurité : empêcher l'auto-attribution d'objets par le client.

### 2.7 Événements Socket.io

| Événement | Émetteur | Room | Payload |
|-----------|----------|------|---------|
| `wallet:object_issued` | walletEngine | `user_{ownerId}` | `{ object }` |
| `wallet:object_consumed` | walletEngine | `user_{ownerId}` | `{ object }` |
| `wallet:object_revoked` | walletEngine | `user_{ownerId}` | `{ object }` |

Écoutés par `WalletContext` → `refresh()` automatique (Wallet « vivant » côté UI).

---

## 3. Flux de fonctionnement

### 3.1 Cycle de vie complet d'un objet numérique

```
[Organe émetteur]
      │
      ▼ issueObject()
  ┌─────────┐
  │ active  │◄──────────────────────────────────┐
  └────┬────┘                                   │
       │ consumeObject() (idempotent)            │ revokeObject()
       ▼                                        ▼
  ┌──────────┐                            ┌──────────┐
  │ consumed │                            │ revoked  │
  └────┬─────┘                            └──────────┘
       │ facette souvenir (isMemory=true)
       │ si keepsake + memoryEnabled
       ▼
  [Objet persiste en Wallet — patrimoine / keepsake]
```

**Archivage :** non implémenté en v1. Les objets `ephemeral` restent en base ; la politique `retention` est déclarée mais non appliquée par un job de purge.

### 3.2 Acteurs et permissions

| Acteur | Crée | Modifie état | Consomme | Consulte |
|--------|------|--------------|----------|----------|
| Organe émetteur (Event, Orders…) | `issueObject` | `revokeObject` | — | — |
| Organe consommateur (QR Identity futur) | — | — | `consumeObject` | — |
| Citoyen (app mobile) | — | — | — | GET `/api/wallet/*` (ses objets uniquement) |
| Script démo | `issueObject` / `consumeObject` | — | — | — |

### 3.3 Flux détaillé — émission

1. Organe appelle `wallet.issueObject({ ownerId, kind, payload, sourceEngine, ... })`
2. Moteur valide : kind connu, owner existe, sourceEngine présent
3. Transaction SQLite : INSERT `digital_objects` + INSERT event `issued`
4. Socket `wallet:object_issued` → room `user_{ownerId}`
5. Mobile `WalletContext` refresh → famille mise à jour

### 3.4 Flux détaillé — consommation (idempotente)

1. Organe (ex. QR Identity) appelle `consumeObject({ objectId, consumerEngine, idempotencyKey })`
2. Si `idempotencyKey` déjà présent dans le ledger → retour sans double effet
3. Vérification : kind consommable, transition autorisée, pas déjà consumed
4. Transaction : UPDATE status + INSERT event `consumed`
5. Projection enrichie : `isMemory=true` si keepsake + memoryEnabled
6. Capacités recalculées (ex. billet : Offrir disparaît, Revoir le souvenir apparaît)
7. Socket `wallet:object_consumed`

### 3.5 Communication inter-organes (modèle cible)

```
Organe émetteur ──issueObject()──▶ Wallet Engine
Organe consommateur ──consumeObject()──▶ Wallet Engine
Wallet Engine ──wallet:object_*──▶ Mobile (citoyen)
Organe propriétaire contenu ──resolveLive(sourceRef)──▶ Mobile (à venir)
Event Engine (futur) ◀── bus ── organes (pas via Wallet)
```

Le Wallet n'est **pas** le bus de messages inter-organes (principe B++). Il est le **contrat d'objets partagé** (couche des noms).

---

## 4. Intégration avec Ma Zone

### 4.1 État actuel vs prévu

| Organe | Connexion aujourd'hui | Intégration prévue |
|--------|----------------------|-------------------|
| **QR Identity** | Aucune | `consumeObject` au scan ; capability `show_qr` (`handledBy: wallet`) |
| **Marketplace** | Aucune | Émission objets post-achat (kinds à définir) |
| **Orders** | Aucune | `issueObject(pickup_ticket)` à la création commande ; `revokeObject` à annulation |
| **Dispatch** | Aucune | Consommation ticket retrait ; statut commande → enrichissement objet |
| **Communication** | Aucune | Capability `contact_merchant` → deep-link Communication Engine |
| **Delivery** | Aucune | Via Dispatch — pas de couplage direct Wallet ↔ livreur |
| **Notifications** | Partielle | Socket `wallet:object_*` vers `user_{id}` ; pas de push natif |
| **Promotions** | Aucune | `issueObject(promo_voucher)` depuis Marketing Engine |
| **Event Engine** | Aucune | `issueObject(event_ticket)` ; enrichissement live via `sourceRef` |

**Seul consommateur actuel :** [`backend/scripts/seed-wallet-demo.js`](backend/scripts/seed-wallet-demo.js) (`sourceEngine: 'demo_seed'`).

### 4.2 Kinds préparés dans le registre (prêts à l'emploi)

| Kind | Famille | Organe émetteur cible |
|------|---------|----------------------|
| `event_ticket` | billets | Event Engine |
| `pickup_ticket` | retraits | Orders / Dispatch |
| `promo_voucher` | promotions | Marketing |
| `loyalty_card` | fidélité | Marketing / Commerce |
| `badge` | badges | Event / Civic |
| `civic_points` | civique | Points Civiques (forme TBD) |

---

## 5. Philosophie des objets numériques vivants

### 5.1 Concepts conservés en v1

| Concept (B/B+/B++) | Implémentation v1 |
|--------------------|-------------------|
| Objet ≠ simple document | `DigitalObject` avec cycle de vie |
| Couche dure / souple | `status` gouverné vs `capabilities` + `isMemory` |
| Capacités par état | `getCapabilities(kind, status)` dans registre |
| « Que puis-je faire ? » | Section « Gérer cet objet numérique » (UI) |
| Souvenir post-consommation | `isMemory` = terminal + `memoryEnabled` + retention |
| Biographie | `digital_object_events` + section « Histoire de l'objet » |
| Patrimoine | `retention: keepsake` déclaré (filtre futur) |
| Payload opaque | JSON stocké, jamais interprété par le moteur |
| Référence source | `sourceEngine` + `sourceRef` (résolution live future) |

### 5.2 Volontairement laissé de côté (anti sur-ingénierie)

| Fonctionnalité | Raison |
|----------------|--------|
| `enrichObject()` | Handler non implémenté ; EVENT_TYPE déclaré seulement |
| `transferObject()` | Reporté ; capability `offer` déclarée sans exécution |
| `reserve` / `release` | Transitions déclarées, handlers absents |
| Relations inter-objets | Pas de table `object_relations` |
| Guards contextuels (`primaryWhen`) | Évaluation au bord mobile — non implémentée |
| Expiration automatique | Pas de `expireObject()` ni cron |
| Purge `retention: ephemeral` | Politique déclarée, non enforced |
| Exécution réelle des capacités | Mobile = Alert stub « géré par : {handledBy} » |
| Versioning payload | Absent |

### 5.3 Préparé pour le futur (extension sans refonte)

- Types d'événements ledger : `reserved`, `released`, `transferred`, `enriched`, `expired`
- Transitions `active → reserved → consumed` dans `DEFAULT_TRANSITIONS`
- Capabilities avec `handledBy: wallet | source | device` et `invocation`
- Index idempotence sur `(object_id, idempotency_key)`
- Champs `zone_id`, `expires_at`, `source_ref`

---

## 6. Interface utilisateur

### 6.1 Organisation et choix UX

Le Wallet est un **onglet principal** (`WalletTab`, 4e tab client) — pas dans le menu hamburger — conformément à la directive « expérience principale de Ma Zone ».

**Navigation à 3 niveaux :**

1. **WalletScreen** — Hub par **familles** (6 cartes : Billets, Retraits, Promotions, Fidélité, Badges, Points civiques), pas une liste chronologique. Pattern identique à `ClientMessagingHomeScreen`.
2. **WalletFamilyScreen** — Liste des objets de la famille, badge statut ou « Souvenir ».
3. **WalletObjectDetailScreen** — Fiche : payload brut, menu actions, timeline ledger.

**Pourquoi par familles :** prépare l'écosystème multi-organes sans surcharger l'écran ; chaque famille correspond à un domaine métier futur ; extensible en ajoutant une entrée dans `FAMILIES` du registre.

### 6.2 Comportement temps réel

`WalletContext` écoute `wallet:object_issued|consumed|revoked` et appelle `refresh()` — le Wallet se met à jour sans action utilisateur quand un organe émet ou consomme un objet.

### 6.3 Captures d'écran représentatives

Voir le fichier compagnon [`AUDIT_WALLET_ENGINE_SCREENS.html`](AUDIT_WALLET_ENGINE_SCREENS.html) — mockups fidèles au design system THEME avec données du seed de démonstration :

1. **Page principale** — 6 familles, compteurs, états vides/peuplés
2. **Famille Billets** — liste avec statut Actif / Souvenir
3. **Fiche billet actif** — payload, menu « Gérer » (QR, Offrir, Calendrier)
4. **Fiche billet consommé** — badge Souvenir, capacité « Revoir le souvenir », historique ledger

---

## 7. Séparation des responsabilités

### 7.1 Appartient au Wallet

- Persistance et propriété (`owner_id`)
- Validation et exécution des transitions d'état
- Intégrité transactionnelle (atomicité, idempotence consommation)
- Journal append-only (audit)
- Déclaration et exposition des capacités (descripteurs)
- Calcul facette souvenir (`isMemory`)
- Regroupement par familles (présentation)
- Émission événements socket propriétaire

### 7.2 Appartient aux autres moteurs

| Responsabilité | Organe |
|----------------|--------|
| Décider **quand** émettre un objet | Organe métier (Orders, Event…) |
| Contenu et sens du `payload` | Organe émetteur |
| Scan QR et validation identité | QR Identity |
| Exécution « Offrir », « Voir le commerce », « Contacter » | Organe indiqué par `handledBy` |
| Contenu live (photos event, promo actuelle) | Organe source via `sourceRef` |
| Logique promotion / fidélité / badge | Marketing, Event, Civic |
| Livraison physique | Dispatch (indépendant du Wallet) |

### 7.3 Vérification anti-fourre-tout

Inspection de `walletEngine.js` : **aucun `if (kind === 'event_ticket')` métier**. Toute connaissance type-spécifique est dans `walletRegistry.js` (déclaratif). Le moteur appelle uniquement `registry.canTransition`, `registry.getCapabilities`, `registry.getRetention`.

**Conclusion :** le Wallet reste un organe transversal. Il ne devient pas un moteur métier en v1.

---

## 8. Évolutivité

### 8.1 Ajouter un nouvel organe (ex. Event Engine)

```
1. Déclarer kind(s) dans walletRegistry.js (defineKind)
2. Depuis eventEngine.js : require('./walletEngine').issueObject(...)
3. (Optionnel) Écouter wallet:object_* ou laisser le mobile refresh seul
4. Mobile : nouvelle famille ou kind existant → affichage automatique via API
```

**Aucune modification de walletEngine.js requise** si le kind respecte les transitions par défaut.

### 8.2 Organes futurs — mapping prévu

| Organe | Kind(s) | Commande principale |
|--------|---------|---------------------|
| QR Identity | tous consommables | `consumeObject` |
| Marketing | `promo_voucher`, `loyalty_card` | `issueObject`, `revokeObject` |
| Event | `event_ticket`, `badge` | `issueObject`, enrichissement futur |
| Orders/Dispatch | `pickup_ticket` | `issueObject` à commande, `consumeObject` au retrait |
| Civic | `civic_points`, `badge` | `issueObject`, enrichissement |
| Stock | — | Pas de kind direct ; émission via Orders/Marketing |

### 8.3 Évolutions architecturales sans refonte

- Passage registre code → table DB (si kinds dynamiques)
- PostgreSQL + event store (scale)
- Event Engine bus (couche des verbes, distincte du Wallet)
- Capability router mobile (`handledBy` → navigation inter-écrans)

---

## 9. Dette technique

### 9.1 Compromis assumés

| Compromis | Justification | Impact |
|-----------|---------------|--------|
| Registre en JS (pas DB) | Simplicité MVP, 6 kinds statiques | Redéploiement pour nouveau kind |
| Écritures in-process only | Sécurité client, pattern organe Ma Zone | Nécessite discipline backend |
| SQLite | Cohérence stack MVP | Limites concurrence / volume |
| Capacités stub mobile | Fondation d'abord, organes pas prêts | UX actions non fonctionnelles |
| Pas d'intégration organe | Périmètre v1 = noyau sain | Wallet vide en prod sans seed |

### 9.2 Limites connues

1. **Aucune autorisation inter-organes** — tout module backend peut appeler `issueObject` sans allowlist `sourceEngine`.
2. **`expires_at` non enforced** — pas de job expiration.
3. **`retention: ephemeral` non appliquée** — objets éphémères persistent indéfiniment.
4. **Pas de versioning payload** — risque dérive schéma par kind.
5. **Événements `reserved/transferred/enriched/expired`** — types déclarés, handlers absents.
6. **Client-only** — pas de vue Wallet commerçant/livreur.
7. **Pas de tests automatisés** — validation manuelle + script verify éphémère.
8. **Pas de documentation organe** — `ORGANE_WALLET.md` absent.

### 9.3 Sujets prochaines versions

- Allowlist `sourceEngine` pour écritures
- Branchement Orders → `pickup_ticket`
- `expireObject` + scheduler
- Capability router mobile
- Purge rétention ephemeral
- Tests d'intégration idempotence / transitions

---

## 10. Auto-évaluation (regard CTO)

### 10.1 Note globale : **B+ (14/20)**

| Critère | Note | Commentaire |
|---------|------|-------------|
| Architecture / conception | 17/20 | Alignée B++, Open/Closed, ledger, séparation couches |
| Qualité code | 15/20 | Lisible, conventions Ma Zone, peu de dette structurelle |
| Robustesse transactionnelle | 16/20 | Idempotence, transactions SQLite, ownership |
| Intégration écosystème | 8/20 | Noyau seul, zéro organe branché |
| UX / complétude mobile | 13/20 | Hub solide, actions stub |
| Opérationnel / sécurité | 12/20 | Pas d'auth inter-organes, pas d'expiration |
| Documentation | 10/20 | Commentaires code OK, pas de doc organe dédiée |

### 10.2 Plus grandes qualités

1. **Fondation extensible** — registre + moteur générique : ajout de kinds sans toucher au cœur.
2. **Intégrité des droits** — ledger append-only + idempotence consommation : base saine pour QR Identity et droits à valeur.
3. **Cohérence Ma Zone** — même pattern que Communication/Dispatch ; risque faible pour l'équipe.

### 10.3 Principaux risques

1. **Wallet isolé** — sans branchement Orders/Event, la valeur utilisateur reste limitée au seed démo.
2. **API interne ouverte** — un bug ou module malveillant pourrait émettre des objets arbitraires.
3. **Capacités non exécutables** — risque perception « coquille vide » côté citoyen tant que les organes ne répondent pas aux `handledBy`.

### 10.4 Trois améliorations architecturales recommandées (sans développer maintenant)

1. **Couche d'autorisation inter-organes** — allowlist des `sourceEngine` autorisés à appeler issue/consume/revoke ; log structuré.
2. **Premier branchement production Orders → `pickup_ticket`** — preuve d'intégration bout-en-bout, validation du modèle in-process.
3. **Capability router mobile** — mapper `handledBy` + `invocation` vers navigation/API des organes existants (remplacer Alert stub).

---

## 11. Annexes

### 11.1 Arborescence Wallet

```
backend/
├── src/
│   ├── db/index.js                    (modifié — tables wallet)
│   ├── index.js                       (modifié — route /api/wallet)
│   ├── lib/
│   │   ├── walletEngine.js            (créé)
│   │   └── walletRegistry.js          (créé)
│   └── routes/
│       └── wallet.js                  (créé)
└── scripts/
    └── seed-wallet-demo.js            (créé)

mobile/
├── App.js                             (modifié — WalletProvider)
└── src/
    ├── api/index.js                   (modifié — 6 endpoints wallet)
    ├── context/
    │   └── WalletContext.js           (créé)
    ├── navigation/index.js            (modifié — WalletStack + WalletTab)
    └── screens/client/
        ├── WalletScreen.js            (créé)
        ├── WalletFamilyScreen.js      (créé)
        ├── WalletObjectDetailScreen.js (créé)
        └── walletStatus.js            (créé)
```

### 11.2 Fichiers créés ou modifiés

**Créés (10) :** `walletEngine.js`, `walletRegistry.js`, `routes/wallet.js`, `seed-wallet-demo.js`, `WalletContext.js`, `WalletScreen.js`, `WalletFamilyScreen.js`, `WalletObjectDetailScreen.js`, `walletStatus.js`

**Modifiés (5) :** `db/index.js`, `backend/src/index.js`, `mobile/App.js`, `mobile/src/api/index.js`, `mobile/src/navigation/index.js`

### 11.3 Statuts d'objet (registre)

`pending` → `active` → `consumed` | `expired` | `revoked`  
Branches : `active` ↔ `reserved` (transitions déclarées, handlers reserve absents)

### 11.4 Familles UX

| id | label | icon |
|----|-------|------|
| billets | Billets | ticket-outline |
| retraits | Retraits | cube-outline |
| promotions | Promotions | pricetag-outline |
| fidelite | Fidélité | heart-outline |
| badges | Badges | ribbon-outline |
| civique | Points civiques | leaf-outline |

### 11.5 Routes navigation mobile

| Route | Écran |
|-------|-------|
| `WalletTab` → `WalletHome` | WalletScreen |
| `WalletTab` → `WalletFamily` | WalletFamilyScreen |
| `WalletTab` → `WalletObjectDetail` | WalletObjectDetailScreen |

### 11.6 Références conception

- [`PLAN_ETUDE_WALLET_ENGINE.md`](PLAN_ETUDE_WALLET_ENGINE.md) — Architecture B
- [`ANALYSE_OBJET_NUMERIQUE_VIVANT.md`](ANALYSE_OBJET_NUMERIQUE_VIVANT.md) — B+
- [`ANALYSE_OBJET_VIVANT_B_PLUS_PLUS.md`](ANALYSE_OBJET_VIVANT_B_PLUS_PLUS.md) — B++

---

*Rapport généré le 14 juillet 2026 — Audit read-only Wallet Engine v1, revue d'architecture avant validation définitive.*
