/**
 * Lantype — DA Porte Lanternes.
 * Verre : SkSL Figma (Skia) — voir BASE_LANTYPE_GLASS.md
 */
export const LANTYPE = {
  colors: {
    ambreVif: '#E8A830',
    ambreChaud: '#FF6E0A',
    parchment: '#F0E4C2',
    actif: '#94D2FF',
    encre: '#06040A',
    verre: 'transparent',
    caCyan: 'rgba(100, 200, 255, 0.40)',
    caMagenta: 'rgba(255, 80, 180, 0.35)',
  },

  fonts: {
    display: 'Cinzel_400Regular',
    displaySemiBold: 'Cinzel_600SemiBold',
    body: 'Lora_400Regular',
    bodyItalic: 'Lora_400Regular_Italic',
    monoLight: 'DMMono_300Light',
    mono: 'DMMono_400Regular',
    monoMedium: 'DMMono_500Medium',
  },

  status: {
    undiscovered: {
      label: 'Non découverte',
      dotColor: 'rgba(240,228,194,0.18)',
      textColor: 'rgba(240,228,194,0.22)',
      glow: null,
      dotPulse: false,
    },
    active: {
      label: 'En cours',
      dotColor: 'rgba(148,210,255,0.90)',
      textColor: 'rgba(148,210,255,0.85)',
      glow: { color: 'rgba(148,210,255,1)', opacity: 0.2, radius: 24 },
      dotPulse: true,
    },
    found: {
      label: 'Découverte',
      dotColor: 'rgba(255,195,70,1)',
      textColor: 'rgba(232,168,48,1)',
      glow: { color: 'rgba(232,168,48,1)', opacity: 0.35, radius: 32 },
      dotPulse: false,
    },
  },

  glass: {
    radius: 16,
    paddingV: 22,
    paddingH: 22,
    /** Flou léger cristal — le tint système ajoute encore un peu de matière */
    blurIntensity: 22,
  },
};
