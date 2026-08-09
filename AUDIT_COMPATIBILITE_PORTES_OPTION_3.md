# Audit de compatibilité — Option 3 (Portes scellées)

| | |
|---|---|
| **Date** | 2026-08-04 |
| **Statut** | Document d’analyse — **pas encore de GO code** |
| **Décision produit** | Option 3 : conserver la grille Accueil ; seule la Porte Lanternes est ouverte ; les 5 autres sont visibles mais scellées |
| **Priorité** | Préserver l’architecture existante ; couche de présentation minimale |

---

## Verdict

**Oui : l’option 3 permet de conserver l’intégralité de l’architecture existante sans refonte**, si elle est limitée à une **couche de présentation + garde d’accès** sur la surface Deuxième Âme.

Ce n’est **pas** une nouvelle architecture de « univers indépendants ». C’est un **verrouillage public** de portes dont le code (écrans, routes, organes, APIs) reste en place exactement comme aujourd’hui.

### Schéma — seule la surface est touchée

```
SURFACE (seule zone touchée)
  Accueil (grille PORTES)
       │
       ▼
  porte.status ?
       ├── open (lanternes)  →  Écran Lanterns  →  APIs / Event Engine
       └── sealed            →  Carte mystère (pas de navigate)

INCHANGÉ
  Event Engine · Wallet · Identity · /api/events ·
  Écrans Events / Participer / Quartier / … (restent enregistrés) ·
  Épée commerçant · Première Âme · Messages / Wallet / Panier
```

---

## Pourquoi c’est compatible

Aujourd’hui, les Portes sont **déjà** une notion de surface uniquement (`mobile/src/data/deuxiemeAme.js`) :

> *« Les portes sont une notion de SURFACE. L’Event Engine ne les connaît pas. »*

| Couche | État actuel | Impact Option 3 |
|--------|-------------|-----------------|
| Event Engine, types `lanterne`, OV, Mode Réception | Organes / tables / APIs | **Aucun** |
| Wallet, Identity, orchestration | Inchangés | **Aucun** |
| Routes `/api/events`, discover, murmurs | Inchangées | **Aucun** (le backend peut continuer à servir ; c’est le mobile qui n’ouvre pas) |
| Écrans `EventsScreen`, `ParticiperScreen`, etc. | Enregistrés dans le stack | **Conservés** — prêts pour l’ouverture future |
| `DeuxiemeAmeHomeStack` routes | Déclarées dans `navigation/index.js` | **Conservées** |
| Première Âme, Messages, Wallet, Panier | Partagés | **Aucun** |
| Épée commerçant (créer des événements) | Indépendant | **Aucun** — le commerçant continue ; le citoyen V1 n’entre pas par la Porte Événements |

Le flux actuel d’ouverture est déjà centralisé dans `DeuxiemeAmeHomeScreen.js` :

```javascript
function openPorte(porte) {
  navigation.navigate(porte.route);
}
```

Le point de contrôle naturel est **là** (+ la carte `PorteCard`), pas dans les organes.

---

## Ce qui n’est PAS rendu obsolète

Rien de l’investissement E0–E8 / Deuxième Âme v1 ne devient mort :

- Les 5 écrans « fermés » restent du **code vivant**, branchés au navigateur, testables (Lab / Bac à Sable), prêts à un `status: 'open'`.
- Les illustrations `portes.*` dans le registry restent.
- `PARTICIPATION_MODES`, Event Engine, billetterie, scan Lanterne : inchangés.
- Ouvrir une Porte plus tard = **changer un flag de surface** (+ éventuellement copy/illustration), pas une migration.

---

## Points de friction explicites (pas des refontes, mais à traiter)

Ce ne sont **pas** des incompatibilités d’architecture. Ce sont des **fuites de surface** ou des **tensions de message** si on ne les traite pas dans la même couche présentation.

### 1. Révélation du contenu (contrainte produit vs cartes actuelles)

Aujourd’hui `PorteCard` affiche `label` + `description` en clair (« Les Événements — Découvrez tout ce qui se passe… »).

Si les Portes scellées gardent ce texte, **on contredit** « elles ne révèlent ni leur contenu ni leur fonctionnement ».

**Résolution sans refonte :** pour `status !== 'open'`, la carte affiche une **présentation mystère** (silhouette, numéro de Porte, teaser non descriptif) tout en gardant en interne `id`, `route`, illustrations réelles pour le jour J. Les labels/descriptions actuels restent dans le fichier de déclaration — utilisés seulement quand la Porte est ouverte.

### 2. Contournements hors grille (accès sans passer par une Porte)

Même si `openPorte` refuse, le citoyen peut encore atteindre du contenu « Événements / Surprise » via :

| Contournement | Fichier | Risque |
|---------------|---------|--------|
| Suggestions IA → `Events` / `Surprise` | `INTENT_SUGGESTIONS` dans `deuxiemeAme.js` | Contourne le sceau |
| Murmurs → `EventDetail` | `DeuxiemeAmeHomeScreen.js` | Montre le contenu d’initiatives hors Porte Lanternes |
| Stats hero (`events` count) | même écran | Signale qu’il y a une vie « événements » |
| Navigation directe si un deep link vise `Events` | stack déjà enregistré | Contournement possible |

