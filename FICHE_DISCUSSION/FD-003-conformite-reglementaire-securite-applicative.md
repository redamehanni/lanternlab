# FD-003 — Conformité réglementaire et sécurité applicative : ce qui manque pour être inattaquable

| | |
|---|---|
| **Statut** | **brouillon** — rédigée par Cursor Adam, validation Adam et Reda requise |
| **Date** | 2026-07-26 |
| **Auteur(s)** | Adam (AdamY76) via Cursor |
| **Phase / chantier** | Conformité réglementaire et sécurité applicative |
| **Document unique (Adam → Reda)** | [`CHANTIER/conformite-reglementaire/DOSSIER-COMPLET-conformite-reglementaire.md`](../CHANTIER/conformite-reglementaire/DOSSIER-COMPLET-conformite-reglementaire.md) |
| **Références** | [FD-000](./FD-000-mise-a-niveau-global-cursor-adam-ma-zone.md) · [FD-002](./FD-002-mise-a-jour-cursor-adam-chantier-orchestration-e0-e8.md) · `docs/legal/` · `docs/METHODE-AUDIT-CONFORMITE-APP.md` · `RUNBOOK_ETAPE_0_SOCLE_PRODUCTION.md` |

> **Ne pas contredire FD-000** sur la philosophie produit. Cette fiche ne parle ni de la Deuxième Âme, ni de l'orchestration : elle traite de ce qui doit être vrai avant que Ma Zone touche un utilisateur réel.
>
> **Rôle de cette FD vs le dossier.** Le **DOSSIER-COMPLET** contient l’audit entier (synthèse, plan, décisions, surfaces, inventaire, ASVS, CNIL, registre…). Cette **FD-003** est la fiche Cursor : liste maîtresse cochable, scénarios, séquencement, critères « inattaquable ». Pour envoyer le sujet à Reda : **un seul fichier = le DOSSIER-COMPLET**.

---

## Table des matières

