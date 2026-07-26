# 05 — Obligations légales d’affichage et e-commerce

Date : 2026-07-26  
Sources : LCEN · Code de la consommation · economie.gouv.fr · DSA (place de marché)  
Montage retenu : **intermédiaire** (commerçants vendent ; Ma Zone met en relation ; livreurs indépendants — hypothèse)

---

## 1. Mentions légales (LCEN)

| Obligation | Statut Ma Zone | Action |
|------------|----------------|--------|
| Identité de l’éditeur (raison sociale, siège, SIREN/RCS, capital si société) | **Absent** — entité non immatriculée | Remplir `docs/legal/mentions-legales.md` |
| Directeur / responsable de publication | Absent | Placeholder `{{DIRECTEUR_PUBLICATION}}` |
| Hébergeur (nom, adresse, contact) | Absent | Dès choix d’hébergeur |
| Accessibilité facile (lien permanent) | Absent (pas de page, pas de footer) | Drawer + Settings + site si public |

Sanctions rappelées par economie.gouv.fr : jusqu’à 75 000 € (EI) / 375 000 € (sociétés) — ordre de grandeur, pas un conseil.

---

## 2. Information précontractuelle & CGV (si vente à distance)

| Obligation | Statut | Note |
|------------|--------|------|
| CGV accessibles | **Absent** | Gabarit intermédiation créé |
| Caractéristiques essentielles, prix TTC, délais | Partiel UI / pas formalisé | À intégrer au checkout |
| Identité du professionnel vendeur | À clarifier | Sur place de marché : identité du **commerçant** + rôle Ma Zone |
| Droit de rétractation 14 j ou exceptions | Absent | Alimentaire / biens personnalisés = exceptions fréquentes — à motiver juridiquement |
| Garanties légales | Absent | |
| Médiateur de la consommation + lien RLL UE | Absent | `{{MEDIATEUR_*}}` |
| Résiliation électronique d’abonnement | N/A aujourd’hui | Si abonnements futurs |

---

## 3. CGU plateforme

| Obligation | Statut |
|------------|--------|
| Règles d’usage, comptes, modération, responsabilités | **Absent** (gabarit `cgu.md`) |
| Distinction Ma Zone / commerçant / livreur | À acter dans CGU + CGV intermédiation |

---

## 4. RGPD — information & droits (renvoi)

Voir 01, 03, 04. Rappel bloquant :

- Politique de confidentialité absente  
- Pas d’information à la collecte  
- Pas d’effacement / portabilité self-service  

---

## 5. Cookies / traceurs

| Élément | Statut |
|---------|--------|
| CMP / bandeau | Absent |
| Analytics | Absent (bon état) |
| Cookies session Supabase (legacy) | Techniques — si site public, documenter dans politique cookies |

**Règle :** aucun SDK analytics avant CMP conforme CNIL.

---

## 6. DSA — place de marché

| Obligation | Statut | Action |
|------------|--------|--------|
| Traçabilité des professionnels (art. 30 type) | **Absente** — pas de collecte SIREN commerçant structurée | Anticiper avant ouverture publique |
| Signalement contenus illicites | Absent | Prévoir canal |
| Transparence publicité / ranking | N/A ou partiel | À revoir si ranking payant |

---

## 7. DAC7 / fiscalité plateformes

Signalé uniquement : les places de marché peuvent avoir des **obligations déclaratives** sur les vendeurs. Hors rédaction technique — conseil fiscal/juridique avant mise en service réelle.

---

## 8. Accessibilité (EAA)

Depuis juin 2025, obligations d’accessibilité pour certains services e-commerce B2C. **Chantier séparé** — non traité ici.

---

## 9. Application mobile stores

| Point | Statut |
|-------|--------|
| Privacy nutrition labels / Data safety | Non préparés (roadmap portrait) |
| Permissions iOS caméra | OK |
| Permission photothèque | Manquante dans `app.json` |
| Bundle id | `com.anonymous.mobile` — placeholder |

---

## 10. Matrice « surface → documents obligatoires »

| Surface | Mentions | Privacy | CGU | CGV | Cookies | Médiateur |
|---------|----------|---------|-----|-----|---------|-----------|
| App mobile (prod) | Oui | Oui | Oui | Oui* | Si webviews/traceurs | Oui* |
| Site Next public | Oui | Oui | Oui | Oui* | Oui | Oui* |
| Admin-web interne | Mentions internes / charte | Privacy salariés | — | — | — | — |
| Branchement Shopify | — | Info commerçant | Annexe | — | — | — |

\*CGV + médiateur dès qu’il y a relation de consommation à distance via la plateforme.
