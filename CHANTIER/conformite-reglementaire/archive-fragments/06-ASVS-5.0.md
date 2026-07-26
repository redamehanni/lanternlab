# 06 — Conformité OWASP ASVS 5.0.0 (référentiel français)

| | |
|---|---|
| **Date** | 2026-07-26 |
| **Référentiel** | `OWASP_Application_Security_Verification_Standard_5.0.0_fr.csv` — 345 exigences, 17 chapitres |
| **Niveau visé** | **L2** (application traitant des données personnelles, messagerie, géolocalisation, transactions) |
| **Nature de l'évaluation** | Revue documentaire et revue de code — **pas un test d'intrusion** |
| **Code évalué** | État post Organe d'Orchestration E0 → E8 |

> **Pourquoi L2 et pas L1.** L'ASVS positionne L1 comme le minimum pour toute application et L2 comme le niveau attendu dès qu'une application traite des données personnelles ou des transactions. Ma Zone traite identité, adresses, géolocalisation, messagerie privée et commandes : **L2 est le plancher réel**, pas une ambition.

---

## 1. Tableau de bord par chapitre

| Ch. | Chapitre | Exigences | Verdict L2 | Priorité |
|-----|----------|-----------|------------|----------|
| V1 | Encodage et nettoyage | 30 | **Largement conforme** | — |
| V2 | Validation et logique métier | 13 | Partiel | P1 |
| V3 | Sécurité du frontend Web | 31 | Partiel (legacy web) | P1 |
| V4 | API et service Web | 16 | Partiel | P1 |
| V5 | Gestion des fichiers | 13 | **Non conforme** | **P0** |
| V6 | Authentification | 47 | **Non conforme** | **P0** |
| V7 | Gestion des sessions | 19 | **Non conforme** | **P0** |
| V8 | Autorisation | 13 | Partiel (1 trou critique) | **P0** |
| V9 | Jetons autonomes | 7 | Partiel | P1 |
| V10 | OAuth et OIDC | 36 | Conforme côté client | — |
| V11 | Cryptographie | 24 | Largement conforme | P2 |
| V12 | Communication sécurisée | 12 | En attente de déploiement | **P0 (prod)** |
| V13 | Configuration | 21 | Partiel | P1 |
| V14 | Protection des données | 13 | Partiel | P1 |
| V15 | Développement et architecture | 21 | Partiel | P1 |
| V16 | Journalisation et erreurs | 17 | **Non conforme** | P1 |
| V17 | WebRTC | 12 | Sans objet | — |

**Lecture rapide :** quatre chapitres bloquent une mise en production — **V5 fichiers**, **V6 authentification**, **V7 sessions**, **V8 autorisation** (un seul trou, mais critique), auxquels s'ajoute **V12** dès qu'il y a un déploiement réel.

---

## 2. V6 — Authentification : le chapitre le plus faible

C'est ici que l'écart est le plus large, et c'est contre-intuitif : le socle E0 a très bien traité les **secrets**, mais pas le **cycle de vie du mot de passe**.

### V6.2.1 — Longueur minimale de mot de passe

- **Constat :** `backend/src/routes/auth.js` L13-21 — la seule validation est la présence du champ. Aucun contrôle de longueur côté serveur. L'écran d'inscription affiche « Minimum 6 caractères » sans que rien ne l'impose.
- **Pourquoi c'est vulnérable :** un compte peut être créé avec le mot de passe `a`. Sur une plateforme où un compte donne accès à des adresses de livraison et à une messagerie privée, un mot de passe d'un caractère résiste à une attaque par dictionnaire pendant quelques millisecondes.
- **Ce que fera la nouvelle version :** refus serveur en dessous de 8 caractères (ASVS L1), cible recommandée 12 à 15, sans imposer de composition (majuscules, chiffres) — l'ASVS V6.2.5 interdit explicitement ces règles de composition qui poussent aux mots de passe prévisibles.
- **Gravité :** P0

### V6.2.2 et V6.2.3 — Changement de mot de passe

- **Constat :** aucune route de changement de mot de passe. `backend/src/routes/users.js` expose `GET/PUT /me` et la gestion des adresses ; le mot de passe est explicitement retiré de la réponse (L17) mais n'est jamais modifiable.
- **Pourquoi c'est vulnérable :** un utilisateur dont le mot de passe a fuité (réutilisation depuis un autre site compromis) **n'a aucun moyen de le changer**. Le seul recours serait la suppression de compte, qui n'existe pas non plus. L'utilisateur est enfermé dans un compte compromis.
- **Ce que fera la nouvelle version :** `PUT /api/users/me/password` exigeant le mot de passe actuel puis le nouveau, avec invalidation des sessions actives (voir V7.4.1).
- **Gravité :** P0

