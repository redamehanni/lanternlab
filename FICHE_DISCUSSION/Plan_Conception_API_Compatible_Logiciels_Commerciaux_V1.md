# Plan_Conception_API_Compatible_Logiciels_Commerciaux_V1

**Conception API & interopérabilité — Chapitre Fondation API compatible avec les logiciels commerciaux**

| | |
|---|---|
| **Nature** | Plan de conception / implémentation (PAS une fiche FD, PAS du code) |
| **Date** | 2026-07-24 |
| **Statut** | Brouillon — en attente de validation Adam / Reda avant code |
| **Chapitre** | Fondation API compatible avec les logiciels commerciaux |
| **Sources** | [`Cartographie_Metier_V1.md`](./Cartographie_Metier_V1.md) · FD-000 · code `backend/` / `mobile/` |
| **Suite** | Voir [FD-001](./FD-001-chantier-fondation-api-logiciels-commerciaux.md) · code selon plan de codage (pas encore exécuté) |
| **Ancien nom** | `Plan_Conception_API_Compatible_V1` (renommé 2026-07-24) |

> Ce document traduit la cartographie métier en conception technique.  
> Chaque choix ci-dessous doit pouvoir se justifier par une conclusion de `Cartographie_Metier_V1`.  
> Les logiciels externes sont des **adapters jetables** ; le métier Ma Zone reste dans les organes.

---

# 1. Préambule — objectif, gouvernance, posture

## 1.1 Objectif final du chapitre

Modifier l’API Ma Zone pour qu’elle puisse coller à l’ensemble des logiciels qu’un commerçant utilise au quotidien (POS, e-commerce, stock, etc.), **sans** :

- casser l’architecture interne (*surface compose, organe décide*) ;
- dépendre d’un éditeur externe dans le cœur ;
- imposer au commerçant d’abandonner sa caisse le jour 1.

**Critère de fin de chapitre (minimum) :**

1. Contrats API métier versionnés (`/v1`) alignés CDM.
2. Inventory Engine (triple état) branché sur le flux commande.
3. Integration Engine + au moins un chemin connecteur opérationnel (natif et/ou unified).
4. Sync fiable (Inbox/Outbox, idempotence, réconciliation).

**Mémoire officielle du chapitre :** [FD-001](./FD-001-chantier-fondation-api-logiciels-commerciaux.md) (récit jusqu’au plan de codage ; à mettre à jour après le code).

## 1.2 Gouvernance FD

| Moment | Livrable | FD ? |
|--------|----------|------|
| Fait | Cartographie_Metier_V1 | Non |
| Fait | Ce plan de conception (doc technique) | Non |
| Fait | [FD-001](./FD-001-chantier-fondation-api-logiciels-commerciaux.md) — récit pour Reda / Adam | **Oui** |
| Après validation | Modification code (tranches A–C–E) | Non (mettre à jour FD-001) |
| Fin de chapitre | Amendement FD-001 (résultats) — **pas** de FD-002 architecture séparée | Mise à jour |

L’ancien plan d’architecture d’interopérabilité est **absorbé** ici.

## 1.3 Posture

Architecte-chercheur : le plan ne confirme pas Ma Zone, il impose les contraintes métier découvertes (propriété par attribut, miroir naïf dangereux, séparation on_hand / ATP, ISCA, etc.).

## 1.4 Chaîne du chapitre

```
Cartographie_Metier_V1 → Plan_Conception (ce doc) → FD-001 (récit) → Code → amendement FD-001
```

---

# 2. Conclusions cartographie qui contraignent l’API

Issues de [`Cartographie_Metier_V1.md`](./Cartographie_Metier_V1.md) — contraintes normatives pour la conception :

