/**
 * Tokens Première Âme / Marketplace / Épée / Livreur.
 * Conservés pour ne pas altérer ces faces pendant le chantier DA V1
 * (périmètre = Deuxième Âme uniquement).
 */
export const MARKETPLACE_THEME = {
  colors: {
    primary: '#0A1628',
    primaryLight: '#1A3358',
    accent: '#2563EB',
    accentSoft: '#EFF6FF',
    success: '#059669',
    successSoft: '#ECFDF5',
    warning: '#D97706',
    warningSoft: '#FFFBEB',
    error: '#DC2626',
    errorSoft: '#FEF2F2',
    bg: '#F8FAFC',
    bgElevated: '#FFFFFF',
    card: '#FFFFFF',
    text: '#0F172A',
    textSecondary: '#64748B',
    textMuted: '#94A3B8',
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
    overlay: 'rgba(15, 23, 42, 0.45)',
    promo: '#DC2626',
    promoSoft: '#FEF2F2',
  },
  radius: {
    sm: 10,
    md: 16,
    lg: 20,
    xl: 24,
    full: 999,
  },
  shadow: {
    sm: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    md: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 4,
    },
    lg: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 8,
    },
    float: {
      shadowColor: '#2563EB',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 6,
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  typography: {
    hero: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
    title: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
    subtitle: { fontSize: 16, fontWeight: '600' },
    body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
    caption: { fontSize: 13, fontWeight: '500' },
    micro: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  },
};

export default MARKETPLACE_THEME;
