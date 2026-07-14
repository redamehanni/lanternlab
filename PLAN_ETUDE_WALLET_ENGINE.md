# Plan d'étude — Wallet Engine (Phase II)

**Date :** 14 juillet 2026  
**Statut :** Proposition à valider — aucune implémentation  
**Version Ma Zone de référence :** v0.8.9 (Bouclier stable)

---

## Objet de ce document

Ce document présente le **plan de l'étude de conception** du Wallet Engine, premier organe transversal de Ma Zone (Phase II). Il ne constitue pas l'étude complète : c'est la proposition de cadrage, d'architecture recommandée et de livrables que vous devez valider avant la rédaction du rapport définitif.

**Aucun code. Aucune implémentation. Réflexion architecturale uniquement.**

---

## Positionnement conceptuel (référentiel Constitution)

| Principe | Implication pour le Wallet |
|----------|---------------------------|
| Le Wallet **stocke** ; le QR Identity **identifie** | Organe distinct du QR — pas de scan, pas d'identité physique |
| Organe **transversal** | Consommé par de nombreux moteurs, dépendant d'aucun |
| **Générique** | Accueillir des usages non encore imaginés sans refonte |
| **Zone-aware, jamais Zone-bound** | La Zone est une entité abstraite configurable (quartier, ville, festival…) |
| **Un organe = une responsabilité** | Registre des droits numériques du citoyen, pas un fourre-tout |

Le Wallet n'est pas un portefeuille. C'est le **registre personnel des droits numériques** du citoyen : billets, réservations, promotions, fidélité, badges, accès, retraits Click & Collect, points civiques (forme technique ouverte), etc.

---

## Mission de l'étude complète (après validation)

Répondre aux **15 questions** posées :

1. Responsabilité exacte du Wallet Engine  
2. Responsabilités explicitement refusées (anti-fourre-tout)  
3. Architecture idéale  
4. Services internes de l'organe  
5. Objets métier manipulés  
6. États possibles d'un droit numérique  
7. Communication des autres organes avec le Wallet  
8. Enregistrement seul vs consommation — raisonnement  
9. Risques d'architecture identifiés dès aujourd'hui  
10. Concevoir pour des usages inconnus dans plusieurs années  
11. Architecture « grande entreprise » très évolutive  
12. Principes SOLID, DDD et bonnes pratiques  
13. Éléments réutilisables de l'architecture Ma Zone actuelle  
14. Nouveaux composants à prévoir  
15. Pièges classiques des systèmes de droits numériques  

Plus : comparaison d'approches, schémas, interfaces publiques conceptuelles, interactions avec les moteurs existants et futurs, vision 5 ans / 20 moteurs.

---

## Comparaison des trois approches architecturales

### Approche A — CRUD simple

**Description :** Table `wallet_items` avec `owner_id`, `kind`, `status`, `payload` JSON, dates.

| Avantages | Inconvénients |
|-----------|---------------|
| Simple, rapide à prototyper | Faible auditabilité |
| Peu de tables | Pas d'historique des transitions |
| Familier pour l'équipe | Risqué pour droits à valeur (double-dépense) |
| | Difficile à faire évoluer sans migration lourde |
| | Chaque nouveau type peut polluer le noyau |

**Verdict :** Rejetée comme architecture cible. Acceptable uniquement comme spike temporaire.

---

### Approche B — Droit générique + registre + machine à états + ledger (RECOMMANDÉE)

**Description :**

- Objet central **`DigitalRight`** : générique, `kind` + `payload` opaque
- **Registre de types** (`RightKind`) : métadonnées par kind (transitions autorisées, consommable oui/non, expiration…)
- **Machine à états** : transitions validées par le noyau
- **Journal append-only** (`right_events` / ledger) : chaque transition inscrite, immuable
- **Projection d'état courant** : table/ligne dénormalisée pour lectures rapides

