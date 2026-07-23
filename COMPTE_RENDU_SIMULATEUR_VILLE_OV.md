# Compte rendu — Simulateur de ville & Opportunités Volantes spatiales

**Date :** 22 juillet 2026  
**Objet :** Enrichir le monde simulé de Ma Zone (géographie parisienne, diffusion spatiale, boîte aux lettres, parcours d'acceptation)  
**Contrainte respectée :** aucune logique de campagne ajoutée au *cœur* de cycle de vie de l'Event Engine — tout vit dans la couche **diffusion** + World Factory + surfaces.

---

## Philosophie appliquée

Nous ne testons plus seulement des données : le Laboratoire génère désormais un **monde spatial**. Chaque acteur et chaque initiative portent une adresse réelle à Paris et des coordonnées. Les Opportunités Volantes ciblent par **distance**, pas seulement par canal.

Les points 7 (rareté) et 8 (Ticket d'Or) n'ont **pas** été développés. L'architecture les laisse ouverts via des champs opaques extensibles (`policy`, `meta`).

---

## 1. Laboratoire → simulateur de ville

### Ajout

- Catalogue `backend/src/lib/worldFactory/parisAddresses.js` : **~45 adresses parisiennes réelles** (plusieurs arrondissements) avec `address`, `lat`, `lng`.
- Primitive `pickParisAddress(exclude)` : tirage aléatoire avec anti-doublon dans un batch.

### Recettes mises à jour

| Recette | Changements |
|---------|-------------|
| `quartier_anime` | Habitants, commerçants, boutiques, livreurs, initiatives + Lanternes géolocalisés |
| `monde_evenementiel` | Idem, pour peupler rapidement un monde événementiel crédible |

Chaque boutique et chaque initiative héritent de la même position (le lieu de l'initiative = le commerce).

### Création commerçante (Épée)

`POST /api/events` hérite automatiquement de `lat` / `lng` / `address` de la boutique si non fournis → les initiatives produites hors Lab sont aussi spatiales.

---

## 2. Calculs sur de vraies positions

### Diffusion spatiale (`diffusion.js`)

`matchSubscribers` enrichit désormais chaque abonné avec sa position et `distanceKm` (via `geo.distanceKm`, Haversine déjà existant — **réutilisé**, non dupliqué).

Filtres :

1. Canaux (Mode Réception) — inchangé  
2. **Périmètre de campagne** `radiusKm` (prioritaire)  
3. Sinon rayon d'écoute individuel `radius_km` de l'abonnement  
4. Tri **plus proches d'abord** avant application du quota  

Épicentre d'une initiative : ses propres coords, sinon celles de sa boutique (`resolveOrigin`).

### Livreurs

Les recettes assignent désormais une **vraie adresse + lat/lng** aux livreurs. Le dispatch existant (`dispatch.js`) lit déjà `u.lat` / `u.lng` : il bénéficie automatiquement de cette géographie sans refonte.

---

## 3. Campagnes d'Opportunités Volantes enrichies

### Politique de diffusion (couche diffusion, pas le cœur)

```
{ channels, note, radiusKm, quota, windowStart?, windowEnd?, actor? }
```

| Paramètre | Rôle |
|-----------|------|
| `quota` | Nombre max d'habitants à atteindre |
| `radiusKm` | Périmètre (km) autour de l'épicentre |

Sélection **entièrement automatisée** : abonnés au canal ∩ dans le périmètre ∩ les `quota` plus proches.

### UI Épée

`DiffuseOpportunityScreen` : champs « Nombre à diffuser » + « Périmètre (km) ».

### Lab

Action `diffuse_event` : paramètres `radiusKm` + `quota` ajoutés.

### Persistance

La politique complète est stockée en JSON dans `event_diffusions.policy` (opaque → extensible).

---

## 4–6. Boîte aux lettres personnelle

### Persistence

Nouvelle table `event_opportunity_inbox` :

| Champ | Rôle |
|-------|------|
| `user_id`, `event_id`, `diffusion_id` | Lien habitant ↔ initiative ↔ campagne |
| `distance_km` | Distance au moment de la diffusion |
| `channels` | Canaux de la campagne |
| `status` | `received` / `accepted` / `dismissed` |
| `meta` | JSON opaque (réserve rareté / Ticket d'Or) |
| `ticket_object_id` | Objet Wallet créé à l'acceptation |

### API

| Méthode | Route | Rôle |
|---------|-------|------|
| `GET` | `/api/events/inbox?sort=&status=` | Liste triable |
| `POST` | `/api/events/inbox/:id/accept` | Accepte → Wallet |
| `POST` | `/api/events/inbox/:id/dismiss` | Met de côté |

### Tris supportés

- **date** (défaut)  
- **distance**  
- **interest** / centres d'intérêt (premier canal)  
- **seats** (places restantes si billetterie)

### UI

- Popover Mode Réception : entrée **« Voir toutes les opportunités contenues dans ma boîte aux lettres »**
- Badge non-lus sur l'icône boîte aux lettres
- Écran `MailboxScreen` avec chips de tri
- Bannière temps réel → ouvre le parcours d'intérêt (plus seulement le détail)

---

## 5. Parcours complet d'acceptation

```
Affichage opportunité
        ↓
« Cette opportunité vous intéresse ? »
        ↓ Oui
Message : « Super ! Retrouvez votre ticket… dans votre Wallet. »
        ↓
Création automatique d'un objet Wallet
```

### Orchestration (`claimAcceptedOpportunity`)

Sans dupliquer la billetterie :

| Cas | Objet Wallet |
|-----|--------------|
| Initiative à réservation | `event_ticket` (même chemin que `issueTicket`, jauge respectée) |
| Initiative ouverte + `canTicket` | `event_ticket` gratuit (preuve d'accès) |
| Autre (ex. promo) | `badge` « Opportunité acceptée » |

Le Wallet devient le support des opportunités acceptées.

---

## 7–8. Compatibilité future (non développé)

### Rareté (Commun → Mythique)

- Non implémentée.
- Place prévue : `meta.rarity` sur chaque reçu d'inbox + éventuel `policy.rarity` / payload d'initiative.
- Aucune hypothèse « toutes les opportunités sont égales » n'est codée en dur dans les tris (le tri rareté pourra s'ajouter).

### Ticket d'Or

- Non implémenté.
- Place prévue : `policy.campaignKind = 'golden_ticket'` (mécanique **distincte** d'un niveau de rareté).
- La diffusion reste une **stratégie** attachée à une initiative, pas un type d'événement → compatible avec une campagne exceptionnelle « un seul ticket demain à 18h ».

---

## Choix techniques & architecture

1. **Séparation des couches** : cycle de vie (`index.js`) inchangé dans son rôle ; campagne / géo / inbox = `diffusion.js`.
2. **Réutilisation de `geo.distanceKm`** : un seul calcul Haversine pour Marketplace, dispatch et OV.
3. **Reçus par habitant** distincts des agrégats `event_diffusions` (transparence campagne vs boîte personnelle).
4. **JSON opaque** (`policy`, `meta`) pour évoluer sans migration douloureuse.
5. **Idempotence** de diffusion enrichie (clé = event + canaux + quota + rayon).
6. **Reset Lab** : `demoWorld.purgeUsers` nettoie aussi `event_opportunity_inbox`.

---

## Tests effectués

| Test | Résultat |
|------|----------|
| Recette `monde_evenementiel` : 100 % des acteurs / stores / events avec coords Paris | OK |
| Diffusion `radiusKm: 3`, `quota: 5` → sélection des plus proches (ex. 3 atteints, dist 1,66 km) | OK |
| Inbox + accept → `event_ticket` dans Wallet, status `accepted` | OK |
| Reset batch propre (inbox + events) | OK |
| Non-régression `test-sandbox-events.js` | **7 / 7** |
| Compilation Babel des écrans / contextes mobiles | OK |

---

## Points à enrichir aux prochaines itérations

1. **Ordonnanceur** pour `windowStart` / `windowEnd` (campagnes programmées, dont un futur Ticket d'Or à heure fixe).
2. **Push hors-ligne** (la boîte est persistante, mais le flash socket ne touche que les connectés).
3. **Carte** dans la boîte aux lettres / détail (visualiser le périmètre).
4. **Rareté** comme propriété d'opportunité + filtre / tri dédié.
5. **Ticket d'Or** comme `campaignKind` avec quota forcé à 1 et fenêtre temporelle.
6. **Paiement** pour les billets payants acceptés depuis la boîte.
7. **Watcher backend** (`nodemon`) pour éviter les process périmés lors des tests Lab.

---

## Fichiers principaux

### Backend

- `backend/src/lib/worldFactory/parisAddresses.js` *(nouveau)*
- `backend/src/lib/worldFactory/recipes/quartierAnime.js`
- `backend/src/lib/worldFactory/recipes/mondeEvenementiel.js`
- `backend/src/lib/worldFactory/demoWorld.js`
- `backend/src/lib/eventEngine/diffusion.js` *(refonte spatiale + inbox)*
- `backend/src/lib/eventEngine/orchestration.js` (`claimAcceptedOpportunity`)
- `backend/src/lib/eventEngine/index.js`
- `backend/src/routes/events.js`
- `backend/src/db/index.js` (`event_opportunity_inbox`)
- `backend/src/lib/lab/actions/events.js`

### Mobile

- `mobile/src/screens/merchant/DiffuseOpportunityScreen.js`
- `mobile/src/screens/deuxiemeAme/MailboxScreen.js` *(nouveau)*
- `mobile/src/screens/deuxiemeAme/OpportunityInterestScreen.js` *(nouveau)*
- `mobile/src/components/deuxiemeAme/ModeReceptionPopover.js`
- `mobile/src/components/deuxiemeAme/AmeHeader.js`
- `mobile/src/components/deuxiemeAme/OpportunityBanner.js`
- `mobile/src/context/OpportunityContext.js`
- `mobile/src/screens/deuxiemeAme/DeuxiemeAmeHomeScreen.js`
- `mobile/src/navigation/index.js`
- `mobile/src/api/index.js`

---

*Fin du compte rendu — Ma Zone · Simulateur de ville & OV spatiales · 22/07/2026*
