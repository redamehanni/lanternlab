# Compte rendu — Event Engine (implémentation complète)

**Date :** 21 juillet 2026  
**Statut :** Plan d'architecture validé et **exécuté** (phases 1 → 7)  
**Référence architecture :** `PLAN_EVENT_ENGINE.pdf`  
**Public :** Architectes Ma Zone

---

## Document de référence

| Format | Fichier |
|--------|---------|
| **PDF** | `COMPTE_RENDU_EVENT_ENGINE.pdf` |
| HTML | `COMPTE_RENDU_EVENT_ENGINE.html` |
| Markdown | `COMPTE_RENDU_EVENT_ENGINE.md` |

---

## Philosophie tenue

L'Event Engine est un **organe dédié aux initiatives locales et à leur cycle de vie** (du brouillon à l'archivage).

Il n'est :

- ni un Event Bus technique universel ;
- ni un fourre-tout pour les événements internes de l'application ;
- ni un agenda / catalogue / miroir de la ville.

Il **orchestre** Wallet et Identity lorsqu'une initiative le nécessite ; il n'absorbe jamais leurs responsabilités.

Une **Opportunité Volante** est traitée comme une **stratégie de diffusion**, jamais comme un type d'événement.

> Nous ne construisons pas le miroir de la ville.  
> Nous construisons le moteur qui aide la ville à devenir plus vivante.

---

## Ce qui a été implémenté

### Backend — `backend/src/lib/eventEngine/`

| Fichier / dossier | Rôle |
|-------------------|------|
| `lifecycle.js` | Graphe de statuts canonique (`draft → scheduled → published → live → ended → archived`, `cancelled`) + `canTransition` fail-fast, spécialisable par type |
| `eventRegistry.js` | Registre Open/Closed (`registerType`), canaux du Mode Réception, capacités connues, sources ouvertes (merchant, admin, association, artist, citizen, ai…) |
| `types/` | `atelier` (générique), `degustation` (billetterie), `promo` (projection), `lanterne` (cycle spécialisé). Auto-déclarés |
| `index.js` | API publique : create / update / transition / publish / cancel / queries + journal append-only + émissions socket |
| `diffusion.js` | Mode Réception (`event_subscriptions`) + Opportunités Volantes (`event_diffusions`) avec idempotence et garde `isFlyable` |
| `orchestration.js` | Billet → `wallet.issueObject` (jauge) ; Lanterne → récompense Wallet + transition (idempotent par citoyen) |
| `bus.js` + `subscribers/insights.js` | Hook interne emit/subscribe ; abonné stats/activité en lecture seule ; isolation défensive |

### Base de données — `backend/src/db/index.js`

Tables ajoutées :

- `events`
- `event_journal`
- `event_subscriptions`
- `event_diffusions`

### Routes — `backend/src/routes/events.js`

- Production (commerçant / Épée)
- Mode Réception (habitant)
- Opportunité Volante
- Billet / découverte Lanterne (habitant)
- Découverte / Murmures (préparation Deuxième Âme)
- Insights (hook interne)

### Bac à Sable

