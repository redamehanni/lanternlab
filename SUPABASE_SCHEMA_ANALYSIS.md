# Ma Zone — Analyse intégrale de la base Supabase

**Document technique — Équipe de développement Ma Zone**

| | |
|---|---|
| **Version** | 1.0 |
| **Date** | juin 2026 |
| **Source** | `supabase/migrations/0001_init.sql`, `supabase/seed.sql`, `src/lib/data.ts` |
| **Périmètre** | Schéma PostgreSQL Supabase (version web Next.js) |

---

## Contexte architectural

Ma Zone possède **deux couches de données distinctes** dans ce dépôt :

| Couche | Technologie | Usage actuel |
|--------|-------------|--------------|
| **MVP mobile** | SQLite (`backend/data/mazone.db`) | Application Expo/React Native — **production locale** |
| **Web Next.js** | Supabase PostgreSQL | Maquette web optionnelle — **mode démo si non configuré** |

Ce rapport analyse **exclusivement la base Supabase** définie dans `supabase/migrations/0001_init.sql`.

---

## 1. Schéma relationnel complet

```mermaid
erDiagram
  auth_users ||--o| profiles : "1:1 cascade"
  profiles ||--o{ stores : "merchant_id"
  profiles ||--o{ orders : "consumer_id"
  profiles ||--o{ orders : "driver_id"
  profiles ||--o| driver_sessions : "1:1 cascade"
  stores ||--o{ inventory : "store_id cascade"
  products ||--o{ inventory : "product_id cascade"
  stores ||--o{ orders : "store_id cascade"
  products ||--o{ orders : "product_id cascade"

  auth_users {
    uuid id PK
    text email
    jsonb raw_user_meta_data
  }

  profiles {
    uuid id PK_FK
    user_role role
    text full_name
    text phone
    numeric rating
    timestamptz created_at
  }

  stores {
    uuid id PK
    uuid merchant_id FK
    text name
    text store_type
    text address
    float lat
    float lng
    timestamptz created_at
  }

  products {
    uuid id PK
    text name
    text category
    text image_url
    text sku
    timestamptz created_at
  }

  inventory {
    uuid id PK
    uuid store_id FK
    uuid product_id FK
    numeric price
    int stock
    boolean available
    timestamptz updated_at
  }

  orders {
    uuid id PK
    uuid consumer_id FK
    uuid store_id FK
    uuid product_id FK
    uuid driver_id FK
    order_status status
    fulfillment_type fulfillment
    numeric price
    text delivery_address
    int eta_minutes
    text customer_name
    timestamptz created_at
    timestamptz updated_at
  }

  driver_sessions {
    uuid driver_id PK_FK
    boolean is_online
    float lat
    float lng
    timestamptz updated_at
  }
```

---

## 2. Extensions et types énumérés

### Extension

| Extension | Usage |
|-----------|-------|
| `pgcrypto` | `gen_random_uuid()` pour les clés primaires |

### Enums

| Enum | Valeurs |
|------|---------|
| `user_role` | `consumer`, `merchant`, `driver` |
| `order_status` | `pending`, `preparing`, `ready`, `assigned`, `picked_up`, `delivering`, `delivered`, `cancelled` |
| `fulfillment_type` | `delivery`, `pickup` |

---

## 3. Tables détaillées

### 3.1 `auth.users` (schéma Supabase Auth — géré par Supabase)

Non créée par la migration Ma Zone, mais **référencée** par `profiles.id`.

| Colonne clé | Description |
|-------------|-------------|
| `id` | UUID — identité authentifiée |
| `email` | Email de connexion |
| `raw_user_meta_data` | JSON — rôle et nom passés à l'inscription |

**Trigger Ma Zone :** `on_auth_user_created` → crée automatiquement une ligne `profiles`.

---

### 3.2 `profiles`

Étend `auth.users` avec le rôle et les informations publiques.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `uuid` | **PK**, FK → `auth.users(id)` ON DELETE CASCADE | Identité |
| `role` | `user_role` | NOT NULL, DEFAULT `consumer` | Rôle applicatif |
| `full_name` | `text` | nullable | Nom affiché |
| `phone` | `text` | nullable | Téléphone |
| `rating` | `numeric(2,1)` | DEFAULT 5.0 | Note utilisateur |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | Date création |

**RLS :** activé — lecture/écriture de son propre profil uniquement.

