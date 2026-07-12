# Ma Zone — Plan UX Chapitre Client, Messagerie & Dispatch

**Document technique — Équipe de développement Ma Zone**

| | |
|---|---|
| **Version** | 1.0 |
| **Date** | juillet 2026 |
| **Périmètre** | Navigation client, onglet Messagerie, UX Chat vs Messagerie, terminologie commerçant, popup proposition course |
| **Statut** | Plan d'architecture (aucune implémentation avant validation) |
| **Références** | ORGANE_COMMUNICATION.md, CURRENT_ARCHITECTURE.md, stabilisation_messagerie_mvp_81a6b9a9.plan.md |

---

## Document de référence

| Format | Fichier | Usage |
|--------|---------|-------|
| **HTML (recommandé dans Cursor)** | [`PLAN_UX_CHAPITRE_CLIENT_MESSAGERIE.html`](PLAN_UX_CHAPITRE_CLIENT_MESSAGERIE.html) | Lecture directe dans le navigateur / Cursor |
| **Markdown** | [`PLAN_UX_CHAPITRE_CLIENT_MESSAGERIE.md`](PLAN_UX_CHAPITRE_CLIENT_MESSAGERIE.md) | Partage ChatGPT, édition |
| **PDF** | [`PLAN_UX_CHAPITRE_CLIENT_MESSAGERIE.pdf`](PLAN_UX_CHAPITRE_CLIENT_MESSAGERIE.pdf) | Impression / envoi — **ouvrir via Finder ou double-clic sur `Ouvrir_PLAN_UX_PDF.command`** (ne pas ouvrir le PDF dans l’éditeur Cursor : binaire illisible) |

**Aucun code ne sera écrit avant validation explicite de ce plan.**

---

## 0. Audit de l'existant (état au 11/07/2026)

### Navigation client actuelle

Fichier : `mobile/src/navigation/index.js` — 4 onglets :

| Onglet | Rôle réel | Problème |
|--------|-----------|----------|
| HomeTab | Accueil + recherche | OK |
| **ProfileTab** | `ClientProfileScreen` | À supprimer de la tab bar |
| CartTab | Panier | Conserver |
| **MenuTab** | `ClientMenuScreen` — liste d'écrans | N'est pas un drawer ; doublon avec Profil |

Le « hamburger » actuel **n'existe pas sur Home** : c'est un onglet Menu séparé. `HomeScreen` n'a pas de bouton menu latéral.

### Communication (stable — ne pas refondre)

Organe en place (`ORGANE_COMMUNICATION.md`) :

- Moteur : `backend/src/lib/communicationEngine.js`
- Client mobile : `CommunicationContext.js`, `openCommunication.js`
- Durable : `kind=client_merchant`, `lifecycle=durable`, unicité `(store_id, client_id)`
- Éphémère : `kind=client_driver`, archivé à la livraison
- Pastilles : `UnreadDot.js` + helpers `getUnreadForStore`, `getUnreadForOrder`

**Support client** : `SupportChatScreen.js` est encore un stub (« Bientôt disponible »). La section « Support client » de l'onglet Messagerie affichera ce stub en V1, sans toucher au moteur.

### Dispatch (stable — ne pas refondre)

Flux actuel dans `backend/src/lib/dispatch.js` :

```
Nouvelle commande (pending_driver)
    → tryDispatchNewOrder
    → findAvailableDriver
    → assignOrderToDriver (assignation IMMÉDIATE)
    → mission:assigned + conversations ephemeral créées
```

- **Aucune étape proposition** : `assignOrderToDriver` écrit directement `driver_id` + `status=accepted`
- `NewCourseOfferModal.js` existe mais **n'est branché nulle part**
- `GET /api/missions/offered` est appelé côté mobile (`api/index.js`) mais **la route backend n'existe plus**
- `POST /missions/:id/accept` et `POST /missions/:id/refuse` existent ; `refuse` est un no-op (ne relance pas le dispatch)
- **Point de vigilance critique** : au boot, `backend/src/db/index.js` L348-355 **efface tout statut `offered`** — incompatible avec la popup tant que cette migration n'est pas adaptée

