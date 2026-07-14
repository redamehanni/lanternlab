# Analyse architecturale — L'objet numérique vivant dans le Wallet Engine

**Date :** 14 juillet 2026  
**Statut :** Compte rendu d'architecte — à valider — aucune implémentation  
**Référence :** [PLAN_ETUDE_WALLET_ENGINE.md](PLAN_ETUDE_WALLET_ENGINE.md) (Architecture B)

---

## Résumé exécutif

Depuis le plan d'architecture Wallet Engine, la philosophie du Wallet a évolué : il ne s'agit plus seulement de stocker des droits, mais d'héberger des **objets numériques vivants** — capables d'évoluer, d'être enrichis, de survivre à leur consommation, et de proposer des actions contextuelles (« Que puis-je faire avec toi ? »).

**Verdict d'architecte : cette évolution ne casse pas l'architecture B.** Elle la valide et la renforce. Elle révèle toutefois une imprécision conceptuelle à corriger : la confusion entre le **Droit** (entitlement porteur de valeur) et l'**Objet** (contenant vivant, face citoyen).

**Recommandation :** faire évoluer l'architecture B vers **B+** — même noyau transactionnel, avec trois extensions additifs pilotées par le registre de types, sans compromettre la robustesse.

---

## 1. Ce qui ne change pas

L'architecture B proposée dans le plan d'étude reste le socle :

| Élément | Rôle | Statut |
|---------|------|--------|
| Registre de types (`RightKind`) | Déclarer les kinds sans toucher au noyau | Conservé |
| Machine à états | Gouverner les transitions d'entitlement | Conservé, étendu |
| Journal append-only (ledger) | Auditabilité, traçabilité, anti double-dépense | Conservé — devient la biographie de l'objet |
| Projection d'état courant | Lectures rapides | Conservé |
| Payload opaque | Le noyau n'interprète jamais le métier | Conservé |
| API publique + événements | Séparation des organes | Conservé |
| Principes non négociables | Simplicité du noyau, responsabilités claires | Conservés |

La philosophie « objet vivant » ne remet pas en cause ces fondations. Elle demande de les **compléter**, pas de les remplacer.

---

## 2. L'insight central : séparer le Droit de l'Objet

### Le problème conceptuel

Jusqu'ici, le plan parlait de `DigitalRight` comme objet central. Cette formulation est correcte pour la couche transactionnelle, mais incomplète pour l'expérience utilisateur.

Un billet consommé n'est pas « mort » dans la vision Ma Zone. Le **droit d'entrée** est épuisé ; l'**objet billet** continue d'exister comme souvenir.

### La distinction

| Concept | Nature | Cycle de vie | Responsable |
|---------|--------|--------------|-------------|
| **Droit (entitlement)** | Créance porteuse de valeur | Transactionnel, terminal (`pending → active → consumed/expired/revoked`) | Wallet — couche dure |
| **Objet numérique (`DigitalObject`)** | Contenant vivant, face citoyen | Permanent, évolutif, enrichissable | Wallet (contenant) + organes émetteurs (contenu) — couche souple |

### Règle d'or

> La présentation et les capacités sont **molles**. L'entitlement et la valeur sont **durs**. Le seul vrai danger est de laisser la couche molle contaminer la couche dure.

### Schéma en couches

```
┌─────────────────────────────────────────────────────────┐
│  COUCHE SOUPLE (évolutive, face citoyen)                │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │ Capacités   │  │ Références   │  │ Facette        │ │
│  │ déclaratives│  │ vers organes │  │ souvenir       │ │
│  │ (menu)      │  │ (contenu live)│  │ (post-consomm.)│ │
│  └─────────────┘  └──────────────┘  └────────────────┘ │
├─────────────────────────────────────────────────────────┤
│  COUCHE DURE (gouvernée, transactionnelle)              │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │ Entitlement │→ │ Machine à    │→ │ Ledger         │ │
│  │ (droit)     │  │ états        │  │ append-only    │ │
│  └─────────────┘  └──────────────┘  └────────────────┘ │
└─────────────────────────────────────────────────────────┘
         DigitalObject = contenant des deux couches
```

---

## 3. Les trois extensions additifs (architecture B+)

Toutes sont **pilotées par le registre de types**. Aucune ne modifie le cœur transactionnel.