| # | Conclusion métier | Impact API / organes |
|---|-------------------|----------------------|
| C1 | Besoin avant outil ; logiciels = manifestations temporaires | Domaines API nommés par **besoin métier**, pas par marque |
| C2 | Un attribut = un propriétaire | Matrice CDM + règles de conflit (§4, §5) |
| C3 | Stock physique ≠ disponibilité promise | Triple état obligatoire (§6) |
| C4 | Données chaudes / froides / immuables | Sync différenciée (§8) |
| C5 | Décisions (remise, remboursement…) > données seules | Droits / policies, pas seulement CRUD |
| C6 | Verticaux hétérogènes (SKU / table / créneau) | CDM Offre extensible ; ne pas forcer tout en « panier SKU » |
| C7 | Miroir naïf multi-canal = drift | Journal mouvements + réservation + réconciliation |
| C8 | Cumul « OS du commerce » = risque de flou | Séquencer les rôles Ma Zone (canal + ATP d’abord) |
| C9 | ISCA / NF525 = prérequis FR | Ne pas prétendre être la caisse fiscale sans cadre ; tickets externes restent chez le POS |
| C10 | Event-driven + idempotence = invariant | Outbox/Inbox généralisés |

---

# 3. Philosophie d’interopérabilité

## 3.1 Principes fondateurs

1. **Ma Zone ne dépend jamais d’un logiciel externe** dans son cœur métier.
2. **Les logiciels externes sont des connecteurs** (adapters) enregistrés dans un registre.
3. **Le CDM Ma Zone est le seul langage interne** — pas la seule vérité du monde réel.
4. **Les connecteurs traduisent** (Anti-Corruption Layer) : `toCanonical` / `fromCanonical`.
5. **Surface compose, organe décide** (FD-000) — routes et adapters n’implémentent pas de règles métier.
6. **OV = stratégie de diffusion**, pas un type d’événement.
7. **Wallet = objets numériques**, pas PSP.

## 3.2 Architecture logique

```
Logiciels commerçant (Shopify, Lightspeed, POS FR, Chift…)
        │
        ▼
┌─────────────────────────────┐
│  Adapters (ACL)             │  connectorRegistry
│  auth · pull · push · map   │
└─────────────┬───────────────┘
              ▼
┌─────────────────────────────┐
│  CDM Ma Zone                │  dictionnaire + matrice propriété
└─────────────┬───────────────┘
              ▼
┌─────────────────────────────┐
│  Organes                    │  Inventory · Orders · Event · Wallet…
└─────────────┬───────────────┘
              ▼
┌─────────────────────────────┐
│  API REST /v1 + webhooks    │  OpenAPI 3.1 · AsyncAPI
│  Apps Ma Zone + partenaires │
└─────────────────────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Sync Outbox / Inbox        │  idempotence · réconciliation
└─────────────────────────────┘
```

## 3.3 Stack retenue (V1 chapitre)

| Choix | Retenu | Exclu V1 |
|-------|--------|----------|
| Style API | REST + OpenAPI 3.1, `/v1` | GraphQL public |
| Événements | AsyncAPI 3.0 (webhooks/sync) | Kafka obligatoire |
| Intégration | Hybride natifs + unified (Chift = un adapter) | iPaaS comme cerveau |
| Persistance sync | SQLite WAL + batch workers | Microservices day-1 |
| Patterns | Ports/ACL, Outbox/Inbox, journaux append-only | LWW global |

---

# 4. CDM V1 — Modèle Canonique

## 4.1 Définition

Le **CDM** est le dictionnaire métier interne de Ma Zone : entités, attributs, cycles de vie, identifiants (`id` Ma Zone + `external_ref` vers systèmes tiers).

Il n’implique **pas** que Ma Zone possède tous les attributs. Pour chaque attribut :

- **propriétaire** — Ma Zone écrit et fait foi ;
- **miroir** — Ma Zone lit/copie ; la source externe fait foi ;
- **calculateur** — dérivé, jamais persisté comme vérité écrasable.

## 4.2 Entités pivots V1