### V6.4.1 et V6.4.2 — Récupération de compte

- **Constat :** aucun parcours « mot de passe oublié ». Aucun service d'envoi d'email ou de SMS n'est branché (confirmé par l'inventaire des dépendances : ni SendGrid, ni Mailgun, ni Twilio).
- **Pourquoi c'est bloquant :** sans récupération, tout oubli de mot de passe crée un compte orphelin contenant des données personnelles que personne ne peut plus ni corriger, ni effacer. C'est un problème de sécurité **et** un obstacle direct à l'exercice des droits RGPD.
- **Ce que fera la nouvelle version :** parcours de réinitialisation par jeton aléatoire à usage unique et courte durée, envoyé par email, sans jamais révéler si l'adresse existe. Prérequis : choisir un prestataire d'envoi (qui deviendra un sous-traitant à inscrire au registre).
- **Gravité :** P0 — prérequis produit avant ouverture

### V6.3.1 et V6.3.2 — Anti-automatisation et comptes par défaut

- **Constat V6.3.1 :** conforme. `backend/src/app.js` applique 10 requêtes par minute sur `/api/auth` en production.
- **Constat V6.3.2 :** partiellement conforme. Le script `backend/scripts/create-admin.js` propose des identifiants par défaut (`admin@mazone.local` / `admin1234`) et `start-lab.sh` les réinitialise. Acceptable en développement, inacceptable si le script est exécuté sur l'instance de production.
- **Ce que fera la nouvelle version :** refus du mot de passe par défaut lorsque `NODE_ENV=production`, sur le modèle du refus déjà en place pour les secrets JWT historiques dans `config/env.js`.
- **Gravité :** P1

---

## 3. V7 — Gestion des sessions : la déconnexion n'existe pas côté serveur

### V7.4.1 — La fin de session doit empêcher toute utilisation ultérieure

- **Constat :** `backend/src/routes/auth.js` L35 et L52 émettent un JWT valable **30 jours**. `mobile/src/context/AppContext.js` efface le stockage local à la déconnexion, mais aucun mécanisme serveur ne rejette un jeton déjà émis. Un commentaire dans le code mobile parle d'ailleurs de « JWT mort en AsyncStorage ».
- **Pourquoi c'est vulnérable :** un jeton copié avant la déconnexion (téléphone prêté, sauvegarde non chiffrée, poste partagé, capture réseau en HTTP local) reste valide jusqu'à 30 jours. La déconnexion est cosmétique : elle rassure l'utilisateur sans rien révoquer.
- **Ce que fera la nouvelle version :** liste de révocation (ou table de sessions référencées) consultée à chaque vérification de jeton, alimentée par la déconnexion, le changement de mot de passe et la suppression de compte. Durée de vie réduite avec jeton de rafraîchissement.
- **Gravité :** P0

### V7.4.2 — Fin de toutes les sessions à la suppression du compte

- **Constat :** sans suppression de compte ni révocation, l'exigence est doublement non satisfaite.
- **Pourquoi c'est non conforme :** un compte « supprimé » dont les jetons restent actifs continue d'accéder aux données — l'effacement RGPD serait alors une fiction.
- **Ce que fera la nouvelle version :** la suppression de compte révoque toutes les sessions dans la même transaction.
- **Gravité :** P0 — dépendance directe du droit à l'effacement

---

## 4. V5 — Gestion des fichiers

### V5.2.2 — Vérification de l'extension et du type

- **Constat :** multer configuré avec `limits.fileSize` seulement dans `users.js`, `stores.js`, `products.js`. Aucun `fileFilter`.
- **Pourquoi c'est vulnérable :** un utilisateur authentifié peut téléverser un fichier HTML ou SVG à la place d'une photo de profil. Servi ensuite depuis le même domaine que l'API, un SVG peut porter du JavaScript et s'exécuter dans le contexte de l'application.
- **Ce que fera la nouvelle version :** liste blanche `image/jpeg`, `image/png`, `image/webp`, vérifiée sur le type réel du contenu et non sur l'en-tête déclaré par le client.
- **Gravité :** P0

### V5.3.2 — Chemins générés en interne

