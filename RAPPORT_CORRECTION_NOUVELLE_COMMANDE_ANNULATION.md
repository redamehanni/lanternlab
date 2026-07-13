# Rapport de correction — Nouvelle commande & Annulation client

**Date :** 12 juillet 2026  
**Statut :** Implémenté et testé  
**Périmètre :** Correctifs uniquement — aucune nouvelle fonctionnalité

---

## 1. Résumé

Deux régressions client ont été corrigées de manière durable :

| Point | Cause racine | Correctif |
|-------|--------------|-----------|
| **Nouvelle commande** | Chemin navigation obsolète post-refactor Drawer | Utilitaire `navigateToFreshHome()` |
| **Annuler la commande** | `Alert.alert` non fonctionnel sur web + propagation incomplète cancel | `confirmAction()` + enrichissement `cancelOrderByClient` |

**Moteurs centraux préservés :** Dispatch Engine (cœur transactionnel intact), Communication Engine (réutilisation de `archiveEphemeralForOrder` existant).

---

## 2. Fichiers modifiés

| Fichier | Modification |
|---------|-------------|
| `mobile/src/navigation/navigateToFreshHome.js` | **Nouveau** — utilitaire navigation générique documenté |
| `mobile/src/navigation/index.js` | Tab Home réutilise l'utilitaire |
| `mobile/src/screens/client/OrderTrackingScreen.js` | Nouvelle commande, annulation, showCancel |
| `mobile/src/screens/client/OrderHistoryScreen.js` | confirmAction pour annulation |
| `mobile/src/config.js` | Ajout `offered` aux statuts annulables |
| `backend/src/lib/dispatch.js` | Enrichissement post-transaction `cancelOrderByClient` |
| `mobile/src/context/DriverContext.js` | Clear `pendingOffer` sur `mission:cancelled` |

---

## 3. Détail des corrections

### Point 1 — Nouvelle commande

**Cause :** `OrderTrackingScreen` naviguait vers `HomeTab → screen: 'Home'`, mais après le refactor Drawer l'écran `Home` est nested sous `HomeMain → HomeStack`.

**Correctif :** `navigateToFreshHome(navigation)` :
- Navigue vers `HomeTab → HomeMain → Home` avec `{ reset: timestamp }`
- Remet à zéro la stack `CartTab` (évite OrderTracking stale)
- **Aucune logique métier** — documenté comme utilitaire réutilisable

### Point 2 — Annulation client

**Mobile :**
- `confirmAction()` remplace `Alert.alert` (web + native)
- `showCancel = active && canCancelOrder(order.status)` — source unique, plus d'état stale
- `onMissionStatus` met à jour `cancellable` systématiquement
- Post-annulation : `navigateToFreshHome()` — retour état normal
- Bouton « Nouvelle commande » aussi visible après annulation

**Backend (`cancelOrderByClient` — enrichissement post-transaction uniquement) :**
- SELECT `offered_to_driver_id`
- `clearOfferTimeout(mission_id)` avant transaction
- Mission UPDATE : NULL `driver_id`, `offered_to_driver_id`, `offer_expires_at`
- `mission:cancelled` vers livreur assigné **et** livreur en offre
- `assignPendingOrdersToDriver()` pour chaque livreur libéré

**Driver mobile :**
- `mission:cancelled` clear `activeMission` **et** `pendingOffer`

---

## 4. navigateToFreshHome — contrat de l'utilitaire

```
Responsabilité unique : ramener l'app client à un état d'accueil propre.
Entrée  : navigation (n'importe quel écran client)
Sortie  : HomeTab actif, Home reset, CartTab stack = [Cart]
Interdit: logique commande, panier, mission, socket
```

Réutilisable depuis tout écran client sans effet de bord métier.

---

## 5. Tests de non-régression

| ID | Scénario | Résultat |
|----|----------|----------|
| T5 | `picked_up` non annulable / `picking_up` annulable | ✅ |
| T6 | Annulation avec offre `offered` | ✅ mission nettoyée, livreur libéré |
| T7 | Annulation livreur `accepted` | ✅ livreur libéré |
| T8 | `tryDispatchNewOrder` post-cancel | ✅ offre émise |
| **T10** | Cycle complet : commande → annulation → nouvelle → livraison → nouvelle | ✅ |

**T10 — contrôles explicites (backend) :**
- Mission annulée : `status=cancelled`, champs driver NULL
- Livreur : `driverIsBusyForNewOffer=false`, `driverHasPendingOffer=false`
- Conversations éphémères : `status=archived`
- Nouvelle commande : mission `available`, order `pending_driver` — état vierge
- Livraison complète puis 3ᵉ commande : pas de ghost mission

**Tests mobile (T1-T4, navigation) :** validation syntaxique + revue statique du chemin navigation. Recette manuelle recommandée sur web et simulateur iOS.

---

## 6. Moteurs préservés

| Moteur | Modifié ? | Détail |
|--------|-----------|--------|
| Dispatch Engine — `assignOrderToDriver` | Non | Inchangé |
| Dispatch Engine — `tryDispatchNewOrder` | Non | Inchangé |
| Dispatch Engine — `findAvailableDriver` | Non | Inchangé |
| Communication Engine | Non | `archiveEphemeralForOrder` réutilisé tel quel |
| `cancelOrderByClient` | Enrichi | Post-transaction + notifications uniquement |

Aucune modification du cœur transactionnel SQL n'a été nécessaire.

---

## 7. Recette manuelle recommandée

1. **Nouvelle commande :** livrer une commande → « Nouvelle commande » → accueil reset
2. **Annulation web :** passer commande → annuler → confirm dialog → accueil
3. **Annulation iOS :** idem avec Alert natif
4. **picked_up :** livreur passe « Produit récupéré » → bouton disparaît
5. **T10 mobile :** annuler → nouvelle commande → livrer → nouvelle commande

---

*Rapport généré après implémentation — 12 juillet 2026.*