| Entité CDM | Rôle | Notes cartographie |
|------------|------|--------------------|
| `Store` | Commerce | Lien merchant |
| `Offer` / `Product` | Offre vendable | SKU retail ; extensions futures (prestation, ligne carte) |
| `Variant` | Déclinaison | optionnelle |
| `CatalogPublication` | Vue publiée canal | gates « ready to publish » |
| `StockLevel` | Triple état | §6 |
| `StockMovement` | Journal append-only | deltas / raisons |
| `Customer` | Fiche client | golden record / survivorship plus tard |
| `Order` | Commande | machine à états existante enrichie |
| `PaymentIntent` | Intention paiement | frontière PSP — pas Wallet |
| `Delivery` / `Mission` | Livraison | organe Dispatch existant |
| `Event` | Initiative locale | Event Engine existant |
| `OpportunityDiffusion` | OV | diffusion, pas type |
| `WalletObject` | Objet numérique | Wallet Engine existant |
| `ExternalBinding` | Mapping `external_ref` | connector + resource + external_id |
| `SyncConflict` | Conflit journalisé | §5 |

## 4.3 Matrice de propriété (attributs critiques produit / stock)

| Attribut | Rôle MZ | Propriétaire effectif typique | Sync |
|----------|---------|-------------------------------|------|
| `sku` / `ean` | miroir ou propriétaire si créé MZ | POS / commerçant | Rare ; immuable après publish |
| `name` | miroir (défaut) ou propriétaire | Commerçant / catalogue | Froide |
| `description` | miroir | Commerçant | Froide |
| `photos` | miroir | Commerçant | Froide / batch |
| `price` | miroir (défaut) | Commerçant / POS | Chaude |
| `cost` | non exposé canaux | Achats | Interne |
| `tax` | miroir | Commerçant / fiscal | Froide |
| `on_hand` | **miroir** | **POS physique** | Très chaude |
| `reserved` | **propriétaire** | **Ma Zone** | Interne + API MZ |
| `available` | **calculateur** | — | Diffusé |
| `safety_buffer` | propriétaire | Politique magasin MZ | Config |

Pour une offre **née dans Ma Zone** sans POS : `name`, `price`, `on_hand` peuvent être propriétaires MZ jusqu’à connexion d’un POS (bascule documentée dans `ExternalBinding`).

## 4.4 Identité externe

```
ExternalBinding {
  mazone_entity_type,   // product | order | customer…
  mazone_id,
  connector_id,         // shopify | zettle | lightspeed | chift | …
  external_id,
  external_location_id?, // outlet / shop
  last_source_updated_at,
  last_synced_at
}
```

---

# 5. Politique d’arbitrage des conflits — Qui gagne ?

## 5.1 Principe

**Pas de Last-Write-Wins global.**  
Chaque attribut a une règle. Un conflit = tentative d’écriture par une source non autorisée, ou deux sources concurrentes sur un attribut mal classé.

## 5.2 Matrice normative de résolution

| Classe | Attributs | Qui écrit | Règle de conflit |
|--------|-----------|-----------|------------------|
| Physique magasin | `on_hand` | POS / inventaire (via adapter) | **Priorité POS physique** : appliquer si `source_updated_at` POS ≥ dernière application ; Ma Zone **n’écrase jamais** `on_hand` |
| Engagement MZ | `reserved` | Organe Inventory seul | **Ma Zone gagne toujours** ; webhook externe ignoré pour `reserved` (log) |
| Calculé | `available` | Personne | Recalcul uniquement ; écriture rejetée |
| Contenu catalogue | name, description, photos | Propriétaire déclaré | Propriétaire gagne ; écriture secondaire → **rejet** + `SyncConflict` |
| Prix | `price` | Propriétaire déclaré | Idem contenu |
| Identifiants | sku, ean, external_ref | Création contrôlée | Immuables après publication ; conflit = alerte mapping (pas d’auto-merge silencieux) |
| Statut commande MZ | order.status | Orders/Dispatch | Machine à états MZ ; miroir sortant possible, entrant seulement via transitions autorisées |

## 5.3 Métadonnées obligatoires sur tout événement sync

```
source                // connector_id + account
source_updated_at     // horodatage côté source
idempotency_key       // unique par événement métier
correlation_id        // traçabilité
schema_version
```

## 5.4 Journal `SyncConflict`

Chaque rejet / collision enregistre : attribut, valeur proposée, valeur retenue, source perdante, raison (`owner_priority` | `stale_timestamp` | `immutable` | `computed_field`), payload résumé.

**Interdit :** silent LWW sur `on_hand` ou `reserved`.

## 5.5 Exemple concurrent (vente caisse + commande Shopify/MZ)

