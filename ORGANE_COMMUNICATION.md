# Organe Communication Ma Zone — Architecture V1

## Vue d'ensemble

Un **moteur unique** (`communicationEngine`) gère tous les échanges : stockage, API, sockets, non-lus. Les **policies** (`communicationPolicies`) encodent les règles métier par type de relation.

```
UI (Mes commerces, OrderTracking, ChatScreen, MissionDrawer)
    ↓
CommunicationContext + openCommunication()
    ↓
/api/communication/* → communicationEngine → SQLite + Socket.io
```

## Composants créés

### Backend

| Fichier | Responsabilité |
|---------|----------------|
| `backend/src/lib/communicationEngine.js` | Resolve, send, list, markRead, enrichThread, emit socket |
| `backend/src/lib/communicationPolicies.js` | ACL, visibilité, lifecycle, archive ephemeral |
| `backend/src/lib/unread.js` | Compteurs non-lus par utilisateur |
| `backend/src/routes/communication.js` | API REST unifiée |
| `backend/src/routes/conversations.js` | Proxy legacy vers le moteur |
| Table `store_members` | Fondation multi-employé (seed owner V1) |
| Table `conversation_reads` | État lu/non-lu par utilisateur |

### Mobile

| Fichier | Responsabilité |
|---------|----------------|
| `mobile/src/context/CommunicationContext.js` | Threads, non-lus, socket sync, markRead |
| `mobile/src/communication/openCommunication.js` | Entrée navigation unique vers Chat |
| `mobile/src/screens/client/MesCommercesScreen.js` | Relations durables client ↔ commerces |
| `mobile/src/screens/merchant/MesClientsScreen.js` | Miroir commerçant |
| `mobile/src/components/ui/UnreadDot.js` | Pastilles UI |

## Règles métier

### Durable — Client ↔ Commerçant
- Unicité `(store_id, client_id)`
- `participant_mode: store_team`
- Visible dans Mes commerces + bouton commande
- Même `conversation.id` partout

### Éphémère — Livraison
- Unicité `(order_id, kind)` pour `client_driver` et `merchant_driver`
- Archivé à la livraison / annulation
- Invisible dans les listes après fin de commande
- Livreur : accès uniquement via mission active

## Multi-employé (préparé, inactive V1)
- `store_members` : un owner par store (comportement actuel)
- ACL : tout membre du store accède aux conversations `store_team`
- Socket : room `store_{store_id}` pour notifications équipe
- Non-lus : indépendants par `user_id` via `conversation_reads`

## Extension future

| Besoin | Action |
|--------|--------|
| Nouvel employé | `INSERT INTO store_members` |
| Support unifié | Migrer `support_threads` → `kind: support` |
| Notifications système | `kind: system`, `message_type: system` |
| IA | Même transport, nouveau `message_type` |

## API

- `POST /api/communication/resolve` — `{ order_id?, store_id?, target_role }`
- `GET /api/communication/threads?kind=&lifecycle=`
- `GET /api/communication/threads/:id/messages`
- `POST /api/communication/threads/:id/messages`
- `POST /api/communication/threads/:id/read`

Legacy `/api/conversations/*` reste compatible.
