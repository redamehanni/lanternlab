# Plan d'architecture — Event Engine (cœur vivant de Ma Zone)

**Date :** 21 juillet 2026  
**Statut :** Plan d'architecture — **aucune implémentation exécutée**  
**Références :** Vision Deuxième Âme · Wallet Engine · Identity Engine · Épée · Laboratoire  
**Public :** Architectes Ma Zone  
**Révision :** formulations produit alignées (philosophie « produire la vie locale ») — architecture inchangée

---

## Document de référence

| Format | Fichier |
|--------|---------|
| **PDF** | `PLAN_EVENT_ENGINE.pdf` |
| HTML | `PLAN_EVENT_ENGINE.html` |
| Markdown | `PLAN_EVENT_ENGINE.md` |

---

## Décisions d'architecture validées

1. **Nature :** moteur d'**OCCURRENCES** (pas un bus technique universel qui refondrait Orders/sockets).
2. **Portée :** architecture **conceptuelle complète**, implémentation ensuite **par phases**.

---

## Vision produit (philosophie)

Ma Zone **n'est pas** un agenda de quartier, ni un catalogue de ce qui existe déjà, ni un panneau d'affichage.

La mission première : donner aux acteurs d'une ville (commerçants, associations, artistes, créateurs, citoyens, collectivités…) les moyens de **créer davantage de vie locale**.

Une grande partie des événements présents dans Ma Zone **n'existeraient jamais sans Ma Zone**.

| Ce que ce n'est pas | Ce que c'est |
|---------------------|--------------|
| Un moteur qui **observe** la ville | Un moteur qui aide la ville à **produire** davantage d'initiatives |
| Le **miroir** de la ville | Le **moteur** qui aide la ville à devenir plus vivante |
| Un agrégateur / afficheur | Un accompagnateur du **cycle de vie complet** d'une initiative |

L'Event Engine intervient **dès la création** (brouillon inclus) : un commerçant ouvre l'Épée et crée une dégustation ; une association crée une collecte ; un artiste une rencontre ; un citoyen une balade ; une mairie un événement. Ces initiatives **naissent grâce aux outils Ma Zone**.

---

## Résumé exécutif

L'Event Engine est un **organe** générique, robuste et évolutif : le **cœur vivant** de Ma Zone.

- Un **Événement** = une **initiative locale** portée par un acteur, accompagnée sur **tout son cycle de vie** (du brouillon à l'archivage). Le « fait qui a lieu » n'est qu'**une phase**, pas la définition.
- Une **Opportunité Volante** n'est **pas** un type d'événement : c'est une **stratégie de diffusion** d'un événement.
- La **Deuxième Âme** est une surface de **découverte, participation, rencontre et engagement** — et, à terme, une porte vers la **création** d'initiatives par les habitants. Elle consomme l'organe (projections) ; elle n'est **pas** un simple panneau d'affichage.
- L'Engine **orchestre** Wallet, Identity, Communication — il ne réimplémente jamais leur logique.
- On **ne refond pas** le cœur stable de la Marketplace (commandes, dispatch, sockets existants).

---

## Principe directeur

Mêmes règles que Wallet et Identity :

| Principe | Application |
|----------|-------------|
| Organe ≠ surface | Le cœur ne contient aucune UI |
| Registre Open/Closed | Nouveau type = une déclaration, sans toucher au cœur |
| Payload opaque + `display` séparé | Comme ADR-002 du Wallet |
| Journal append-only | Biographie + audit de chaque transition |
| Orchestration | Billet → Wallet ; scan → Identity ; chat → Communication |
| Provenance démo | Tag `demo_entities` (`entity_type = event`) pour reset World Factory |

---

## Vue d'ensemble

```
Sources / Producteurs  (créent les initiatives grâce à Ma Zone)
  Commerçant (Épée) · Admin / Lab · Système / Organes · Assoc / Artiste / Citoyen (futur)
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│  EVENT ENGINE (organe)                                  │
│  Accompagne le cycle de vie des initiatives locales     │
│  eventRegistry (types + canaux)                         │
│  Core: create / publish / transition / query            │
│  lifecycle + event_journal (append-only)                 │
│  diffusion (Opportunités Volantes + abonnements)        │
│  hook interne emit/subscribe                            │
└───────────────┬─────────────────────┬───────────────────┘
                │ orchestre           │ projections + actions
                ▼                     ▼
     Wallet · Identity · Comm    Deuxième Âme · Marketplace
                                 (découvrir, participer, s'engager ;
                                  à terme : créer)
                                 Notifications / Stats / IA
```

---

## 1. Modèle canonique — l'Événement (initiative / occurrence)

**Définition produit :** un Événement est une **initiative locale** créée et portée dans Ma Zone. Elle existe dès qu'elle est en **brouillon** — elle n'a pas encore « lieu », et pourtant elle est déjà une entité du moteur.

**Définition technique :** entité persistante de premier ordre, produite par une source, adressée à une audience, située (quand pertinent) dans le temps et l'espace, avec un **cycle de vie complet**.

L'Event Engine n'est pas un observateur de faits urbains : c'est le moteur qui **accompagne** ces initiatives de la création à l'archivage (y compris diffusion et participation comme dimensions du parcours).

### Table `events` (proposée)

| Groupe | Champs |
|--------|--------|
| Identité | `id`, `type` (registre), `status` (cycle de vie) |
| Source | `source_kind` (merchant, admin, driver, association, artist, citizen, system, ai), `source_id` |
| Contenu | `title`, `summary`, `body`, `media`, `display` (JSON), `payload` (JSON opaque) |
| Temps | `starts_at`, `ends_at`, `timezone`, `recurrence` (réservé) |
| Espace | `lat`, `lng`, `zone_id`, `address`, `geo_precision` (exact / approx) |
| Audience | `visibility` (public \| targeted), `capacity`, `channels` |
| Liens | `store_id`, `product_id`, `parent_event_id`, `source_ref` |
| Provenance | tag `demo_entities` |
| Horodatage | `created_at`, `updated_at` |

### Table `event_journal` (append-only)

`id`, `event_id`, `type`, `from_status`, `to_status`, `actor`, `payload`, `idempotency_key`, `created_at`  
Biographie auditable, calquée sur `digital_object_events` du Wallet.

---

## 2. Registre de types (Open/Closed)

`eventRegistry.defineEventType({...})` — même patron que `defineKind` (Wallet) et `defineRecipe` (World Factory).

Chaque type déclare :

- `id` — ex. `concert`, `degustation`, `atelier`, `ouverture`, `expo`, `collecte`, `promo`, `lanterne`, `murmure`, `visite`, `performance`
- `defaultChannels` — canaux de diffusion par défaut
- `capabilities` — `canTicket`, `canRSVP`, `isLantern`, `isMurmur`, `hasCapacity`, `isFlyable`
- `lifecycle` — statuts + transitions (fail-fast)
- `requiredPayload` — validation minimale
- `display()` — projection d'affichage (le cœur n'interprète jamais le payload)