1. POS vend 1 unité → adapter → baisse `on_hand` (miroir POS).
2. Quasi simultanément, commande Ma Zone → `reserve(1)` sur `reserved` si `available >= 1` **au moment de la transaction**.
3. Si `available` devient 0 après le miroir POS, la réserve échoue (409) — pas de double promesse.
4. Pas de « POS et MZ décrémentent le même compteur » : compteurs séparés.

---

# 6. Inventory Engine — triple état

## 6.1 Modèle obligatoire

```
available = on_hand - reserved - safety_buffer
```

| Champ | Sens | Qui écrit |
|-------|------|-----------|
| `on_hand` | Stock physique magasin/entrepôt | Miroir POS / inventaire / réception |
| `reserved` | Quantité engagée (commandes MZ / paniers validés) | Inventory Engine |
| `safety_buffer` | Coussin politique (optionnel, défaut 0) | Config magasin |
| `available` | Vendable / diffusé aux canaux | **Calculé** — jamais stocké comme vérité écrasable (projection cache OK si invalidée) |

**Interdit** comme vérité unique : `products.quantity` actuel.

## 6.2 Journal `StockMovement` (append-only)

Types de mouvement (V1) :

- `mirror_set` / `mirror_delta` — sync POS
- `reserve` / `release` / `commit` — cycle commande MZ
- `adjust` — inventaire manuel Épée (si mode sans POS ou correction)
- `damage` / `expire` — démarque (vertical alimentaire plus tard)

Chaque ligne : `product_id`, `store_id`, `type`, `delta_on_hand`, `delta_reserved`, `reason`, `idempotency_key`, `source`, `created_at`.

## 6.3 API organe (interne)

```
syncOnHand(productId, value|delta, meta)   // miroir POS
reserve(orderId, lines[])                  // idempotent
release(orderId)                           // annulation
commit(orderId)                            // livraison : on_hand et reserved baissent
getSellableQty(productId) -> available
recomputeAvailable(productId)
```

## 6.4 Flux nominaux

**A. Vente en caisse physique**

1. Webhook / pull POS → `syncOnHand`  
2. Recalcul `available`  
3. Si `available == 0` → rupture canaux MZ (marketplace, affichage)

**B. Commande Ma Zone**

1. `reserve` si `available >= qty`  
2. Création order + dispatch (existant)  
3. Livraison → `commit` ; annulation → `release`

**C. Lien Lanternes / OV / marketplace**

- La **diffusion** et l’affichage marketplace lisent `available` (ou un seuil `available > 0`).
- Une OV / promo ne doit pas promettre un stock que `available` ne couvre pas (règle organe, pas UI).

## 6.5 Migration depuis `products.quantity`

État actuel ([`backend/src/routes/orders.js`](../backend/src/routes/orders.js)) : décrément direct `products.quantity` à la commande.

Chemin de transition (conception) :

| Phase | Comportement |
|-------|----------------|
| T0 | Ajouter colonnes / table `stock_levels` ; backfill `on_hand = quantity`, `reserved = 0` |
| T1 | Lectures sellable via Inventory ; écritures commande via `reserve`+`commit` |
| T2 | Connecteurs mettent à jour `on_hand` ; `quantity` devient vue dérivée ou deprecated |
| T3 | Supprimer les UPDATE quantity directs hors organe |

Pas de schéma SQL final figé ici — uniquement le chemin.

## 6.6 Verticaux

| Vertical | Application V1 |
|----------|----------------|
| Retail / épicerie | Triple état SKU standard |
| CHR | V1 : stock matières optionnel / plus tard ; offre carte ≠ SKU rayon — ne pas forcer |
| Services | Souvent `on_hand` N/A ; capacité = agenda (hors Inventory V1) — documenter limite |

---

# 7. Domaines API (REST `/v1`)

## 7.1 Principes