### Favoris vs Messagerie commerçants

| Concept | Source | Écran actuel |
|---------|--------|--------------|
| **Coups de cœur** (favoris) | API `/api/favorites`, table `store_favorites` | Section sur HomeScreen uniquement |
| **Relation durable** (messagerie) | `GET /api/communication/threads?kind=client_merchant` | `MesCommercesScreen.js` |

**Décision validée** : écran dédié pour « Mes commerces coups de cœur » (favoris), distinct de l'onglet Messagerie.

---

## 1. Audit de stabilité (Partie 6)

### Verdict par organe

| Modification | Dispatch | Communication | Dette | Multi-livreur | Multi-employé |
|--------------|----------|---------------|-------|---------------|---------------|
| Drawer + nav client | Aucun | Aucun | Faible (1 dep drawer) | OK | OK |
| Onglet Messagerie | Aucun | Réutilise Context | Faible | OK | OK |
| UX Chat vs Messagerie | Aucun | **UI seule** sur `ChatScreen` | Faible | OK | OK |
| Terminologie commerçant | Aucun | Aucun | Nulle | OK | OK |
| Popup proposition course | **Couche insertion** | Aucun | Moyenne si mal placée | **Préparé** | N/A |

### Règle d'or

**Organes intacts (ne pas refondre) :**

- `dispatch.js` → `assignOrderToDriver`
- `communicationEngine.js`

**Nouvelles couches UX (insertion uniquement) :**

- `ClientDrawer` — navigation latérale
- `MessagingTab` — hub messagerie client
- `ChatPresentation` — styles UI selon lifecycle
- `OfferModal` + `proposeOrderToDriver` — délègue à `assignOrderToDriver` après acceptation

### Adaptations minimales recommandées dès maintenant

1. **Dispatch — statut `offered`**
   - Ajouter colonnes `missions.offered_to_driver_id`, `missions.offer_expires_at` (nullable)
   - **Supprimer ou conditionner** les `UPDATE` boot qui remettent `offered` → `pending_driver` (`db/index.js` L348-355)
   - Ne **pas** modifier la transaction interne de `assignOrderToDriver`

2. **Communication — helper agrégé**
   - Ajouter `getTotalUnreadMessagingTab()` dans `CommunicationContext.js` :
     - Somme des `unread_count` des threads `client_merchant` + `support` (future)
     - **Exclure** `client_driver` ephemeral du badge onglet Messagerie (reste sur bouton suivi commande)

3. **Navigation — paramètre `presentationMode`**
   - Étendre `openCommunication.js` pour passer `lifecycle` / `kind` déjà retournés par l'API

4. **Drawer — pas de 3e système**
   - Un seul `ClientDrawerContent` ; réutiliser les écrans existants (`OrderHistory`, `HelpCenter`, `ClientInfo`)

---

## 2. Architecture cible — Navigation client (Partie 1)

### Tab bar cible (3 onglets)

```
[ Home ]  [ Messagerie ]  [ Panier ]
```

- **Supprimer** : `ProfileTab`, `MenuTab` (onglet)
- **Conserver** : `HomeTab`, `CartTab`
- **Ajouter** : `MessagingTab`

### Drawer latéral (hamburger sur Home)

**Technique recommandée** : `@react-navigation/drawer` enveloppant `HomeStack` uniquement.

- Dépendances à ajouter : `@react-navigation/drawer`, `react-native-reanimated` (standard Expo)
- Alternative rejetée : Modal custom — plus de code, moins de gestures natives

**Structure** :

```
HomeTab
  └── DrawerNavigator
        ├── HomeMain → HomeStack (Home, ProductDetail, OrderTracking, Chat…)
        └── (drawer screens navigables depuis le menu)
              ├── ClientProfileHub → stack profil
              ├── FavoriteStores → nouvel écran
              ├── OrderHistory
              └── HelpCenter
```

**Contenu drawer** (`ClientDrawerContent.js`) :

