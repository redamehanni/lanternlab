# Compte rendu — Implémentation Portes V1 (accès public)

| | |
|---|---|
| **Date** | 2026-08-04 |
| **Statut** | Livré (surface mobile) — pas encore committé sauf demande |
| **GO** | Reda — plan *Portes surface seal* + audit Option 3 |
| **Références** | `AUDIT_COMPATIBILITE_PORTES_OPTION_3.md` · `FICHE_DISCUSSION/FD-004-…` · `CHANTIER/portes-v1/JOURNAL_MODIFICATIONS.md` |

---

## 1. Objectif atteint

Conserver l’accueil Deuxième Âme comme point d’entrée, tout en faisant comprendre que Ma Zone est un **programme à plusieurs Portes**.

- **Une seule Porte ouverte :** Les Lanternes
- **Cinq Portes visibles mais scellées** — intrigantes, sans révéler leur contenu
- **Aucune refonte** des moteurs, APIs, organes ou modèles de données

---

## 2. Principe architectural respecté

> Les Portes sont un mécanisme de présentation et d’accès public. Elles ne définissent pas l’architecture interne de l’application.

| Couche | Impact |
|---|---|
| Event Engine, Wallet, Identity | **Aucun** |
| Backend / APIs | **Aucun** |
| Murmurs | **Aucun filtre** — canal, contenu = données réelles |
| Surface Accueil (mobile) | **Seule zone modifiée** |

---

## 3. Comportement utilisateur V1

### Grille des Portes

| Porte (id interne) | Affichage public | Accès |
|---|---|---|
| `lanternes` | Label + description + illustration | Navigation vers `Lanterns` |
| `evenements` | « Porte II » + teaser mystère + cadenas | Toast d’intrigue — **pas** de navigation |
| `participer` | « Porte III » | Idem |
| `quartier` | « Porte IV » | Idem |
| `adresses` | « Porte V » | Idem |
| `surprise` | « Porte VI » | Idem |

### En-tête Accueil

Texte du type : **« 6 Portes · 1 ouverte — Les Lanternes ne sont que le premier chapitre »**

### Contournements bouchés (surface)

- Tap sur une Porte scellée → toast (`sealedHint`), pas de `navigate`
- Suggestions IA vers `Events` / `Surprise` → même refus tant que la Porte est scellée
- Hero : compteur « événements » masqué (`showEvents: false`) pour ne pas trahir une Porte fermée

### Murmurs

**Non filtrés.** Section et API inchangées. Si seule l’activité Lanternes existe dans les données, les murmures en parleront naturellement.

---

## 4. Fichiers modifiés

| Fichier | Ce qui a changé |
|---|---|
| `mobile/src/data/deuxiemeAme.js` | `status: 'open' \| 'sealed'`, `sealedLabel` / `sealedHint`, helpers `isPorteOpen`, `porteByRoute`, `openPortesCount`, commentaire de principe |
| `mobile/src/components/deuxiemeAme/PorteCard.js` | Rendu mystère si sealed (cadenas, pas d’illustration / description métier) |
| `mobile/src/screens/deuxiemeAme/DeuxiemeAmeHomeScreen.js` | Garde `openPorte`, suggestions alignées, copy Portes, hero sans signal événements |
| `mobile/src/components/deuxiemeAme/WeatherHero.js` | Pill « événements » conditionnel (`stats.showEvents !== false`) |
| `FICHE_DISCUSSION/INDEX.md` | Entrée FD-004 + note du 04/08 |

---

## 5. Fichiers créés

| Fichier | Rôle |
|---|---|
| `FICHE_DISCUSSION/FD-004-portes-couche-presentation-acces-public-v1.md` | Fiche Cursor — principe + périmètre public V1 |
| `CHANTIER/portes-v1/JOURNAL_MODIFICATIONS.md` | Journal détaillé du chantier |
| `COMPTE_RENDU_PORTES_V1_ACCES_PUBLIC.md` | Ce document (source du PDF) |

---

## 6. Volontairement non touché

- Tout le dossier `backend/`
- Event Engine, Wallet, Identity
- Enregistrement des écrans dans le navigateur (les routes scellées restent vivantes)
- Première Âme, Épée commerçant
- `MurmursScreen` et APIs murmures

---

## 7. Comment ouvrir une Porte plus tard

Dans `mobile/src/data/deuxiemeAme.js`, sur l’entrée concernée :

1. Passer `status` à `PORTE_STATUS.OPEN`
2. Le rendu reprend automatiquement `label` / `description` / illustration
3. Si Porte Événements : remettre `showEvents: true` (ou retirer le flag) dans le calcul des stats de l’accueil

**Aucune migration backend.**

---

## 8. Hors périmètre (signalé, non implémenté)

1. Garde centralisée sur deep links / navigation programmatique vers écrans scellés
2. Override Lab pour tester les Portes scellées
3. Affinage direction artistique des textes et visuels mystère

---

## 9. Décisions produit actées

| Décision | Statut |
|---|---|
| Option 3 — grille Accueil conservée | Validée |
| Lanternes seule ouverte au lancement | Validée |
| Murmurs = canal, pas de filtre Porte | Validée |
| Vocabulaire `open` / `sealed` (pas « Coming Soon ») | Validée |
| Couche surface uniquement | Validée |

---

## 10. Conclusion

L’implémentation est **fidèle au plan validé** : couche de présentation et d’accès public, investissement architectural préservé, ouverture progressive d’une Porte = un flag de surface.

*Document généré le 04/08/2026 — Cursor Reda.*