1. [Contexte](#1-contexte)
2. [Objectif](#2-objectif)
3. [Périmètre](#3-périmètre)
4. [Référentiels utilisés](#4-référentiels-utilisés)
5. [Le constat en une page](#5-le-constat-en-une-page)
6. [Métier 1 — Développeur](#6-métier-1--développeur)
7. [Métier 2 — Expert cybersécurité](#7-métier-2--expert-cybersécurité)
8. [Métier 3 — Ingénieur DevOps](#8-métier-3--ingénieur-devops)
9. [Métier 4 — Juriste et DPO](#9-métier-4--juriste-et-dpo)
10. [Les neuf scénarios d'attaque réalistes aujourd'hui](#10-les-neuf-scénarios-dattaque-réalistes-aujourdhui)
11. [Séquencement proposé](#11-séquencement-proposé)
12. [Critères de sortie — la définition d'« inattaquable »](#12-critères-de-sortie--la-définition-dinattaquable)
13. [Décisions à trancher](#13-décisions-à-trancher)
14. [Ce qu'il ne faut pas faire](#14-ce-quil-ne-faut-pas-faire)
15. [Notes pour les deux Cursor](#15-notes-pour-les-deux-cursor)
16. [Liste maîtresse — inventaire opposable de tout ce qui manque](#16-liste-maîtresse--inventaire-opposable-de-tout-ce-qui-manque)

---

## 1. Contexte

Le chantier Organe d'Orchestration (E0 → E8) a livré un backend structuré, testé et outillé. L'étape E0 a réglé une grande partie des risques d'infrastructure : secrets obligatoires, arrêt au démarrage si la configuration est invalide, liste blanche CORS, bac à sable interdit en production, limitation de débit, coffre chiffré pour les identifiants d'éditeurs.

Cette fiche part d'un audit complet mené le 26/07/2026 sur l'ensemble du dépôt, croisant cinq référentiels. Elle constate que **le progrès est réel mais déséquilibré** : Ma Zone protège aujourd'hui mieux les secrets d'un commerçant que le compte d'un habitant.

L'explication n'est pas une faute. Chaque chantier a traité rigoureusement les risques de son périmètre. Le cycle de vie des comptes citoyens — mot de passe, session, effacement, information — n'a simplement jamais été le périmètre d'aucun chantier depuis le début du projet.

**Compléments du 26/07 soir** (désormais dans le DOSSIER-COMPLET, parties 3–4 et 1) : revue « surfaces exposables » (six P0 dont `labToken`), inventaire champ-par-champ des entrées, plan de mise en sécurité densifié. Les anciens fichiers numérotés sont archivés dans `CHANTIER/conformite-reglementaire/archive-fragments/`.

---

## 2. Objectif

Établir la **liste exhaustive et opposable** de ce qui manque pour que Ma Zone soit défendable devant quatre interlocuteurs différents :

- un développeur qui reprend le code,
- un expert en sécurité qui cherche une faille,
- un ingénieur d'exploitation qui doit tenir le service debout,
- un juriste ou un délégué à la protection des données qui vérifie la conformité.

« Inattaquable » ne signifie pas « invulnérable » — cela n'existe pas. Cela signifie : **aucun de ces quatre interlocuteurs ne peut pointer un manquement connu et non traité.**

---

## 3. Périmètre

### Inclus

- `mobile/` et `backend/` — produit officiel
- `admin-web/` — outil interne traitant des données réelles
- `src/` et `supabase/` — legacy web, tant qu'il reste dans le dépôt
- Chaîne d'intégration continue, exploitation, documentation juridique

### Hors périmètre explicite

- Test d'intrusion réel — cet audit est une revue, pas un pentest
- Certification ASVS par un tiers
- Rédaction juridique définitive — les gabarits `docs/legal/` doivent être validés par un avocat
- Statut social des livreurs — relève du conseil en droit du travail
- Accessibilité (European Accessibility Act) — chantier distinct
- Toute modification de code : cette fiche décrit, elle n'exécute pas

---

## 4. Référentiels utilisés

| Référentiel | Volume | Usage |
|-------------|--------|-------|
| Guide RGPD du développeur (CNIL) | 18 fiches | Grille de conformité principale |
| **OWASP ASVS 5.0.0 (version française)** | **345 exigences, 17 chapitres** | Niveau L2 visé |
| OWASP Cheat Sheet Series | ~120 fiches | Remédiation technique |
| ANSSI — standards de sécurité côté navigateur v2.0 | R1 à R63 | Surfaces web |
| LCEN, Code de la consommation, DSA | — | Obligations d'affichage et de plateforme |
| Principes de conception logicielle (Florat, M1 MIAGE) | — | Qualité, tests, découpage |

Le choix du **niveau L2** de l'ASVS n'est pas une ambition : la norme le prescrit dès qu'une application traite des données personnelles ou des transactions. Ma Zone traite identité, adresses, géolocalisation, messagerie privée et commandes.

---

## 5. Le constat en une page

| Ce qui est solide | Ce qui est absent |
|-------------------|-------------------|
| Secrets obligatoires, arrêt au démarrage sinon | Politique de mot de passe |
| Liste blanche CORS en production | Changement de mot de passe |
| Contrôle d'accès sur les commandes, testé | Récupération de compte |
| Coffre AES-256-GCM, purge au débranchement | Révocation de session |
| HMAC à temps constant sur les webhooks | Contrôle d'accès sur la messagerie |
| 349 tests, lois d'architecture vérifiées en CI | Filtrage des fichiers téléversés |
| Bac à sable interdit en production | Journalisation des événements de sécurité |
| Séparation en couches, OpenAPI vérifiée | Suppression de compte et export de données |
| Documentation d'architecture tenue à jour | Tout le corpus juridique |
| Aucun secret serveur dans les bundles clients | Fermeture des surfaces de laboratoire en production |
| Signature et anti-rejeu des webhooks | Limites de longueur sur les saisies |

**Dix-huit écarts sont bloquants** — douze issus de la revue de code, six de la revue des surfaces exposables. Ils sont listés métier par métier ci-dessous, récapitulés au chapitre 12, et inventoriés exhaustivement au chapitre 16.

---

## 6. Métier 1 — Développeur

Ce qu'un développeur reprenant le code doit trouver, et ne trouve pas aujourd'hui.

### 6.1 Fonctionnalités de compte absentes

Ce sont des manques **produit** autant que sécurité. Aucune application grand public ne peut s'en passer.

| # | Manque | Conséquence concrète |
|---|--------|----------------------|
| D1 | Changement de mot de passe | Un utilisateur dont le mot de passe a fuité ne peut rien faire |
| D2 | Récupération de mot de passe oublié | Compte définitivement perdu, données orphelines |
| D3 | Vérification d'adresse email | Inscription avec l'email d'un tiers ; aucune preuve de contact |
| D4 | Suppression de compte | Droit à l'effacement inexercable |
| D5 | Export de ses données | Droit à la portabilité inexercable |
| D6 | Écran de paramètres réel | `SettingsScreen.js` est un gabarit vide |

**Prérequis technique commun à D2 et D3 :** aucun service d'envoi d'email n'est branché. Ce choix est à faire (voir chapitre 13) et créera un sous-traitant à inscrire au registre.

### 6.2 Validation des entrées

- **Constat :** validation artisanale dans chaque route (`if (!email || !password)`), aucune bibliothèque de schéma.
- **Ce qui manque :** des schémas déclaratifs (Zod ou équivalent) sur l'authentification, les commandes, les intentions `/api/v1` et les métadonnées de téléversement.
- **Pourquoi c'est un sujet de développeur et pas seulement de sécurité :** aujourd'hui, le contrat d'entrée d'une route n'est lisible nulle part ailleurs que dans son corps. L'OpenAPI décrit `/api/v1` mais rien ne garantit que le code s'y conforme à l'exécution.
- **Référence :** ASVS V2.1.1 et V2.2.1, chapitre « spécifications exécutables » du support de conception.

### 6.3 Tests

| Couverture | État |
|------------|------|
| Backend — orchestration, intégrations, stock, commandes | 349 tests, solide |
| Backend — contrôle d'accès | `test/security/access.test.js`, ciblé mais partiel |
| Backend — messagerie legacy, téléversements, inscription | **Aucun test** |
| Mobile | **Aucun harnais de test** — dette déjà reconnue en FD-002 |
| Bout en bout | Aucun |

**Ce qui manque :** des tests de non-régression sur chaque correctif de cette fiche. Un correctif d'autorisation sans test qui prouve le refus est un correctif qui régressera au prochain remaniement.

### 6.4 Dette structurelle qui touche la conformité

- **Une commande égale un produit** (pas de table `order_items`) — dette la plus lourde selon FD-002. Impact conformité : la facturation, la rétractation et la conservation comptable supposent une commande multi-lignes.
- **Journaux append-only** (`identity_events`, `order_journal`, `integration_inbox`) — excellents pour l'audit, mais incompatibles en l'état avec le droit à l'effacement. Il faut une stratégie d'anonymisation des identifiants plutôt qu'une suppression de lignes.
- **Deux surfaces d'API en parallèle** jusqu'au 31/01/2027 — chaque correctif de sécurité doit être appliqué **des deux côtés** tant que `/api` vit. La route `messages.js` en est l'illustration : `/api/v1` et `/api/conversations` sont protégés, l'ancienne route ne l'est pas.

### 6.5 Ce que le développeur doit produire

- [ ] Routes de changement et de réinitialisation de mot de passe
- [ ] Vérification d'email à l'inscription
- [ ] `DELETE /api/users/me` avec cascade et anonymisation documentée
- [ ] `GET /api/users/me/export` produisant un JSON portable
- [ ] Écran Paramètres et Confidentialité dans le mobile
- [ ] Schémas de validation sur les routes sensibles
- [ ] Tests couvrant chaque correctif de sécurité de cette fiche
- [ ] Stratégie d'anonymisation pour les journaux append-only

---

## 7. Métier 2 — Expert cybersécurité

### 7.1 Les quatre écarts que je considère comme exploitables aujourd'hui

#### C1 — Messagerie de commande sans contrôle d'accès

- **Constat :** `backend/src/routes/messages.js` L8-17 et L20-39. `verifyToken` seul, aucun appel à `canViewOrder`, alors que la fonction existe et est correctement utilisée dans `routes/orders.js`.
- **Pourquoi c'est vulnérable :** tout compte inscrit peut lire l'intégralité d'une conversation privée entre un client, un commerçant et un livreur — la requête joint la table `users`, donc les noms d'expéditeurs remontent aussi. Il peut également écrire dans cette conversation et diffuser le message dans le salon temps réel. Les identifiants de commande sont devinables, donc l'énumération est triviale.
- **Ce que fera la nouvelle version :** appel à `canViewOrder(req.user, orderId)` en tête des deux routes, réponse 404 en cas de refus (et non 403, pour ne pas confirmer l'existence de la commande), puis dépréciation de la route au profit de `/api/conversations`.
- **Référentiel :** ASVS V8.2.2, OWASP Insecure Direct Object Reference, CNIL fiche 8.
- **Gravité :** **P0 — écart le plus grave de l'audit.**

#### C2 — Téléversements non filtrés, servis sans authentification

- **Constat :** multer sans `fileFilter` dans `users.js`, `stores.js`, `products.js` ; `file.originalname` conservé dans le nom final ; `app.js` L165 sert `backend/uploads` en statique sans contrôle.
- **Pourquoi c'est vulnérable :** trois problèmes cumulés. Un utilisateur peut déposer un SVG porteur de JavaScript à la place d'une photo, servi ensuite depuis le domaine de confiance. Un nom de fichier soumis peut contenir des séquences de traversée. Et toutes les photos de profil sont accessibles à qui connaît l'URL — un traitement de données personnelles sans aucun contrôle d'accès.
- **Ce que fera la nouvelle version :** liste blanche de types réels (JPEG, PNG, WebP) vérifiée sur le contenu et non sur l'en-tête déclaré, nom régénéré en UUID avec extension dérivée côté serveur, et service via route authentifiée ou URL signée à durée limitée.
- **Référentiel :** ASVS V5.2.2, V5.3.1, V5.3.2 ; OWASP File Upload.
- **Gravité :** P0.

#### C3 — Cycle de vie du mot de passe inexistant

- **Constat :** `routes/auth.js` L13-21 ne valide que la présence du champ. Aucune longueur minimale, aucune route de changement, aucune réinitialisation.
- **Pourquoi c'est vulnérable :** un compte peut exister avec le mot de passe `a`. La limitation de débit à 10 requêtes par minute ralentit une attaque en ligne mais ne protège rien contre un mot de passe trivial ou déjà présent dans une fuite publique. Et une fois compromis, le compte ne peut pas être récupéré par son propriétaire.
- **Ce que fera la nouvelle version :** minimum 8 caractères imposé côté serveur, cible recommandée 12 à 15, **sans** règle de composition — l'ASVS V6.2.5 les interdit explicitement car elles produisent des mots de passe prévisibles. Plus une vérification contre une liste de mots de passe compromis, et les parcours de changement et de réinitialisation.
- **Référentiel :** ASVS V6.2.1 à V6.2.4, V6.4.1 ; recommandations CNIL sur les mots de passe.
- **Gravité :** P0.

#### C4 — Déconnexion sans révocation

- **Constat :** jeton émis pour **30 jours** (`auth.js` L35 et L52), vérification purement cryptographique dans `middleware/auth.js`, aucune liste de révocation. La déconnexion efface le stockage local du téléphone et rien d'autre.
- **Pourquoi c'est vulnérable :** un jeton capturé avant la déconnexion — téléphone prêté ou volé, sauvegarde non chiffrée, interception sur le réseau local en HTTP — reste valide jusqu'à trente jours. La déconnexion rassure sans protéger. Et le jour où la suppression de compte existera, elle sera fictive tant que les jetons émis survivront.
- **Ce que fera la nouvelle version :** table de sessions ou liste de révocation consultée à chaque vérification, alimentée par la déconnexion, le changement de mot de passe et la suppression de compte ; durée de vie du jeton d'accès réduite avec jeton de rafraîchissement.
- **Référentiel :** ASVS V7.4.1 et V7.4.2.
- **Gravité :** P0.

### 7.1 bis — Les trois portes ouvertes par conception

Ces écarts ne sont pas des bugs. Le code fait exactement ce qu'il a été écrit pour faire. Le problème est que ce comportement est inacceptable en dehors d'un poste de développement, et que rien ne l'empêche d'en sortir. Détail : DOSSIER-COMPLET, **Partie 3**.

#### C13 — Injection de session par deep link (`labToken`)

- **Constat :** `mobile/src/context/AppContext.js` L10-18, L119-127, L172-196 et `mobile/src/utils/labToken.js` L10-29. L'application ouvre une session complète à partir d'un jeton reçu dans une URL — `mazone://lab?labToken=<JWT>` sur mobile, `#labToken=<JWT>` en mode web. La seule validation est un appel à `GET /api/users/me` : **tout jeton que le backend accepte fonctionne**. Aucune garde `__DEV__`, rien qui distingue un jeton de laboratoire d'un jeton volé.
- **Pourquoi c'est vulnérable :** cela transforme n'importe quel jeton obtenu par un autre moyen — hameçonnage, journal système, sauvegarde d'appareil, interception en HTTP — en session utilisable en un clic. Dans l'autre sens, un lien piégé envoyé à une victime la place dans une session que l'attaquant contrôle, et il observe ensuite tout ce qu'elle y saisit. Le mécanisme est un outil interne compilé dans le build livré.
- **Ce que fera la nouvelle version :** suppression complète du mécanisme dans les builds de production, et, si le laboratoire doit survivre, jeton d'imitation marqué côté serveur (`imp: true`, durée courte, usage unique) refusé par un build de production.
- **Référentiel :** ASVS V7.2, V13.4.1.
- **Gravité :** **P0 — écart le plus grave de tout l'audit, devant C1.**

#### C14 — Authentification web contournée par défaut

- **Constat :** `src/lib/supabase/config.ts` L1-9, `src/lib/supabase/middleware.ts` L11-12, `src/app/(auth)/connexion/page.tsx` L36-39. Sans les variables `NEXT_PUBLIC_SUPABASE_*`, le middleware ne vérifie rien, les champs du formulaire cessent d'être obligatoires, et un clic ouvre l'espace choisi. Le rôle se sélectionne par trois boutons. Même **avec** Supabase configuré, le middleware ne contrôle que la présence d'une session, jamais le rôle, et `getMerchantOrders` (`src/lib/data.ts` L386-391) ne filtre pas par commerçant.
- **Pourquoi c'est vulnérable :** ce n'est pas un contournement à découvrir, c'est le comportement par défaut d'un déploiement sans configuration — exactement ce qui arrive quand on déploie « pour voir ». `vercel.json` est déjà dans le dépôt.
- **Ce que fera la nouvelle version :** refus de démarrer en production sans configuration d'authentification, sur le modèle du `fail-fast` déjà en place dans `backend/src/config/env.js` ; mode démonstration activable uniquement par variable explicite ; contrôle de rôle dans le middleware. Ou, plus simplement, retrait du site legacy du dépôt.
- **Référentiel :** ASVS V13.4.1, V8.2.1.
- **Gravité :** P0 tant que `src/` reste déployable.

#### C15 — Identifiants d'administration livrés dans le bundle

- **Constat :** `admin-web/src/pages/LoginPage.jsx` L5-6 et L46-48 — `admin@mazone.local` / `admin1234` préremplis **et affichés à l'écran**. Mêmes valeurs par défaut dans `backend/scripts/create-admin.js` L7-8. Par ailleurs, `POST /api/admin/auth/login` ne bénéficie **pas** du limiteur strict monté sur `/api/auth` (`backend/src/app.js` L185), et Vite écoute sur toutes les interfaces (`admin-web/vite.config.js` L6, `host: true`).
- **Pourquoi c'est vulnérable :** le compte le plus privilégié du système a un identifiant public, un mot de passe public, et trois cents tentatives de connexion autorisées par minute. Sur un réseau partagé, la console est atteignable par toute machine du réseau.
- **Ce que fera la nouvelle version :** champs vides, mention retirée, refus serveur d'un mot de passe administrateur par défaut en production, limiteur strict sur la connexion administrateur, et écoute sur `127.0.0.1` par défaut.
- **Référentiel :** ASVS V6.3.1, V6.3.2, V13.4.
- **Gravité :** P0 — le correctif du limiteur tient en deux lignes.

### 7.2 Durcissements attendus

| # | Sujet | Constat | Attendu |
|---|-------|---------|---------|
| C5 | Algorithme JWT non contraint | `jwt.verify(token, secret)` sans option `algorithms` (`middleware/auth.js` L10, `socket/handlers.js` L13) | `{ algorithms: ['HS256'] }` — la version actuelle de la bibliothèque protège par défaut, mais l'application ne doit pas dépendre d'un comportement implicite |
| C6 | Auto-attribution de rôle | `auth.js` L16-18 autorise `merchant` et `driver` à l'inscription | Inscription publique en `client` seulement ; élévation par invitation ou validation |
| C7 | Second facteur pour l'administration | Absent | Second facteur sur `admin_users` — ces comptes peuvent usurper une identité citoyenne en bac à sable |
| C8 | Liste blanche de destinations sortantes | Le connecteur Shopify valide strictement son domaine (`^[a-z0-9][a-z0-9-]*\.myshopify\.com$`), mais le transport générique `integration/http.js` n'impose rien | Liste blanche au niveau du moteur, en défense en profondeur — un futur connecteur moins rigoureux ouvrirait une falsification de requête côté serveur |
| C9 | Énumération de comptes | `/register` répond 409 « Email déjà utilisé » | Réponse indifférenciée, ou acceptation du compromis si l'ergonomie prime — mais de façon documentée |
| C10 | Rotation des secrets | Aucune ; changer la clé du coffre oblige à rebrancher les boutiques (dette assumée dans `secrets.js`) | Procédure de rotation documentée, puis outillée |
| C11 | Stockage du jeton sur mobile | AsyncStorage, non chiffré, avec le profil complet | `expo-secure-store` (Keychain et Keystore), et profil minimal |
| C12 | Politique de divulgation de vulnérabilité | Absente | `security.txt` et adresse de contact — permet un signalement responsable plutôt qu'une publication |

### 7.3 Ce que l'expert sécurité doit obtenir

- [ ] Les sept écarts P0 corrigés et couverts par des tests — C1 à C4 (défauts de code) **et** C13 à C15 (portes ouvertes par conception)
- [ ] Durcissements C5 à C12 planifiés
- [ ] Écarts de surface S-05 à S-21 traités ou explicitement acceptés par écrit
- [ ] Un test d'intrusion externe avant l'ouverture publique
- [ ] Une modélisation de menace documentée pour les parcours commande, messagerie et intégration
- [ ] Une revue de sécurité systématique sur tout nouveau chantier touchant l'authentification ou les données personnelles

---

## 8. Métier 3 — Ingénieur DevOps

Le runbook d'étape 0 est un bon document et il faut le dire : il distingue correctement ce que le code fait de ce qu'un humain doit faire. Les manques ci-dessous sont ceux de sa **partie non exécutée**.

### 8.1 Rien n'est déployé, donc rien n'est prouvé

| # | Manque | Conséquence |
|---|--------|-------------|
| O1 | Aucun hébergeur choisi | Décision ouverte depuis FD-000 ; bloque le registre des traitements, les mentions légales et le contrat de sous-traitance |
| O2 | Pas de TLS ni de WSS | Le backend écoute en HTTP ; jetons et messages circulent en clair sur le réseau local |
| O3 | Volume persistant non provisionné | SQLite est un fichier ; un conteneur sans volume perd la base au redémarrage |
| O4 | Sauvegarde jamais restaurée | Le script `backup-db.js` existe et vérifie l'intégrité, mais une sauvegarde non testée en restauration n'est pas une sauvegarde |
| O5 | Aucune expédition de journaux | `ERROR_TRACKING_DSN` est prévu, non branché — ASVS V16.4.3 |
| O6 | Aucune alerte | `/health` existe mais personne ne le surveille |

### 8.2 Limites d'architecture connues, à surveiller

Ces points sont **documentés et assumés** en FD-002 et dans le runbook. Ils ne sont pas des fautes, mais ils doivent avoir un déclencheur de réexamen écrit.

- SQLite mono-instance, un seul écrivain — seuil annoncé : 200 messages en attente de façon soutenue.
- Pas d'adaptateur Redis pour Socket.io — passer à deux instances casserait les salons.
- Minuteurs de répartition en mémoire — une offre peut rester bloquée après redémarrage.

### 8.3 Chaîne d'intégration continue

L'existant est remarquable sur un point rare : la CI vérifie des **lois d'architecture** (absence de SDK tiers dans les organes, confinement du dialecte d'éditeur, un seul écrivain du stock, absence de secret en dur). Peu de projets font cela.

Ce qui manque relève de la sécurité de la chaîne :

| # | Manque | Référentiel |
|---|--------|-------------|
| O7 | Aucun audit de dépendances (`npm audit` ou équivalent) | ASVS V15.2.1, CNIL fiche 9 |
| O8 | Pas de Dependabot ni de mise à jour automatisée | ASVS V15.1.1 |
| O9 | Pas de nomenclature logicielle (SBOM) | OWASP Dependency Graph |
| O10 | Pas d'analyse statique de sécurité | Bonne pratique |
| O11 | Délai de correction des vulnérabilités non défini | ASVS V15.1.1 — il faut écrire « critique sous 7 jours, élevée sous 30 » |
| O12 | Actions GitHub non épinglées par empreinte | OWASP CI/CD Security |

### 8.4 Exploitation

- [ ] Procédure d'astreinte et d'escalade
- [ ] Objectifs de reprise après incident chiffrés (durée d'interruption et perte de données maximales acceptables)
- [ ] Séparation stricte des environnements et des secrets entre développement, recette et production
- [ ] Vérification que le dossier `.git` n'est pas déployé (ASVS V13.4.1)
- [ ] Journal des accès administrateur à l'infrastructure

---

## 9. Métier 4 — Juriste et DPO

C'est le domaine le moins avancé du projet : **rien n'existe**. Aucune mention légale, aucune politique de confidentialité, aucune condition générale, aucun registre avant cet audit.

### 9.1 Documents à publier

Sept gabarits ont été produits dans `docs/legal/` (plus un README d'index). Ils contiennent des champs variables tant que l'entité n'est pas immatriculée. Le registre (huitième pièce) est dans le DOSSIER-COMPLET, **Partie 8**.

| # | Document | État | Bloquant pour |
|---|----------|------|---------------|
| J1 | Mentions légales | Gabarit | Toute mise en ligne — obligation LCEN |
| J2 | Politique de confidentialité | Gabarit | Toute collecte — RGPD art. 12 à 14 |
| J3 | Conditions générales d'utilisation | Gabarit | Ouverture des comptes |
| J4 | Conditions générales de vente (intermédiation) | Gabarit | Première transaction |
| J5 | Politique cookies | Gabarit | Avant tout traceur non exempté |
| J6 | Procédure de violation de données | Gabarit | Doit exister **avant** l'incident |
| J7 | Procédure d'exercice des droits | Gabarit | Première demande d'un utilisateur |
| J8 | Registre des traitements (`CHANTIER/`) | Rédigé — 9 traitements | Obligation art. 30 |

### 9.2 Informations à fournir pour compléter les gabarits

Raison sociale, forme juridique, capital, siège, numéro SIREN et RCS, numéro de TVA, directeur de la publication, hébergeur, médiateur de la consommation, adresse de contact, délégué à la protection des données le cas échéant.

### 9.3 Ce qui manque dans le produit lui-même

| # | Manque | Fondement |
|---|--------|-----------|
| J9 | Information à la collecte lors de l'inscription | RGPD art. 13 |
| J10 | Acceptation tracée et horodatée des documents | RGPD art. 7, preuve du consentement |
| J11 | Liens vers les documents dans l'interface | LCEN — accessibilité facile |
| J12 | Durées de conservation définies et appliquées | RGPD art. 5-1-e |
| J13 | Information du commerçant avant branchement d'un logiciel tiers | RGPD art. 13 — l'écran actuel montre les autorisations demandées mais pas les finalités Ma Zone |
| J14 | Âge minimum et contrôle | RGPD art. 8 — 15 ans en France |
| J15 | Mention de l'usage de la géolocalisation | Transparence |

### 9.4 Contrats et gouvernance

| # | Manque | Fondement |
|---|--------|-----------|
| J16 | Contrats de sous-traitance avec l'hébergeur et les prestataires | RGPD art. 28 |
| J17 | Documentation des transferts hors Union européenne (éditeurs, cartographie) | RGPD chapitre V |
| J18 | Registre des violations de données | RGPD art. 33-5 |
| J19 | Analyse d'impact ou décision motivée de ne pas en faire | RGPD art. 35 |
| J20 | Désignation d'un délégué ou décision motivée de ne pas en désigner | RGPD art. 37 |
| J21 | Traçabilité des professionnels vendeurs | Règlement sur les services numériques |
| J22 | Obligations déclaratives fiscales des plateformes | À vérifier avec un conseil |
| J23 | Assurance responsabilité civile professionnelle | Bonne pratique, souvent exigée par les partenaires |
| J24 | Modèle de commission formalisé | Le code applique déjà 5 % au livreur sans document contractuel |

### 9.5 Le point qui mérite une décision rapide

**L'analyse d'impact (J19).** Ma Zone combine plusieurs facteurs que la CNIL considère comme déclencheurs : traitement d'adresses et de coordonnées, messagerie privée, ciblage par distance, et — dès que le suivi des livreurs sera activé — géolocalisation de travailleurs. Il ne s'agit pas d'affirmer qu'une analyse d'impact est obligatoire : il s'agit de constater qu'on ne peut pas mettre en production sans avoir tranché la question par écrit.

---

## 10. Les neuf scénarios d'attaque réalistes aujourd'hui

Formulés comme un attaquant les formulerait, à partir des écarts constatés. Les cinq premiers viennent de la revue de code, les quatre suivants de la revue des surfaces exposables.

1. **Je crée un compte gratuit et je lis les conversations des autres.** J'énumère les identifiants de commande sur `/api/messages/:orderId`. Je récupère les noms, les échanges, le contexte des livraisons. Aucune trace n'est laissée puisque les refus d'autorisation ne sont pas journalisés — et il n'y a même pas de refus.

2. **Je dépose un fichier actif sur le domaine de confiance.** Je téléverse un SVG contenant du script en guise de photo de profil. Il est servi depuis le même domaine que l'API, sans authentification, avec un nom que j'ai partiellement choisi.

3. **J'attends qu'un téléphone soit prêté ou revendu.** Le jeton reste valide trente jours, la déconnexion ne révoque rien, et il est stocké en clair dans AsyncStorage avec le profil complet.

4. **Je devine les mots de passe faibles.** Rien n'impose de longueur minimale. Je cible les adresses obtenues par le scénario 1. Et si je compromets un compte, son propriétaire ne peut ni changer son mot de passe ni supprimer son compte.

5. **J'écoute le réseau local pendant une démonstration.** Le backend est en HTTP. Je récupère les jetons et le contenu des messages en clair.

6. **J'envoie un lien à ma victime.** Un simple `mazone://lab?labToken=<jeton>` la bascule dans une session que je contrôle. Elle continue d'utiliser l'application sans rien remarquer, et je vois tout ce qu'elle y fait. Dans l'autre sens, si j'ai obtenu un jeton par le scénario 3 ou 5, ce lien me le transforme en session en un clic.

7. **Je cherche le déploiement de démonstration.** Le site Next.js déployé sans variables Supabase — le cas par défaut — me laisse entrer dans l'espace commerçant ou livreur en cliquant sur un bouton, sans mot de passe.

8. **Je lis le mot de passe administrateur sur l'écran de connexion.** Il y est affiché. Et si le compte a été changé, j'ai droit à trois cents essais par minute, sans verrouillage, sur un nom d'utilisateur que je connais.

9. **Je remplis la base.** Aucun champ n'a de limite de longueur. J'envoie des descriptions de boutique d'un mégaoctet en boucle. La base SQLite grossit, chaque lecture ralentit, l'affichage casse pour tout le monde. Cela ne me coûte rien.

Les scénarios se combinent : le premier fournit les cibles, le quatrième les comptes, le second la persistance, et le sixième transforme n'importe quel jeton obtenu ailleurs en accès direct. Le scénario 6 est le plus préoccupant parce qu'il ne demande **aucune faille** — seulement un lien.

---

## 11. Séquencement proposé

### Vague 0 — Fermer ce qui est ouvert par conception (à faire en premier, avant même la vague 1)

Ces cinq actions sont de très faible ampleur — quelques lignes chacune, aucune conception à faire — et elles ferment les portes les plus larges.

0.1. Supprimer `labToken` du build de production (C13)  
0.2. Vider les identifiants de `LoginPage.jsx` et retirer la mention affichée (C15)  
0.3. Appliquer le limiteur strict à `POST /api/admin/auth/login` (C15)  
0.4. Faire échouer le démarrage du site Next.js en production sans configuration d'authentification — ou retirer `src/` du dépôt (C14)  
0.5. Ramener les serveurs de développement sur `127.0.0.1` (S-05)

Elles lèvent les scénarios 6, 7 et 8.

### Vague 1 — Fermer les portes (avant toute exposition, même en bêta fermée)

1. Contrôle d'accès sur `/api/messages`
2. Filtrage et service authentifié des téléversements
3. Politique de mot de passe côté serveur
4. Liste blanche d'algorithmes sur les trois vérifications de jeton
5. Inscription en `client` uniquement
6. Limites de longueur côté serveur sur tous les champs texte (S-06)
7. Échappement du libellé dans les marqueurs de carte (S-15)
8. Contrôle du statut sur `GET /api/events/:id` (S-11)

Ces correctifs sont de faible ampleur et lèvent les scénarios 1, 2, 4 et 9.

### Vague 2 — Rendre les comptes vivables

6. Changement de mot de passe
7. Révocation de session
8. Choix d'un prestataire d'envoi d'email, puis réinitialisation et vérification d'adresse
9. Suppression de compte et export des données
10. Écran Paramètres et Confidentialité

### Vague 3 — Publier le corpus juridique

11. Immatriculation puis remplissage des sept gabarits
12. Information et acceptation à l'inscription, avec traçabilité
13. Durées de conservation arrêtées puis appliquées

### Vague 4 — Tenir le service

14. Hébergement, TLS, WSS, volume persistant
15. Restauration de sauvegarde testée pour de vrai
16. Expédition des journaux, alertes, journalisation des événements de sécurité
17. Audit de dépendances et délai de correction dans la CI

### Vague 5 — Prouver

18. Test d'intrusion externe
19. Analyse d'impact si la décision est positive
20. Validation juridique du corpus par un avocat

---

## 12. Critères de sortie — la définition d'« inattaquable »

Ma Zone pourra être considérée comme défendable quand ces dix-huit affirmations seront vraies **et vérifiables**.

### Développeur

1. Un utilisateur peut changer son mot de passe, récupérer son compte, l'exporter et le supprimer.
2. Chaque correctif de sécurité de cette fiche est couvert par un test qui échoue si on le retire.
3. Les entrées des routes sensibles sont validées par un schéma déclaratif.

### Cybersécurité

4. Aucun compte ne peut accéder à une ressource dont il n'est pas partie — messagerie incluse.
5. Aucun fichier non-image ne peut être déposé, et aucun fichier n'est servi sans contrôle d'accès.
6. Un mot de passe trivial est refusé, et une session déconnectée ne fonctionne plus.
7. Un test d'intrusion externe a été mené et ses conclusions traitées.

### DevOps

8. Le service tourne derrière TLS, avec WSS pour le temps réel.
9. Une sauvegarde a été restaurée avec succès au moins une fois.
10. Les journaux partent vers un système distinct, et une alerte se déclenche si le service tombe.
11. La CI refuse une dépendance présentant une vulnérabilité critique.

### Juriste et DPO

12. Les mentions légales, la politique de confidentialité et les conditions générales sont accessibles depuis l'application, sans champ variable non rempli.
13. L'utilisateur est informé à la collecte, et son acceptation est tracée.
14. Chaque catégorie de données a une durée de conservation appliquée par du code.
15. Le registre est à jour, les contrats de sous-traitance sont signés, et la question de l'analyse d'impact est tranchée par écrit.

### Surfaces exposables

16. Aucun build de production ne contient d'outil de laboratoire, de mode démonstration implicite ni d'identifiant par défaut.
17. Aucune saisie utilisateur n'atteint la base sans limite de longueur ni contrôle de type.
18. Aucune donnée n'est envoyée vers un domaine tiers non déclaré au registre, y compris par le chargement d'une image.

---

## 13. Décisions à trancher

Détail et cases à cocher : DOSSIER-COMPLET, **Partie 2**.

| # | Décision | Qui | Bloque |
|---|----------|-----|--------|
| 1 | Hébergeur et socle de données en production | Adam et Reda | Registre, mentions, sous-traitance |
| 2 | Prestataire d'envoi d'email | Adam et Reda | Réinitialisation, vérification, notifications |
| 3 | Base légale du ciblage par distance | Adam | Politique de confidentialité, consentement |
| 4 | Âge minimum d'inscription | Adam | Conditions générales, contrôle |
| 5 | Analyse d'impact : oui, non, ou après bêta | Adam et conseil | Mise en production |
| 6 | Durées de conservation par catégorie | Adam | Purges, politique |
| 7 | Inscription commerçant et livreur : ouverte ou validée | Adam | Correctif C6 |
| 8 | Identité de l'éditeur pour les champs variables | Adam | Les sept documents juridiques |
| 9 | **Sort du site Next.js legacy** : le retirer du dépôt ou le corriger comme le reste | Adam et Reda | S-02, S-03, S-15, S-16, S-17, S-18 |
| 10 | Sort du mécanisme `labToken` : suppression pure ou jeton d'imitation marqué côté serveur | Adam et Reda | S-01 |

---

## 14. Ce qu'il ne faut pas faire

- **Déployer publiquement avant les vagues 0 et 1.** Les scénarios 1 à 4 sont exploitables par un utilisateur ordinaire, sans outil ; les scénarios 6 à 8 n'exigent même pas de compte.
- **Considérer que « hors périmètre » protège de quoi que ce soit.** Le site Next.js est déclaré hors produit par FD-000, et il porte pourtant trois des six P0 de surface. Du code déployable et vulnérable reste déployable et vulnérable, quelle que soit la mention documentaire qui l'accompagne. Seules la suppression ou la correction protègent.
- **Laisser un outil de laboratoire dans un build de production.** `labToken` a été écrit pour le confort du Bac à Sable ; il constitue aujourd'hui l'écart le plus grave de l'audit.
- **Publier les gabarits juridiques tels quels.** Ils contiennent des champs variables et n'ont pas été validés par un avocat.
- **Traiter cette fiche comme un audit certifiant.** C'est une revue de code et de documentation, pas un test d'intrusion ni une certification ASVS.
- **Corriger `/api/v1` en oubliant `/api`.** Les deux surfaces vivent jusqu'au 31/01/2027 ; l'écart sur `messages.js` vient exactement de là.
- **Ajouter un outil de mesure d'audience avant d'avoir une gestion du consentement.** L'absence actuelle de tout traceur est un atout — il ne faut pas le perdre par inadvertance.
- **Considérer que le coffre chiffré des intégrations couvre le sujet « sécurité ».** Il couvre remarquablement bien les secrets d'éditeurs, et rien d'autre.

---

## 15. Notes pour les deux Cursor

- **Document unique d’audit :** `CHANTIER/conformite-reglementaire/DOSSIER-COMPLET-conformite-reglementaire.md` (Parties 0→10). Ne pas renvoyer Reda vers les fragments archivés.
- **Avant tout partage d'un lien de démonstration** — réseau de coworking, salon, visioconférence, capture d'écran publiée — vérifier que la vague 0 (Partie 1 du dossier) est faite. Aujourd'hui, montrer l'application sur un réseau partagé revient à en donner les clés.
- **Format imposé** pour tout correctif de sécurité, dans le code comme dans les messages de commit : *pourquoi c'était vulnérable* puis *ce que fait la nouvelle version*. La méthode est décrite dans `docs/METHODE-AUDIT-CONFORMITE-APP.md` § 3.1.
- **Ne pas contredire les 17 lois d'architecture** de la roadmap Orchestration en corrigeant. En particulier, un correctif d'autorisation se place dans `lib/access.js` ou dans l'organe concerné, jamais dans un connecteur.
- **Toute nouvelle collecte de données** doit être ajoutée au registre (DOSSIER-COMPLET Partie 8) dans le même travail que le code, pas après.
- **Cette fiche est un brouillon.** Elle demande validation d'Adam avant de devenir opposable, et une ligne dans `INDEX.md`.

---

## 16. Liste maîtresse — inventaire opposable de tout ce qui manque

Liste **unique et exhaustive** à cocher pour qu’aucun des quatre métiers ne puisse pointer un manquement connu non traité.  
Chaque item est soit **Absent**, soit **Partiel**. Les items déjà OK (coffre, CORS prod, ACL commandes, helmet, rate-limit, CI lois, etc.) **ne figurent pas** ici.

Légende priorité : **P0** = avant toute exposition · **P1** = avant ouverture publique · **P2** = avant échelle / certification.

### 16.1 Développeur — compte, validation, tests, dette

| ID | Manque | Priorité | Réf. |
|----|--------|----------|------|
| D-01 | Politique de longueur minimale de mot de passe **côté serveur** (≥ 8, cible 12–15, sans règles de composition) | P0 | ASVS V6.2.1 |
| D-02 | Route de **changement** de mot de passe (ancien + nouveau) | P0 | ASVS V6.2.2 |
| D-03 | Parcours **mot de passe oublié** (jeton à usage unique + email) | P0 | ASVS V6.4.1 |
| D-04 | **Vérification d’email** à l’inscription | P1 | ASVS V6.3 / bonnes pratiques |
| D-05 | `DELETE /api/users/me` — effacement + cascade + anonymisation journaux | P0 | RGPD art. 17 |
| D-06 | `GET /api/users/me/export` — portabilité JSON | P0 | RGPD art. 20 |
| D-07 | Écran Paramètres / Confidentialité (aujourd’hui placeholder) | P0 | Produit + RGPD |
| D-08 | Acceptation CGU/privacy **tracée** à l’inscription (`consents`) | P0 | RGPD art. 7 / 13 |
| D-09 | Liens légaux accessibles (drawer, settings, footer) | P0 | LCEN |
| D-10 | Schémas de validation déclaratifs (Zod ou équiv.) auth / orders / intents / uploads | P1 | ASVS V2.2.1 |
| D-11 | Tests de non-régression sur ACL messages, uploads, auth password, révocation | P0 | ASVS V15 / CNIL 11 |
| D-12 | Harnais de tests mobile (au moins parcours auth + compte) | P1 | FD-002 dette |
| D-13 | Stratégie d’**anonymisation** des journaux append-only à l’effacement | P1 | RGPD art. 17 |
| D-14 | Modèle `order_items` (commande multi-produits) — impact facturation / conservation | P2 | Dette FD-002 |
| D-15 | Inscription publique forcée `client` ; merchant/driver par validation | P0 | ASVS V8 / CNIL 7–8 |
| D-16 | JWT mobile dans **SecureStore** (pas AsyncStorage) | P1 | ASVS V14.3.3 |
| D-17 | `jwt.verify(..., { algorithms: ['HS256'] })` sur les 3 points | P1 | ASVS V9.1.2 |
| D-18 | Info RGPD commerçant avant OAuth connecteur (finalités Ma Zone) | P1 | RGPD art. 13 |
| D-19 | Déclaration `NSPhotoLibraryUsageDescription` (+ Android si besoin) | P1 | Stores |
| D-20 | Âge minimum + garde-fou à l’inscription | P1 | RGPD art. 8 |

### 16.2 Expert cybersécurité — failles, durcissement, preuve

| ID | Manque | Priorité | Réf. |
|----|--------|----------|------|
| C-01 | ACL `canViewOrder` sur `/api/messages` (GET + POST) | P0 | ASVS V8.2.2 |
| C-02 | `fileFilter` MIME réel + rejet non-images | P0 | ASVS V5.2.2 |
| C-03 | Noms de fichiers UUID (plus d’`originalname` sur disque) | P0 | ASVS V5.3.2 |
| C-04 | `/uploads` derrière auth ou URL signée (plus de static public) | P0 | ASVS V5.3.1 |
| C-05 | Révocation de session / denylist JWT (logout, password change, delete) | P0 | ASVS V7.4.1–2 |
| C-06 | Réduction durée access token + refresh token | P1 | ASVS V7 |
| C-07 | Vérification mots de passe contre liste compromis (HIBP ou équiv.) | P1 | ASVS V6.2.4 |
| C-08 | MFA sur comptes **admin** | P1 | ASVS V6.5 |
| C-09 | Allowlist destinations HTTP au niveau moteur d’intégration | P1 | SSRF défense |
| C-10 | Anti-énumération comptes (réponses indifférenciées) — décision documentée | P2 | ASVS V6.3 |
| C-11 | Procédure + outillage de **rotation** clé coffre / JWT | P2 | ASVS V13.3.4 |
| C-12 | `security.txt` + canal de divulgation responsable | P1 | Bonne pratique |
| C-13 | Modélisation de menaces (commande, messagerie, intégration) | P1 | ASVS V15 |
| C-14 | **Pentest externe** avant ouverture publique + traitement des findings | P1 | Preuve |
| C-15 | Refus mots de passe / admin par défaut si `NODE_ENV=production` | P1 | ASVS V6.3.2 |
| C-16 | CSP + HSTS sur surface Next.js si exposée | P1 | ANSSI R2/R14 · ASVS V3 |
| C-17 | Redact PII dans logs (`email`, `name`, `phone`, `address`, GPS) + supprimer `console.log` socket | P1 | ASVS V16.2.5 |
| C-18 | Journaliser auth succès/échec + refus d’autorisation | P1 | ASVS V16.3.1–2 |

### 16.3 Ingénieur DevOps — déploiement, observabilité, supply chain

| ID | Manque | Priorité | Réf. |
|----|--------|----------|------|
| O-01 | Choix d’hébergeur + région UE documentée | P0 | Registre / DPA |
| O-02 | TLS 1.2/1.3 sur API + WSS Socket.io (reverse proxy) | P0 | ASVS V12.1.1 · V4.4.1 |
| O-03 | Volume persistant SQLite + stratégie multi-instance écrite | P0 | Runbook |
| O-04 | Sauvegarde **restaurée avec succès** au moins une fois (preuve datée) | P0 | ASVS / continuité |
| O-05 | Secrets prod hors dépôt (vault / secrets manager) — procédure | P0 | ASVS V13 |
| O-06 | Séparation stricte env. dev / staging / prod + secrets distincts | P0 | ASVS V13 |
| O-07 | Expédition logs vers système distinct (`ERROR_TRACKING_DSN` ou équiv.) | P1 | ASVS V16.4.3 |
| O-08 | Monitoring `/health` + alertes (disponibilité, erreurs 5xx, disque) | P1 | Exploitation |
| O-09 | `npm audit` (ou OSV) en CI, seuil high bloquant | P1 | ASVS V15.2.1 |
| O-10 | Dependabot / Renovate + délai écrit (critique ≤ 7 j, high ≤ 30 j) | P1 | ASVS V15.1.1 |
| O-11 | SBOM générée et archivée par build | P2 | ASVS V15.1.2 |
| O-12 | Actions GitHub épinglées par SHA | P2 | CI/CD Security |
| O-13 | SAST (ou équivalent) sur PR touchant auth / uploads / access | P2 | ASVS V15 |
| O-14 | Objectifs RTO / RPO chiffrés + procédure d’astreinte | P1 | Continuité |
| O-15 | Vérifier non-déploiement de `.git` / backups / `.env` | P0 | ASVS V13.4.1 |
| O-16 | Journal des accès admin infra | P1 | Gouvernance |
| O-17 | Rate-limit / WAF en bordure (en plus du rate-limit app) | P2 | DDoS de base |
| O-18 | Plan de bascule si seuil SQLite 200 msg atteint (Postgres) | P2 | FD-002 |

### 16.4 Juriste / DPO — corpus, droits, contrats, gouvernance

| ID | Manque | Priorité | Réf. |
|----|--------|----------|------|
| J-01 | Mentions légales publiées (placeholders remplis) | P0 | LCEN |
| J-02 | Politique de confidentialité publiée | P0 | RGPD art. 12–14 |
| J-03 | CGU publiées | P0 | Contrat |
| J-04 | CGV intermédiation publiées | P0 | Code conso |
| J-05 | Politique cookies (même si peu de traceurs) | P1 | ePrivacy / CNIL |
| J-06 | Médiateur conso + lien ODR européens affichés | P0 | Code conso |
| J-07 | Procédure violation données opérationnelle (72 h) | P0 | RGPD art. 33–34 |
| J-08 | Procédure exercice des droits opérationnelle (1 mois) | P0 | RGPD art. 12 |
| J-09 | Registre art. 30 **tenu à jour** (bases légales actées) | P0 | RGPD art. 30 |
| J-10 | Information art. 13 à chaque collecte (inscription, profil, Mode Réception) | P0 | RGPD art. 13 |
| J-11 | Durées de conservation actées **et appliquées par du code** | P1 | RGPD art. 5-1-e |
| J-12 | Contrats de sous-traitance (DPA art. 28) hébergeur + email + autres | P0 | RGPD art. 28 |
| J-13 | Documentation transferts hors UE (Shopify, cartes…) + garanties | P1 | RGPD ch. V |
| J-14 | Registre des violations | P1 | RGPD art. 33-5 |
| J-15 | AIPD réalisée **ou** décision motivée de ne pas en faire | P0 | RGPD art. 35 |
| J-16 | DPO désigné **ou** décision motivée de ne pas en désigner | P1 | RGPD art. 37 |
| J-17 | Traçabilité professionnels vendeurs (DSA) | P1 | DSA |
| J-18 | Position DAC7 / obligations fiscales plateformes (conseil) | P1 | Fiscal |
| J-19 | Assurance RC pro | P2 | Partenaires |
| J-20 | Modèle de commission / rémunération livreur formalisé | P1 | Contrat |
| J-21 | Validation avocat du corpus avant publication | P0 | Gouvernance |
| J-22 | Privacy labels / Data safety stores | P1 | Apple / Google |
| J-23 | Canal signalement contenus illicites (DSA) | P1 | DSA |
| J-24 | Charte interne accès admin / impersonation labo | P1 | Organisation |

### 16.5 Surfaces exposables — ce qu'un attaquant voit et atteint

Transversal aux quatre métiers. Détail, justification et correctif attendu pour chaque ligne : DOSSIER-COMPLET, **Partie 3** (et Partie 4 pour l’inventaire champ par champ).

| ID | Manque | Surface | Priorité | Réf. |
|----|--------|---------|----------|------|
| S-01 | Supprimer `labToken` des builds de production (injection de session par lien) | Mobile | **P0** | ASVS V7.2 · V13.4.1 |
| S-02 | Refus de démarrage du site Next.js sans configuration d'authentification | Next.js | **P0** | ASVS V13.4.1 |
| S-03 | Contrôle de **rôle** dans le middleware + filtrage par propriétaire des données | Next.js | **P0** | ASVS V8.2.1–2 |
| S-04 | Identifiants d'administration retirés du bundle et refusés en production | admin-web | **P0** | ASVS V6.3.2 |
| S-05 | Serveurs de développement sur `127.0.0.1` par défaut (Vite `host: true`, Next `-H 0.0.0.0`) | Tous | P1 | ASVS V13.4 |
| S-06 | Limites de longueur **côté serveur** sur tous les champs texte | Mobile + API | P1 | ASVS V2.2.1 |
| S-07 | Validation de type, bornes et format (nombres, coordonnées, dates libres) | Mobile + API | P1 | ASVS V2.3 |
| S-08 | Liste blanche de domaines dans `imageUrl()` — traceur tiers involontaire | Mobile | P1 | ASVS V5.2 · RGPD art. 13 |
| S-09 | Validation de schéma avant `Linking.openURL` | Mobile | P1 | ASVS V1.2.2 |
| S-10 | Anti-énumération à l'inscription (409 « Email déjà utilisé ») — doublon de C-10 | Backend | P1 | ASVS V6.3 |
| S-11 | Filtrer le statut sur `GET /api/events/:id` — brouillons lisibles par tout inscrit | Backend | P1 | ASVS V8.2.2 |
| S-12 | Supprimer les renvois de `e.message` au client en production (≈ 12 routes) | Backend | P1 | ASVS V16.5.1 |
| S-13 | Liste blanche d'environnements pour le bac à sable + `requireSandbox` sur World Factory | Backend | P1 | ASVS V13.4.1 |
| S-14 | Limiteur strict sur `POST /api/admin/auth/login` | Backend | **P0** | ASVS V6.3.1 |
| S-15 | Échappement du libellé dans les marqueurs Leaflet (XSS stockée) | Next.js | **P0** | ASVS V1.2.1 |
| S-16 | Validation du paramètre `next` sur `/auth/callback` (redirection ouverte) | Next.js | P1 | ASVS V1.2.2 |
| S-17 | Vérification de session et de rôle dans chaque action serveur Next.js | Next.js | P1 | ASVS V8.2.1 |
| S-18 | CSP, HSTS, `Permissions-Policy`, attributs de cookies explicites — recoupe C-16 | Next.js | P1 | ANSSI R2/R14 · ASVS V3.3 |
| S-19 | Jeton anti-falsification sur les actions d'état + `noopener` sur `window.open` | Web | P2 | ASVS V3.5 |
| S-20 | Suppression des appels `console` au build de production (nom et rôle journalisés) | Mobile | P1 | ASVS V16.2.5 |
| S-21 | Blocage de capture d'écran sur les écrans sensibles (code QR d'identité) | Mobile | P2 | ASVS V14.3 |

**Correspondances :** S-01 = C13 · S-02 et S-03 = C14 · S-04 et S-14 = C15 · S-10 recoupe C-10 · S-18 recoupe C-16 · S-20 recoupe C-17.

### 16.6 Compteur

| Métier | Items manquants |
|--------|-----------------|
| Développeur | **20** |
| Cybersécurité | **18** |
| DevOps | **18** |
| Juriste / DPO | **24** |
| Surfaces exposables | **21** dont 4 recoupements → **17 nouveaux** |
| **Total** | **97** |

Dont **P0** estimés : ~41 items. Les six P0 de surface (S-01 à S-04, S-14, S-15) sont ceux dont le **coût de correction est le plus faible et le risque le plus élevé** : ils se traitent en une journée et ferment trois scénarios d'attaque complets.

### 16.7 Définition opérationnelle d’« inattaquable »

On considère Ma Zone **défendable** (pas « invulnérable ») quand :

1. **Tous les P0** de la liste 16.1–16.5 sont cochés avec preuve (PR, test, document signé ou publié).  
2. Les **15 critères** du §12 sont vrais et vérifiables.  
3. Un **pentest externe** (C-14) a eu lieu et ses findings critiques sont clos.  
4. Le corpus juridique est **publié sans placeholder** et **validé avocat** (J-21).  
5. L’**AIPD** est tranchée par écrit (J-15).

Tant qu’un seul P0 reste ouvert, le projet reste en statut : **prototype — non exposable**.

---

*Fiche générée depuis `_TEMPLATE.md` — audit du 2026-07-26 (CNIL + ASVS 5.0.0 + ANSSI + LCEN/DSA) — valider avant commit.*