### 3.1 Capacités déclaratives — « Que puis-je faire avec toi ? »

Chaque objet possède un bouton **« Gérer cet objet numérique »** dont les actions dépendent de son `kind` et de son état courant.

**Mécanisme :** le registre déclare, par kind et par état, une liste de **descripteurs d'action** :

```
{
  id: "offer",
  label: "Offrir",
  icon: "gift",
  availableInStates: ["active"],
  handledBy: "wallet",           // ou "event_engine", "orders", etc.
  invocation: "wallet.transfer", // commande ou deep-link
  guard: "transferable === true" // condition déclarative
}
```

**Rôle du Wallet :** exposer le menu des capacités disponibles pour un objet donné.  
**Rôle du Wallet :** **ne jamais exécuter** une action métier qu'il ne possède pas.

| Action exemple | Exposée par | Exécutée par |
|----------------|-------------|--------------|
| Offrir un billet | Wallet | Wallet (`transfer`) |
| Ajouter au calendrier | Wallet (descripteur) | Event Engine |
| Créer une procuration | Wallet (descripteur) | Orders / Dispatch |
| Voir le commerce | Wallet (descripteur) | Commerce Engine (futur) |
| Personnaliser carte cadeau | Wallet (descripteur) | Marketing Engine |

**Danger signalé :** si le cœur Wallet commence à implémenter les actions par type (« pour un billet, faire X »), il redevient un fourre-tout monolithique. Règle dure : le cœur sait *qu'*une action existe et *qui* la traite, jamais *comment* (sauf pour les capacités cœur : transfer, revoke).

---

### 3.2 Mémoire et présentation post-consommation

**Vision :** un billet utilisé ne disparaît pas. Il devient un **souvenir numérique** : date, lieu, organisateur, photos, édition, historique.

**Mécanisme :** extension de la machine à états — `consumed` devient **non destructif**.

```
active → consumed → [facette souvenir activée]
```

- L'objet reste dans le Wallet du citoyen.
- La facette « droit actif » se ferme (entitlement épuisé).
- La facette « souvenir » s'ouvre (métadonnées de présentation, propriété de l'émetteur).
- Le ledger append-only **est** la biographie de l'objet : chaque transition inscrite = un chapitre de son histoire.

**Harmonie remarquable :** le ledger, conçu pour l'audit et la sécurité, devient naturellement le support de la mémoire vivante. Aucune contradiction.

---

### 3.3 Évolution en direct — le Wallet comme espace vivant

**Vision :** un commerçant ajoute une animation à son événement → le billet évolue. Une promotion change → l'objet est mis à jour. Le Wallet n'est pas une archive figée.

**Deux mécanismes gouvernés :**

#### A. Résolution par référence (défaut recommandé)

L'objet stocke `sourceEngine + sourceRef`. Le contenu riche et volatil (photos, promo actuelle, édition de l'événement) est **résolu à la lecture** auprès de l'organe propriétaire.

- Le Wallet reste léger.
- Jamais périmé (la source est la vérité).
- Le « vivant » est réel car la source est vivante.

#### B. Événements d'enrichissement (si persistance ou notification requise)

L'organe propriétaire appelle une commande gouvernée :

```
enrichObject({ objectId, enrichmentPayload, sourceEngine, idempotencyKey })
```

→ entrée append-only dans le ledger  
→ projection mise à jour  
→ événement `wallet:object_enriched` émis

**Danger signalé :** laisser les organes muter directement les payloads du Wallet détruirait l'invariant du payload opaque, la garantie append-only, et créerait un couplage N-vers-Wallet. L'enrichissement passe **toujours** par l'API publique et est journalisé — ou se fait par référence. Jamais via une table mutable partagée.

---

## 4. Exemples revisités sous l'architecture B+

### Billet d'événement

| Phase | Facette droit | Facette objet | Capacités disponibles |
|-------|---------------|---------------|----------------------|
| Avant l'événement | `active` | Présentation live (résolue via Event Engine) | Offrir, partager, calendrier, voir lieu |
| Scan QR à l'entrée | `consumed` | Transition journalisée | — |
| Après l'événement | `consumed` | Souvenir (date, lieu, photos, édition) | Partager le souvenir, revoir l'historique |