**Ajouter un futur type = déclarer ici, sans toucher au cœur.**

---

## 3. Cycle de vie

Le moteur accompagne l'initiative **sur tout son parcours**. Lecture produit du parcours :

```
brouillon → planification → publication → (diffusion) → (participation)
  → déroulement → clôture → archivage
```

- **Diffusion** et **participation** sont des **dimensions du parcours** (couche diffusion, plus tard `event_participations`) — pas forcément de nouveaux `status` techniques.
- Les **statuts techniques** restent génériques et inchangés :

```
draft → scheduled → published → live → ended → archived
  └─────────────── cancelled (depuis draft / scheduled / published / live)
```

Correspondance indicative : brouillon↔`draft`, planification↔`scheduled`, publication↔`published`, déroulement↔`live`, clôture↔`ended`, archivage↔`archived`.

Exemple Lanterne (spécialisation) : `hidden → active → discovered → retired`  
(`discovered` = scan Identity → récompense Wallet).  
Chaque transition écrit au journal.

---

## 4. Couche de diffusion (Mode Réception + Opportunités Volantes)

Distinction fondamentale :

> Une Opportunité Volante **n'est pas** un type d'événement.  
> C'est une **stratégie de diffusion** d'un événement.

La diffusion ne « montre pas la ville » : elle **porte les initiatives créées dans Ma Zone** vers les habitants au bon moment, selon leurs canaux et leur proximité.

| Concept | Rôle |
|---------|------|
| **Canaux** | Catégories du Mode Réception (culture, gastronomie, solidarité, associations, artistes, créateurs, artisans, commerces, sport, famille, nature, patrimoine, vie de quartier, lanternes, opportunités rares…). Déclarés dans le registre. Ce sont des **canaux de diffusion**, pas de simples filtres UI. |
| **Abonnements** (`event_subscriptions`) | Chaque habitant construit son Mode Réception (canaux + rayon géo + préférences). Pas un simple ON/OFF. |
| **Diffusion passive** | L'initiative est *découvrable* via les portes (requêtes filtrées type / canal / géo / passions) — première marche vers la participation. |
| **Diffusion active = Opportunité Volante** | Politique attachée à un événement (canaux + fenêtre temporelle + proximité + push). Côté Épée : « Créer une Campagne d'Opportunité Volante ». Table `event_diffusions` + idempotence d'envoi. |

---

## 5. Sources / producteurs

**Intention produit :** la majorité des événements du système **naissent dans Ma Zone**. Les acteurs ne se contentent pas de déclarer ce qui existe déjà : ils **créent** grâce aux outils (Épée, futurs espaces association / artiste / citoyen, Lab).