**Données seed :** aucune (créées à l'inscription via trigger).

---

### 3.3 `stores`

Commerces de la zone de livraison.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `uuid` | **PK**, DEFAULT gen_random_uuid() | Identifiant |
| `merchant_id` | `uuid` | FK → `profiles(id)` ON DELETE SET NULL | Commerçant propriétaire |
| `name` | `text` | NOT NULL | Nom du commerce |
| `store_type` | `text` | nullable | Catégorie (ex. High-tech) |
| `address` | `text` | NOT NULL | Adresse postale |
| `lat` | `double precision` | NOT NULL | Latitude |
| `lng` | `double precision` | NOT NULL | Longitude |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | Date création |

**Index :** aucun dédié (hors PK).

**RLS :** lecture publique (`select using (true)`).

**Données seed :** 5 commerces (Paris 1er–4e) — Gaming, Fnac, Carrefour, Apple Store, Boulanger.

**Écart code :** `data.ts` référence `store.delivery_minutes` — **colonne absente du schéma**.

---

### 3.4 `products`

Catalogue produit global (indépendant des commerces).

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `uuid` | **PK**, DEFAULT gen_random_uuid() | Identifiant |
| `name` | `text` | NOT NULL | Nom produit |
| `category` | `text` | nullable | Catégorie |
| `image_url` | `text` | nullable | URL image |
| `sku` | `text` | nullable | Référence SKU |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | Date création |

**RLS :** lecture publique.

**Données seed :** 6 produits (Switch, chargeur, casque, HDMI, perceuse, livre).

**Manquant vs MVP SQLite :** `description`, `barcode`, `active`, lien direct `store_id`.

---

### 3.5 `inventory`

Lien commerce ↔ produit avec prix et stock local.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `uuid` | **PK**, DEFAULT gen_random_uuid() | Identifiant |
| `store_id` | `uuid` | NOT NULL, FK → `stores(id)` ON DELETE CASCADE | Commerce |
| `product_id` | `uuid` | NOT NULL, FK → `products(id)` ON DELETE CASCADE | Produit |
| `price` | `numeric(10,2)` | NOT NULL | Prix unitaire |
| `stock` | `integer` | NOT NULL, DEFAULT 0 | Stock disponible |
| `available` | `boolean` | NOT NULL, DEFAULT true | Disponible à la vente |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT now() | Dernière MAJ |
| — | — | **UNIQUE (store_id, product_id)** | Un seul prix/stock par paire |

**Index :** `idx_inventory_product` sur `product_id`.

**RLS :** lecture publique ; écriture réservée au commerçant propriétaire du store.

**Données seed :** 11 lignes d'inventaire (prix + stock par commerce).

---

### 3.6 `orders`

Commandes clients.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | `uuid` | **PK**, DEFAULT gen_random_uuid() | Identifiant |
| `consumer_id` | `uuid` | FK → `profiles(id)` ON DELETE SET NULL | Client |
| `store_id` | `uuid` | NOT NULL, FK → `stores(id)` ON DELETE CASCADE | Commerce |
| `product_id` | `uuid` | NOT NULL, FK → `products(id)` ON DELETE CASCADE | Produit |
| `driver_id` | `uuid` | FK → `profiles(id)` ON DELETE SET NULL | Livreur assigné |
| `status` | `order_status` | NOT NULL, DEFAULT `pending` | Statut commande |
| `fulfillment` | `fulfillment_type` | NOT NULL, DEFAULT `delivery` | Livraison ou retrait |
| `price` | `numeric(10,2)` | NOT NULL | Montant |
| `delivery_address` | `text` | nullable | Adresse livraison |
| `eta_minutes` | `integer` | nullable | ETA estimée |
| `customer_name` | `text` | nullable | Nom client (affichage) |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | Création |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT now() | MAJ |

**Index :** `idx_orders_store`, `idx_orders_driver`, `idx_orders_status`.

**RLS :** lecture/écriture pour consommateur, livreur assigné, ou commerçant du store.

**Données seed :** aucune commande en seed.

**Manquant vs MVP SQLite :**
- Pas de `quantity` (toujours 1 produit implicite)
- Pas de table `missions` séparée
- Statuts différents du MVP mobile (`pending_driver`, `driver_assigned`, etc.)
- Pas de `total_price` distinct du `price`

---

### 3.7 `driver_sessions`

Session en ligne du livreur et position GPS.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `driver_id` | `uuid` | **PK**, FK → `profiles(id)` ON DELETE CASCADE | Livreur |
| `is_online` | `boolean` | NOT NULL, DEFAULT false | Disponible |
| `lat` | `double precision` | nullable | Position |
| `lng` | `double precision` | nullable | Position |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT now() | Dernière MAJ |

**RLS :** le livreur gère uniquement sa propre session.

**Données seed :** aucune.

**Écart MVP SQLite :** en SQLite, `driver_online` est une colonne sur `users` ; en Supabase, table dédiée (meilleure séparation).

---

## 4. Sécurité (RLS) et triggers

### Row Level Security

| Table | Politique | Règle |
|-------|-----------|-------|
| `products` | `read products` | SELECT public |
| `stores` | `read stores` | SELECT public |
| `inventory` | `read inventory` | SELECT public |
| `inventory` | `merchant writes inventory` | ALL si merchant du store |
| `profiles` | `read/update own profile` | auth.uid() = id |
| `orders` | `read/update related orders` | consumer, driver, ou merchant du store |
| `orders` | `consumer creates order` | INSERT si consumer_id = auth.uid() |
| `driver_sessions` | `driver manages session` | ALL si driver_id = auth.uid() |

### Trigger

| Nom | Événement | Action |
|-----|-----------|--------|
| `on_auth_user_created` | AFTER INSERT on `auth.users` | Crée `profiles` avec rôle et nom depuis metadata |

---

## 5. Données déjà stockées (seed)

| Table | Volume seed | Contenu |
|-------|-------------|---------|
| `stores` | 5 lignes | Commerces zone pilote Paris |
| `products` | 6 lignes | Catalogue produits |
| `inventory` | 11 lignes | Prix et stocks par commerce |
| `profiles` | 0 | Créés à l'inscription Auth |
| `orders` | 0 | Créés à la commande runtime |
| `driver_sessions` | 0 | Créés par le livreur |

**Total seed :** catalogue uniquement, pas de données transactionnelles.

---

## 6. Comparaison Supabase vs MVP SQLite (mobile)

Le MVP mobile actif utilise **17+ tables SQLite** absentes ou incomplètes dans Supabase :

| Fonctionnalité MVP mobile | SQLite | Supabase |
|---------------------------|--------|----------|
| Utilisateurs + auth | `users` (email/password) | `auth.users` + `profiles` |
| Missions livreur | `missions` (table dédiée) | `orders.driver_id` seulement |
| Messagerie commande | `conversations` + `messages` | **Absent** |
| Adresses client | `client_addresses` | **Absent** |
| Panier | `cart_items` | **Absent** |
| Favoris | `store_favorites` | **Absent** |
| Promotions | `promotions` | **Absent** |
| Broadcast livreur | `driver_broadcast` | **Absent** |
| Notifications | `driver_notifications`, `merchant_notifications` | **Absent** |
| Support | `support_threads`, `support_messages` | **Absent** |
| Statuts commande | 7+ statuts dispatch | 8 statuts enum différents |
| Quantité commande | `quantity` | **Absent** |
| En ligne livreur | `users.driver_online` | `driver_sessions` |
| Temps réel | Socket.io | Supabase Realtime (orders only) |

---

## 7. Données manquantes pour la vision long terme

### 7.1 Déjà partiellement couvert

- Catalogue multi-commerces (`stores`, `products`, `inventory`)
- Commandes mono-produit (`orders`)
- Auth multi-rôles (`profiles` + RLS)
- Session livreur (`driver_sessions`)
- Temps réel basique (Realtime sur `orders`)

### 7.2 Manquant — critique pour parité MVP mobile

| Besoin | Impact |
|--------|--------|
| Table `missions` | Dispatch, workflow livreur, missions fantômes |
| `conversations` + `messages` | Chat client/commerçant/livreur |
| `cart_items` | Panier multi-articles |
| `promotions` | Offres flash, réductions |
| `client_addresses` | Carnet d'adresses |
| `store_favorites` | Favoris client |
| Alignement statuts `order_status` | Cohérence mobile ↔ web |
| `quantity` sur commandes | Commandes multi-quantité |

### 7.3 Manquant — vision long terme Ma Zone

| Domaine | Données absentes |
|---------|------------------|
| **Paiements** | transactions, refunds, commissions livreur, facturation commerçant |
| **Géolocalisation** | historique positions livreur, zones de livraison, géofencing |
| **Dispatch avancé** | file d'attente, logs dispatch, offres courses |
| **Évaluations** | reviews commande, notes livreur/commerçant (rating existe mais non alimenté) |
| **Admin / ops** | audit logs, config plateforme, modération |
| **Marketing** | campagnes, coupons, parrainage |
| **Stock avancé** | mouvements stock, alertes rupture, sync ERP |
| **Légal / conformité** | consentements RGPD, documents livreur (permis, assurance) |
| **Analytics** | événements, KPIs, rapports commerçant |
| **Notifications push** | tokens device, préférences notification |

---

## 8. Nouvelles tables recommandées

### Phase 1 — Parité MVP mobile (priorité haute)

| Table | Description | Relations clés |
|-------|-------------|----------------|
| `missions` | Course livreur liée à une commande | `order_id` → orders, `driver_id` → profiles |
| `conversations` | Fils de chat par commande et paire d'acteurs | `order_id`, `user_a`, `user_b`, `kind` |
| `messages` | Messages dans une conversation | `conversation_id`, `sender_id` |
| `cart_items` | Panier client | `consumer_id`, `product_id`, `store_id`, `quantity` |
| `promotions` | Promotions par produit/commerce | `store_id`, `product_id`, type, prix promo |
| `client_addresses` | Adresses enregistrées | `consumer_id`, address, lat, lng |
| `store_favorites` | Commerces favoris | `consumer_id`, `store_id` |

### Phase 2 — Opérations et notifications

| Table | Description |
|-------|-------------|
| `driver_broadcast` | Messages globaux plateforme → livreurs |
| `notifications` | Notifications unifiées (user_id, type, read, payload JSON) |
| `support_threads` | Fils assistance Ma Zone |
| `support_messages` | Messages support |

### Phase 3 — Monétisation et scale

| Table | Description |
|-------|-------------|
| `payments` | Paiements Stripe/similaire liés aux commandes |
| `driver_earnings` | Gains par mission, commissions |
| `delivery_zones` | Zones géographiques et tarifs |
| `dispatch_logs` | Traçabilité attributions livreur |
| `order_events` | Historique statuts (audit trail) |
| `reviews` | Avis post-livraison |
| `driver_documents` | KYC livreur (permis, assurance) |

### Colonnes à ajouter aux tables existantes

| Table | Colonnes suggérées |
|-------|-------------------|
| `stores` | `description`, `photo_url`, `category`, `story`, `delivery_minutes`, `phone`, `email` |
| `products` | `description`, `barcode`, `active` |
| `orders` | `quantity`, `total_price`, aligner enum `order_status` |
| `profiles` | `address`, `lat`, `lng`, `photo_url`, `transport`, `vehicle_plate`, `first_name`, `last_name` |

---

## 9. Écarts schéma / code applicatif

| Problème | Détail |
|----------|--------|
| `delivery_minutes` sur stores | Utilisé dans `data.ts` L94, L204 — **non défini en SQL** |
| Statuts commande | Web : `pending→preparing→ready→assigned` ; Mobile : `pending_driver→driver_assigned→...` |
| Pas de missions | `acceptMission()` met `driver_id` sur `orders` directement |
| Mode démo par défaut | Sans `.env.local`, Supabase n'est pas utilisé — données en mémoire |
| `merchant_id` nullable | Stores seed sans commerçant associé |

---

## 10. Synthèse exécutive

La base Supabase Ma Zone est un **schéma initial minimal** (7 tables public + auth) conçu pour la maquette web Next.js. Elle couvre le **catalogue** (stores, products, inventory) et les **commandes basiques**, mais est **loin de la richesse du MVP mobile SQLite** qui fait tourner l'application Expo en production locale.

**Points forts actuels :**
- Modèle catalogue normalisé (produit global + inventaire par commerce)
- RLS et Auth Supabase intégrés
- Realtime sur les commandes
- Seed zone pilote Paris opérationnel

**Lacunes principales :**
- Pas de missions, messagerie, panier, promotions, favoris, support
- Statuts et modèle dispatch non alignés avec le mobile
- Aucune table paiement, analytics, ou conformité
- Écart code/schéma (`delivery_minutes`)

**Recommandation :** avant toute convergence mobile ↔ Supabase, exécuter une **migration Phase 1** (7 tables) et harmoniser l'enum `order_status` avec le moteur de commandes documenté dans `CURRENT_ARCHITECTURE.md`.

---

*Rapport généré par analyse statique du dépôt Ma Zone — juin 2026*