| Avantages | Inconvénients |
|-----------|---------------|
| Auditable, traçable | Plus de tables qu'en CRUD simple |
| Extensible (Open/Closed) | Courbe d'apprentissage modérée |
| Sûr pour consommation (atomicité, idempotence) | Nécessite discipline sur le registre de kinds |
| Compatible SQLite actuel | |
| Précurseur naturel vers event sourcing | |
| Aligné DDD (contexte borné) | |

**Verdict :** Architecture recommandée pour Ma Zone MVP → scale.

---

### Approche C — Event Sourcing complet + CQRS

**Description :** État = replay d'événements ; lectures via projections séparées ; bus d'événements central.

| Avantages | Inconvénients |
|-----------|---------------|
| Flexibilité et audit maximaux | Surdimensionné pour MVP actuel |
| Reconstruction d'état à tout instant | Complexité opérationnelle élevée |
| Idéal à très grande échelle | SQLite moins adapté qu'à PostgreSQL/event store |
| | Coût de développement et maintenance |

**Verdict :** Cible d'évolution long terme. L'approche B en est un précurseur compatible sans refonte du noyau.

---

## Architecture recommandée (à valider)

```
Architecture retenue :
  DigitalRight (objet générique)
  + RightKind Registry (registre de types)
  + State Machine (transitions)
  + Ledger append-only (journal immuable)
  + Projection (état courant pour lecture)
```

### Décisions structurantes

**1. Stocker ET gouverner la consommation**

Consommer un droit = transition d'état (`active → consumed`). Le Wallet garantit l'intégrité (usage unique, idempotence, atomicité) **sans connaître le sens métier** du droit. Ce que le droit « octroie » appartient au moteur émetteur (Marketing, Event, Orders…).

**2. Payload opaque + versionné**

Les champs spécifiques à un type (ex. `seat_number` pour un billet) restent dans `payload`. Le noyau Wallet ne les interprète jamais.

**3. Communication inter-organes**

