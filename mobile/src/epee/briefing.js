/**
 * Briefing — agrège les cartes produites par les adaptateurs et les organise
 * en deux sections lisibles pour le Cockpit :
 *   - `priorities` : ce qui demande une action maintenant,
 *   - `life`       : la vie du commerce (contexte, pas d'urgence).
 *
 * RÈGLE UX : un briefing, pas un tableau exhaustif. On plafonne chaque section
 * pour garder un coup d'œil rapide. Le détail vit dans les écrans d'organes.
 */
import ADAPTERS from './adapters';

const MAX_PER_SECTION = 4;

export function buildBriefing(ctx = {}) {
  const cards = [];
  for (const adapter of ADAPTERS) {
    try {
      const produced = adapter.build(ctx) || [];
      cards.push(...produced);
    } catch {
      // Un adaptateur défaillant ne doit jamais casser le Cockpit.
    }
  }

  const bySection = (section) =>
    cards
      .filter((c) => c.section === section)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))
      .slice(0, MAX_PER_SECTION);

  return {
    priorities: bySection('priority'),
    life: bySection('life'),
  };
}

export default { buildBriefing };
