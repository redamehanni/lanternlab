import { THEME } from '../../theme';

// Libellés et couleurs de présentation des statuts d'objet numérique.
export const STATUS_META = {
  pending: { label: 'En attente', color: THEME.colors.warning },
  active: { label: 'Actif', color: THEME.colors.success },
  reserved: { label: 'Réservé', color: THEME.colors.accent },
  consumed: { label: 'Utilisé', color: THEME.colors.textMuted },
  expired: { label: 'Expiré', color: THEME.colors.textMuted },
  revoked: { label: 'Annulé', color: THEME.colors.error },
};