Contrat technique : tout acteur authentifié avec l'entitlement adéquat peut créer les types autorisés. Matrice **rôle × type** extensible :

| Source | Exemples |
|--------|----------|
| Commerçant (Épée) | Ouvertures, dégustations, promos, campagnes Opportunité Volante |
| Admin / Lab | Tout type, Lanternes (curation humaine), Murmures |
| Système / organes | Projections (« nouvelle boutique », « promo ») — secondaires par rapport à la création humaine |
| Futur | Association, artiste, citoyen — même contrat |

---

## 6. Surfaces (découverte, participation, engagement)

Le cœur expose des **requêtes / projections** et des **actions** (participer, s'inscrire, scanner, etc.). Les surfaces **consomment** l'organe ; elles ne le réimplémentent pas.

| Surface | Rôle |
|---------|------|
| **Deuxième Âme** | Porte d'entrée vers la vie locale : découvrir, participer, rencontrer, s'engager — et à terme **créer**. Les 6 portes sont des vues filtrées **et** des chemins vers l'action, pas un catalogue passif. |
| **Murmures** | Projection curatée et poétique qui donne envie d'agir |
| **Mode Réception** | Boîte alimentée par la diffusion active des initiatives |
| **Marketplace** | Page commerce : les initiatives du commerçant, créées notamment via l'Épée |

---

## 7. Orchestration des organes existants

| Organe | Rôle |
|--------|------|
| **Wallet** | Billetterie / récompenses via `issueObject` ; souvenir keepsake |
| **Identity** | Découverte Lanterne = scan vérifié |
| **Communication** | Fil organisateur ↔ participants |
| **Promotions** | Projection éventuelle en événement `promo` (sans déplacer la logique promo) |
| **Épée** | Module `events` (aujourd'hui « Bientôt ») → **Créer** un événement + Campagne OV — outil de production de vie locale |
| **World Factory / Lab** | Seed d'événements + action labo « publier / diffuser » |

---

## 8. Hook interne (notifications / stats / IA)

`emit(domainEvent)` / `subscribe(channel, handler)` — abonnés en **lecture seule**.  
**Sans** réécrire les flux socket existants (commandes, missions).

---

## 9. Temps réel (sockets)

Nouveaux événements : `event:published`, `event:live`, `event:opportunity`, `event:updated`, `event:cancelled`.  
Rooms par canal / zone / utilisateur. Réutilise Socket.io déjà en place.

---

## 10. Arborescence proposée

```
backend/src/lib/eventEngine/
├── index.js              # API publique
├── eventRegistry.js      # defineEventType, canaux
├── lifecycle.js          # transitions par type
├── diffusion.js          # Opportunités Volantes + matching
├── bus.js                # hook interne
└── types/                # un fichier par type (auto-déclaration)

backend/src/routes/events.js
backend/src/db/index.js   # tables events, event_journal,
                          # event_subscriptions, event_diffusions,
                          # (plus tard) event_participations
```

---

## 11. Roadmap incrémentale (après validation)

Chaque phase livrable et testable en headless :

| Phase | Contenu |
|-------|---------|
| **1 · Cœur** | Tables + registre + lifecycle + API create/publish/query + 2–3 types |
| **2 · Épée** | Activer module events + écran « Créer un événement » |
| **3 · Diffusion** | Canaux + abonnements Mode Réception + Opportunités Volantes |
| **4 · Orchestration** | Billetterie/récompenses Wallet ; Lanternes Identity + Wallet |
| **5 · Hook** | Abonnés notifications / stats |
| **6 · Bac à Sable** | Recette World Factory + action labo publier/diffuser |
| **7 · Deuxième Âme** | 6 portes + Murmures (chapitre suivant, hors cœur strict) |

---

## 12. Principes tenus / anti-objectifs

**Tenus :** surface vs organe · Open/Closed · journal append-only · payload opaque · idempotence de diffusion · provenance démo · sandbox Lab · cycle de vie dès le brouillon · production d'initiatives (pas observation passive).

**Anti-objectifs :**
- ne pas faire de l'Event Engine un second moteur métier ;
- ne pas refondre le flux commandes / sockets stable ;
- ne pas confondre **type d'événement** et **stratégie de diffusion** ;
- **ne pas** construire un agenda de quartier, un catalogue, ni un agrégateur de ce qui existe déjà ;
- **ne pas** réduire la Deuxième Âme à un panneau d'affichage.

---

## Phrase à retenir

> Nous ne construisons pas le miroir de la ville.  
> Nous construisons le moteur qui aide la ville à devenir plus vivante.  
>
> La Première Âme permet d'acheter local.  
> La Deuxième Âme donne envie de vivre local — et d'y participer.  
> L'Event Engine accompagne chaque initiative, du brouillon à l'archivage.

---

*Fin du plan — architecture uniquement, aucun code. Formulations produit révisées ; structure technique inchangée.*
