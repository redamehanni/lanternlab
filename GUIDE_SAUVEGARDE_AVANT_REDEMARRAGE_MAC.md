# Guide de sauvegarde — Avant redémarrage Mac

**Date :** 12 juillet 2026  
**Objectif :** Vous rassurer sur ce qui est sauvegardé, ce qui ne l'est pas, et comment récupérer votre travail sans maîtriser Git.

---

## 1. Réponse courte : est-ce que tout est bon ?

**Oui — vous pouvez quitter Cursor et redémarrer votre Mac sans perdre le travail important.**

Votre code source, la documentation et la configuration du projet sont **sauvegardés sur GitHub**. Le dossier du projet sur votre disque (`/Users/redamehanni/Downloads/MaZone-main`) **reste en place** après un redémarrage : macOS ne supprime pas vos fichiers lors d'un reboot.

| Question | Réponse |
|----------|---------|
| Puis-je fermer Cursor ? | **Oui** |
| Puis-je redémarrer le Mac ? | **Oui** |
| Mon code est-il sauvegardé ailleurs que sur le Mac ? | **Oui — sur GitHub** |
| Risque de tout perdre ? | **Très faible** pour le code et la doc |

---

## 2. Lien GitHub et point de restauration

| Élément | Valeur |
|---------|--------|
| **Dépôt GitHub** | https://github.com/redamehanni/Ma-zone-V0.8.1-stable-03-07-2026 |
| **Branche** | `main` |
| **Commit (hash complet)** | `aa76cba1d979d15942625ddf90183a9a83b2e60c` |
| **Tag (marque-page)** | `mvp-pre-mac-restart-2026-07-12` |
| **Message du commit** | MVP stable avant redémarrage Mac - Communication Engine + UI navigation + Driver offer popup |
| **Date du commit** | 12 juillet 2026, 12:56 (heure locale) |

Le **tag** est comme un signet : il pointe toujours vers exactement ce commit, même si d'autres commits sont ajoutés plus tard.

**Vérification effectuée :** le hash sur GitHub (`origin/main` et le tag) correspond **exactement** au hash local `aa76cba`.

---

## 3. Tout ce qui a été fait dans le projet (résumé)

### Phase UX client (navigation & messagerie)

- Navigation client refaite : drawer hamburger, 3 onglets (Accueil, Messagerie, Panier)
- Nouveaux écrans : Messagerie client, Profil, Commerces favoris
- Communication Engine : conversations durables vs éphémères, badges non-lus
- Labels clarifiés : « Messagerie client » / « Chat livreur »

### Phase livreur (popup offre de course)

- Mode dispatch « offre popup 20 secondes » (`OFFER_MODE`)
- Backend : `dispatchOffer.js`, colonnes `offered_to_driver_id`, `offer_expires_at`
- Mobile : `NewCourseOfferModal`, timer 20 s, Accepter / Refuser

### Correction métier « livreur occupé » (bug Accept 409)

- Séparation explicite de trois concepts :
  - `driverHasAcceptedMission()` — en livraison
  - `driverHasPendingOffer()` — offre en attente
  - `driverIsBusyForNewOffer()` — règle pour proposer une nouvelle course
- Robustesse mobile : message d'erreur API, fallback HTTP, pause du timer pendant l'acceptation

### Documentation produite

- Plan UX messagerie (MD, HTML, PDF)
- Audit popup Accept livreur (MD, HTML, PDF)
- Rapport de correction Accept (MD, HTML, PDF)
- Script de génération PDF (`scripts/generate-plan-ux-pdf.py`)

---

## 4. Ce qui a été poussé sur GitHub (57 fichiers)

### Backend (code)

| Fichier / zone | Rôle |
|----------------|------|
| `backend/src/lib/communicationEngine.js` | Moteur de communication |
| `backend/src/lib/communicationPolicies.js` | Règles métier messagerie |
| `backend/src/lib/dispatchOffer.js` | Propositions de course (popup 20 s) |
| `backend/src/lib/dispatch.js` | Dispatch + séparation modèle métier livreur |
| `backend/src/lib/unread.js` | Compteurs non-lus |
| `backend/src/config/dispatch.js` | Configuration OFFER_MODE |
| `backend/src/routes/communication.js` | API communication |
| `backend/src/routes/conversations.js` | API conversations (refactor) |
| `backend/src/routes/missions.js` | Accept / Refuse offres |
| `backend/src/routes/drivers.js` | Statut en ligne + offres |
| `backend/src/db/index.js` | Schéma SQLite étendu |
| `backend/scripts/migrate-durable-merchant-conversations.js` | Script migration |

