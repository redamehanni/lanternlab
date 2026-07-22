# Ma Zone — Portrait complet, inventaire réalisé & feuille de route

**Document de synthèse produit + technique**  
**Date :** 19 juillet 2026  
**Version de référence :** V0.9.2 (Bac à Sable v1) — tag `ma-zone-v0.9.2-bac-a-sable-v1-stable-16-07-26`  
**Public :** Direction produit, architecture, équipe de développement  
**Statut :** Inventaire de l'état réel du code + vision déjà actée (Deuxième Âme : conception uniquement)

---

## Document de référence

| Format | Fichier |
|--------|---------|
| **PDF** | `PORTRAIT_MAZONE_INVENTAIRE_ROADMAP.pdf` |
| HTML | `PORTRAIT_MAZONE_INVENTAIRE_ROADMAP.html` |
| Markdown | `PORTRAIT_MAZONE_INVENTAIRE_ROADMAP.md` |

---

## 1. Qu'est-ce que Ma Zone ?

Ma Zone est une plateforme de **vie locale** organisée autour d'un territoire (quartier / ville). Elle n'est pas « une marketplace de plus » : le commerce local est un **acteur** parmi d'autres d'un écosystème vivant.

### Deux âmes complémentaires

| Âme | Intention | Posture utilisateur | État |
|-----|-----------|---------------------|------|
| **Première Âme** | « J'ai besoin de quelque chose. » | Client : chercher, comparer, commander, se faire livrer | **Construite** (MVP fonctionnel) |
| **Deuxième Âme** | « J'ai envie de vivre quelque chose. » | Habitant : découvrir, sortir, rencontrer, participer, créer | **Vision actée** — pas encore développée |

La Première Âme construit l'**activité** (économie locale).  
La Deuxième Âme lui donne un **sens** (Ville Augmentée : murmures, quêtes, lanternes, expériences).  
Son succès ne se mesure pas au temps d'écran, mais aux **expériences vécues dehors**.

### La place que Ma Zone doit prendre

