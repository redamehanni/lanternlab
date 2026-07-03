# Ma Zone — Guide complet pour débutant (A à Z)

Ce document explique **comment lancer et tester le MVP Ma Zone sur votre Mac**, étape par étape, sans connaissance technique préalable.

---

## Table des matières

1. [Ce que vous allez obtenir](#1-ce-que-vous-allez-obtenir)
2. [Ce qu'il faut installer sur votre Mac](#2-ce-quil-faut-installer-sur-votre-mac)
3. [Comprendre le projet (2 parties)](#3-comprendre-le-projet-2-parties)
4. [Installation la première fois](#4-installation-la-première-fois)
5. [Lancer le projet (les 2 terminaux)](#5-lancer-le-projet-les-2-terminaux)
6. [Où voir l'application ?](#6-où-voir-lapplication-)
7. [Ouvrir 3 simulateurs pour tester les 3 rôles](#7-ouvrir-3-simulateurs-pour-tester-les-3-rôles)
8. [Scénario de démonstration complet](#8-scénario-de-démonstration-complet)
9. [Récapitulatif des écrans par rôle](#9-récapitulatif-des-écrans-par-rôle)
10. [Problèmes fréquents et solutions](#10-problèmes-fréquents-et-solutions)
11. [Tester sur un vrai téléphone (optionnel)](#11-tester-sur-un-vrai-téléphone-optionnel)
12. [Arrêter les serveurs](#12-arrêter-les-serveurs)

---

## 1. Ce que vous allez obtenir

Ma Zone est une application de livraison locale avec **3 rôles** :

| Rôle | Ce qu'il fait |
|------|----------------|
| **Commerçant** | Crée sa boutique, ajoute des produits, gère les stocks, voit les commandes |
| **Client** | Recherche des produits, passe commande, suit la livraison en temps réel |
| **Livreur** | Reçoit des missions, accepte ou refuse, met à jour les étapes de livraison |

Tout est **réel** : les données sont sauvegardées en base SQLite, et les actions se synchronisent en temps réel entre les appareils via Socket.io.

---

## 2. Ce qu'il faut installer sur votre Mac

### Obligatoire

| Logiciel | À quoi ça sert | Comment l'installer |
|----------|----------------|---------------------|
| **Node.js** (v18 ou plus) | Fait tourner le backend et Expo | [nodejs.org](https://nodejs.org) → télécharger la version LTS |
| **Terminal** | Lancer les commandes | Déjà sur votre Mac (Applications → Utilitaires → Terminal) |

### Pour voir l'app sur simulateur iPhone (recommandé sur Mac)

| Logiciel | À quoi ça sert | Comment l'installer |
|----------|----------------|---------------------|
| **Xcode** | Fournit le simulateur iPhone | Mac App Store → chercher "Xcode" → Installer (gros téléchargement, ~12 Go) |

Après l'installation de Xcode, ouvrez-le **une fois** et acceptez les licences. Puis dans le Terminal :

```bash
sudo xcodebuild -license accept
```

### Vérifier que Node est installé

Ouvrez le Terminal et tapez :

```bash
node -v
```

Vous devez voir quelque chose comme `v20.x.x` ou `v24.x.x`. Si la commande n'est pas reconnue, installez Node.js.

---

## 3. Comprendre le projet (2 parties)

Votre dossier `MaZone` contient **deux programmes distincts** qui doivent tourner en même temps :

```
MaZone/
├── backend/     ← Le "cerveau" : API, base de données, temps réel
│                  URL : http://localhost:4000
│
└── mobile/      ← L'application visible (interface Client / Commerçant / Livreur)
                   Lancée via Expo → s'affiche dans un simulateur iPhone
```

| Partie | Rôle | Analogie |
|--------|------|----------|
| **Backend** | Enregistre tout (comptes, produits, commandes, messages) et envoie les mises à jour en temps réel | Le serveur d'un restaurant |
| **Mobile (Expo)** | Affiche l'interface que vous touchez | L'application sur votre téléphone |

**Important :** le backend seul ne montre rien à l'écran. L'app mobile seule ne peut pas fonctionner sans le backend. Il faut **les deux**.

---

## 4. Installation la première fois

Ouvrez le **Terminal** et exécutez ces commandes **une seule fois** (ou après un `git pull` qui ajoute des dépendances).

### Étape 4.1 — Installer le backend

```bash
cd /Users/adamyousfi/Desktop/MaZone/backend
npm install
```

Attendez la fin (1 à 2 minutes). Pas de message d'erreur rouge = OK.

### Étape 4.2 — Installer l'app mobile

```bash
cd /Users/adamyousfi/Desktop/MaZone/mobile
npm install
```

Attendez la fin. C'est fait pour l'installation initiale.

---

## 5. Lancer le projet (les 2 terminaux)

Vous avez besoin de **2 fenêtres Terminal** ouvertes en parallèle.

### Terminal 1 — Backend (à lancer en premier)

```bash
cd /Users/adamyousfi/Desktop/MaZone/backend
node src/index.js
```

**Ce que vous devez voir :**

```
╔═══════════════════════════════════════╗
║         MA ZONE — Backend API         ║
╠═══════════════════════════════════════╣
║  URL : http://localhost:4000            ║
╚═══════════════════════════════════════╝
```

✅ Tant que ce terminal reste ouvert et affiche ce message, le backend fonctionne.  
❌ Ne fermez pas cette fenêtre pendant vos tests.

**Test rapide :** ouvrez Safari et allez sur [http://localhost:4000/health](http://localhost:4000/health). Vous devez voir : `{"status":"ok",...}`

---

### Terminal 2 — Application mobile (Expo)

Ouvrez une **nouvelle** fenêtre Terminal :

```bash
cd /Users/adamyousfi/Desktop/MaZone/mobile
npx expo start --clear
```

**Ce que vous devez voir :**

- Un **QR code** dans le terminal
- Des lignes du type `Metro waiting on...`
- Un menu avec des raccourcis : `› Press i │ open iOS simulator`

⚠️ **À ce stade, l'app n'est PAS encore visible à l'écran.** Expo a seulement préparé le serveur de développement. Il faut maintenant ouvrir un simulateur (section suivante).

---

## 6. Où voir l'application ?

`npx expo start` **ne ouvre pas automatiquement** l'application. Voici où elle apparaît selon votre choix :

### Option A — Simulateur iPhone (recommandé)

Dans le **Terminal 2** (celui où Expo tourne), appuyez sur la touche :

```
i
```

→ Une fenêtre **iPhone Simulator** s'ouvre sur votre Mac.  
→ L'application Ma Zone se charge dedans (écran bleu « Ma Zone » avec choix Client / Commerçant / Livreur).

**Alternative en une commande** (Terminal 2, si Expo n'est pas déjà lancé) :

```bash
cd /Users/adamyousfi/Desktop/MaZone/mobile
npm run ios
```

Cela lance Expo **et** ouvre directement le simulateur.

---

### Option B — Navigateur web

Dans le Terminal 2, appuyez sur :

```
w
```

→ L'app s'ouvre dans Chrome/Safari. Utile pour un aperçu rapide, mais le simulateur iPhone est plus fidèle au rendu mobile.

---

### Option C — Téléphone physique

1. Installez **Expo Go** depuis l'App Store (iPhone) ou Play Store (Android).
2. Scannez le QR code affiché dans le Terminal 2.
3. L'app s'ouvre dans Expo Go.

⚠️ Sur un **vrai téléphone**, `localhost` ne fonctionne pas (le téléphone ne pointe pas vers votre Mac). Voir [section 11](#11-tester-sur-un-vrai-téléphone-optionnel).

---

### Schéma récapitulatif

```
Terminal 1                    Terminal 2
──────────                    ──────────
node src/index.js      +      npx expo start
     │                              │
     │                              │  puis touche "i"
     ▼                              ▼
http://localhost:4000         Simulateur iPhone
(API invisible)               (app visible ici ✓)
```

---

## 7. Ouvrir 3 simulateurs pour tester les 3 rôles

Pour la démo complète, vous voulez **3 fenêtres** côte à côte : une pour le Client, une pour le Commerçant, une pour le Livreur.

### Prérequis

- Terminal 1 : backend lancé (`node src/index.js`)
- Terminal 2 : Expo lancé (`npx expo start --clear`)

### Étape 7.1 — Premier simulateur (ex. Client)

Dans le Terminal 2, appuyez sur **`i`**.

Un iPhone s'ouvre → inscrivez-vous en tant que **Client**.

### Étape 7.2 — Deuxième simulateur (ex. Commerçant)

1. Dans la barre de menu Mac en haut : **File → Open Simulator**
2. Choisissez un **autre modèle** d'iPhone (ex. iPhone 16 Pro si le premier est iPhone 16).

Une **deuxième** fenêtre simulateur s'ouvre.

3. Retournez dans le **Terminal 2** et appuyez encore sur **`i`**.

L'app Ma Zone se charge dans ce deuxième simulateur → inscrivez-vous en tant que **Commerçant** (utilisez un **autre email** que pour le Client).

### Étape 7.3 — Troisième simulateur (ex. Livreur)

Répétez la même opération :

1. **File → Open Simulator** → autre modèle
2. Terminal 2 → touche **`i`**
3. Inscrivez-vous en tant que **Livreur** (encore un autre email)

### Résultat attendu

Vous avez **3 simulateurs iPhone** ouverts, chacun connecté au même backend `localhost:4000`. Une action sur l'un est visible sur les autres en temps réel.

**Astuce :** réduisez la taille des fenêtres simulateur (coin bas-droite) pour les voir côte à côte.

---

## 8. Scénario de démonstration complet

Suivez cet ordre **exact** pour valider tout le parcours.

### Phase 1 — Commerçant (Simulateur 2)

| Étape | Action |
|-------|--------|
| 1 | Choisir **Commerçant** → **S'inscrire** |
| 2 | Remplir : nom, email (`commercant@test.fr`), mot de passe (`test123`), téléphone |
| 3 | **Créer ma boutique** : nom, adresse (ex. `12 rue de la Paix, Paris`), description |
| 4 | **+ Produit** : nom (ex. `Coca-Cola 33cl`), prix (`1.50`), quantité (`10`), catégorie |
| 5 | (Optionnel) Ajouter une photo via « Prendre » ou « Importer » |

✅ Le produit est en base. Le Client pourra le trouver à l'étape suivante.

---

### Phase 2 — Client (Simulateur 1)

| Étape | Action |
|-------|--------|
| 1 | Choisir **Client** → **S'inscrire** avec un **autre email** (`client@test.fr`) |
| 2 | Renseigner une adresse de livraison |
| 3 | Rechercher `coca` (ou le nom du produit créé) |
| 4 | Ouvrir la fiche produit → **Commander** |
| 5 | Confirmer l'adresse → **Confirmer la commande** |

✅ Une commande est créée. Le commerçant et le livreur sont notifiés en temps réel.

---

### Phase 3 — Livreur (Simulateur 3)

| Étape | Action |
|-------|--------|
| 1 | Choisir **Livreur** → **S'inscrire** (`livreur@test.fr`) |
| 2 | Une **popup** apparaît avec la mission (timer 20 secondes) |
| 3 | Cliquer **Accepter** |
| 4 | Avancer les étapes : « Partir vers le commerce » → « Produit récupéré » → « En route vers le client » → « Mission accomplie » |

✅ Le Client et le Commerçant voient le statut changer en direct sur leurs écrans.

---

### Phase 4 — Messagerie (n'importe quel simulateur)

| Depuis | Action |
|--------|--------|
| Client | Sur l'écran de suivi → **Contacter le commerçant** ou **Contacter le livreur** |
| Commerçant | Commandes reçues → **Contacter le client** |
| Livreur | Mission en cours → **Contacter le client** |

Les messages sont instantanés et sauvegardés.

---

## 9. Récapitulatif des écrans par rôle

### Commerçant

- Tableau de bord (boutique, commandes en cours)
- Créer / modifier la boutique
- Ajouter un produit (manuel ou code-barres)
- Gérer les stocks (+ / − / +10)
- Liste des commandes + chat

### Client

- Recherche de produits (nom, prix, distance, stock)
- Fiche produit
- Confirmation de commande
- Suivi en temps réel (timeline des étapes)
- Chat commerçant / livreur

### Livreur

- Liste des missions disponibles
- Popup mission entrante (20 s)
- Mission active (étapes à valider)
- Chat client

---

## 10. Problèmes fréquents et solutions

### « Connexion impossible » ou « Vérifiez l'adresse IP du serveur »

| Cause | Solution |
|-------|----------|
| Backend pas lancé | Ouvrir Terminal 1 et lancer `node src/index.js` |
| Backend fermé par erreur | Relancer Terminal 1 |
| Mauvais ordre de démarrage | Toujours : backend **d'abord**, Expo **ensuite** |

---

### Rien ne s'affiche après `npx expo start`

C'est **normal**. Appuyez sur **`i`** (iOS) ou lancez `npm run ios`.

---

### `Command not found: node` ou `npx`

Node.js n'est pas installé ou pas dans le PATH. Réinstallez Node.js depuis [nodejs.org](https://nodejs.org), fermez et rouvrez le Terminal.

---

### Le simulateur iOS ne s'ouvre pas

1. Installez **Xcode** depuis le Mac App Store.
2. Ouvrez Xcode une fois, acceptez les licences.
3. Terminal : `sudo xcodebuild -license accept`
4. Réessayez `npm run ios`.

---

### « Email déjà utilisé » à l'inscription

Chaque rôle de test doit avoir un **email différent** :
- `commercant@test.fr`
- `client@test.fr`
- `livreur@test.fr`

---

### Le livreur ne reçoit pas la mission

1. Vérifiez que le livreur est bien **inscrit et connecté** avant ou juste après la commande client.
2. Le livreur doit être sur l'écran **Missions** (Socket.io le met « en ligne » automatiquement).
3. Si besoin : déconnectez et reconnectez le livreur.

---

### Réinitialiser toutes les données

Supprimez le fichier de base de données et relancez le backend :

```bash
rm -f /Users/adamyousfi/Desktop/MaZone/data/mazone.db
cd /Users/adamyousfi/Desktop/MaZone/backend
node src/index.js
```

Une nouvelle base vide sera recréée au démarrage.

---

### Port 4000 déjà utilisé

Un ancien backend tourne encore. Dans le Terminal :

```bash
pkill -f "node src/index.js"
```

Puis relancez le backend.

---

## 11. Tester sur un vrai téléphone (optionnel)

Sur simulateur, l'app utilise `localhost` automatiquement. Sur un **téléphone physique**, le téléphone ne peut pas accéder au `localhost` de votre Mac.

### Étapes

1. Mac et téléphone sur le **même Wi-Fi**.
2. Trouvez l'IP locale de votre Mac : **Réglages Système → Réseau → Wi-Fi → Détails** (ex. `192.168.1.81`).
3. Créez le fichier `mobile/.env` :

   ```
   EXPO_PUBLIC_API_URL=http://192.168.1.81:4000
   ```

   (Remplacez par votre IP.)

4. Modifiez `backend/src/index.js` : remplacez `'127.0.0.1'` par `'0.0.0.0'` dans `server.listen(...)` pour accepter les connexions du réseau local.
5. Relancez backend et Expo.
6. Scannez le QR code avec **Expo Go**.

---

## 12. Arrêter les serveurs

| Terminal | Action |
|----------|--------|
| Terminal 1 (backend) | `Ctrl + C` |
| Terminal 2 (Expo) | `Ctrl + C` |

Fermer les fenêtres Simulateur : **Simulator → Quit Simulator** ou fermer chaque fenêtre.

---

## Aide-mémoire (copier-coller)

```bash
# ── TERMINAL 1 — Backend ──
cd /Users/adamyousfi/Desktop/MaZone/backend
node src/index.js

# ── TERMINAL 2 — App mobile ──
cd /Users/adamyousfi/Desktop/MaZone/mobile
npx expo start --clear
# Puis appuyer sur : i  (ouvrir simulateur iPhone)

# ── Ouvrir un 2e ou 3e simulateur ──
# Menu Mac : File → Open Simulator → autre iPhone
# Puis dans Terminal 2 : i
```

---

## Besoin d'aide ?

En cas de blocage, notez :
1. Ce que vous avez tapé dans le Terminal
2. Le message d'erreur exact (copier-coller)
3. À quelle étape du guide vous êtes

Cela permet de diagnostiquer rapidement le problème.