- Resource-oriented, **métier**, pas écrans.
- Version URI : `/api/v1/...` (coexistence progressive avec routes actuelles `/api/...` pendant migration).
- Contract-first : OpenAPI 3.1 ; webhooks décrits en AsyncAPI.
- Erreurs : problème JSON (aligné SumUp/RFC 9457 déjà cité côté SumUp) — `type`, `title`, `status`, `detail`, `code`.
- Auth : JWT citoyen / merchant / driver existant ; JWT admin séparé ; futurs **API keys OAuth partenaires** pour connecteurs sortants/entrants.
- Idempotency-Key header sur POST de commande, réserve, webhooks rejoués.

## 7.2 Domaines et responsabilités

| Domaine | Resources (esquisses) | Organe | Notes |
|---------|----------------------|--------|-------|
| **Stores** | `/stores`, `/stores/{id}` | stores | Existants enrichis |
| **Catalog** | `/products`, `/products/{id}`, publications | catalog + Inventory lecture | `available` exposé, pas `on_hand` aux clients |
| **Inventory** | `/inventory/{productId}`, `/inventory/movements` | Inventory Engine | Merchant : on_hand visible ; client : available |
| **Cart** | `/cart` | cart | Partagé deux âmes |
| **Orders** | `/orders`, transitions | Orders + Dispatch | reserve à la création |
| **Deliveries** | `/missions`… | Dispatch | Inchangé philosophiquement |
| **Customers** | `/customers/me`, adresses | users | Golden record plus tard |
| **Payments** | `/payments/...` (futur) | PSP séparé | Hors Wallet |
| **Events** | `/events`, publish, diffuse | Event Engine | Existants |
| **Opportunities** | inbox, accept/dismiss | diffusion | OV ≠ type event |
| **Wallet** | lecture objets | Wallet | Écriture via organes |
| **Identity** | presentation / verify | Identity | Présente, ne décide pas |
| **Communication** | threads | Communication | `openCommunication` |
| **Integrations** | `/integrations`, connectors, bindings | Integration Engine | Merchant connecte son POS |
| **Stats** | agrégats lecture | reporting | Pas de vérité métier |

## 7.3 Contrats d’interface esquissés (exemples)

**GET `/api/v1/products/{id}`** (client) — retourne prix, `available`, display ; **ne retourne pas** `on_hand` ni `cost`.

**GET `/api/v1/inventory/{productId}`** (merchant) — `{ on_hand, reserved, available, safety_buffer, updated_at }`.

**POST `/api/v1/orders`** — body lignes ; header Idempotency-Key ; effet : `reserve` puis createOrderWithDispatch ; 409 si `available` insuffisant.

**POST `/api/v1/integrations/{connectorId}/connect`** — OAuth / API key selon connector ; crée binding magasin.

**POST `/api/v1/webhooks/{connectorId}`** — signature vérifiée ; persist Inbox ; **202** ; pas de traitement métier synchrone lourd.

## 7.4 Ce que l’API ne fait pas (V1)

- Remplacer la caisse NF525 du commerçant.
- Être le ledger comptable.
- GraphQL public.
- Écriture `on_hand` depuis le client final.

---

# 8. Integration Engine & connecteurs

## 8.1 Emplacement futur

`backend/src/lib/integration/` + `connectorRegistry.js`  
Pattern Open/Closed identique à [`eventRegistry.js`](../backend/src/lib/eventEngine/eventRegistry.js).

## 8.2 Contrat `Connector` (esquissé)

```
capabilities() -> { products, inventory, orders, customers, webhooks, push_sales? }
authenticate(ctx)
pull(resource, cursor) -> { items, nextCursor }
push(resource, canonicalPayload) -> externalRef   // phase écrite
subscribeWebhooks(cfg) / verifyWebhook(req)
toCanonical(resource, externalPayload) -> CDM
fromCanonical(resource, cdmEntity) -> externalPayload
```

Un connector déclare ses capacités ; Ma Zone **négocie** (pas d’hypothèse « tout le monde a le stock temps réel »).

## 8.3 Stratégie hybride de couverture

| Couche | Rôle | Exemples |
|--------|------|----------|
| Natifs prioritaires | Profondeur | Shopify, Zettle, Lightspeed X-Series |
| Natif / partenaire FR | Retail & CHR locaux | Clictill, L’Addition (selon accès API) |
| Unified | Long-tail | **Chift** = un adapter `chift` |
| Manuel | Sans API | Import CSV / saisie Épée → même CDM |

