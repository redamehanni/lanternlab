# Synthèse exécutive — Audit de conformité réglementaire et sécurité applicative Ma Zone

| | |
|---|---|
| **Date** | 2026-07-26 (complété avec OWASP ASVS 5.0.0, puis avec la revue des surfaces exposables) |
| **Périmètre** | Dépôt complet (`mobile/`, `backend/`, `src/`, `supabase/`, `admin-web/`) |
| **Produit vivant** | `mobile/` + `backend/` Node/SQLite (FD-000) |
| **Statut déploiement** | Prototype local — **pas en production** |
| **Montage** | Place de marché d'intermédiation (hypothèse actée) |
| **Entité juridique** | Pas encore immatriculée → gabarits `docs/legal/` |
| **Méthode** | [`docs/METHODE-AUDIT-CONFORMITE-APP.md`](../../docs/METHODE-AUDIT-CONFORMITE-APP.md) |
| **Fiche de discussion** | [FD-003](../../FICHE_DISCUSSION/FD-003-conformite-reglementaire-securite-applicative.md) |

> Ce document n'est **pas** un avis juridique et ne vaut pas certification de sécurité. Les textes légaux doivent être validés par un professionnel du droit ; une attestation ASVS exige une vérification par un tiers indépendant.

---

## Verdict en une phrase

