# Compte rendu — Deuxième Âme, première version de production

**Date :** 21 juillet 2026  
**Référence :** `PLAN_DEUXIEME_AME_V1_PRODUCTION.md` (plan validé)  
**Périmètre :** surface client (Deuxième Âme) + Épée (Opportunité Volante)  
**Backend Event Engine :** inchangé (déjà prêt)

---

## 1. Synthèse

La première version officielle de la Deuxième Âme est livrée. Ce n'est ni un prototype ni un échafaudage : c'est une **base de production** destinée à évoluer, s'enrichir et être raffinée, pas à être remplacée.

- La **Première Âme** (Marketplace) reste strictement identique.
- La **Deuxième Âme** s'ajoute comme seconde face de Ma Zone.
- Le **panier**, le **wallet** et la **messagerie** sont partagés entre les deux faces.
- La philosophie Event Engine est respectée : **la surface compose, l'organe fournit les projections**. Aucune logique métier n'a remonté dans les écrans.
- Aucune modification backend n'a été nécessaire : les routes et sockets étaient déjà en place.

---

## 2. Éléments développés

### 2.1 Architecture « deux faces » (additive)

| Élément | Rôle |
|---|---|
| `activeSoul` + `switchSoul()` dans `AppContext` | État persisté (`first` / `second`), réinitialisé à la déconnexion |
| `AppNavigator` | Branche `ClientRoot` ou `DeuxiemeAmeRoot` selon la face |
| Drawer Première Âme | Bouton « Entrer dans la Deuxième Âme » |
| En-tête Deuxième Âme | Icône boutique pour revenir à la Marketplace |

Les rôles marchand et livreur sont intacts. Un client non basculé voit exactement la Première Âme d'avant.

### 2.2 Face Deuxième Âme — navigation

Onglets : **Accueil / Messages / Wallet / Panier**.

- Accueil : stack dédiée (portes, détails, scan, Mode Réception…).
- Messages, Wallet, Panier : **mêmes stacks** que la Première Âme → continuité d'expérience réelle (pas de duplication d'état).

### 2.3 Accueil — composition validée

Ordre de composition (fidèle à la maquette de référence) :

1. **AmeHeader** — identité de face, cloche Mode Réception, messages, profil, bascule
2. **WeatherHero** — ancrage local + pouls du quartier (stats **réelles** : événements / lanternes)
3. **AiIntentBar** — barre d'intention + suggestions
4. **Grille des 6 portes** (`PorteCard`, config déclarative)
5. **Murmures** — carrousel horizontal + « Voir tout »

### 2.4 Les 6 portes (vues composées)

| Porte | Projection / organe | Écran |
|---|---|---|
| Les Lanternes | `listDiscoverable` (capability `isLantern`) + scan | `LanternsScreen` → `LanternScanScreen` |
| Les Événements | `listDiscoverable` (hors lanternes) | `EventsScreen` |
| Participer | Entrée ouverte (formes déclaratives) | `ParticiperScreen` |
| Découvrir mon quartier | Commerces existants + catégories « Bientôt » | `DecouvrirQuartierScreen` |
| Mes adresses | Favoris existants (`getFavoriteStores`) | `MesAdressesScreen` |
| Se laisser surprendre | Tirage sur `listDiscoverable` | `SurpriseScreen` |

Les portes sont déclarées dans `mobile/src/data/deuxiemeAme.js`. Ajouter / renommer une porte = une entrée de config, sans toucher à l'organe.

### 2.5 Parcours branchés sur l'Event Engine

