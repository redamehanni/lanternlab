/**
 * Point d'extension du briefing : la liste des adaptateurs.
 *
 * Brancher un futur organe au Cockpit = ajouter son adaptateur ici. Chaque
 * adaptateur est une fonction pure `build(ctx) -> cartes[]` — jamais de logique
 * métier, jamais d'appel réseau (le Cockpit fournit le contexte).
 */
import marketplace from './marketplace';
import messages from './messages';
import store from './store';
import promotions from './promotions';
import clients from './clients';

const ADAPTERS = [marketplace, messages, store, promotions, clients];

export default ADAPTERS;
