# 03 — Matrice d’écarts Guide RGPD du développeur (CNIL)

Date : 2026-07-26 · Statuts : `OK` | `Partiel` | `Absent` | `N/A`

Pour les écarts techniques, détail pédagogique dans [04-AUDIT-SECURITE.md](./04-AUDIT-SECURITE.md).

---

| # | Fiche CNIL | Statut | Preuves | Pourquoi vulnérable / non conforme | Nouvelle version | Gravité |
|---|------------|--------|---------|------------------------------------|------------------|---------|
| 0 | Développer en conformité | Partiel | Privacy by design amorcée (E0, sandbox prod refusée) ; pas de registre avant cet audit | Conformité traitée après features | Maintenir registre + checklist avant chaque feature data | P1 |
| 1 | Identifier les données personnelles | Partiel | Inventaire dans 02 ; pas de doc produit opposable | Inventaire incomplets → oublis de droits | Tenir 02 à jour à chaque migration | P1 |
| 2 | Préparer son développement | Absent | Pas de bases légales actées avant collecte | Collecte sans cadrage finalité/base | Valider DECISIONS-A-TRANCHER avant prod | P0 |
| 3 | Sécuriser env. de développement | Partiel | `.gitignore` data/uploads ; secrets dev générés hors prod | Scripts admin / UI login encore suggestifs en local | Ne jamais shipper credentials par défaut en prod | P1 |
| 4 | Gérer le code source | OK | Pas de clés prod commités ; CI anti-secrets historiques | — | Maintenir | — |
| 5 | Choix d’architecture | Partiel | SQLite local ; Shopify hors UE possible ; double stack legacy | Transferts / localisation non documentés | Trancher hébergeur + DPA ; documenter Shopify | P1 |
| 6 | Sécuriser sites/apps/serveurs | Partiel | helmet, rate-limit, CORS prod, ACL orders OK | Messages legacy + uploads publics | Voir P0 audit sécurité | P0 |
| 7 | Minimiser les données | Partiel | Scopes Shopify limités ; pas de customers inbound | Champs profil larges ; rôle libre merchant/driver | Inscription client-only ; revoir champs facultatifs | P1 |
| 8 | Gérer les profils | Partiel | Rôles + admin séparé + ACL orders | Self-escalade métier ; IDOR messages | ACL messages + validation rôles | P0 |
| 9 | Bibliothèques et SDK | Partiel | CI Loi 17 ; pas d’analytics | Pas de `npm audit` en CI | Ajouter audit deps CI | P1 |
| 10 | Qualité code / doc | Partiel | CURRENT_ARCHITECTURE, OpenAPI, 349 tests | Dette order_items ; docs légales absentes | Continuer ; pack legal | P1 |
| 11 | Tester | Partiel | Tests access, env, orchestration | Pas de tests effacement / messages legacy / mobile | Étendre suite sécurité | P1 |
| 12 | Informer les personnes | Absent | Aucun doc legal dans l’UI | Art. 12–14 non respectés si collecte réelle | Publier privacy + liens inscription/params | P0 |
| 13 | Exercice des droits | Absent | Pas DELETE/export citoyen | Art. 15–20 non exercables | Endpoints + écran Settings | P0 |
| 14 | Durée de conservation | Absent | TTL techniques seulement | Conservation illimitée de fait | Politique + purges | P1 |
| 15 | Bases légales techniques | Absent | Pas de table `consents` | Impossible de prouver un consentement | Consents horodatés + acceptation CGU | P0 |
| 16 | Traceurs | OK / N/A | Pas de SDK tracking ; cookies session legacy seulement | Si analytics ajouté sans CMP → non-conformité | CMP avant tout traceur non exempté | P2 |
| 17 | Mesure fréquentation | N/A | Aucune | — | Préférer outil exempté CNIL si besoin | — |
| 18 | Attaques informatiques | Partiel | Rate-limit, ACL, coffre, HMAC | Uploads, IDOR messages, pas Zod | Correctifs P0 + validation schéma | P0 |

---

## Synthèse fiches bloquantes avant prod

**P0 :** fiches 2, 6, 8, 12, 13, 15, 18 (partiel)  
**P1 :** 0, 1, 5, 7, 9, 10, 11, 14  
**OK / N/A :** 4, 16 (état actuel), 17