L'objet ne meurt jamais. Le droit se ferme. Le souvenir s'ouvre.

### Ticket Click & Collect

| Phase | Capacités |
|-------|-----------|
| Avant retrait | Créer procuration, changer personne autorisée, voir commerce, itinéraire, contacter commerçant |
| Après retrait | Souvenir d'achat (historique transaction, commerce, date) |

### Carte de fidélité

Objet **sans consommation terminale**. L'objet vit en permanence. Les récompenses discrètes sont des **droits** émis sur l'objet puis consommés un par un. Le commerçant enrichit l'objet (nouveaux bonus) via `enrichObject` ou résolution live.

### Badge

Les niveaux sont des **événements d'enrichissement** (`badge:leveled_up`). La progression est dans le ledger. Les capacités évoluent avec l'état (`voir progression`, `comprendre comment évoluer`, `partager`).

---

## 5. Machine à états révisée

```
                    ┌──────────┐
                    │ pending  │
                    └────┬─────┘
                         │ issue
                         ▼
                    ┌──────────┐
              ┌─────│  active  │─────┐
              │     └────┬─────┘     │
         reserve│          │consume  │revoke
              │     ┌────▼─────┐     │
              │     │ reserved │     │
              │     └────┬─────┘     │
              │   release│consume    │
              │          ▼           ▼
              │     ┌──────────┐  ┌─────────┐
              │     │ consumed │  │ revoked │
              │     └────┬─────┘  └─────────┘
              │          │ facette souvenir
              │          ▼
              │     ┌──────────┐
              │     │  memory  │  (présentation, pas un nouvel entitlement)
              │     └──────────┘
              │
         expire▼
         ┌──────────┐
         │ expired  │  (peut aussi activer facette souvenir selon kind)
         └──────────┘
```

**Point clé :** `memory` n'est pas un état d'entitlement. C'est un **mode de présentation** de l'objet après clôture du droit. L'entitlement reste `consumed` ou `expired` dans le ledger.

---

## 6. Communication inter-organes (inchangée dans l'esprit)

```
┌──────────────┐     issue/consume/enrich     ┌─────────────────┐
│  Marketing   │ ───────────────────────────▶ │  Wallet Engine  │
│  Engine      │                              │  (B+)           │
└──────────────┘                              └────────┬────────┘
┌──────────────┐     issue/consume              │        │
│  Event       │ ───────────────────────────────┘        │
│  Engine      │                                        │ wallet:object_*
└──────────────┘                                        ▼
┌──────────────┐                              ┌─────────────────┐
│  Dispatch    │ ─ issue (ticket retrait) ──▶ │  Autres organes │
│  / Orders    │                              │  réagissent     │
└──────────────┘                              └─────────────────┘

Lecture live : Wallet ──resolve──▶ Event Engine (contenu riche à la volée)
```

- **Écritures :** commandes synchrones via API publique (inchangé).
- **Notifications :** événements de domaine (`wallet:object_issued`, `wallet:object_consumed`, `wallet:object_enriched`).
- **Contenu live :** résolution par référence à la lecture (nouveau, défaut).
- **Jamais** d'accès direct à la base du Wallet.

---

## 7. Dangers architecturaux identifiés

| Danger | Conséquence | Mitigation |
|--------|-------------|------------|
| Actions métier dans le cœur Wallet | Fourre-tout, violation SRP | Descripteurs déclaratifs ; exécution déléguée |
| Mutation directe des payloads par les organes | Perte invariants, couplage | API `enrichObject` journalisée ou résolution par référence |
| Confondre état d'entitlement et mode de présentation | Réouverture de droits consommés | Séparer facette droit / facette souvenir |
| Objets « vivants » = table mutable sans ledger | Perte d'auditabilité | Tout enrichissement append-only |
| Menu d'actions codé en dur côté mobile | Non extensible | Capacités servies par le registre + API |
| Contenu live sans fallback | Objet vide si organe source down | Cache projection + graceful degradation |

---

## 8. Impact sur les principes non négociables

