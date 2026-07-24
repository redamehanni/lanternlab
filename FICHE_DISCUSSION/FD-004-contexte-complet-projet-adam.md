# FD-004 — Contexte complet du projet Ma Zone (mise à niveau Cursor Adam)

| | |
|---|---|
| **Statut** | **validé** |
| **Date** | 2026-07-24 |
| **Auteur(s)** | Reda Mehanni (synthèse pour Adam / AdamY76) |
| **Phase / chantier** | Onboarding total — zéro zone d'ombre |
| **Références** | Toutes les fiches FD-000→003, `PORTRAIT_MAZONE_INVENTAIRE_ROADMAP.md`, `CURRENT_ARCHITECTURE.md`, tags Git v0.8.9 → v0.9.5.2 |

---

> **Lecture OBLIGATOIRE pour le Cursor d'Adam (AdamY76)**  
> Cette fiche te met au même niveau que le Cursor de Reda **comme si tu avais travaillé sur Ma Zone depuis le début**.  
> **Avant toute proposition de code, feature, refactor ou architecture :** lire cette fiche en entier + `FICHE_DISCUSSION/INDEX.md`.  
> Si une idée contredit un point de cette fiche → **ne pas implémenter** ; proposer une fiche de discussion ou demander validation à Adam/Reda.

---

## Table des matières