Ma Zone a **durci son socle technique** avec le chantier E0–E8 (secrets, CORS, contrôle d'accès sur les commandes, helmet, limitation de débit, coffre chiffré, intégration continue), mais reste **non conforme sur quatre fronts simultanés** : le corpus juridique est inexistant, les droits des personnes ne sont pas implémentés, le cycle de vie des comptes présente des écarts bloquants au regard de l'OWASP ASVS niveau 2, et — écart découvert en dernier — **des outils de laboratoire et des modes de démonstration restent actifs dans du code livrable**, au point qu'un simple lien suffit à ouvrir une session.

### La chose à retenir avant toute autre

`mobile/src/context/AppContext.js` accepte un jeton de session passé dans une URL (`mazone://lab?labToken=…`), sans aucune garde de production. C'est l'écart le plus grave de l'audit, et il n'était visible sous aucun des angles précédents : ce n'est pas un bug, c'est un outil interne qui n'a jamais été retiré du build. Voir [07-SURFACES-EXPOSABLES.md](./07-SURFACES-EXPOSABLES.md) § S-01.

---

## Référentiels croisés

| Référentiel | Couverture | Document |
|-------------|-----------|----------|
| Guide RGPD du développeur (CNIL) — 18 fiches | Intégrale | [03](./03-MATRICE-ECARTS-CNIL.md) |
| **OWASP ASVS 5.0.0 — 345 exigences, 17 chapitres** | **Niveau L2 visé** | [06](./06-ASVS-5.0.md) |
| OWASP Cheat Sheet Series | Ciblée | [04](./04-AUDIT-SECURITE.md) |
| ANSSI — standards de sécurité côté navigateur (R1–R63) | Applicable web | [04](./04-AUDIT-SECURITE.md) |
| LCEN, Code de la consommation, DSA | Intégrale | [05](./05-OBLIGATIONS-LEGALES.md) |
| RGPD — registre article 30 | Intégrale | [01](./01-REGISTRE-TRAITEMENTS.md) |
| Revue orientée attaquant (bundles, deep links, entrées, modes cachés) | Intégrale | [07](./07-SURFACES-EXPOSABLES.md) |

---

## Score par domaine et par métier

| Domaine | Note | Métier concerné | Commentaire |
|---------|------|-----------------|-------------|
| Architecture et qualité de code | **A−** | Développeur | 349 tests, lois vérifiées en CI, OpenAPI, séparation en couches |
| Sécurité — socle et secrets | **B+** | Cybersécurité | Fort progrès E0 ; coffre AES-GCM exemplaire |
| Sécurité — comptes et sessions | **D** | Cybersécurité | Ni politique de mot de passe, ni changement, ni révocation |
| Sécurité — fichiers et messagerie | **D−** | Cybersécurité | Téléversements non filtrés, messagerie sans contrôle d'accès |
| Sécurité — surfaces exposables | **D−** | Cyber / Dev | Laboratoire actif en build livrable, démonstration web sans authentification, identifiants d'administration dans le bundle |
| Validation des entrées | **D** | Développeur | Un seul champ sur vingt impose une limite de longueur |
| Journalisation et détection | **D** | DevOps / Cybersécurité | Événements de sécurité non tracés |
| Exploitation et déploiement | **C** | DevOps | Runbook sérieux, mais rien de déployé ni TLS ni sauvegarde testée |
| Droits des personnes (RGPD) | **D** | Juriste / DPO | Effacement, portabilité et consentement absents |
| Information des utilisateurs | **F** | Juriste / DPO | Aucune mention légale ni politique dans l'interface |
| Obligations e-commerce et DSA | **F** | Juriste / DPO | Bloquant avant ouverture publique |
| Gouvernance et documentation | **C+** | Transverse | Registre créé par cet audit ; AIPD à trancher |

---

## Ce qui s'est amélioré depuis le pré-audit du 25/07

| Avant | Maintenant, vérifié dans le code |
|-------|----------------------------------|
| JWT avec repli `mazone-secret-dev-2024` | Arrêt au démarrage en production, secrets historiques refusés (`config/env.js`) |
| CORS ouvert à toutes les origines | Liste blanche obligatoire en production, `*` refusé |
| Commandes et salons temps réel sans contrôle | `lib/access.js` plus tests dédiés `test/security/access.test.js` |
| Ni helmet ni limitation de débit | Présents, avec 10 requêtes par minute sur l'authentification |
| Aucun test, aucune intégration continue | 349 tests et un workflow qui vérifie les lois d'architecture |
| Secrets d'intégration en clair | Coffre AES-256-GCM avec effacement au débranchement |
| Bac à sable activable partout | Refusé au démarrage si `NODE_ENV=production` |

Ce progrès est réel et mérite d'être dit : le projet a réglé en une semaine la majorité des écarts d'infrastructure que le pré-audit avait identifiés.

---

## Les dix-huit écarts bloquants

Classés par gravité décroissante. Le détail « pourquoi c'était vulnérable / ce que fera la nouvelle version » figure dans [04](./04-AUDIT-SECURITE.md), [06](./06-ASVS-5.0.md) et [07](./07-SURFACES-EXPOSABLES.md).

Les six premiers sont les **portes ouvertes par conception**, découvertes par la revue orientée attaquant. Ils passent devant le reste pour une raison simple : leur correction demande une journée, et ils ferment trois scénarios d'attaque complets qui ne nécessitent même pas de compte.

| # | Écart | Métier | Référentiel | Priorité |
|---|-------|--------|-------------|----------|
| 1 | Session ouverte par simple lien (`labToken` actif en build livrable) | Cyber | ASVS V7.2, V13.4.1 | P0 |
| 2 | Authentification web contournée par défaut sans configuration Supabase | Cyber | ASVS V13.4.1 | P0 |
| 3 | Identifiants d'administration préremplis et affichés dans le bundle | Cyber | ASVS V6.3.2 | P0 |
| 4 | Connexion administrateur sans limitation de débit dédiée | Cyber | ASVS V6.3.1 | P0 |
| 5 | Rôle non vérifié malgré la session, données non filtrées par propriétaire (web) | Cyber | ASVS V8.2.1–2 | P0 |
| 6 | Injection HTML dans les marqueurs de carte (XSS stockée) | Cyber | ASVS V1.2.1 | P0 |
| 7 | Messagerie de commande lisible et inscriptible par n'importe quel compte | Cyber | ASVS V8.2.2 | P0 |
| 8 | Aucun document légal accessible dans l'application | Juriste | LCEN, RGPD art. 12–14 | P0 |
| 9 | Ni suppression de compte ni export de données | Juriste / Dev | RGPD art. 17 et 20 | P0 |
| 10 | Téléversements sans filtrage, servis sans authentification | Cyber | ASVS V5.2.2, V5.3.1 | P0 |
| 11 | Aucune politique de mot de passe côté serveur | Cyber | ASVS V6.2.1 | P0 |
| 12 | Changement de mot de passe impossible | Cyber / Dev | ASVS V6.2.2 | P0 |
| 13 | Aucune récupération de compte (mot de passe oublié) | Dev / Produit | ASVS V6.4.1 | P0 |
| 14 | Déconnexion sans révocation serveur, jeton valable 30 jours | Cyber | ASVS V7.4.1 | P0 |
| 15 | Inscription sans information ni acceptation | Juriste | RGPD art. 13, CNIL 12 et 15 | P0 |
| 16 | TLS et WSS non déployés | DevOps | ASVS V12.1.1, V4.4.1, ANSSI R1 | P0 en production |
| 17 | Événements de sécurité non journalisés | DevOps / Cyber | ASVS V16.3.1 et V16.3.2 | P1 |
| 18 | Durées de conservation non définies, aucune purge | Juriste / Dev | RGPD art. 5-1-e, CNIL 14 | P1 |

---

## Le paradoxe à retenir

Le projet protège **très bien** les secrets des commerçants — coffre chiffré, HMAC à temps constant, purge au débranchement, vérification en intégration continue — et **très mal** les comptes des habitants : mot de passe d'un caractère accepté, impossible à changer, session irrévocable pendant trente jours, et conversation privée lisible par n'importe quel inscrit.

L'explication est structurelle, pas fautive : le chantier E0–E8 portait sur l'orchestration et l'interopérabilité, et il a traité rigoureusement les risques de **son** périmètre. Le cycle de vie des comptes citoyens n'était simplement dans le périmètre d'aucun chantier depuis le début du projet.

Le second paradoxe est du même ordre. Le projet a mis en place un garde-fou remarquable — le backend **refuse de démarrer** en production si le bac à sable est activé — puis a laissé le mécanisme d'imitation vivre côté mobile, sans aucune garde équivalente. La protection existe, elle a été pensée, et elle s'arrête à la frontière du backend. C'est exactement le genre d'écart qu'une revue de code ne voit pas, parce que chaque fichier pris isolément est correct.

---

## Documents de cet audit

| Fichier | Contenu |
|---------|---------|
| [plan-de-mise-en-securite-et-conformite.md](./plan-de-mise-en-securite-et-conformite.md) | Feuille de route complète P0 / P1 / P2 (ex-PLAN-TRAVAIL) |
| [08-INVENTAIRE-ENTREES.md](./08-INVENTAIRE-ENTREES.md) | Inventaire champ-par-champ UI + API + stockage (passe hacker) |
| [01-REGISTRE-TRAITEMENTS.md](./01-REGISTRE-TRAITEMENTS.md) | Registre article 30 — neuf traitements |
| [02-CARTOGRAPHIE-DONNEES.md](./02-CARTOGRAPHIE-DONNEES.md) | Tables, flux, sous-traitants |
| [03-MATRICE-ECARTS-CNIL.md](./03-MATRICE-ECARTS-CNIL.md) | Les 18 fiches CNIL confrontées au code |
| [04-AUDIT-SECURITE.md](./04-AUDIT-SECURITE.md) | ANSSI et OWASP, format pourquoi / nouvelle version |
| [05-OBLIGATIONS-LEGALES.md](./05-OBLIGATIONS-LEGALES.md) | LCEN, consommation, DSA, médiateur |
| [06-ASVS-5.0.md](./06-ASVS-5.0.md) | Les 17 chapitres ASVS, niveau L2 |
| [07-SURFACES-EXPOSABLES.md](./07-SURFACES-EXPOSABLES.md) | **Revue orientée attaquant** — bundles, deep links, entrées utilisateur, modes cachés (S-01 à S-21) |
| [DECISIONS-A-TRANCHER.md](./DECISIONS-A-TRANCHER.md) | Décisions bloquantes |
| [`docs/legal/`](../../docs/legal/) | Sept gabarits juridiques à champs variables |
| [FD-003](../../FICHE_DISCUSSION/FD-003-conformite-reglementaire-securite-applicative.md) | Fiche de discussion — **liste maîtresse de 97 items** (§16) |
| [references/OWASP_ASVS_5.0.0_fr.csv](./references/OWASP_ASVS_5.0.0_fr.csv) | Référentiel ASVS 5.0.0 FR (345 exigences) |

---

## Liste maîtresse — ce qui manque pour être défendable

**97 items** inventoriés dans [FD-003 §16](../../FICHE_DISCUSSION/FD-003-conformite-reglementaire-securite-applicative.md) :

| Métier | Items | Focus |
|--------|------:|-------|
| Développeur | 20 | Compte, validation, tests, SecureStore, consents |
| Cybersécurité | 18 | Messagerie, téléversements, sessions, test d'intrusion, journaux |
| DevOps | 18 | TLS, sauvegardes restaurées, audit en CI, supervision, sous-traitance infra |
| Juriste / DPO | 24 | Corpus légal, AIPD, sous-traitants, DSA, médiateur |
| Surfaces exposables | 17 nouveaux | Laboratoire, mode démonstration, entrées, journaux clients |

Dont ~**41 P0**. Définition d'« inattaquable » = tous les P0 cochés + 18 critères FD-003 §12 + test d'intrusion + corpus validé par un avocat + AIPD tranchée.

Détail ASVS : [06-ASVS-5.0.md](./06-ASVS-5.0.md). Détail attaquant : [07-SURFACES-EXPOSABLES.md](./07-SURFACES-EXPOSABLES.md).

---

## Prochaine action recommandée

1. **Exécuter la vague 0** de [FD-003 §11](../../FICHE_DISCUSSION/FD-003-conformite-reglementaire-securite-applicative.md) — cinq actions de quelques lignes chacune : retirer `labToken` du build de production, vider les identifiants de la console d'administration, appliquer le limiteur strict à la connexion administrateur, faire échouer le site web sans configuration d'authentification, ramener les serveurs de développement sur `127.0.0.1`. **Une journée de travail, trois scénarios d'attaque fermés.**
2. Lire [FD-003](../../FICHE_DISCUSSION/FD-003-conformite-reglementaire-securite-applicative.md) — §16 liste maîtresse et §10 scénarios d'attaque.
3. Trancher les décisions de [DECISIONS-A-TRANCHER.md](./DECISIONS-A-TRANCHER.md), dont le **sort du site Next.js legacy** qui porte à lui seul trois écarts P0.
4. Exécuter le [plan de mise en sécurité et conformité](./plan-de-mise-en-securite-et-conformite.md) — vague C.1 puis validation des entrées (08 / P1-9…).

> **En attendant la vague 0 :** ne pas faire de démonstration de l'application sur un réseau partagé, et ne pas déployer le site Next.js, même temporairement.