| Zone | Contenu | Navigation |
|------|---------|------------|
| Header | Avatar, nom, email | — |
| CTA | « Mon profil » | `ClientProfileHub` |
| Sous-menu profil (écran hub) | Mes informations → `ClientInfoScreen` | |
| | Modifier mon profil → section édition | Réutiliser contenu `ClientProfileScreen` |
| Liste | Mes commerces coups de cœur | `FavoriteStoresScreen` **nouveau** |
| | Mes commandes | `OrderHistory` |
| | Aide | `HelpCenter` |
| Footer | Déconnexion (rouge) | `logoutUser()` depuis AppContext |

**Décisions UX** :

- Style minimaliste : fond blanc/card, séparateurs légers
- « Mon profil » ouvre un **hub intermédiaire** (2 entrées) plutôt qu'un accordion dans le drawer
- `ClientProfileScreen.js` : déprécier en tab ; extraire header + logout vers drawer

**Impacts fichiers** :

- `mobile/src/navigation/index.js` — restructuration `ClientTabs`, nouveau `HomeDrawer`
- Nouveau : `ClientDrawerContent.js`, `ClientProfileHubScreen.js`, `FavoriteStoresScreen.js`
- `ClientMenuScreen.js` — supprimer (redirect legacy non recommandé)

---

## 3. Onglet Messagerie client (Partie 2)

### Structure

Nouveau stack `MessagingStack` remplaçant `ProfileTab` :

```
MessagingTab
  └── MessagingStack
        ├── ClientMessagingHome (hub à 2 sections)
        ├── MesCommerces (existant — liste threads durables)
        ├── SupportChat (existant — stub V1)
        └── Chat (existant — partagé)
```

**Écran hub** `ClientMessagingHomeScreen.js` :

| Section | Libellé | Action | Source données |
|---------|---------|--------|----------------|
| A | Messages de mes commerçants | → `MesCommercesScreen` | `CommunicationContext` threads `client_merchant` |
| B | Support client | → `SupportChatScreen` | Stub V1 ; pastille 0 |

**Pastille onglet Messagerie** :

- Réutiliser `TabIcon` avec `badge={totalUnread}`
- Calcul : `getTotalUnreadMessagingTab()` dans CommunicationContext
- Sync : listeners socket existants (`conversation:updated`, `message:new`)
- Comportement identique livreur : pastille disparaît quand conversation ouverte (`markRead` + `activeConversationId`)

**Justification UX** : l'onglet Messagerie regroupe les **relations durables + support** ; les chats livreur restent contextuels (suivi commande).

---

## 4. Différenciation Messagerie vs Chat de mission (Partie 3)

### Principe

**Un seul écran** `ChatScreen.js` — **deux présentations** selon `thread.lifecycle` / `thread.kind`.

Nouveau composant : `ChatPresentation.js` (styles + chrome, pas de logique métier).

| Aspect | Durable (`client_merchant`) | Éphémère (`client_driver`) |
|--------|----------------------------|----------------------------|
| Titre navigation | « Messagerie » | « Chat de mission » |
| Bandeau | Nom du commerce (existant) | « Messages éphémères · liés à cette livraison » |
| Bulles | Pleines (actuel) | Contour pointillé, fond légèrement transparent |
| Input | Standard | Placeholder « Message pour cette livraison… » |
| Vocabulaire UI | Messagerie | Chat |

**Implémentation minimale** :

1. `openCommunication` transmet `kind`, `lifecycle` dans `route.params`
2. `ChatScreen` dérive `presentationMode = lifecycle === 'ephemeral' ? 'mission_chat' : 'messaging'`
3. `navigation.setOptions({ title })` dynamique selon mode
4. Styles conditionnels sur `renderMessage` et bandeau — **aucune modification** moteur, API, ou socket

**Points de vigilance** :

- Ne pas créer `MissionChatScreen.js` séparé (duplication lifecycle)
- Les messages ephemeral depuis OrderTracking continuent d'utiliser `openCommunication({ orderId, targetRole: 'driver' })`

**Parcours** :

```
OrderTracking ──merchant/driver──► openCommunication ──► ChatScreen ──► ChatPresentation
MesCommerces ──storeId──────────► openCommunication ──► ChatScreen ──► ChatPresentation
                                              ├── durable  → style Messagerie
                                              └── ephemeral → style Chat mission
```