| Parcours | API / socket | Surface |
|---|---|---|
| Mode Réception (toggle + réglage fin) | `GET/PUT /api/events/reception` | Popover + `ModeReceptionScreen` |
| Billet | `POST /api/events/:id/ticket` | `EventDetailScreen` → Wallet |
| Découverte Lanterne | `POST /api/events/:id/discover` | `LanternScanScreen` (caméra + repli saisie) |
| QR physique Lanterne | — (affichage de l'`id`) | Détail d'une lanterne |
| Opportunité Volante (écoute) | socket `event:opportunity` | `OpportunityContext` + `OpportunityBanner` |
| Opportunité Volante (diffusion) | `POST /api/events/:id/diffuse` | `DiffuseOpportunityScreen` (Épée) |
| Murmures | `GET /api/events/feed/murmurs` | Section Accueil + `MurmursScreen` |

### 2.6 Épée — Opportunité Volante

- Module `opportunities` déclaré dans `moduleRegistry.js` (famille Animer).
- Écran `DiffuseOpportunityScreen` : sélection d'une initiative publiée / flyable, canaux, note, clé d'idempotence déterministe.

### 2.7 Gouvernance Open/Closed

Note livrée : `backend/src/lib/eventEngine/AJOUTER_UN_PRODUCTEUR.md`

Règle rappelée : **nouveau producteur = 1 type déclaré + 1 mapping de source**, sans toucher au cœur.

---

## 3. Choix techniques

1. **Aucune modification backend** — les projections, le Mode Réception, la diffusion et l'orchestration (billet / lanterne) étaient déjà prêts.
2. **Référence de navigation globale** (`navigationRef`) — permet à la bannière temps réel (hors navigateur) d'ouvrir le détail d'une initiative.
3. **Config déclarative des portes et des formes de participation** — extensibilité sans refonte d'écrans.
4. **Idempotence de diffusion** via clé `eventId:channels` (rejouer ne double pas).
5. **`expo-camera` ~56.0.8** — dernière version compatible SDK Expo 56 ; permission caméra dans `app.json` ; repli saisie manuelle (web / refus caméra).
6. **Pattern socket** calqué sur `WalletContext` pour `OpportunityContext` (écoute `event:opportunity`, clients uniquement).

---

## 4. Adaptations mineures (par rapport au plan)

| Point | Adaptation |
|---|---|
| Utilitaire `timeAgo` | Ajouté dans `utils/format.js` (murmures / opportunités) |
| Permission caméra | Plugin `expo-camera` + `NSCameraUsageDescription` iOS |
| Porte « Participer » | Architecture **ouverte** : 6 formes déclarées ; seule « Créer une initiative » est active (source `CITIZEN`) ; les autres sont honnêtement marquées « Bientôt » |
| Éléments sans organe | Composants de production avec états honnêtes et points de branchement (`getLocalContext`, `onAssist`, catégories patrimoine/cafés…) |
| Stats du hero | Calculées côté surface à partir de `listDiscoverable` (événements vs lanternes) — l'organe ne connaît pas les portes |

---

## 5. Vigilance produit respectée — porte « Participer »

La porte n'est **pas** réduite à la création d'initiatives citoyennes.

Formes déclarées dans `PARTICIPATION_MODES` :

- Créer une initiative *(active — v1)*
- Rejoindre une initiative *(Bientôt)*
- Aider un commerçant *(Bientôt)*
- Participer à une association *(Bientôt)*
- Répondre à un besoin *(Bientôt)*
- Prendre part à une mission *(Bientôt)*

Ajouter une forme = une entrée de config. Pas de refonte quand les organes arriveront.

---

## 6. Fichiers principaux créés / touchés

### Créés (surface)

- `mobile/src/data/deuxiemeAme.js`
- `mobile/src/context/OpportunityContext.js`
- `mobile/src/navigation/navigationRef.js`
- `mobile/src/components/deuxiemeAme/*` (AmeHeader, WeatherHero, AiIntentBar, PorteCard, MurmurCard, ModeReceptionPopover, OpportunityBanner, EventListItem)
- `mobile/src/screens/deuxiemeAme/*` (Accueil, 6 portes, détail, scan, murmures, Mode Réception)
- `mobile/src/screens/merchant/DiffuseOpportunityScreen.js`
- `backend/src/lib/eventEngine/AJOUTER_UN_PRODUCTEUR.md`

### Modifiés (câblage)

- `mobile/src/context/AppContext.js` — `activeSoul` / `switchSoul`
- `mobile/src/navigation/index.js` — `DeuxiemeAmeRoot` + route Épée
- `mobile/src/components/client/ClientDrawerContent.js` — bascule
- `mobile/App.js` — `OpportunityProvider` + `navigationRef`
- `mobile/src/epee/moduleRegistry.js` — module Opportunité Volante
- `mobile/package.json` / `mobile/app.json` — expo-camera + permissions
- `mobile/src/utils/format.js` — `timeAgo`

### Non touchés (volontairement)

- Première Âme (`HomeScreen`, stacks Marketplace…)
- Backend Event Engine (cœur, routes, diffusion, orchestration)

---

## 7. Recommandations pour les prochaines itérations

1. **Organe ambiance / contexte local** — alimenter le hero (météo, densité de vie) via `getLocalContext`.
2. **Organe IA** — brancher la barre d'intention et « Se laisser surprendre » (structure déjà prête).
3. **Géolocalisation** — `listDiscoverable` accepte déjà des filtres ; brancher position réelle + rayon du Mode Réception.
4. **Porte Participer** — activer les formes « Bientôt » au fur et à mesure de leurs organes (missions, associations, besoins…).
5. **Badge cloche** — refléter le volume d'opportunités reçues.
6. **DA & médias** — illustrations, animations, micro-interactions et médias d'initiatives quand la direction artistique arrivera.

---

## 8. Philosophie rappelée

> Nous ne construisons pas le miroir de la ville.  
> Nous construisons le moteur qui aide la ville à devenir plus vivante.

La Deuxième Âme est la première expression visible de cette philosophie. Cette v1 en pose durablement l'architecture d'expérience ; les itérations suivantes raffineront, sans remplacer.
