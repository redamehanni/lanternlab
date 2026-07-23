/**
 * Design System officiel — Deuxième Âme (Direction Artistique V1).
 *
 * Contrat émotionnel : quartier vivant, humain, intemporel.
 * Crème / pastels désaturés / terracotta doux. Surfaces posées, jamais flottantes.
 * Typo : Cormorant Garamond (display) + Source Sans 3 (UI).
 */
export const AME = {
  colors: {
    // Fond papier
    bg: '#F7F1EA',
    bgElevated: '#FFFBF7',
    card: '#FFFBF7',
    paper: '#F3EBE2',
    paperDeep: '#EDE4DA',

    // Encre
    text: '#2C2420',
    textSecondary: '#6B5E55',
    textMuted: '#9A8C82',
    textOnDark: '#FFFBF7',
    textOnAccent: '#FFFBF7',

    // Accent global Âme (terracotta / ocre)
    primary: '#8B5E45',
    primarySoft: '#F3E6DC',
    accent: '#C4785A',
    accentSoft: '#F8EBE4',
    accentDeep: '#A35D42',

    // Sémantique adoucie
    success: '#5F8F78',
    successSoft: '#E8F2EC',
    warning: '#C4893A',
    warningSoft: '#F8EFDF',
    error: '#C45C5C',
    errorSoft: '#F8E8E8',

    // Accents portes (désaturés)
    portes: {
      lanternes: '#8B6FAE',
      evenements: '#C4785A',
      participer: '#5F8F78',
      quartier: '#6A92A8',
      adresses: '#B86B6B',
      surprise: '#7A7FB8',
    },
    portesSoft: {
      lanternes: '#F0EAF6',
      evenements: '#F8EBE4',
      participer: '#E8F2EC',
      quartier: '#E8F0F4',
      adresses: '#F6EAEA',
      surprise: '#EEEDF6',
    },

    border: '#E6DCD2',
    borderLight: '#EFE7DE',
    overlay: 'rgba(44, 36, 32, 0.38)',
    inkWash: 'rgba(44, 36, 32, 0.55)',
  },

  radius: {
    sm: 12,
    md: 18,
    lg: 22,
    xl: 28,
    xxl: 36,
    full: 999,
  },

  shadow: {
    // Ombres brunes chaudes, opacity ≤ 0.06 — surfaces posées
    sm: {
      shadowColor: '#5C4030',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 10,
      elevation: 1,
    },
    md: {
      shadowColor: '#5C4030',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.055,
      shadowRadius: 18,
      elevation: 2,
    },
    lg: {
      shadowColor: '#5C4030',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.06,
      shadowRadius: 28,
      elevation: 3,
    },
    float: {
      shadowColor: '#8B5E45',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 4,
    },
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
    section: 28,
  },

  /**
   * fontFamily est injecté après chargement des fonts (voir fonts.js).
   * Les tailles / graisses restent utilisables avant le boot.
   */
  typography: {
    display: {
      fontSize: 30,
      fontWeight: '600',
      letterSpacing: -0.4,
      lineHeight: 36,
    },
    hero: {
      fontSize: 26,
      fontWeight: '600',
      letterSpacing: -0.3,
      lineHeight: 32,
    },
    title: {
      fontSize: 20,
      fontWeight: '600',
      letterSpacing: -0.2,
      lineHeight: 26,
    },
    subtitle: {
      fontSize: 16,
      fontWeight: '600',
      letterSpacing: 0,
      lineHeight: 22,
    },
    body: {
      fontSize: 15,
      fontWeight: '400',
      lineHeight: 22,
    },
    caption: {
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 18,
    },
    micro: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.8,
      lineHeight: 14,
    },
    poetic: {
      fontSize: 22,
      fontWeight: '500',
      letterSpacing: -0.2,
      lineHeight: 28,
    },
  },

  fonts: {
    display: 'CormorantGaramond_600SemiBold',
    displayRegular: 'CormorantGaramond_500Medium',
    displayBold: 'CormorantGaramond_700Bold',
    ui: 'SourceSans3_400Regular',
    uiMedium: 'SourceSans3_500Medium',
    uiSemiBold: 'SourceSans3_600SemiBold',
    uiBold: 'SourceSans3_700Bold',
  },
};

export default AME;