Le cœur n’importe **jamais** le SDK Shopify directement dans Orders/Inventory — seulement via adapter.

## 8.4 Ordre de couverture recommandé

1. **Manuel / CSV / Épée** — prouve Inventory sans POS.  
2. **Shopify** — référence états inventaire + écosystème.  
3. **Zettle** — mouvements STORE/SOLD.  
4. **Lightspeed** — outlets / inventory API.  
5. **Chift** — couverture FR élargie.  
6. Clictill / L’Addition selon partenariats.

## 8.5 ExternalBinding & multi-outlet

Un produit MZ peut avoir N bindings (un par connector / outlet).  
`on_hand` est **par store_id MZ** (localisation) ; mapping outlet POS ↔ store MZ obligatoire.

---

# 9. Synchronisation — Outbox, Inbox, SQLite

## 9.1 Modes selon temporalité (cartographie §8)

| Donnée | Mode sync V1 |
|--------|----------------|
| `on_hand`, `available` (effet) | Webhook + pull court ; réconciliation |
| `price` | Webhook ou poll ≤ quelques minutes |
| Catalogue name/description/photos | Batch / poll horaire OK |
| Commandes MZ → POS (phase écrite) | Outbox event-driven |
| Tickets / écritures comptables | **Pas** sync écrasante ; export contrôlé plus tard |

## 9.2 Inbox (entrants)

1. Vérifier signature + timestamp.  
2. Dédupliquer `idempotency_key` (contrainte unique).  
3. Persister Inbox.  
4. Répondre **202**.  
5. Worker unique traite par **lots**, appelle `toCanonical` + organe.

## 9.3 Outbox (sortants)

1. Transaction métier (ex. `commit` stock + intention push vente POS) écrit Outbox **dans la même transaction SQLite**.  
2. Worker unique publie par lots.  
3. Marque `emitted` / retry avec backoff ; poison → DLQ logique (table `outbox_failed`).

## 9.4 Réconciliation

Job périodique par connector : pull inventaire / commandes non terminales ; converge vers POS pour `on_hand` ; détecte drift ; crée `SyncConflict` si écart inexplicable.

## 9.5 Contrainte SQLite — normative

**Déjà en place :** `journal_mode = WAL` ([`backend/src/db/index.js`](../backend/src/db/index.js)).

**Exigences supplémentaires à l’implémentation :**

| Exigence | Détail |
|----------|--------|
| `busy_timeout` | Ex. 5000 ms au boot |
| Workers | **1** Inbox + **1** Outbox (mutex) — pas N consumers writers |
| Batching | Taille configurable (défaut 50) ; transaction courte par lot |
| Webhook | ACK rapide ; zéro organe lourd dans la requête HTTP |
| Observabilité | Compteur / log `SQLITE_BUSY` ; seuil → planifier Postgres |
| Lectures | WAL permet lectures concurrentes pendant écriture worker |

**Interdit V1 :** plusieurs instances backend qui consomment Outbox/Inbox en parallèle sans élection de leader.

---

# 10. Alignement avec le code actuel Ma Zone

| Existant | Devenir |
|----------|---------|
| `products.quantity` | Migrer vers StockLevel triple état |
| `routes/orders.js` décrément direct | Appeler Inventory `reserve`/`commit` |
| `product:stock_updated` socket | Émettre `available` (et on_hand aux merchants) |
| Event Engine + registres | Inchangé philosophiquement ; lit `available` si besoin jauge |
| Wallet / Identity / Communication | Hors connecteurs POS ; inchangés |
| Dispatch / missions | Après reserve réussie |
| `mobile/src/api/index.js` | Pointer progressivement `/api/v1` |
| World Factory / Lab | Générer stock_levels dans recettes démo |
| FD-000 anti-patterns | Respectés (pas Next legacy, pas OV type, pas Wallet PSP) |

Nouveaux organes prévus :

- `backend/src/lib/inventory/` (Inventory Engine)
- `backend/src/lib/integration/` (Integration Engine + connectors/)

---

# 11. Roadmap d’implémentation par tranches