- **Constat :** `backend/src/routes/users.js` L11 conserve `file.originalname` dans le nom final.
- **Pourquoi c'est vulnérable :** un nom de fichier soumis par l'utilisateur peut contenir des séquences de traversée de répertoire ou des caractères qui déstabilisent le stockage et les URL.
- **Ce que fera la nouvelle version :** identifiant aléatoire (UUID) plus extension dérivée du type détecté côté serveur. Le nom d'origine, s'il doit être conservé, va en base de données, jamais sur le disque.
- **Gravité :** P0

### V5.3.1 — Les fichiers déposés ne doivent pas être exécutables

- **Constat :** `backend/src/app.js` L165 sert `backend/uploads` en statique, sans authentification.
- **Pourquoi c'est vulnérable :** combiné aux deux points précédents, le dossier de dépôt devient une surface d'hébergement de contenu arbitraire sur le domaine de confiance. Et indépendamment de l'exécution, les photos de profil sont accessibles à quiconque connaît ou devine l'URL — ce qui est un traitement de données personnelles sans contrôle d'accès.
- **Ce que fera la nouvelle version :** service par route authentifiée ou URL signée à durée limitée, en-tête `Content-Disposition` et `Content-Type` forcés, aucune exécution possible.
- **Gravité :** P0

---

## 5. V8 — Autorisation : un seul trou, mais béant

### V8.2.2 — Accès aux données limité aux personnes explicitement autorisées