### Mobile (code)

| Fichier / zone | Rôle |
|----------------|------|
| `mobile/src/navigation/index.js` | Navigation drawer + onglets |
| `mobile/src/context/CommunicationContext.js` | État messagerie global |
| `mobile/src/context/DriverContext.js` | Offre pending vs mission active |
| `mobile/src/screens/driver/DriverHomeScreen.js` | Popup + acceptation |
| `mobile/src/components/driver/NewCourseOfferModal.js` | Modal offre 20 s |
| `mobile/src/components/client/ClientDrawerContent.js` | Menu hamburger |
| `mobile/src/screens/client/ClientMessagingHomeScreen.js` | Hub messagerie |
| `mobile/src/screens/client/ClientProfileHubScreen.js` | Profil client |
| `mobile/src/screens/client/FavoriteStoresScreen.js` | Favoris |
| `mobile/src/communication/`, `components/chat/` | Couche communication |
| `mobile/package.json` + `package-lock.json` | Dépendances (drawer, reanimated) |

### Documentation & outils (également sur GitHub)

- `PLAN_UX_CHAPITRE_CLIENT_MESSAGERIE.md` / `.html` / `.pdf`
- `AUDIT_POPUP_ACCEPT_LIVREUR.md` / `.html` / `.pdf`
- `RAPPORT_CORRECTION_ACCEPT_LIVREUR.md` / `.html` / `.pdf`
- `ORGANE_COMMUNICATION.md`
- `scripts/generate-plan-ux-pdf.py`
- `Ouvrir_*_PDF.command` (raccourcis macOS)

**Total :** 57 fichiers, +5 508 lignes ajoutées, −369 lignes supprimées.

---

## 5. Ce qui n'a PAS été poussé sur GitHub (volontairement)

| Élément | Pourquoi pas sur GitHub | Impact si vous redémarrez |
|---------|-------------------------|---------------------------|
| `.cursor/` | Fichiers internes à l'éditeur Cursor (plans, config locale) | Aucun sur le projet — l'app fonctionne sans |
| `backend/data/` | Base SQLite locale (commandes, utilisateurs de test) | **Reste sur votre disque** après reboot ; pas sur GitHub |
| `backend/uploads/` | Images uploadées en local | Idem — reste sur disque |
| `node_modules/` | Dépendances npm (très volumineux) | Se régénère avec `npm install` |
| `mobile/.env` | Config locale (URL API personnalisée) | Seulement si vous l'avez créée |
| `.DS_Store`, logs `.expo/` | Fichiers système / cache | Sans importance |

### Nuance importante sur le mot « EXACTEMENT »

| Type de contenu | Récupérable depuis GitHub ? |
|-----------------|----------------------------|
| **Code source** (backend + mobile) | **Oui — à l'identique** |
| **Documentation** (MD, HTML, PDF) | **Oui — à l'identique** |
| **Configuration projet** (`package.json`, etc.) | **Oui — à l'identique** |
| **Données de test SQLite** (commandes, comptes) | **Non** — données locales, pas versionnées |
| **Photos uploadées** | **Non** — stockage local |
| **Dépendances `node_modules`** | **Non** — mais réinstallables en 1 commande |

**En pratique :** après redémarrage, vous retrouvez **exactement le même code et la même documentation** qu'aujourd'hui. Les **données de démo** (base SQLite avec Marie, Karim, etc.) restent sur votre Mac dans `backend/data/` tant que vous ne supprimez pas le dossier du projet.

---

## 6. Risque de redémarrer le Mac — analyse concrète

### Scénario A — Tout se passe bien (le cas le plus probable)

1. Vous fermez Cursor
2. Vous redémarrez le Mac
3. Le dossier `MaZone-main` est toujours dans `Downloads/`
4. Vous rouvrez Cursor sur ce dossier
5. Vous relancez backend + mobile