---

## 5. Terminologie commerçant (Partie 4)

Fichier unique : `MerchantOrdersScreen.js`

| Avant | Après | Justification |
|-------|-------|---------------|
| Tchat client | **Messagerie client** | Relation durable |
| Tchat livreur | **Chat livreur** | Relation temporaire |

Changement **textuel uniquement** — pas de modification dispatch/communication.

Optionnel cohérence : titre navigation Chat côté commerçant « Messagerie » vs « Chat » selon `kind` (même logique Partie 3).

---

## 6. Popup proposition de course (Partie 5)

### Objectif

Insérer une **couche UX** entre « course trouvée » et « assignation », sans réécrire `assignOrderToDriver`.

### Point d'insertion optimal

**Un seul endroit à modifier** dans le flux automatique — `tryDispatchNewOrder` (`dispatch.js` L135-138) :

```javascript
// AVANT (direct)
return assignOrderToDriver(orderId, driver.id, io);

// APRÈS (proposition)
return proposeOrderToDriver(orderId, driver.id, io);
```

`assignPendingOrdersToDriver` (livreur se met en ligne) suit la **même logique**.

**`assignOrderToDriver` reste inchangé** — appelé uniquement après acceptation explicite.

### Nouvelle fonction `proposeOrderToDriver(orderId, driverId, io)`

Responsabilités (nouveau fichier `backend/src/lib/dispatchOffer.js`) :

1. Vérifier mission `available`, pas de `driver_id`
2. `UPDATE missions SET status='offered', offered_to_driver_id=?, offer_expires_at=datetime('now', '+20 seconds')`
3. Calculer rémunération test : `base = 3.99`, `bonus = total_price * 0.10`, `earnings = base + bonus`
4. Émettre `mission:offered` → `user_{driverId}` avec `{ mission, offer: { store_name, earnings, expires_at } }`
5. **Ne pas** créer conversations ephemeral (reste dans `assignOrderToDriver`)
6. **Ne pas** changer statut commande (reste `pending_driver`)

### Acceptation

`POST /missions/:id/accept` — adapter conditions :

- Accepter si `status IN ('available', 'offered')` ET (`offered_to_driver_id IS NULL OR offered_to_driver_id = me`)
- Déléguer à **`assignOrderToDriver(orderId, req.user.id, io)`**
- Nettoyer champs offer

### Refus + timeout (20 s)

`POST /missions/:id/refuse` — enrichir :

1. Vérifier `offered_to_driver_id = me`
2. Reset mission : `status='available'`, `offered_to_driver_id=NULL`
3. Appeler `tryDispatchNewOrder(orderId, io, { excludeDriverIds: [me] })`

**Timeout** :

- **Client** : timer 20 s dans `NewCourseOfferModal` → auto `refuse`
- **Serveur** : setTimeout 20 s par mission pour fiabilité multi-device

### UI livreur

Brancher modal existant dans `DriverHomeScreen.js` :

- Écouter `mission:offered` dans `DriverContext.js`
- Afficher `NewCourseOfferModal` :
  - Titre : « Nouvelle course disponible ! »
  - Commerce + rémunération (3,99 € + 10 %)
  - Question : « Souhaitez-vous accepter cette course ? »
  - Boutons : **Accepter** / **Refuser**
  - Compte à rebours 20 s visible
- Accept → `POST /missions/:id/accept`
- Refuse / timeout → `POST /missions/:id/refuse`

Restaurer route **`GET /api/missions/offered`** (polling de secours si socket manqué).

### Multi-livreur (futur)

- Un seul `offered_to_driver_id` par mission à la fois
- Refus/timeout → driver suivant via `excludeDriverIds`
- Compatible extension : table `mission_offer_log` plus tard si besoin analytics

### Ce qu'on ne touche PAS