Sans FD entre tranches. Chaque tranche = critère d’acceptation.

### Tranche A — Contrats & squelette

- OpenAPI `/v1` minimal (products, inventory, orders, integrations).  
- Tables conceptuelles validées en migration boot.  
**Done :** spec publiée dans repo ; routes stub ou façade.

### Tranche B — Inventory Engine

- Triple état + movements + migration depuis `quantity`.  
- `reserve` / `release` / `commit` branchés sur création/annulation/livraison commande.  
**Done :** plus aucun UPDATE `quantity` hors organe ; test manuel oversell panier+commande.

### Tranche C — Integration Engine + connecteur Manuel

- `connectorRegistry` + connector `manual` / CSV.  
- Merchant peut définir on_hand via Épée → même organe.  
**Done :** magasin sans POS synchronisé via saisie.

### Tranche D — Premier connecteur natif lecture (Shopify)

- OAuth, pull products + inventory, webhooks Inbox, miroir `on_hand`.  
**Done :** vente Shopify/POS Shopify reflétée en `available` MZ < délai cible (ex. 1–2 min + webhook).

### Tranche E — Fiabilisation sync

- Outbox pour événements sortants préparés ; réconciliation ; journal conflits ; busy_timeout + workers batch.  
**Done :** scénario duplicate webhook sans double mouvement ; scénario conflit POS vs réserve documenté.

### Tranche F — Élargissement

- Zettle et/ou Lightspeed et/ou Chift.  
- Push vente MZ → POS **uniquement** si `capabilities.push` et décision magasin.  
**Done :** 2+ connectors live en lecture ; push optionnel sur 1.

### Critère chapitre « bouclé » (pour amender FD-001)

Tranches **A–E** faites ; F au moins démarrée ou explicitement scoped. API `/v1` utilisée par mobile pour stock sellable + commande. Puis **mise à jour** de [FD-001](./FD-001-chantier-fondation-api-logiciels-commerciaux.md) (résultats).

---

# 12. Risques et bonnes pratiques

| Risque | Mitigation |
|--------|------------|
| Drift miroir | Triple état + réconciliation + conflits journalisés |
| SQLITE_BUSY | WAL + busy_timeout + single worker + batch |
| Flou de rôle MZ | Roadmap : ATP/canal d’abord, pas « OS complet » day-1 |
| CHR / services mal modélisés | Limites V1 explicites (§6.6) |
| Dépendance Chift | Adapter interchangeable ; natifs en parallèle |
| Contaminer organes avec SDK | ACL strict ; revue : aucun `require('shopify')` dans orders.js |
| Double vérité client | Survivorship / golden record phase ultérieure |

---

# 13. Checklist avant de toucher au code

- [ ] Validation humaine de **ce** plan  
- [ ] Accord matrice conflits (§5)  
- [ ] Accord triple état (§6)  
- [ ] Accord contraintes SQLite (§9.5)  
- [ ] Accord ordre connectors (§8.4)  
- [ ] Relire FD-000 §22 anti-patterns  
- [ ] Relire [FD-001](./FD-001-chantier-fondation-api-logiciels-commerciaux.md) (contexte Reda / Adam)  

---

# 14. Lien avec FD-001

La mémoire du chapitre est dans [FD-001](./FD-001-chantier-fondation-api-logiciels-commerciaux.md) (récit jusqu’au plan de codage).

Après le code, **amender FD-001** (pas créer FD-002) avec :

1. Ce qui a été implémenté (tranches A–…).  
2. Écarts plan vs réel.  
3. Limites connues (CHR, services, Postgres).  
4. Suite éventuelle (push POS, plus de connectors).

---

# 15. Hors périmètre de ce document / chapitre minimum

- Certification NF525 de Ma Zone comme logiciel de caisse.  
- Remplacement forcé du POS commerçant.  
- Postgres / hébergeur prod (seuil seulement).  
- Kafka, GraphQL public, microservices.  
- Implémentation code (étape suivante après GO).

---

*Plan_Conception_API_Compatible_Logiciels_Commerciaux_V1 — Chapitre Fondation API — 2026-07-24*  
*Document de conception — pas une FD — pas du code.*