**Rien n'est perdu.** C'est le scénario normal.

### Scénario B — Le dossier local est endommagé ou supprimé

1. Vous clonez le dépôt depuis GitHub (voir section 7)
2. Vous récupérez **100 % du code et de la doc**
3. Vous faites `npm install` dans `backend/` et `mobile/`
4. La base SQLite sera **vide ou réinitialisée** (données de test à recréer)

**Le travail de développement est sauvé.** Seules les données locales de test peuvent manquer.

### Scénario C — Vous voulez être sûr à 100 % avant de redémarrer

Copiez le dossier entier ailleurs (clé USB, iCloud, Desktop) :

```
Copier : /Users/redamehanni/Downloads/MaZone-main
Vers   : /Users/redamehanni/Desktop/MaZone-main-BACKUP-12-07-2026
```

C'est une assurance supplémentaire **en plus** de GitHub, incluant la base SQLite locale.

---

## 7. Comment récupérer votre travail après redémarrage (sans maîtriser Git)

### Option 1 — Le plus simple : ne rien faire de spécial

Si le dossier est toujours dans `Downloads/` :

1. Ouvrir Cursor → Ouvrir le dossier `MaZone-main`
2. Terminal : `cd backend && npm install && node src/index.js`
3. Autre terminal : `cd mobile && npm install && npx expo start`

C'est tout. Vous êtes au même point qu'avant le reboot.

### Option 2 — Vérifier que vous êtes sur la bonne version (facultatif)

Dans le terminal, dans le dossier du projet :

```bash
cd /Users/redamehanni/Downloads/MaZone-main
git log -1 --oneline
```

Vous devez voir :

```
aa76cba MVP stable avant redémarrage Mac - Communication Engine + UI navigation + Driver offer popup
```

### Option 3 — Re-cloner depuis GitHub (si le dossier local a un problème)

```bash
cd ~/Downloads
git clone https://github.com/redamehanni/Ma-zone-V0.8.1-stable-03-07-2026.git MaZone-main-restored
cd MaZone-main-restored
git checkout mvp-pre-mac-restart-2026-07-12
cd backend && npm install
cd ../mobile && npm install
```

Vous obtenez **exactement** la version sauvegardée aujourd'hui.

### Option 4 — Retour arrière via le tag (si vous avez fait d'autres modifications après)

```bash
cd /Users/redamehanni/Downloads/MaZone-main
git fetch origin
git checkout mvp-pre-mac-restart-2026-07-12
```

---

## 8. Checklist avant de redémarrer

- [x] Code source commité et poussé sur GitHub
- [x] Tag `mvp-pre-mac-restart-2026-07-12` poussé sur GitHub
- [x] Hash local = hash GitHub (`aa76cba`)
- [x] Aucun fichier de code important non commité (seul `.cursor/` reste hors Git)
- [x] Compilation syntaxique backend + mobile vérifiée avant le commit
- [ ] *(Optionnel)* Copie du dossier `MaZone-main` sur Desktop ou clé USB
- [ ] *(Optionnel)* Noter le hash : `aa76cba1d979d15942625ddf90183a9a83b2e60c`

---

## 9. Synthèse finale

| Ce que vous pouvez faire en toute confiance | Détail |
|---------------------------------------------|--------|
| Quitter Cursor | OK |
| Redémarrer le Mac | OK |
| Retrouver le code identique | Oui — via dossier local **ou** GitHub |
| Retrouver la doc identique | Oui — tout est sur GitHub |
| Retrouver les données SQLite de test | Oui — si le dossier local n'est pas supprimé ; sinon recréer |

**Vous n'avez pas besoin de maîtriser Git pour être protégé.** Le minimum à retenir :

1. **Lien de secours :** https://github.com/redamehanni/Ma-zone-V0.8.1-stable-03-07-2026  
2. **Marque-page :** tag `mvp-pre-mac-restart-2026-07-12`  
3. **Hash :** `aa76cba1d979d15942625ddf90183a9a83b2e60c`

Si après le reboot quelque chose ne va pas, revenez à ce document ou demandez de l'aide en citant le tag `mvp-pre-mac-restart-2026-07-12`.

---

*Document généré le 12 juillet 2026 — point de restauration Git validé sur GitHub.*