1. [Résumé exécutif (2 minutes)](#1-résumé-exécutif-2-minutes)
2. [Identité & sens de Ma Zone](#2-identité--sens-de-ma-zone)
3. [Les deux Âmes](#3-les-deux-âmes)
4. [Philosophie architecturale](#4-philosophie-architecturale)
5. [Chronologie & versions Git](#5-chronologie--versions-git)
6. [Stack officielle vs legacy](#6-stack-officielle-vs-legacy)
7. [Carte du monorepo](#7-carte-du-monorepo)
8. [Backend — organes & moteurs](#8-backend--organes--moteurs)
9. [Mobile — surfaces par rôle](#9-mobile--surfaces-par-rôle)
10. [Deuxième Âme — état réel du code](#10-deuxième-âme--état-réel-du-code)
11. [Event Engine — règles inviolables](#11-event-engine--règles-inviolables)
12. [Wallet Engine](#12-wallet-engine)
13. [Identity Engine](#13-identity-engine)
14. [Communication Engine](#14-communication-engine)
15. [Commandes, dispatch & livraison](#15-commandes-dispatch--livraison)
16. [Épée — Shell commerçant](#16-épée--shell-commerçant)
17. [Bac à Sable, World Factory, Laboratoire](#17-bac-à-sable-world-factory-laboratoire)
18. [Design System Deuxième Âme](#18-design-system-deuxième-âme)
19. [Travaux récents (juillet 2026)](#19-travaux-récents-juillet-2026)
20. [Bugs connus & stabilisation](#20-bugs-connus--stabilisation)
21. [Horizon déployable](#21-horizon-déployable)
22. [Ce qu'il NE FAUT PAS proposer](#22-ce-quil-ne-faut-pas-proposer)
23. [Décisions actées vs ouvertes](#23-décisions-actées-vs-ouvertes)
24. [Collaboration Reda ↔ Adam](#24-collaboration-reda--adam)
25. [Démarrage local & credentials](#25-démarrage-local--credentials)
26. [Index documentaire](#26-index-documentaire)
27. [Notes finales pour le Cursor d'Adam](#27-notes-finales-pour-le-cursor-dadam)

---

## 1. Résumé exécutif (2 minutes)

**Ma Zone** = plateforme de **vie locale** sur un territoire (quartier / ville). Ce n'est **pas** « une marketplace de plus ».

| Aujourd'hui (juillet 2026) | Détail |
|----------------------------|--------|
| **Produit vivant** | `mobile/` (Expo RN) + `backend/` (Node/Express/SQLite) |
| **Version de référence** | **v0.9.5.2** — tag `ma-zone-v0.9.5.2-labo-simulateur-xcode-24-07-26` |
| **État** | Prototype **riche et structuré**, pas encore **production-ready** |
| **Rôles code** | `client`, `merchant`, `driver` (+ `admin` séparé dans `admin_users`) |
| **Deuxième Âme** | **Construite** (v0.9.3+) — pas seulement vision |
| **Legacy** | `src/` Next.js + Supabase — **ne pas développer** sans décision actée |

**Principe n°1 (partout) :** *Surface compose, organe décide.*

**Principe n°2 (collaboration) :** Reda + Adam, deux Cursor, un repo — **FICHE_DISCUSSION/** = canal de vision ; **git pull** avant chantier.

---

## 2. Identité & sens de Ma Zone

### 2.1 Slogan & promesse

> **« Pourquoi attendre demain ce qui est déjà dans votre zone ? »**

Livraison locale rapide + **écosystème de vie de quartier** (pas seulement consommer).

### 2.2 Ce que Ma Zone veut être

| Dimension | Intention |
|-----------|-----------|
| **Pont numérique ↔ rue** | Le téléphone sert à **sortir**, pas à retenir |
| **Outil pro commerçant** | L'**Épée** = poste de travail (catalogue, commandes, promos, initiatives…) |
| **Laboratoire** | Inventer Ma Zone avant prod (Bac à Sable, World Factory) |
| **À terme** | Comment une ville **raconte ses histoires** à ses habitants |

### 2.3 Métrique de succès (Deuxième Âme)

Le succès ne se mesure **pas** au temps d'écran, mais aux **expériences vécues dehors** (sorties, rencontres, découvertes).

### 2.4 Ce que Ma Zone n'est PAS

- Un clone Uber Eats / Deliveroo sans âme
- Un agenda municipal / miroir de la ville
- Un Event Bus technique universel
- Un portefeuille financier (le Wallet = **objets numériques vivants**, pas CB)
- Une app web Next.js (legacy) — le produit officiel est **mobile + Node**

---

## 3. Les deux Âmes

| Âme | Intention utilisateur | Posture | État code |
|-----|----------------------|---------|-----------|
| **Première Âme** | « J'ai besoin de quelque chose. » | Client : chercher, commander, se faire livrer | **Construite** — MVP marketplace |
| **Deuxième Âme** | « J'ai envie de vivre quelque chose. » | Habitant : découvrir, participer, recevoir des opportunités | **Construite v1** — enrichissement continu |

### 3.1 Règles de coexistence (ACTÉES)

1. **Première Âme inchangée** quand on travaille sur la Deuxième Âme — pas de régression marketplace.
2. **Panier partagé** entre les deux faces (même `CartProvider`).
3. **Wallet & Messages partagés** (`WalletProvider`, `CommunicationProvider` app-wide).
4. Bascule via `activeSoul` (`'first' | 'second'`) dans `AppContext` — persisté.
5. Tabs Deuxième Âme : **Accueil · Messages · Wallet · Panier** (le « Panier » remplace « Aide » de la maquette).

### 3.2 Switch Client ↔ Habitant

Vision long terme : changement d'**intention**, pas seulement de thème.  
Aujourd'hui : bascule Première ↔ Deuxième Âme via drawer + en-tête. Le rôle reste `client`.

---

## 4. Philosophie architecturale

### 4.1 Surfaces vs organes

```
SURFACES (UI)          →  orchestrent, affichent, naviguent
ORGANES / MOTEURS      →  décident, transigent, journalisent
SQLite + Socket.io     →  persistance + temps réel
```

> **Une surface qui réimplémente une règle métier est un bug d'architecture.**

Exemples :
- ✅ `DiffuseOpportunityScreen` appelle `diffuseEvent()` — surface
- ✅ `diffusion.js` calcule les abonnés — organe
- ❌ Un écran qui décrémente le stock directement en SQL

### 4.2 Pattern organe Ma Zone (répété partout)

| Couche | Emplacement |
|--------|-------------|
| Logique métier | `backend/src/lib/<organe>/` ou `<organe>Engine.js` |
| Routes HTTP | `backend/src/routes/` |
| Schéma DB | `backend/src/db/index.js` (migrations incrémentales au boot) |
| Context mobile | `mobile/src/context/` |
| Écrans | `mobile/src/screens/` |

### 4.3 Open/Closed

Nouveau type d'événement, module Épée, recette World Factory, kind Wallet = **entrée dans un registre**, pas modification du cœur.

Registres clés :
- `eventEngine/eventRegistry.js`
- `walletRegistry.js`
- `mobile/src/epee/moduleRegistry.js`
- `worldFactory/recipeRegistry.js`
- `lab/actionRegistry.js`

### 4.4 Journal append-only

Wallet (`digital_object_events`), Event Engine (`event_journal`) — audit + biographie. Ne pas remplacer par du CRUD simple.

### 4.5 Idempotence

Obligatoire pour : diffusion OV, scan Lanterne, sync POS (futur), actions labo.

---

## 5. Chronologie & versions Git

| Date | Tag / jalon | Contenu majeur |
|------|-------------|----------------|
| 03/07/26 | `mvp-0.8.1` | MVP stable base |
| 12/07/26 | `mvp-pre-mac-restart` | Communication Engine + UI nav + popup offre livreur |
| 13/07/26 | `ma-zone-beta-stable-0.8.9` | Bêta stable Phase II ready |
| 15/07/26 | `ma-zone-v9.0-wallet-integre` | Wallet Engine intégré |
| 16/07/26 | `ma-zone-v0.9.2-bac-a-sable-v1` | World Factory + Épée Shell + Laboratoire |
| 22/07/26 | `ma-zone-v0.9.3-2eme-ame-event-engine` | Deuxième Âme + Event Engine complet |
| 23/07/26 | `ma-zone-v0.9.4-simulateur-ville-paris-ov` | Géo Paris, OV spatiales, boîte aux lettres |
| 23/07/26 | `ma-zone-v0.9.5-premiere-da` | Design System Deuxième Âme V1 |
| 24/07/26 | `ma-zone-v0.9.5.2-labo-simulateur-xcode` | Impersonation iOS/Xcode, fixes auth/lab |
| 24/07/26 | FICHE_DISCUSSION | FD-000→004, collaboration Reda + Adam |

**Adam rejoint officiellement le 24/07/2026** — cette fiche comble tout l'historique antérieur.

---

## 6. Stack officielle vs legacy

### 6.1 Produit officiel (DÉVELOPPER ICI)

| Brique | Stack | Port dev |
|--------|-------|----------|
| `mobile/` | Expo 56, RN 0.85, React 19, React Navigation | 8081 |
| `backend/` | Node, Express, better-sqlite3, JWT, Socket.io | 4000 |
| `admin-web/` | Vite + React (Laboratoire interne) | 5174 |

Persistance : **SQLite** `backend/data/mazone.db` (WAL, migrations au boot).

### 6.2 Legacy (NE PAS ENRICHIR sans décision FD)

| Brique | Stack | Statut |
|--------|-------|--------|
| `src/` | Next.js 15 + Supabase | Maquette web — **legacy** |
| `MaZone/` | SwiftUI | Squelette — non branché |
| Racine `package.json` | Next.js | README historique — à aligner (Phase 0) |

**Double stack :** Next/Supabase et mobile/Node **ne partagent ni base ni logique**. Wallet, Identity, Event, World Factory n'existent **que** côté Node.

**Proposition actée dans FD-002 §10.1 (non encore implémentée) :** archiver UI Next.js ; **garder** schéma Supabase comme ref future Postgres.

---

## 7. Carte du monorepo

```
MaZone-main/
├── mobile/                 ← App Expo (client, merchant, driver, deuxiemeAme)
├── backend/                ← API + organes + SQLite
├── admin-web/              ← Laboratoire (Monde + Explorateur)
├── FICHE_DISCUSSION/       ← Vision partagée Reda + Adam ★
├── src/                    ← LEGACY Next.js — ne pas toucher
├── supabase/               ← Schéma SQL ref Postgres future
├── CURRENT_ARCHITECTURE.md ← Architecture MVP Première Âme (juin 2026)
├── PORTRAIT_MAZONE_…md     ← Inventaire complet (juillet, légèrement pré-DA)
├── CHANTIER_*.md / PLAN_*.md / AUDIT_*.md / COMPTE_RENDU_*.md
└── .cursor/rules/          ← Règles Cursor persistantes
```

Volume approximatif : mobile ~17k lignes, backend ~9k lignes.

---

## 8. Backend — organes & moteurs

Point d'entrée : `backend/src/index.js` (:4000).

### 8.1 Auth & users

- JWT citoyen (`JWT_SECRET`) — login/register par rôle
- JWT admin séparé (`ADMIN_JWT_SECRET`, claim `type: 'admin'`)
- Table `users` : `client | merchant | driver` + lat/lng, driver_online
- Table `admin_users` : équipe Ma Zone, **jamais** dans `users`

### 8.2 Catalogue & commerce

- `stores`, `products` (stock `quantity`, barcode peu exploité)
- Panier `cart_items`, favoris, promotions
- Stock : décrément transactionnel à validation panier (SQLite mono-process)

### 8.3 Orders & dispatch

- **Cœur métier Première Âme**
- Fichiers critiques : `lib/dispatch.js`, `lib/orders.js`, `lib/orderStatus.js`
- Flux : commande → mission `available` → dispatch auto → socket `mission:assigned`
- Commission livreur : **5 %** du `total_price`
- Voir §15 pour bugs connus

### 8.4 Event Engine ★

Organe complet depuis v0.9.3. Dossier `backend/src/lib/eventEngine/`.

Tables : `events`, `event_journal`, `event_subscriptions`, `event_diffusions`.

Routes : `backend/src/routes/events.js`.

### 8.5 Wallet Engine

- Registre objets numériques (`digital_objects` + ledger)
- API mobile **lecture seule** ; émission via organes (`issueObject`, `consumeObject`)
- Orchestration Event → Wallet (billets, récompenses Lanterne)

### 8.6 Identity Engine

- Présentation QR rotative — **identifie, ne décide pas**
- N'accorde aucun droit métier

### 8.7 Communication Engine

- Moteur unifié `communicationEngine.js`
- Fils **durables** (client↔commerce) et **éphémères** (commande/livraison)
- Policies dans `communicationPolicies.js`

### 8.8 World Factory & Lab

- Génération mondes démo (`quartier_anime`, `monde_evenementiel`)
- Impersonation, actions labo via organes
- Garde sandbox : `lib/sandbox.js` (`SANDBOX_MODE=on` ou `NODE_ENV !== 'production'`)

---

## 9. Mobile — surfaces par rôle

Navigation : `mobile/src/navigation/index.js`.

### 9.1 Client — Première Âme

Tabs : Home · Messagerie · Wallet · Panier.

Écrans clés : `HomeScreen`, `ProductDetailScreen`, `CartScreen`, `OrderTrackingScreen`, `WalletScreen`, `IdentityScreen`, messagerie (`MesCommercesScreen`, `ChatScreen`…).

### 9.2 Client — Deuxième Âme

Voir §10. Root : `DeuxiemeAmeRoot` si `activeSoul === 'second'`.

### 9.3 Commerçant — Épée

Drawer + Cockpit + modules registre. Voir §16.

### 9.4 Livreur

Tabs : Accueil · Revenu · Boîte de réception · Menu.

Écran central : `DriverHomeScreen` + `MissionDrawer` + `DriverContext`.

**Fichiers legacy non branchés (ne pas réactiver sans décision) :**
- `NewCourseOfferModal.js` (popup OUI/NON — flux direct ailleurs)
- `MissionsScreen.js`, `ActiveMissionScreen.js`

### 9.5 Config réseau

`mobile/src/config.js` + `EXPO_PUBLIC_API_URL` :
- Simulateur iOS : IP LAN du Mac (pas `localhost` sur device)
- Scripts : `mobile/scripts/start-ios.sh`, `start-lab.sh`
- Scheme deep link : `mazone://` (`app.json`)

---

## 10. Deuxième Âme — état réel du code

**Important :** le `PORTRAIT_MAZONE` (19/07) dit « Deuxième Âme vision uniquement » — **c'est obsolète**. Depuis v0.9.3, la face est **codée**.

### 10.1 Accueil (`DeuxiemeAmeHomeScreen`)

Blocs composés dans `mobile/src/components/deuxiemeAme/` :

| Bloc | Branché ? | Source |
|------|-----------|--------|
| Mode Réception | ✅ Réel | `getModeReception` / `setModeReception` |
| Hero stats | ✅ Réel | `getEventDiscovery` (événements, lanternes) |
| Météo / patrimoine | ⏳ Stub honnête | « Bientôt » + point de branchement |
| Barre IA | ⏳ Partiel | Puces → filtres Event ; saisie libre → Bientôt |
| 6 portes | ✅ V1 | Voir ci-dessous |
| Murmures | ✅ Réel | `getEventMurmurs()` |
| Bannière OV | ✅ Réel | Socket `event:opportunity` |

### 10.2 Les 6 portes

| Porte | Écran | État |
|-------|-------|------|
| Lanternes | `LanternsScreen` + `LanternScanScreen` | ✅ Réel (expo-camera, QR = event.id) |
| Événements | `EventsScreen` + `EventDetailScreen` | ✅ Réel + billet → Wallet |
| Participer | `ParticiperScreen` | ✅ V1 citoyen (`createEvent`) |
| Découvrir mon quartier | `DecouvrirQuartierScreen` | ✅ V1 (favoris / marketplace) |
| Mes adresses | `MesAdressesScreen` | ✅ Réel |
| Se laisser surprendre | `SurpriseScreen` | ✅ V1 (tirage aléatoire discovery) |

### 10.3 Opportunité Volante côté habitant

- `OpportunityContext.js` — écoute socket, bannière overlay
- Boîte aux lettres : `getOpportunityInbox`, accept/dismiss
- Diffusion **spatiale** depuis v0.9.4 (radiusKm, quota, tri distance)

### 10.4 Ce qui reste vision (pas d'organe dédié)

- Quêtes + guide IA complet
- Météo humaine du quartier
- Passions / onboarding habitant profond
- Métriques « sorties / expériences »
- Ticket d'Or / rareté OV (architecture ouverte, non implémenté)

---

## 11. Event Engine — règles inviolables

### 11.1 Ce qu'est l'Event Engine

Organe des **initiatives locales** et de leur **cycle de vie** :
`draft → scheduled → published → live → ended → archived` (+ `cancelled`).

### 11.2 Ce qu'il N'EST PAS

- ❌ Event Bus technique universel
- ❌ Fourre-tout événements internes app
- ❌ Agenda / miroir de la ville

### 11.3 Opportunité Volante ≠ type d'événement

> **Une Opportunité Volante est une stratégie de diffusion**, pas un type dans le registre.

| Concept | Où ça vit |
|---------|-----------|
| Initiative (atelier, dégustation, lanterne…) | `events` + types dans `eventEngine/types/` |
| Mode Réception (écoute habitant) | `event_subscriptions` — `diffusion.js` |
| Opportunité Volante (push actif) | `event_diffusions` — `diffusion.js` |

### 11.4 Types enregistrés (extensibles)

`atelier`, `degustation`, `promo`, `lanterne` — ajouter un producteur = `registerType()` + mapping source, **sans toucher le cœur**.

### 11.5 Orchestration

- Billet → `wallet.issueObject` (jauge)
- Lanterne scan → récompense Wallet + idempotence par citoyen

### 11.6 Géolocalisation (v0.9.4)

- Initiatives + users ont lat/lng (Paris simulé en labo via `parisAddresses.js`)
- Diffusion filtre par `radiusKm` — **fix 24/07** : users sans coords restent éligibles si radius campagne (évite exclusion Mode Réception)

---

## 12. Wallet Engine

### 12.1 Définition

> Registre personnel des **objets numériques vivants** du citoyen — pas un portefeuille CB.

### 12.2 Familles & kinds

Familles UX : Billets, Retraits, Promotions, Fidélité, Badges, Points civiques.

Kinds : `event_ticket`, `pickup_ticket`, `promo_voucher`, `loyalty_card`, `badge`, `civic_points`…

### 12.3 Cycle de vie

`issue → active → consume / revoke / expire` + facette **souvenir** (retention keepsake).

### 12.4 Capacités déclaratives

`handledBy: wallet | source | device` — beaucoup d'UI affiche encore « sera géré par… » (stub honnête).

### 12.5 Émetteurs

- World Factory / Lab (`source_engine: 'world_factory' | 'lab'`)
- Event Engine (billets, lanternes)
- **Pas encore branché :** Orders → `pickup_ticket` à la livraison réelle

### 12.6 Règle

Le Wallet **ne connaît pas** le métier promotions/commandes — il stocke et transitionne.

---

## 13. Identity Engine

- QR rotatif côté client (`IdentityScreen`)
- **Identifie, ne décide pas** — aucun droit métier
- Architecture prête NFC / Apple Wallet plus tard
- Séparé du Wallet (présentation vs possession d'objets)

---

## 14. Communication Engine

### 14.1 Architecture

```
UI → CommunicationContext → /api/communication/* → communicationEngine
```

### 14.2 Types de fils

| Type | Durée | Exemple |
|------|-------|---------|
| Durable | Permanent | Client ↔ commerce (`store_team`) |
| Éphémère | Commande | Client↔livreur, commerçant↔livreur |

Éphémère archivé à livraison/annulation — invisible dans listes après.

### 14.3 Entrée navigation unique

`openCommunication()` — ne pas créer de routes chat ad hoc.

---

## 15. Commandes, dispatch & livraison

Référence : `CURRENT_ARCHITECTURE.md` + `PLAN_STABILISATION_MVP_PHASE_1.md`.

### 15.1 Flux nominal

```
POST /api/orders → createOrderWithDispatch()
  → order: pending_driver, mission: available
  → tryDispatchNewOrder() → assignOrderToDriver()
  → socket mission:assigned → DriverContext → MissionDrawer
  → PATCH mission/status → delivered → libère livreur
```

### 15.2 Statuts canoniques commande

`pending_driver` → `driver_assigned` → `picking_up` → `picked_up` → `delivering` → `delivered` / `cancelled`

Alias legacy normalisés au boot — ne pas réintroduire `searching_driver`, `offered`.

### 15.3 Trois problèmes critiques documentés (P1–P3)

| ID | Problème | Impact |
|----|----------|--------|
| **P1** | Missions fantômes en base | Dispatch bloqué, file silencieuse |
| **P2** | Socket `mission:assigned` perdu à reconnexion | Mission en DB, pas de tiroir UI |
| **P3** | DriverContext ne rouvre pas tiroir | Livreur « libre » alors qu'occupé |

**Principe stabilisation :** DB = source de vérité ; UI livreur se réaligne à chaque connexion/focus.

### 15.4 Dispatch — conditions livreur éligible

1. `role = driver`
2. `driver_online = 1`
3. Aucune mission active (`accepted`, `picking_up`, `picked_up`, `delivering`)

---

## 16. Épée — Shell commerçant

Depuis v0.9.2 — remplace l'ancien dashboard 4 onglets.

> **L'Épée n'est jamais un organe. Elle orchestre. Elle ne décide jamais.**

### 16.1 Familles & modules

| Famille | Modules actifs | Bientôt |
|---------|----------------|---------|
| **Vendre** | Catalogue & stock, Commandes | — |
| **Animer** | Promotions, **Mes initiatives**, **Opportunité Volante** | Fidélité, Collaborations |
| **Réseau** | Clients, Messages | — |
| **Piloter** | Mon commerce, Statistiques | Objectifs, Suggestions, Santé (stubs) |

Registre : `mobile/src/epee/moduleRegistry.js`.

### 16.2 Cockpit

Briefing adaptatif (`briefing.js` + adapters) — max 4 cartes par section.

---

## 17. Bac à Sable, World Factory, Laboratoire

### 17.1 Philosophie

| Principe | Implémentation |
|----------|----------------|
| World Factory orchestre, ne réécrit pas | Appelle organes existants |
| Impersonation = authentification | Jeton citoyen réel, 0 mutation identité |
| Lab n'écrit jamais directement | Actions via `lab/actionRegistry` → organes |
| Reset par appartenance | `demo_entities` + purge FK-safe |
| Sandbox ≠ prod | `requireSandbox`, `isDemoUser` only |

### 17.2 admin-web (Laboratoire)

| Page | Action |
|------|--------|
| Login | Auth admin séparée |
| Monde | Run/reset recettes World Factory |
| Explorateur | Voir acteurs, **Devenir X** (web), **Devenir X sur Xcode** (v0.9.5.2) |

### 17.3 Impersonation

- Web : ouvre `http://…:8081/#labToken=<jwt>`
- iOS : `POST /api/admin/impersonate-ios` → `simctl openurl` → `exp://<IP>:8081/--/lab?labToken=…`
- Mobile : `AppContext.js` + `labToken.js` — valide JWT via `/api/users/me`, logout si 401

### 17.4 Recettes

- `quartier_anime` — habitants, commerçants, livreurs, wallets, events géolocalisés Paris
- `monde_evenementiel` — peuplement rapide pour tests Event/OV

### 17.5 Production

**INTERDIT en prod :** impersonation, World Factory run, lab actions.  
Verrouillage via `SANDBOX_MODE` + durcissement Phase 0 (FD-002).

---

## 18. Design System Deuxième Âme

Livré v0.9.5 — **costume Deuxième Âme uniquement** (Première Âme / Épée / Livreur gardent `THEME`).

| Élément | Valeur |
|---------|--------|
| Fond | `#F7F1EA` crème |
| Accent | `#C4785A` terracotta |
| Titres | Cormorant Garamond |
| Corps | Source Sans 3 |
| Tokens | `mobile/src/theme/ame.js`, `motion.js` |
| Icônes | `ameIcons.js` + `SoftIcon` |
| Illustrations | Registry par clé — jamais `require` direct dans composants |

Doc : `DESIGN_SYSTEM_DEUXIEME_AME.md`, `COMPTE_RENDU_DA_DESIGN_SYSTEM_V1.md`.

**Règle :** la DA ne touche que la surface — pas la logique organes.

---

## 19. Travaux récents (juillet 2026)

### 19.1 Session Reda 24/07 — labo & simulateur Xcode

| Sujet | Changement |
|-------|------------|
| JWT stale AsyncStorage | Validation boot `/api/users/me`, interceptor 401, logout auto |
| Mode Réception 401 silencieux | Messages erreur explicites |
| Geo diffusion | Users sans lat/lng non exclus quand radius campagne |
| Backend éphémère | Scripts start persistants (`start-ios.sh`, `start-lab.sh`) |
| IP WiFi changeante | Config dynamique API URL (Metro host / LAN) |
| Impersonation iOS | Route `impersonate-ios` + bouton admin-web |
| Deep link natif | Scheme `mazone`, `Linking` + `labToken` query |

### 19.2 Simulateur ville Paris (23/07)

- ~45 adresses réelles, initiatives géolocalisées
- OV spatiales : radiusKm, quota, tri distance
- Boîte aux lettres + parcours acceptation

### 19.3 FICHE_DISCUSSION (24/07)

- FD-000 système, FD-001 onboarding Adam, FD-002 diagnostic prod/stocks, FD-003 décisions (brouillon Adam), **FD-004 cette fiche**

---

## 20. Bugs connus & stabilisation

### 20.1 Métier Première Âme

- File d'attente silencieuse (pas de livreur / mission fantôme)
- Régressions dispatch documentées historiquement
- Capacités Wallet stub en UI
- Pas de paiement réel
- Stock sans réservation → fantômes possibles

### 20.2 Sécurité (bloquant prod — Phase 0)

- Secrets JWT fallback hardcodés en dev
- CORS `*`
- Pas rate limit / helmet / validation Zod systématique
- 0 test automatisé
- Sandbox actif si mauvaise config prod

### 20.3 Plan stabilisation

`PLAN_STABILISATION_MVP_PHASE_1.md` — P1/P2/P3 dispatch uniquement, pas de refactoring majeur.

---

## 21. Horizon déployable

Deux horizons — **ne pas mélanger** (FD-002).

### Horizon A — MVP Première Âme déployable (PRIORITÉ)

1. Fiabiliser commande → livraison (P1–P3)
2. Phase 0 sécurité (secrets, CORS, sandbox off)
3. PSP (Stripe probable — non acté)
4. Hébergement HTTPS/WSS
5. Stores iOS/Android
6. CGU, litiges, monitoring

### Horizon B — Enrichir Première Âme

Fidélité organe, Collaboration, push, analytics…

### Horizon C — Deuxième Âme profonde (enrichissement, pas construction from scratch)

Quêtes, météo humaine, métriques vie réelle — **après** stabilisation prod et architecture conceptuelle.  
**Note :** la Deuxième Âme **v1 est déjà codée** (FD-004 §10) ; Horizon C = approfondissement, pas démarrage.

**FD-003 (brouillon amendé)** liste 16 décisions D1–D16 — à croiser/valider avant implémentation. **Complémentaire de cette fiche :** FD-004 = état réel ; FD-003 = choix deploy restants (dont périmètre prod v1 pour 2e Âme déjà codée).

---

## 22. Ce qu'il NE FAUT PAS proposer

Sans nouvelle fiche **validée**, le Cursor d'Adam ne doit **pas** :

| ❌ Interdit | ✅ À la place |
|-----------|---------------|
| Développer features dans `src/` Next.js | Travailler `mobile/` + `backend/` |
| Réimplémenter logique métier dans les écrans | Appeler l'organe / API existante |
| Créer un « Event Bus » global | Utiliser Event Engine + hook interne `bus.js` |
| Modèle OV comme type d'événement | Couche `diffusion.js` uniquement |
| Wallet = portefeuille Stripe | PSP séparé ; Wallet = objets numériques |
| Identity qui accorde des droits | Identity présente seulement |
| World Factory qui écrit SQL métier direct | Primitives context + organes |
| Impersonation en prod | Sandbox/staging only |
| Fusionner mobile et Supabase | Migration Postgres backend unifié (futur) |
| Deuxième Âme sans respecter Première Âme | Bascule additive, panier partagé |
| Ignorer FICHE_DISCUSSION | Lire INDEX + fiches validées |
| Coder FD-003 tant que brouillon | Attendre validation Reda+Adam |
| Réintroduire popup OUI/NON livreur | Flux MissionDrawer actuel (sauf fiche) |
| SQLite réservation sans design | ADR inventaire catalogue/inventory/movements |

---

## 23. Décisions actées vs ouvertes

### 23.1 Actées (référence de vision)

| Date | Décision |
|------|----------|
| Architecture | Surface compose, organe décide |
| Produit vivant | `mobile/` + `backend/` Node |
| Deux Âmes | Coexistent ; panier/wallet/messages partagés |
| Event Engine | Organe initiatives ; OV = diffusion |
| Wallet | Objets numériques, registre + ledger |
| Identity | Présente, ne décide pas |
| Épée | Surface commerçant, registre modules |
| Bac à Sable | World Factory + Lab + impersonation démo |
| DA Deuxième Âme | Tokens AME séparés de THEME |
| Collaboration | FICHE_DISCUSSION/ canal officiel vision |
| Adam onboarding | FD-001 + **FD-004 lecture obligatoire** |
| Lab iOS | impersonate-ios + deep link labToken |

### 23.2 Proposées non actées (FD-002 §10, FD-003)

- Archiver Next.js `src/`
- Postgres cible (schéma Supabase)
- Stripe PSP
- Hébergeur prod
- Zone pilote concrète
- Niveau stock lancement (niveau 1 proposé)
- Ordre Phase 0 vs inventaire vs dispatch tests
- iOS seul vs iOS+Android

**En cas de doute → brouillon fiche ou question à Adam/Reda.**

---

## 24. Collaboration Reda ↔ Adam

| Personne | GitHub | Rôle |
|----------|--------|------|
| Reda Mehanni | redamehanni | Fondateur, vision, dev principal |
| Adam | **AdamY76** | Co-développeur depuis 24/07/2026 |

### 24.1 Workflow Git

1. `git pull origin main` avant tout chantier
2. Branches ou commits directs selon accord — **toujours pull d'abord**
3. Tags Git pour jalons (`ma-zone-v0.9.x-…`)
4. Fiches vision : brouillon Cursor → validation humaine → commit

### 24.2 Rituel Sync FICHE_DISCUSSION

Déclencheurs : *« Mets-toi à jour sur le dossier fiche de discussion… »*, *« Sync FICHE_DISCUSSION »*.

Processus identique deux Cursor : pull → INDEX → lire nouveautés → résumer.

Voir `FICHE_DISCUSSION/README.md`.

### 24.3 Règle Cursor

`.cursor/rules/fiche-discussion.mdc` — `alwaysApply: true`.

---

## 25. Démarrage local & credentials

### 25.1 Stack minimale

```bash
# Terminal 1 — Backend
cd backend && node src/index.js   # :4000

# Terminal 2 — Mobile
cd mobile && npx expo start --clear # :8081, puis i pour iOS

# Optionnel — Laboratoire
cd admin-web && npm run dev       # :5174
```

Guide débutant : `GUIDE-DEBUTANT.md`.  
Lab complet : `mobile/scripts/start-lab.sh`.

### 25.2 Variables locales (non commitées)

- `mobile/.env` : `EXPO_PUBLIC_API_URL=http://<IP_LAN>:4000`
- `backend/.env` : secrets (Phase 0 — aujourd'hui fallbacks dev)

### 25.3 Credentials labo (dev)

| Compte | Email | Mot de passe |
|--------|-------|--------------|
| Admin labo | `admin@mazone.local` | `admin1234` |
| Client démo (ex.) | `mariel@gmail.com` | `mariemarie` |

Création admin : `node backend/scripts/create-admin.js`.

### 25.4 Base de données

`backend/data/mazone.db` — gitignored, recréée au boot.

---

## 26. Index documentaire

| Sujet | Document |
|-------|----------|
| Architecture MVP commandes | `CURRENT_ARCHITECTURE.md` |
| Inventaire + roadmap | `PORTRAIT_MAZONE_INVENTAIRE_ROADMAP.md` |
| Stabilisation dispatch P1–P3 | `PLAN_STABILISATION_MVP_PHASE_1.md` |
| Event Engine livré | `COMPTE_RENDU_EVENT_ENGINE.md` |
| Deuxième Âme plan | `PLAN_DEUXIEME_AME_V1_PRODUCTION.md` |
| Simulateur Paris / OV | `COMPTE_RENDU_SIMULATEUR_VILLE_OV.md` |
| Design System AME | `DESIGN_SYSTEM_DEUXIEME_AME.md` |
| Wallet audit | `AUDIT_WALLET_ENGINE_MAZONE.md` |
| Communication | `ORGANE_COMMUNICATION.md` |
| Épée Shell | `CHANTIER_EPEE_SHELL_V1.md` |
| World Factory | `CHANTIER_WORLD_FACTORY_V1.md` |
| Laboratoire | `CHANTIER_LABORATOIRE_V1.md` |
| Diagnostic prod | `FICHE_DISCUSSION/FD-002-…md` |
| Décisions deploy | `FICHE_DISCUSSION/FD-003-…md` (brouillon) |
| Démarrage | `GUIDE-DEBUTANT.md` |

---

## 27. Notes finales pour le Cursor d'Adam

1. **Tu as maintenant le contexte complet** — de la vision à la ligne de code critique.
2. **Avant chaque tâche Adam :** INDEX → fiches validées → cette FD-004 si doute.
3. **Produit = mobile + Node.** Legacy web = archive future, pas terrain de jeu.
4. **Respecte les organes.** Si tu ne trouves pas l'API, cherche dans `backend/src/lib/` avant d'inventer.
5. **Deuxième Âme existe** — ne propose pas de « commencer » la Deuxième Âme from scratch.
6. **Prod pas prête** — Phase 0 et stabilisation dispatch avant features shiny.
7. **FD-003 est brouillon** — amender avec Reda, pas implémenter D1–D16 aveuglément.
8. **Nouvelle vision** → fiche brouillon FD-XXX, pas code direct.
9. **Conflit avec Reda** → la fiche validée prime ; discuter via fiche amendée.
10. **Objectif duo :** deux Cursor qui avancent **dans la même direction**, sans zone d'ombre.

---

## Décisions actées par cette fiche

| Date | Décision | Par |
|------|----------|-----|
| 2026-07-24 | FD-004 = **référence obligatoire** Cursor Adam avant tout chantier | Reda |
| 2026-07-24 | Mise à niveau historique complet juin–juillet 2026 | Reda |
| 2026-07-24 | PORTRAIT §4.6 « Deuxième Âme vision seule » **obsolète** — corriger mentalement via cette fiche | Reda |

---

*Fiche de mise à niveau totale — générée pour AdamY76 le 24/07/2026. Toute évolution majeure du projet doit mettre à jour cette fiche ou en créer une FD-XXX fille validée.*