- Un **pont** entre le numérique et la rue (jamais une destination qui retient).
- Un **outil professionnel** pour les commerçants (l'Épée) qui alimente la vie locale.
- Un **laboratoire** pour inventer Ma Zone avant de la déployer (Bac à Sable).
- À terme : la façon dont une ville **raconte ses histoires** à ses habitants.

### Rôles aujourd'hui dans le code

| Rôle | Description |
|------|-------------|
| `client` | Habitant-consommateur de la Première Âme |
| `merchant` | Commerçant — poste de travail « Épée » |
| `driver` | Livreur — courses locales |
| `admin` | Équipe Ma Zone — hors écosystème citoyen (`admin_users`) |

---

## 2. Architecture : surfaces vs organes

**Principe fondamental** (tenu partout : Wallet, Identity, Épée, Laboratoire, World Factory) :

> Les **surfaces** orchestrent. Les **organes** détiennent la logique métier.  
> Une surface qui réimplémente une règle métier est un bug d'architecture.

```
┌─────────────────────────────────────────────────────────────┐
│ SURFACES (UI / orchestration)                               │
│  App Client · Épée (commerçant) · App Livreur               │
│  Laboratoire admin-web · (futur) Habitant / Ville Augmentée │
└───────────────────────────┬─────────────────────────────────┘
                            │ appelle les contrats publics
┌───────────────────────────▼─────────────────────────────────┐
│ ORGANES / MOTEURS                                           │
│  Auth · Catalog/Stores · Cart · Orders · Dispatch           │
│  Communication · Promotions · Wallet · Identity             │
│  World Factory · Lab actions · (futurs : Event, Loyalty…)   │
└───────────────────────────┬─────────────────────────────────┘
                            │
                    SQLite + Socket.io
```

### Stack technique

| Couche | Technologie |
|--------|-------------|
| Mobile | Expo / React Native, React Navigation, Axios, Socket.io-client |
| Backend | Node.js, Express, better-sqlite3, JWT, Socket.io |
| Laboratoire | React + Vite (`admin-web/`, port 5174) |
| Persistance | SQLite (`backend/data/mazone.db`) |

---

## 3. Les organes / moteurs existants

### 3.1 Auth & utilisateurs
- Inscription / connexion JWT par rôle.
- Profil (photo, téléphone, adresse client, transport livreur).
- Adresses client enregistrées.

### 3.2 Catalogue & commerces
- Boutiques (`stores`) : création / édition, photo, catégorie, story, géoloc.
- Produits : CRUD, stock, images, catégories.
- Recherche produits, détail produit / commerce.

### 3.3 Panier & favoris
- Panier client (ajout, quantité, checkout).
- Favoris commerces (« coups de cœur »).

### 3.4 Commandes (Orders)
- Création commande unitaire ou depuis panier.
- Statuts : `pending_driver` → `driver_assigned` → `picking_up` → `picked_up` → `delivering` → `delivered` / `cancelled`.
- Suivi temps réel (sockets).
- Annulation client (statuts autorisés).

### 3.5 Dispatch & missions
- Attribution livreur (en ligne, sans mission active).
- Mode offre popup (Phase F UX) : proposition 20 s, accept / refuse.
- File d'attente si aucun livreur.
- Workflow livraison (slide confirm, navigation).
- Commission livreur (~5 % du panier).

### 3.6 Communication
- Organe unifié : fils durables client↔commerce, éphémères liés commande, support.
- Non-lus, sockets `message:new` / `conversation:updated`.
- Messagerie client, inbox commerçant, inbox livreur, chat contextualisé.

### 3.7 Promotions
- Création / gestion commerçant (discount, buy_get).
- Flash promotions côté client (accueil).

### 3.8 Wallet Engine
- Registre personnel d'**objets numériques vivants** (pas un moteur métier).
- Familles : Billets, Retraits, Promotions, Fidélité, Badges, Points civiques.
- Kinds : `event_ticket`, `pickup_ticket`, `promo_voucher`, `loyalty_card`, `badge`, `civic_points`.
- Cycle de vie : issue → active → consume / revoke / expire ; journal append-only.
- Facette **souvenir** (retention keepsake).
- Capacités déclaratives (`handledBy`: wallet / source / device) — beaucoup encore stub UI (« sera géré par… »).

### 3.9 Identity Engine
- Présentation d'identité (jeton rotatif, handle neutre).
- Canal QR aujourd'hui ; architecture prête pour NFC / Wallet Apple plus tard.
- Principe : **identifie, ne décide pas** (n'accorde aucun droit).
- Écran Identity client (plein écran depuis le drawer).

### 3.10 World Factory (Bac à Sable)
- Recettes déclaratives (`quartier_anime` : habitants, commerçants, **livreurs**, produits, favoris, wallets).
- Provenance `demo_batches` / `demo_entities`.
- Reset par appartenance (purge propre même après impersonation).
- Principe : **orchestre les organes**, ne réécrit jamais leur logique.

### 3.11 Laboratoire (admin + lab actions)
- Auth admin séparée (`ADMIN_JWT_SECRET`).
- Explorateur acteurs démo (lecture seule).
- Impersonation = **authentification** (jeton user réel), sandbox + démo-only.
- Actions de labo via organes (Wallet issue/consume aujourd'hui).
- UI `admin-web` : Monde + Explorateur + Devenir X.

### 3.12 Organes « annoncés » mais absents
Déclarés dans le Shell Épée en « Bientôt » (`enabled: false`) :
- **Event Engine**
- **Loyalty Engine** (cartes fidélité côté Wallet existent comme *kinds* ; pas d'organe métier commerçant)
- **Collaboration Engine**

Vision Deuxième Âme (pas d'organe encore) :
- Murmures / Ville
- Quêtes + guide IA
- Lanternes (objets physiques + scan)
- Passions / météo humaine
- Switch Client ↔ Habitant

---

## 4. Fonctionnalités & écrans par profil

### 4.1 Auth (commun)
| Écran | Rôle |
|-------|------|
| `RoleSelectScreen` | Choix du rôle |
| `LoginScreen` / `RegisterScreen` | Connexion / inscription |

---

### 4.2 Client (Première Âme) — navigation actuelle

**Onglets :** Home · Messagerie · Wallet · Panier

#### Home + drawer
| Élément | Contenu |
|---------|---------|
| `HomeScreen` | Catégories produits, recherche, flash promos, résultats |
| Drawer | Profil, coups de cœur, commandes, FAQ, devenir livreur, contact, aide, paramètres |
| `ProductDetailScreen` | Fiche produit → panier / commande |
| `StoreDetailScreen` | Fiche commerce |
| `OrderConfirmScreen` | Confirmation commande |
| `OrderTrackingScreen` | Suivi + chat livreur / commerçant |

#### Messagerie
| Écran | Contenu |
|-------|---------|
| `ClientMessagingHomeScreen` | Hub messagerie |
| `MesCommercesScreen` | Conversations durables avec commerces |
| `SupportChatScreen` | Assistance Ma Zone |
| `ChatScreen` | Fil de messages |

#### Wallet
| Écran | Contenu |
|-------|---------|
| `WalletScreen` | Familles d'objets |
| `WalletFamilyScreen` | Liste d'une famille |
| `WalletObjectDetailScreen` | Détail + capacités + biographie |

#### Panier & identité
| Écran | Contenu |
|-------|---------|
| `CartScreen` | Panier → checkout |
| `IdentityScreen` | QR identité (modal plein écran) |

#### Autres (drawer / hub)
Profil hub, infos perso, favoris, historique commandes, FAQ, devenir livreur, contact, aide, paramètres.

**Services proposés au client aujourd'hui :** chercher / acheter / se faire livrer · suivre une commande · chatter · stocker des objets numériques · présenter son identité QR · gérer favoris & profil.

---

### 4.3 Commerçant — Épée (Shell Phase 1)

**Navigation :** Drawer + Cockpit (plus de 4 onglets monolithes).

#### Familles du registre

| Famille | Modules actifs | Modules « Bientôt » |
|---------|----------------|---------------------|
| **Vendre** | Catalogue & stock, Commandes | — |
| **Animer** | Promotions | Événements, Fidélité |
| **Réseau** | Clients, Messages | Collaborations |
| **Piloter** | Mon commerce, Statistiques | — |

#### Écrans branchés
| Écran | Service |
|-------|---------|
| `MerchantCockpitScreen` | Briefing (priorités, vie du commerce, accès rapides) + stubs Objectifs / Suggestions / Santé |
| `ManageStockScreen` / `AddProductScreen` | Catalogue & stocks |
| `MerchantOrdersScreen` | Commandes reçues |
| `ManagePromotions*` | Promotions |
| `MesClientsScreen` | Clients ayant commandé |
| `MerchantInboxScreen` | Notifications + assistance |
| `CreateStoreScreen` | Boutique |
| `MerchantStatsScreen` | Agrégats simples (commandes, CA livré) |
| `ProfileScreen` | Profil |

**Services proposés au commerçant aujourd'hui :** gérer boutique & stock · recevoir & suivre commandes · lancer des promos · voir clients · messagerie / support · briefing cockpit · stats basiques.

**Non utilisables (volontairement) :** Événements, Fidélité, Collaborations — emplacements réservés sans organe.

---

### 4.4 Livreur

**Onglets :** Accueil · Revenu · Boîte de réception · Menu

| Écran | Service |
|-------|---------|
| `DriverHomeScreen` | Carte, online/offline, offre de course, mission active (drawer) |
| `DriverEarningsScreen` | Revenus / stats |
| `DriverInboxScreen` | Notifications + support |
| `DriverMenuScreen` + Info / Aide / Settings | Compte |
| `ChatScreen` | Chat lié à la course |

**Services :** se mettre en ligne · recevoir / accepter / refuser une offre · réaliser le parcours de livraison · chatter · consulter revenus.

---

### 4.5 Laboratoire (équipe Ma Zone) — web

| Page | Service |
|------|---------|
| Login admin | Auth séparée |
| Monde | Recettes World Factory, run, batches, reset |
| Explorateur | Acteurs démo, détail, **Devenir X**, pouvoirs Wallet |

---

### 4.6 Habitant (Deuxième Âme) — vision uniquement

Pas d'écrans dans le code. Cible conceptuelle :
- Switch Client ↔ Habitant
- Accueil « fenêtre sur le quartier » (7 familles : Découvrir, Participer, Rencontrer, Chercher, Recevoir, Contribuer, Créer)
- Murmures, Quêtes, Lanternes (objets physiques), passions, météo humaine, IA-guide
- Lien Épée → initiatives découvertes côté Habitant

---

## 5. Inventaire — TOUT CE QUI A DÉJÀ ÉTÉ RÉALISÉ

### A. Socle technique
1. Backend Express + SQLite + migrations incrémentales  
2. Auth JWT multi-rôles + profils  
3. Socket.io (rooms user / order / conversation / merchant / drivers)  
4. App Expo multi-rôles (client, merchant, driver)  
5. Config réseau locale (simulator / emulator / `EXPO_PUBLIC_API_URL`)  
6. Design tokens THEME + composants UI de base  
7. Cartes Premium (native + web)  

### B. Première Âme — Client
8. Accueil catégories + recherche produits  
9. Flash promotions  
10. Fiches produit / commerce  
11. Panier + checkout  
12. Commande + suivi temps réel  
13. Annulation commande (statuts autorisés)  
14. Favoris commerces  
15. Messagerie (commerces, support, chat commande)  
16. Historique commandes  
17. Drawer (FAQ, contact, aide, paramètres, devenir livreur)  
18. Hub profil + infos personnelles  
19. Wallet (familles, détail, biographie)  
20. Identity QR (présentation)  

### C. Livraison & livreur
21. Moteur de dispatch + file d'attente  
22. Mode offre popup (accept / refuse, timer)  
23. Workflow mission (picking_up → delivered)  
24. Écran carte livreur + online  
25. Revenus livreur  
26. Inbox / support livreur  
27. Chat client–livreur–commerçant selon contexte  

### D. Commerçant — Épée
28. Shell Épée (Cockpit + drawer + registre modules)  
29. Briefing (adaptateurs marketplace, messages, store, promotions, clients)  
30. Catalogue & stock  
31. Commandes commerçant  
32. Promotions CRUD  
33. Mes clients  
34. Inbox / notifications / support  
35. Boutique (création / édition)  
36. Statistiques lecture seule  
37. Emplacements « Bientôt » Event / Fidélité / Collaborations  

### E. Wallet Engine (organe)
38. Schéma `digital_objects` + journal `digital_object_events`  
39. API issue / consume / revoke / lecture familles  
40. Registre kinds + capacités + retention / souvenirs  
41. Seed / démo World Factory peuplant des wallets  

### F. Identity Engine (organe)
42. Présentations + événements d'audit  
43. Routes identity  
44. Écran QR client  

### G. Communication Engine
45. Politiques de fils (durable / éphémère)  
46. API threads / messages / read  
47. Contextes mobile non-lus + badges  

### H. Bac à Sable
48. Tables `admin_users`, `demo_batches`, `demo_entities`  
49. Auth admin séparée + script `create-admin.js`  
50. World Factory (registre recettes, contexte, reset)  
51. Recette `quartier_anime` (+ **livreurs**)  
52. Explorateur lecture seule  
53. Impersonation sandbox / démo-only  
54. Lab actions via Wallet  
55. App `admin-web` (Monde + Explorateur)  
56. Passage de jeton `#labToken` (web)  

### I. Documentation & gouvernance
57. Plans / chantiers / audits PDF (Wallet, Identity, Bac à Sable, Épée, Laboratoire, UX messagerie, etc.)  
58. Sauvegarde GitHub V0.9.2 taguée  

### J. Explicitement NON réalisé (pour éviter la confusion)
- Paiement réel (CB, PSP)  
- Deuxième Âme / Switch Habitant / Murmures / Quêtes / Lanternes  
- Event / Loyalty / Collaboration Engines  
- Notifications push natives (APNs / FCM)  
- Déploiement production (App Store, Play Store, serveur cloud, HTTPS, secrets prod)  
- Multi-villes / multi-zones avancé  
- Modération / KYC / conformité RGPD outillage complet  
- Objectifs / Suggestions / Santé du commerce (stubs Cockpit seulement)  

---

## 6. TODO — pour une application FONCTIONNELLE et DÉPLOYABLE

Deux horizons distincts. Ne pas les mélanger.

### Horizon A — MVP Première Âme « déployable » (priorité opérationnelle)

Sans cela, Ma Zone reste un **labo local**, pas un produit en production.

#### A1. Fiabilité métier (bloquant produit)
1. Stabiliser bout-en-bout le parcours **commande → offre livreur → livraison → livré** (régressions connues historiques : file silencieuse, missions fantômes).  
2. Clarifier & tester les cas limites (aucun livreur, annulation mid-course, multi-commandes).  
3. Brancher réellement les **capacités Wallet** critiques ou masquer celles encore stub.  
4. Vérifier Identity en conditions réelles (scan / présentation sur téléphone physique).  
5. Nettoyer écrans / flux legacy non branchés (anciens écrans livreur) pour éviter la dette.  

#### A2. Paiement & confiance (bloquant business)
6. Choisir et intégrer un **PSP** (Stripe / autre) : paiement commande, webhooks, remboursements.  
7. Tickets / reçus cohérents (Wallet `pickup_ticket` / souvenirs d'achat réellement émis à la livraison).  
8. Mentions légales, CGU, politique de confidentialité **dans l'app**.  
9. Gestion des litiges / support opérationnel (processus + outils minimum).  

#### A3. Production technique (bloquant déploiement)
10. Héberger le backend (VM / PaaS) avec **HTTPS**, secrets (`JWT_SECRET`, `ADMIN_JWT_SECRET`) hors code.  
11. Base de données de prod (backup, restauration) — SQLite OK pour petit volume ou migration Postgres si besoin.  
12. Builds **iOS App Store** + **Android Play Store** (certificates, privacy nutrition labels).  
13. Config réseau prod (`EXPO_PUBLIC_API_URL`, sockets WSS).  
14. Monitoring / logs / alertes (erreurs API, dispatch, sockets).  
15. Désactiver / verrouiller le Bac à Sable hors environnement sandbox (`SANDBOX_MODE`).  
16. Rate limiting, durcissement CORS, rotation secrets.  

#### A4. Qualité & ops
17. Suite de tests automatisés (au minimum : auth, commande, dispatch, reset demo).  
18. Environnements séparés (dev / staging / prod).  
19. Procédure de rollback (tag Git déjà en place — formaliser le runbook).  
20. Onboarding commerçants / livreurs (données réelles, pas seulement World Factory).  

### Horizon B — Enrichir la Première Âme (après A, avant ou en parallèle de la Deuxième Âme)

21. Event Engine + écrans Épée « Événements »  
22. Loyalty Engine (au-delà des kinds Wallet)  
23. Collaboration Engine  
24. Cockpit : Objectifs / Suggestions / Santé (vrais organes ou adapters)  
25. Notifications push  
26. Analytics métier (sans trahir la future métrique « vie réelle »)  
27. Amélioration UX commerce (photos, stories, vidéos verticales — déjà dans la vision)  

### Horizon C — Deuxième Âme / Ville Augmentée (chapitre stratégique)

**Prérequis :** architecture conceptuelle validée (en cours) — **aucun code tant que l'expérience n'est pas certaine.**

28. Architecture conceptuelle formalisée (surfaces Habitant, organes Murmures / Quêtes / Lanternes)  
29. Switch Client ↔ Habitant (changement d'intention, pas seulement de thème)  
30. Onboarding passions (ce qui émerveille, pas ce qu'on achète)  
31. Organe Murmures + écran d'accueil Habitant  
32. Quêtes + guide IA (parcours, pas listes)  
33. Sept familles d'expériences (Découvrir → Créer)  
34. Lanternes : objets physiques, QR, Identity, Wallet (récompense / souvenir), curation Back Office, candidature Épée « Devenir une Lanterne »  
35. Météo humaine du quartier  
36. Lien Épée → découverte Habitant (événements, collabs, histoires)  
37. Métriques de succès « sorties / expériences » (pas de rétention d'écran)  
38. Recettes World Factory enrichies pour peupler la Deuxième Âme dans le Laboratoire  

---

## 7. Synthèse exécutive

| Question | Réponse courte |
|----------|----------------|
| Que sait faire Ma Zone **aujourd'hui** ? | Marketplace locale complète (client / commerçant / livreur) + Wallet + Identity + Bac à Sable (générer un monde, y entrer). |
| Qu'est-ce qui est **annoncé mais vide** ? | Modules Épée Event / Fidélité / Collaborations ; stubs Cockpit ; capacités Wallet partiellement stub. |
| Qu'est-ce qui est **vision pure** ? | Deuxième Âme, Murmures, Quêtes, Lanternes, Switch Habitant. |
| Que faut-il pour **déployer** ? | Horizon A : fiabiliser le parcours, paiement, hébergement HTTPS, stores, secrets, sandbox off en prod. |
| Que faut-il pour **accomplir la promesse** ? | Horizon C : construire l'Habitant sans trahir « faire fermer le téléphone ». |

---

## 8. Verdict CTO

Ma Zone V0.9.2 est un **MVP Première Âme solide** avec une architecture d'organes mature et un Bac à Sable réellement utilisable pour inventer la suite. Ce n'est **pas** encore un produit production-ready (paiement, hébergement, stores, durcissement).

La Deuxième Âme est le **chapitre stratégique** : elle ne doit pas être improvisée en features. Elle doit naître d'une architecture conceptuelle aussi exigeante que celle du Wallet / de l'Épée — surfaces qui orchestrent, organes qui décident, et une métrique de succès qui mesure la **vie**, pas l'écran.

**Prochaine étape recommandée (ordre) :**
1. Clôturer Horizon A (déployabilité Première Âme).  
2. Finaliser l'architecture conceptuelle de la Deuxième Âme (document de conception, sans code).  
3. Ouvrir Horizon C par le plus petit organe fidèle à la philosophie (souvent : Murmures ou Lanternes — à trancher ensemble).

---

*Fin du document — généré à partir de l'état réel du dépôt Ma Zone au 19/07/2026.*