- **Commandes synchrones** (API) : `issue`, `consume`, `revoke`, `reserve`, `release`
- **Événements de domaine** : `wallet:right_issued`, `wallet:right_consumed`… (prépare l'Event Engine futur)
- **Jamais** d'accès direct à la base du Wallet par un autre organe

**4. Cycle de vie d'un droit**

```
pending → active → (reserved/held) → consumed
                  ↘ expired
                  ↘ revoked
```

Transférabilité : option encadrée, non par défaut.

---

## Schéma — place du Wallet dans l'écosystème

```
                    ┌─────────────────┐
                    │  QR Identity    │  (identifie)
                    └────────┬────────┘
                             │ scan → userId
                             ▼
┌──────────────┐    ┌─────────────────┐    ┌──────────────┐
│  Marketing   │───▶│  Wallet Engine  │◀───│    Event     │
│   Engine     │    │  (registre des  │    │   Engine     │
└──────────────┘    │   droits)       │    └──────────────┘
                    └────────┬────────┘
┌──────────────┐             │
│   Dispatch   │─────────────┤ issue / consume
│   / Orders   │             │
└──────────────┘             ▼
                    ┌─────────────────┐
                    │     Citoyen     │
                    │   (propriétaire)│
                    └─────────────────┘
```

Le Wallet est au centre des **droits** ; le QR est la **clé d'accès** ; les moteurs métier **émettent et consomment** via l'API publique.

---

## Services internes envisagés (organe Wallet)

| Service | Responsabilité |
|---------|----------------|
| **RightKindRegistry** | Déclaration et métadonnées des types de droits |
| **IssuanceService** | Création d'un droit (`issue`) |
| **LifecycleService** | Transitions d'état validées |
| **ConsumptionService** | Consommation atomique, idempotente |
| **QueryService** | Lecture droits par owner, filtres kind/status/zone |
| **LedgerService** | Append-only, audit trail |
| **PolicyService** | Règles transversales (expiration, révocation bulk…) |

---

## Interfaces publiques conceptuelles (sans implémentation)

```
// Commandes (sync)
issueRight({ ownerId, kind, payload, zoneId?, expiresAt?, sourceEngine, sourceRef })
consumeRight({ rightId, consumerEngine, idempotencyKey, context? })
revokeRight({ rightId, reason, actorEngine })
reserveRight({ rightId, holdDuration? })   // optionnel
releaseReservation({ rightId })

// Queries
getRightsByOwner(ownerId, filters?)
getRightById(rightId)
getRightsByKind(ownerId, kind)
canConsume(rightId) → boolean + reason

// Événements émis (async)
wallet:right_issued
wallet:right_consumed
wallet:right_revoked
wallet:right_expired
```

---

## Principes de conception non négociables

1. Le Wallet **stocke et gouverne** des droits — jamais la logique métier d'un type.
2. **Générique** et piloté par **registre de kinds** (Open/Closed).
3. **Journal append-only** pour chaque transition (auditabilité).
4. **Payloads opaques** au noyau Wallet.
5. Accès **uniquement via interface publique** — pas d'accès DB par les autres organes.
6. Consommation **idempotente** et **atomique**.
7. Centré sur le **propriétaire** (citoyen), **Zone-aware** mais non lié à une Zone fixe.
8. **Ne pas toucher** Dispatch Engine ni Communication Engine pour intégrer le Wallet.

---

## Éléments réutilisables de Ma Zone (v0.8.9)

| Existant | Réutilisation |
|----------|---------------|
| Pattern organe `backend/src/lib/*.js` | Modèle pour `walletEngine.js` |
| Migrations SQLite boot (`db/index.js`) | Nouvelles tables wallet |
| Auth JWT + `requireRole` | Guards routes wallet |
| Socket.io (`io` sur app) | Émission événements wallet |
| `communicationEngine.js` | Référence d'organe bien découpé |
| Structure routes `/api/*` | `/api/wallet` |

---

## Nouveaux composants à prévoir (ultérieurement, pas maintenant)

- `backend/src/lib/walletEngine.js` (+ policies, registry)
- `backend/src/routes/wallet.js`
- Tables : `digital_rights`, `right_events`, `right_kinds` (noms à affiner)
- Mobile : `WalletContext`, écran Wallet (Phase ultérieure)
- Documentation : `ORGANE_WALLET.md`

---

## Risques identifiés dès la conception

| Risque | Mitigation |
|--------|------------|
| Wallet devient fourre-tout | Responsabilités refusées explicites, revue architecture |
| Double consommation | Ledger + transaction atomique + idempotency key |
| Payload schema drift | Versioning payload, registre kinds |
| Couplage moteurs → Wallet | API stable, events decoupled |
| Points Civiques : moteur ou Wallet ? | Décision différée ; Wallet peut héberger le solde si choix fait |
| SQLite limits à scale | Projection + ledger ; migration PostgreSQL si besoin |

---

## Vision 5 ans — 20 moteurs

Le **noyau Wallet** (DigitalRight + Registry + StateMachine + Ledger) reste stable. Chaque nouveau moteur :

- enregistre un ou plusieurs `kind` dans le registre ;
- appelle `issue` / `consume` via l'API ;
- écoute les événements wallet si réaction nécessaire.

Aucune modification du cœur transactionnel du Wallet pour ajouter un type de droit.

---

## Livrables après validation de ce plan

| Fichier | Contenu |
|---------|---------|
| `ETUDE_ARCHITECTURE_WALLET_ENGINE.md` | Rapport complet (15 questions, comparaison détaillée, schémas Mermaid) |
| `ETUDE_ARCHITECTURE_WALLET_ENGINE.pdf` | Version archivée bibliothèque de conception |
| `Ouvrir_ETUDE_WALLET_PDF.command` | Raccourci macOS |

**Hors périmètre immédiat :** tout fichier de code du Wallet Engine.

---

## Prochaine étape

1. Vous analysez ce plan (PDF).  
2. Vous validez, amendez ou challengez la recommandation (Approche B).  
3. Sur validation : rédaction du rapport d'étude complet + PDF définitif.  
4. Ensuite seulement : chapitre d'implémentation du Wallet Engine.

---

*Document généré le 14 juillet 2026 — Plan d'étude Phase II, à valider avant rédaction du rapport complet.*