| Zone | Contenu |
|------|---------|
| `worldFactory/context.js` | Primitives `createEventInitiative` / `setModeReception` (via l'organe), provenance `event` |
| `recipes/quartierAnime.js` | Seed d'initiatives + Mode Réception des habitants |
| `lab/actions/events.js` | Actions `create_event` / `publish_event` / `diffuse_event` (toujours via l'organe) |
| Reset | Étendu aux initiatives, diffusions, abonnements (purge par appartenance) |

### Mobile — Épée

- Module `events` activé dans `moduleRegistry`
- Écrans **Mes initiatives** + **Créer une initiative**
- Branchés dans `EpeeStack`
- Fonctions API : production, diffusion, découverte, billet, lanterne

---

## Roadmap exécutée

| Phase | Contenu | Statut |
|-------|---------|--------|
| **1 · Cœur** | Tables + registre + lifecycle + API create/publish/query + types de base | Fait |
| **2 · Épée** | Module events activé + écrans création / liste | Fait |
| **3 · Diffusion** | Canaux + Mode Réception + Opportunités Volantes | Fait |
| **4 · Orchestration** | Billetterie / récompenses Wallet ; Lanternes | Fait |
| **5 · Hook** | Bus interne + abonné insights | Fait |
| **6 · Bac à Sable** | Recette World Factory + actions labo + reset propre | Fait |
| **7 · Consommation** | Projections `listDiscoverable` / `listMurmurs` (préparation Deuxième Âme) | Fait |

---

## Choix techniques importants

1. **Registre + payload opaque + `display` séparé + journal append-only** — calque exact de Wallet / Identity pour cohérence et zéro logique métier dans le cœur.
2. **Cycle de vie spécialisable par type** — la Lanterne (`hidden → active → discovered → retired`) prouve l'extensibilité sans toucher au cœur.
3. **Diffusion et orchestration découplées** — `diffusion.js` et `orchestration.js` reçoivent l'initiative projetée ; pas de cycle d'import avec le cœur.
4. **Idempotence** partout où un rejeu est possible (diffusion, découverte, journal).
5. **Filtre canal / capacité en mémoire** (canaux stockés en JSON) — simple et générique pour le volume actuel.
6. **Sources déjà ouvertes** — association, artiste, citoyen, IA déclarés dans le registre sans attendre une refonte.

---

## Adaptations mineures (justifiées)

### Identité du scanneur de Lanterne

Fournie par la couche d'authentification (le citoyen est déjà identifié par son token), plutôt que par un aller-retour Identity `issuePresentation` / `verifyPresentation` — qui modéliserait l'inverse (une personne se présentant à un vérificateur).

La frontière du plan reste respectée : Event **orchestre**, Wallet **récompense**. L'intégration Identity « scan signé hors-ligne » reste un raffinement futur sans refonte.

### Insights en mémoire

Compteurs + fil d'activité récent pour démontrer le hook sans inventer de table stats. À persister quand le besoin analytique sera réel.

---

## Tests effectués

Suite headless : **75 assertions**, toutes vertes.

| Script | Assertions | Couverture |
|--------|------------|------------|
| `test-event-engine` | 22 | Registre, validation fail-fast, cycle de vie générique + Lanterne, journal, bus |
| `test-events-http` | 14 | Routes HTTP production, découverte, garde d'appartenance |
| `test-diffusion` | 10 | Mode Réception, Opportunité Volante, idempotence, garde `isFlyable` |
| `test-orchestration` | 11 | Billetterie + jauge, récompense Lanterne, anti-double |
| `test-bus` | 3 | Insights + isolation défensive (abonné qui plante) |
| `test-sandbox-events` | 7 | Seed, actions labo, reset propre |
| `test-discovery` | 8 | Projections découverte / Murmures / filtres |

Smoke test serveur : démarrage complet, `/health` OK.

---

## Points d'attention pour la suite

| Sujet | Note |
|-------|------|
| `event_participations` | Table réservée ; à créer quand la participation déclarative (RSVP) arrivera |
| Filtrage géographique | Aujourd'hui borné sur `zoneId` ; rayon / haversine à enrichir |
| Persistance insights | Compteurs en mémoire → table / API admin quand le besoin analytique sera réel |
| Récurrence | Champ `recurrence` réservé, non implémenté |
| Endpoint `/insights` | Ouvert à tout authentifié ; restreindre (admin) avant production |
| Index / volume | Indexer davantage si le flux d'initiatives grossit |

---

## Recommandations avant la Deuxième Âme

1. Construire les **6 portes** comme **vues composées** sur `listDiscoverable` / `listMurmurs` (déjà prêtes) — la surface compose, l'organe ne connaît pas les portes.
2. Câbler l'écran **Mode Réception** habitant sur `GET` / `PUT /api/events/reception`.
3. Faire écouter au client le socket **`event:opportunity`** (rooms `user_*` déjà en place) pour la diffusion active.
4. Ajouter l'onglet **Opportunité Volante** dans l'Épée (API `diffuseEvent` prête) et le parcours **billet / lanterne** côté client (`requestEventTicket`, `discoverLantern`).
5. Garder la règle : tout nouveau producteur (association, artiste, citoyen, IA) = **un type déclaré + un mapping de source**, sans toucher au cœur.

---

## Verdict

Rien dans le développement n'a remis en cause l'architecture validée. Aucune décision majeure n'a nécessité d'arrêt.

L'organe est en place, testé, extensible, et prêt à accompagner Ma Zone — et en particulier la construction de la Deuxième Âme.

---

*Fin du compte rendu.*
