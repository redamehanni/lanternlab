# 01 — Registre des traitements (RGPD art. 30)

**Responsable de traitement (à compléter) :** `{{RAISON_SOCIALE}}`  
**Contact :** `{{EMAIL_CONTACT}}` · DPO éventuel : `{{DPO_CONTACT}}`  
**Date :** 2026-07-26 · **Version :** 1.0 (audit initial)

Bases légales utilisées ci-dessous = **hypothèses à valider** (voir DECISIONS-A-TRANCHER.md).

---

## T1 — Gestion des comptes utilisateurs

| Champ | Contenu |
|-------|---------|
| **Finalité** | Créer et authentifier les comptes client, commerçant, livreur |
| **Base légale (hyp.)** | Exécution du contrat (art. 6-1-b) |
| **Personnes** | Clients, commerçants, livreurs |
| **Données** | Nom, prénom, email, téléphone, adresse, photo, rôle, mot de passe hashé, lat/lng profil, plaque véhicule (livreur) |
| **Source** | Formulaire inscription / profil — `RegisterScreen.js`, `auth.js`, table `users` |
| **Destinataires** | Hébergeur futur du backend ; pas de sous-traitant auth tiers aujourd’hui |
| **Transferts hors UE** | Non (SQLite local) — à revoir si hébergement cloud hors UE |
| **Durée (à trancher)** | Compte actif + X mois après clôture |
| **Mesures** | bcrypt, JWT, séparation admin, rate-limit auth |
| **Écarts** | Pas d’info art. 13 à la collecte ; pas d’effacement self-service |

---

## T2 — Commandes et livraison

| Champ | Contenu |
|-------|---------|
| **Finalité** | Passer, préparer et livrer des commandes locales |
| **Base légale (hyp.)** | Contrat (6-1-b) |
| **Personnes** | Client, commerçant, livreur affecté |
| **Données** | `client_id`, adresse de livraison, montants, statut, messagerie liée |
| **Source** | Panier / checkout — `orders`, `orderEngine` |
| **Destinataires** | Commerçant et livreur parties à la commande |
| **Durée (à trancher)** | Ex. 13 mois après livraison (litiges) puis anonymisation |
| **Mesures** | ACL `canViewOrder` / `canChangeOrderStatus` (E0) |
| **Écarts** | Route legacy messages sans ACL ; pas de purge |

---

## T3 — Messagerie et support

| Champ | Contenu |
|-------|---------|
| **Finalité** | Échanges liés à une commande / fil boutique ; support |
| **Base légale (hyp.)** | Contrat (6-1-b) ; intérêt légitime pour support |
| **Données** | Contenu des messages, IDs participants |
| **Tables** | `messages`, `conversations`, `support_*` |
| **Durée (à trancher)** | Archivage « ephemeral » existe ; **pas de purge** du contenu |
| **Écarts** | Conservation illimitée de fait |

---

## T4 — Géolocalisation et proximité

| Champ | Contenu |
|-------|---------|
| **Finalité** | Adresses de livraison, distance commerces, Mode Réception (rayon), inbox opportunités |
| **Base légale (hyp.)** | Contrat pour livraison ; **consentement** recommandé pour ciblage opportunités par distance |
| **Données** | `lat`/`lng` profil et adresses, `radius_km`, `distance_km` |
| **Source** | Saisie manuelle (pas de GPS OS demandé aujourd’hui) |
| **Écarts** | Pas de consentement distinct Mode Réception ; AIPD candidate |

---

## T5 — Deuxième Âme (événements, lanternes, wallet)

| Champ | Contenu |
|-------|---------|
| **Finalité** | Diffusion d’opportunités, scan QR, objets numériques |
| **Base légale (hyp.)** | Consentement / intérêt légitime selon canal |
| **Données** | Abonnements, handles identité temporaires, `digital_objects`, journaux `identity_events` |
| **Durée** | Handles TTL court ; objets selon `retention` produit ; journaux append-only |
| **Écarts** | Journaux sans stratégie d’anonymisation à l’effacement |

---

## T6 — Activité commerçante (catalogue, stock, boutique)

| Champ | Contenu |
|-------|---------|
| **Finalité** | Gérer boutique, produits, stock, promotions |
| **Base légale (hyp.)** | Contrat avec le commerçant |
| **Données** | Coordonnées boutique, photos, email/phone store |
| **Mesures** | Inventory Engine, modes `mazone` / `pos` |

---

## T7 — Intégrations logiciels tiers (E8)

| Champ | Contenu |
|-------|---------|
| **Finalité** | Synchroniser catalogue/stock avec un logiciel du commerçant |
| **Base légale (hyp.)** | Contrat + consentement du commerçant chez l’éditeur (OAuth) |
| **Personnes** | Commerçant (acteur) ; évent. données catalogue (pas clients Shopify inbound aujourd’hui) |
| **Données** | Jetons OAuth chiffrés (`integration_secrets`), `shop_domain`, bindings IDs, payloads inbox/outbox |
| **Sous-traitant / destinataire** | Éditeur connecté (ex. Shopify — hors UE possible) |
| **Mesures** | Coffre AES-256-GCM, HMAC webhooks, purge secrets au disconnect, Loi 17 |
| **Écarts** | Pas d’info RGPD claire dans `MesIntegrationsScreen` (finalités Ma Zone) |

---

## T8 — Administration / laboratoire

| Champ | Contenu |
|-------|---------|
| **Finalité** | Exploitation interne, démo, impersonation sandbox |
| **Base légale (hyp.)** | Intérêt légitime / obligation sécurité |
| **Données** | `admin_users`, journaux, entités démo |
| **Mesures** | JWT admin distinct ; sandbox **refusée** si `NODE_ENV=production` + `SANDBOX_MODE=on` |
| **Écarts** | Identifiants admin de dev encore documentés dans scripts — hors prod OK |

---

## T9 — Site Next.js / Supabase (legacy)

| Champ | Contenu |
|-------|---------|
| **Finalité** | Maquette web (hors produit officiel FD-000) |
| **Statut** | Ne pas développer ; si exposé publiquement → mêmes obligations |
| **Données** | `profiles`, `orders`, `driver_sessions` (géoloc livreur) |
| **Mesures** | RLS Supabase |
| **Écarts** | Aucune page légale |

---

## Sous-traitants / destinataires (inventaire)

| Acteur | Rôle | Localisation probable | Statut contrat |
|--------|------|----------------------|----------------|
| Hébergeur backend | À choisir | — | Absent |
| Vercel | Site Next (si déployé) | `cdg1` configuré | À documenter |
| Supabase | Auth/DB legacy | Région projet | À documenter |
| Shopify | Éditeur connecté | Hors UE possible | OAuth commerçant |
| CARTO | Tuiles cartes | Hors UE | À documenter |
| Apple / Google Maps | Cartes natives / deep links | Selon OS | À documenter |
| Unsplash | Images démo | Hors UE | Démo seulement |

---

## Journal des mises à jour du registre

| Date | Auteur | Changement |
|------|--------|------------|
| 2026-07-26 | Audit Cursor | Création initiale post E0–E8 |