| Principe | Impact |
|----------|--------|
| Wallet stocke et gouverne des droits | **Clarifié** : gouverne les entitlements ; héberge les objets |
| Générique, piloté par registre | **Renforcé** : capacités et facettes déclarées par kind |
| Journal append-only | **Renforcé** : devient la biographie de l'objet |
| Payloads opaques au noyau | **Conservé** : enrichissement = nouveau payload versionné, opaque |
| API publique uniquement | **Conservé** |
| Consommation idempotente et atomique | **Conservé** |
| Centré propriétaire, Zone-aware | **Conservé** |
| Ne pas toucher Dispatch / Communication | **Conservé** |

Aucun principe n'est affaibli. Deux sont clarifiés, deux sont renforcés.

---

## 9. Positionnement vs Event Sourcing (approche C)

La philosophie « objet vivant dont l'histoire compte » pousse naturellement vers l'event sourcing : **les événements sont l'objet**.

Recommandation : **ne pas basculer en C/CQRS complet maintenant** (surdimensionné pour SQLite/MVP), mais faire un choix compatible-futur :

- Traiter le **ledger comme le flux d'événements typés** de l'objet (`Issued`, `Enriched`, `Consumed`, `Transferred`, `LeveledUp`…).
- **Dériver** la projection (facette courante + capacités disponibles) depuis ce flux.
- C'est « B, orienté événements » — le précurseur exact de C, sans réécriture ultérieure.

---

## 10. Renommage conceptuel recommandé

| Avant (plan B) | Après (B+) | Raison |
|----------------|------------|--------|
| `DigitalRight` (objet central) | `DigitalObject` | L'objet est le contenant vivant |
| — | `Entitlement` (aspect de l'objet) | Le droit est un facet gouverné |
| `right_events` | `object_events` | Le ledger raconte l'objet, pas seulement le droit |
| `RightKind` | `ObjectKind` | Le registre décrit des types d'objets |

Ce renommage empêche les futurs développeurs de traiter les objets comme des reçus jetables après consommation.

---

## 11. Interfaces publiques enrichies (conceptuelles)

```
// Commandes existantes (inchangées dans l'esprit)
issueObject({ ownerId, kind, payload, zoneId?, expiresAt?, sourceEngine, sourceRef })
consumeObject({ objectId, consumerEngine, idempotencyKey })
revokeObject({ objectId, reason, actorEngine })
transferObject({ objectId, newOwnerId, idempotencyKey })   // si kind.transferable

// Nouvelles commandes B+
enrichObject({ objectId, enrichmentPayload, sourceEngine, idempotencyKey })
activateMemoryFacet({ objectId })   // post-consommation, si kind.memoryEnabled

// Queries enrichies
getObjectsByOwner(ownerId, filters?)
getObjectById(objectId)
getCapabilities(objectId) → [{ id, label, icon, handledBy, invocation }]
resolveLiveContent(objectId) → contenu riche depuis organe source (cache optionnel)

// Événements
wallet:object_issued
wallet:object_consumed
wallet:object_enriched
wallet:object_transferred
wallet:memory_activated
```

---

## 12. Recommandation finale

### Verdict

**L'architecture B n'est pas remise en cause.** La philosophie « objet numérique vivant » est une **évolution naturelle et compatible** qui corrige une imprécision (droit vs objet) et exploite des forces déjà présentes (ledger, registre, machine à états).

### Architecture retenue : B+

```
B (existant)
  + Séparation Droit / Objet (couche dure / couche souple)
  + Capacités déclaratives dans le registre (menu « Gérer »)
  + Cycle de vie non destructif avec facette souvenir
  + Enrichissement : résolution par référence (défaut) + événements gouvernés
  + Ledger reformulé comme flux d'événements / biographie de l'objet
  + Renommage conceptuel DigitalRight → DigitalObject
```

### Ce qui reste rigide

- Transactions d'entitlement (issue, consume, revoke, transfer)
- Atomicité, idempotence, anti double-dépense
- Journal append-only
- Accès uniquement via API publique

### Ce qui devient souple

- Présentation et contenu riche (résolution live)
- Menu d'actions (descripteurs déclaratifs)
- Facette souvenir post-consommation
- Enrichissement par les organes émetteurs

### Prochaine étape

Sur validation de cette analyse, intégrer B+ dans l'étude complète `ETUDE_ARCHITECTURE_WALLET_ENGINE.md` avant tout chapitre d'implémentation.

---

*Document généré le 14 juillet 2026 — Analyse architecturale, design uniquement, aucune implémentation.*