- `createOrderWithDispatch`
- Transaction SQL inside `assignOrderToDriver`
- `mission:assigned` sémantique (émis après accept uniquement)
- Communication / conversations (créées à l'assignation, pas à la proposition)

---

## 7. Phases d'implémentation

| Phase | Contenu | Estimation |
|-------|---------|------------|
| **A** | Livrables doc (ce MD + PDF), validation utilisateur | 0,5 j |
| **B** | Drawer hamburger, supprimer ProfileTab/MenuTab, FavoriteStoresScreen, ClientProfileHub | 1,5 j |
| **C** | MessagingTab + ClientMessagingHome + pastille `getTotalUnreadMessagingTab` | 1 j |
| **D** | ChatPresentation durable vs ephemeral (UI seule) | 0,5 j |
| **E** | Renommer Messagerie client / Chat livreur | 0,25 j |
| **F** | dispatchOffer.js, migration DB offer, modal + socket mission:offered, feature flag | 1,5 j |
| **G** | Recette non-régression dispatch + communication (11 scénarios) | 1 j |

**Estimation totale** : ~6 jours — phases B-F partiellement parallélisables (B+C vs F).

---

## 8. Matrice de tests (recette)

| # | Scénario | Attendu |
|---|----------|---------|
| 1 | Ouvrir drawer depuis Home | Menu latéral complet |
| 2 | Mon profil → Mes informations | ClientInfoScreen |
| 3 | Mes commerces coups de cœur | Liste favorites API |
| 4 | Onglet Messagerie pastille | Unread durable merchant only |
| 5 | Mes commerces → conversation | Même thread qu'en commande |
| 6 | Chat livreur depuis suivi | Style ephemeral, pas dans badge Messagerie |
| 7 | Commerçant voit « Messagerie client » | Label correct |
| 8 | Nouvelle commande + livreur online | Popup 20s, pas assignation immédiate |
| 9 | Accept popup | Même comportement qu'assignation actuelle |
| 10 | Refuse / timeout | Proposition au livreur suivant |
| 11 | Livraison | Conversations ephemeral archivées (inchangé) |

---

## 9. Points de vigilance

1. **Boot DB** : les migrations L348-355 **casseront** la popup si non adaptées avant Phase F
2. **Drawer + Chat** : s'assurer que `Chat` reste dans HomeStack ET MessagingStack (pattern actuel Cart/Menu)
3. **Support client stub** : ne pas promettre chat support fonctionnel ; pastille support = 0 jusqu'à migration support dans moteur Communication
4. **Pas de second moteur messagerie** : MessagingTab = vues filtrées sur CommunicationContext
5. **Popup ≠ refonte dispatch** : toute régression assignation = rollback `proposeOrderToDriver` → `assignOrderToDriver` en une ligne (feature flag recommandé)

---

## 10. Feature flag recommandé

Variable env ou constante `backend/src/config/dispatch.js` :

```javascript
const OFFER_MODE = process.env.DISPATCH_OFFER_MODE !== '0'; // default true after rollout
```

`tryDispatchNewOrder` :

```javascript
if (OFFER_MODE) return proposeOrderToDriver(...);
return assignOrderToDriver(...);
```

Permet rollback instantané sans revert git en production.

---

## 11. Fichiers principaux impactés (résumé)

| Phase | Fichiers |
|-------|----------|
| B | `navigation/index.js`, `ClientDrawerContent.js`, `ClientProfileHubScreen.js`, `FavoriteStoresScreen.js`, `HomeScreen.js` |
| C | `CommunicationContext.js`, `ClientMessagingHomeScreen.js`, `navigation/index.js` |
| D | `ChatScreen.js`, `ChatPresentation.js`, `openCommunication.js` |
| E | `MerchantOrdersScreen.js` |
| F | `dispatch.js`, `dispatchOffer.js`, `missions.js`, `db/index.js`, `DriverContext.js`, `DriverHomeScreen.js`, `NewCourseOfferModal.js` |
| Doc | `PLAN_UX_CHAPITRE_CLIENT_MESSAGERIE.md`, `.pdf` |

**Fichiers interdits de modification lourde** : `communicationEngine.js`, `communicationPolicies.js`, transaction core `assignOrderToDriver`.

---

*Document généré pour validation avant implémentation — Ma Zone MVP.*