**Résolution sans refonte :** même couche surface — désactiver / rerouter les suggestions vers des portes scellées ; décider explicitement si Murmurs / OV restent (ce ne sont **pas** des Portes) ou s’ils ne montrent que des lanternes en V1. **Décision produit requise** sur Murmurs/OV (voir ci-dessous).

### 3. Ne pas réutiliser le pattern « Coming Soon » de l’Épée

`moduleRegistry.js` (Épée) utilise `comingSoon: true` + libellé « Bientôt ». Vous l’avez exclu explicitement.

**Résolution :** vocabulaire distinct — `status: 'open' | 'sealed'`, UX mystère, **jamais** « Coming Soon » / « Bientôt » sur les Portes.

### 4. Tension documentaire (FD-000), pas technique

FD-000 présente les 6 Portes comme face Deuxième Âme **accessible**. Option 3 ne casse pas le code ; elle change le **périmètre public V1**.

**Résolution :** amender FD (brouillon) : *architecture des 6 Portes intacte ; accès public V1 = Porte Lanternes seule ; les autres sont scellées en surface.*

### 5. Sous-titre Accueil actuel

« Six façons d’entrer dans la vie du quartier » + tuiles toutes cliquables = message inverse de la vision.

**Résolution :** copy Accueil du type « 6 Portes · 1 ouverte » (formulation exacte à valider) — pure présentation.

---

## Ce qui serait incompatible / à ne PAS faire

| Anti-pattern | Pourquoi |
|--------------|----------|
| Encoder les Portes dans Event Engine / CDM | Violerait « surface compose, organe décide » et forcerait une refonte |
| Supprimer écrans / routes / APIs des 5 Portes | Rendrait obsolète l’investissement et compliquerait la réouverture |
| Remplacer la grille par un nouveau shell « Programme » | Option 2 — refonte navigation inutile pour votre contrainte |
| Bloquer côté backend `GET /api/events` pour les non-lanternes | Casserait commerçant, Lab, murmures, et mélangerait surface et organe |
| Renommer les `id` internes (`evenements` → `porte_2`) | Cascades inutiles ; le mystère est **présentation**, pas identité code |

---

## Architecture recommandée (la moins intrusive)

**Une seule addition conceptuelle : un statut de Porte dans le registre surface existant.**

```
PORTES[] dans deuxiemeAme.js
  + status: 'open' | 'sealed'   // lanternes = open ; les 5 autres = sealed
  + (optionnel) sealedLabel / sealedHint pour la carte mystère
```

**Comportement :**

1. Accueil lit `PORTES` comme aujourd’hui.
2. `PorteCard` : si `sealed` → rendu mystère + press = intrigue (toast / micro-narration), **pas** `navigate`.
3. `openPorte` : refuse si `sealed` (filet de sécurité).
4. Contournements surface (`INTENT_SUGGESTIONS`, éventuellement murmurs) alignés sur le même statut.
5. Jour d’ouverture d’une Porte : `status: 'open'` (+ copy réelle) — **zéro** changement d’organe.

Pattern proche de l’Épée (`enabled`) mais **sémantique différente** (scellé / mystère, pas « bientôt »).

### Périmètre de fichiers touchés (quand le GO code sera donné)

- `mobile/src/data/deuxiemeAme.js` — statut + textes scellés
- `mobile/src/components/deuxiemeAme/PorteCard.js` — rendu mystère
- `mobile/src/screens/deuxiemeAme/DeuxiemeAmeHomeScreen.js` — garde `openPorte` + copy en-tête + suggestions
- Fiche discussion (FD) pour acter le périmètre public V1

**Hors périmètre :** backend, Event Engine, Wallet, navigation stack registrations, Première Âme, Épée.

---

## Décision produit restante (avant code)

**Murmurs du quartier + Mode Réception + Opportunités Volantes** : ce ne sont pas des Portes, mais ils exposent déjà des initiatives hors Lanternes.

| Option | Description |
|--------|-------------|
| **A (strict)** | En V1 public, ne montrer que des contenus liés aux lanternes (ou masquer temporairement la section Murmurs). |
| **B (souple)** | Laisser Murmurs / OV / Réception actifs comme « tissu du quartier », le sceau ne portant **que** sur les 5 tuiles Portes. |

Recommandation architecte : **B**, sauf si le lancement exige une discipline narrative totale — A est plus cohérent avec « une seule Porte ouverte », mais touche plus de surface (pas d’organe).

---

## Todos avant / au GO

1. Trancher Murmurs / OV / Réception : **A** vs **B**
2. Spécifier `status: open | sealed` + UX mystère `PorteCard` (sans Coming Soon)
3. Amendement FD : architecture 6 Portes intacte, accès public V1 = Lanternes seule
4. À GO code : `deuxiemeAme.js` + `PorteCard` + `HomeScreen` + suggestions — **zéro backend**

---

## Conclusion

| Question | Réponse |
|----------|---------|
| Option 3 force-t-elle une refonte ? | **Non** |
| Rend-elle obsolète moteurs / APIs / données / routes internes ? | **Non**, si on n’y touche pas |
| Y a-t-il des points incompatibles ? | **Aucun structurel** ; seulement des **fuites de surface** et une **tension de copy/révélation** à traiter dans la même couche |
| Investissement préservé ? | **Oui** — les 5 Portes restent du code prêt à ouvrir |

Prochaine étape quand vous validerez : figer la décision Murmurs (A/B), puis implémentation minimale surface-only — **sans coder tant que le GO n’est pas donné**.