- **Constat :** `backend/src/routes/messages.js` — la route `GET /:orderId` (L8-17) lit tous les messages d'une commande et `POST /` (L20-39) en écrit un, avec pour seule protection `verifyToken`. Aucun appel à `canViewOrder`, alors que cette fonction existe et est utilisée correctement dans `routes/orders.js` L172-174 et L224-226.
- **Pourquoi c'est vulnérable :** tout titulaire d'un compte, même un client sans lien avec la commande, peut lire l'intégralité d'une conversation privée entre un autre client, un commerçant et un livreur — nom de l'expéditeur inclus, puisque la requête joint la table `users`. Il peut aussi y écrire et diffuser le message dans le salon temps réel `order_<id>`. Les identifiants de commande étant séquentiels ou devinables, l'énumération est triviale.
- **Ce que fera la nouvelle version :** appel à `canViewOrder(req.user, orderId)` avant toute lecture ou écriture, avec réponse 404 en cas de refus (et non 403, pour ne pas confirmer l'existence de la commande). À terme, dépréciation de cette route au profit de `/api/conversations`, déjà protégée par `canAccessConversation`.
- **Gravité :** P0 — **c'est l'écart technique le plus grave de l'audit**

Le reste du chapitre est satisfaisant : contrôle au niveau fonction par `requireRole`, décisions prises dans une couche de service de confiance (V8.3.1), et couverture par `backend/test/security/access.test.js`.

---

## 6. V9 — Jetons autonomes

### V9.1.2 — Liste blanche d'algorithmes

- **Constat :** `backend/src/middleware/auth.js` L10 et `socket/handlers.js` L13 appellent `jwt.verify(token, secret)` sans l'option `algorithms`.
- **Pourquoi c'est risqué :** la bibliothèque déduit l'algorithme du jeton présenté. La version 9 de `jsonwebtoken` rejette `alg: none` lorsqu'un secret est fourni, ce qui neutralise l'attaque classique — mais l'application repose alors sur un comportement par défaut de la bibliothèque plutôt que sur une décision explicite. Une mise à jour, un changement de bibliothèque ou une future clé asymétrique rouvriraient la porte à une confusion d'algorithme.
- **Ce que fera la nouvelle version :** `jwt.verify(token, secret, { algorithms: ['HS256'] })` sur les trois points de vérification (citoyen, admin, socket).
- **Gravité :** P1 — correctif d'une ligne, à faire sans discuter

Le reste du chapitre est conforme : signature vérifiée (V9.1.1), clés issues d'une source de confiance (V9.1.3), période de validité respectée (V9.2.1).

---

## 7. V16 — Journalisation de sécurité : le chapitre oublié

Ce chapitre compte 17 exigences, dont 16 au niveau L2. C'est un angle mort complet du projet, et c'est aussi celui qui coûtera le plus cher le jour d'un incident : **sans journal d'événements de sécurité, on ne peut ni détecter une compromission, ni en établir le périmètre, ni notifier la CNIL avec des faits.**

| Exigence | Constat | Verdict |
|----------|---------|---------|
| V16.1.1 — Inventaire documenté de la journalisation | Aucun inventaire | Absent |
| V16.2.1 — Métadonnées quand / où / qui / quoi | Partiel (`logger.js` structuré, contexte variable) | Partiel |
| V16.2.5 — Politique de journalisation des données sensibles | `logger.js` masque `password`, `token`, `authorization`, `jwt`, `secret` mais **pas** `email`, `phone`, `name`, `address`, `lat`, `lng` | Partiel |
| V16.3.1 — Journaliser toutes les opérations d'authentification, réussies et échouées | Aucun journal sur `/api/auth/login` | **Absent** |
| V16.3.2 — Journaliser les échecs d'autorisation | Les refus `canViewOrder` ne sont pas tracés | **Absent** |
| V16.3.4 — Journaliser les erreurs inattendues | Partiel (filet final) | Partiel |
| V16.4.2 — Journaux protégés contre la modification | Fichiers locaux | Partiel |
| V16.4.3 — Journaux expédiés vers un système distinct | Non branché (`ERROR_TRACKING_DSN` prévu, non configuré) | Absent |
| V16.5.1 — Message d'erreur générique au client | Filet final sans trace d'exécution | **Conforme** |

**Écart aggravant :** `backend/src/socket/handlers.js` écrit des `console.log` contenant le **nom** des utilisateurs à chaque connexion et déconnexion. On journalise donc des données personnelles inutiles, tout en ne journalisant pas les événements de sécurité utiles. C'est exactement l'inverse de ce que demandent conjointement l'ASVS V16 et la fiche CNIL n° 6.

**Ce que fera la nouvelle version :** un inventaire des journaux, la journalisation systématique des authentifications et des refus d'autorisation avec identifiants opaques, l'extension de la liste de masquage aux données personnelles, et l'expédition vers un collecteur externe.

---

## 8. Chapitres conformes ou proches — à préserver

### V10 — OAuth (36 exigences)

Ma Zone est **client** OAuth vis-à-vis des éditeurs, pas serveur d'autorisation : la majorité des exigences V10.4 ne s'applique pas. Côté client, l'implémentation est solide et mérite d'être notée :

- Jeton d'état à usage unique avec colonne `consumed_at` (`oauth.js`)
- Durée de vie de 10 minutes, conforme au plafond L1/L2 de V10.4.3
- URI de redirection construite depuis `PUBLIC_BASE_URL` et **jamais** déduite d'un en-tête de requête — la protection contre le vol de jeton par redirection est explicite dans les commentaires du fichier
- Identifiants d'application dérivés de l'identifiant du connecteur, jamais écrits en dur

**Réserve :** pas de PKCE. Non requis pour un client confidentiel côté serveur, mais à prévoir si un jour le flux passe par le mobile.

### V11 — Cryptographie (24 exigences)

- AES-256-GCM pour le coffre d'intégrations, conforme à V11.3.2 qui exige explicitement un mode approuvé de type GCM
- Aucun mode ECB ni remplissage faible (V11.3.1)
- bcrypt pour les mots de passe, HMAC-SHA256 à comparaison en temps constant pour les webhooks (V11.4.1)

**Écart résiduel :** aucun mécanisme de rotation de la clé maîtresse (V13.3.4). La dette est déjà documentée honnêtement dans `secrets.js` — reconnecter les boutiques est obligatoire si la clé change. Acceptable pour un pilote, à traiter avant l'échelle.

### V1 — Encodage et nettoyage (30 exigences)

Requêtes systématiquement paramétrées via `better-sqlite3` (V1.2.4), pas d'`eval` (V1.3.2), échappement automatique par React et React Native pour le rendu (V1.2.1 à V1.2.3). Chapitre globalement sain.

---

## 9. V12 — Communication sécurisée : conforme sur le papier, à prouver en production

Le runbook d'étape 0 prévoit un reverse proxy TLS et le relais WSS pour Socket.io, et l'application écoute sur `127.0.0.1` en production. La conception est correcte.

Mais aujourd'hui, **aucun déploiement n'existe** : le backend tourne en HTTP sur le réseau local, et le mobile s'y connecte en clair (`mobile/src/config.js`). Tant que ce n'est pas déployé derrière TLS 1.2/1.3, V12.1.1 et V4.4.1 (WebSocket sur WSS) restent non satisfaites.

**Conséquence pratique :** en l'état, un attaquant sur le même réseau Wi-Fi peut lire les jetons JWT et le contenu des messages. C'est acceptable pour un prototype local ; c'est disqualifiant pour toute démonstration hors du réseau de confiance.

---

## 10. Synthèse des exigences ASVS bloquantes

| Exigence | Sujet | Fichier concerné | Priorité |
|----------|-------|------------------|----------|
| V8.2.2 | Messagerie sans contrôle d'accès | `routes/messages.js` | P0 |
| V5.2.2 / V5.3.1 / V5.3.2 | Téléversements non filtrés et servis publiquement | `routes/users.js`, `stores.js`, `products.js`, `app.js` | P0 |
| V6.2.1 | Aucune politique de mot de passe | `routes/auth.js` | P0 |
| V6.2.2 / V6.2.3 | Changement de mot de passe impossible | `routes/users.js` | P0 |
| V6.4.1 | Récupération de compte inexistante | — | P0 |
| V7.4.1 / V7.4.2 | Révocation de session inexistante | `middleware/auth.js` | P0 |
| V12.1.1 / V4.4.1 | TLS et WSS non déployés | infrastructure | P0 (prod) |
| V9.1.2 | Algorithme JWT non contraint | `middleware/auth.js`, `socket/handlers.js` | P1 |
| V16.3.1 / V16.3.2 | Événements de sécurité non journalisés | `lib/logger.js` et appelants | P1 |
| V14.3.3 | Jeton et profil en stockage client non chiffré | `mobile/src/utils/storage.js` | P1 |
| V2.2.1 | Validation d'entrée ad hoc | routes | P1 |
| V3.4.1 | HSTS absent | `next.config.ts` | P1 |
| V15.2.1 | Composants obsolètes non surveillés | CI | P1 |
| V13.3.4 | Pas de rotation de secrets | `secrets.js` | P2 |

---

## 11. Chapitres restants — verdict condensé (L1+L2)

Complément pour couvrir les **17 chapitres** du CSV ASVS 5.0.0 FR (345 exigences au total ; ~244 au niveau L1+L2).

| Ch. | Verdict | Points clés Ma Zone |
|-----|---------|---------------------|
| **V2** Validation / logique métier | Partiel | OpenAPI sur `/api/v1` OK ; validation runtime ad hoc ; machines à états orders/inventory solides (E2–E5) |
| **V3** Frontend web | Partiel / N/A mobile | Next.js : nosniff, X-Frame, Referrer OK ; **pas** CSP/HSTS/cookies `__Host-` ; mobile natif hors périmètre cookies |
| **V4** API web | Partiel | Content-Type globalement OK ; CORS prod OK ; WSS non déployé ; pas de doc « proxy headers » (`X-Forwarded-For`) |
| **V13** Configuration | Partiel | `env.js` fail-fast exemplaire ; inventaire communications (V13.1.1) incomplet ; rotation secrets absente |
| **V14** Protection des données | Partiel | Cartographie dans `02-` ; classification formelle absente ; PII en AsyncStorage (V14.3.3) |
| **V15** Dev / architecture | Partiel | Architecture documentée + CI lois = point fort ; pas de SBOM, délais CVE, SAST |
| **V17** WebRTC | **N/A** | Aucun WebRTC dans le produit |

---

## 12. Source et méthode

- **Fichier source :** `OWASP_Application_Security_Verification_Standard_5.0.0_fr.csv` (345 lignes d'exigences).
- **Copie de travail :** [references/OWASP_ASVS_5.0.0_fr.csv](./references/OWASP_ASVS_5.0.0_fr.csv) (si présente dans le dépôt).
- **Niveau visé :** L2 (données personnelles + transactions).
- **Méthode :** revue de code + documentation — **pas** un test d'intrusion ni une certification tierce.
- **Traceabilité corrective :** chaque écart P0/P1 de ce document a un ID dans [FD-003 §16](../../FICHE_DISCUSSION/FD-003-conformite-reglementaire-securite-applicative.md) (listes D- / C- / O- / J-).

---

## 13. Ce que cet audit ne couvre pas

Par honnêteté méthodologique, les points suivants **n'ont pas été vérifiés** et ne peuvent pas l'être par une revue de code :

- Test d'intrusion applicatif et test d'authentification en conditions réelles
- Comportement TLS effectif (aucun déploiement à tester)
- Résistance à la charge et au déni de service
- Sécurité physique et organisationnelle de l'hébergement
- Revue du code des dépendances tierces elles-mêmes

Une certification ASVS formelle exige une vérification par un tiers indépendant. Le présent document est une **auto-évaluation outillée**, utile pour piloter les correctifs, pas opposable comme attestation.
