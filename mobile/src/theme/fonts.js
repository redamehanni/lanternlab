/**
 * Chargement des fonts officielles Deuxième Âme + Lantype (Porte Lanternes).
 * Cormorant Garamond (display) + Source Sans 3 (UI).
 * Cinzel / Lora / DM Mono → Lantype uniquement.
 *
 * useFonts vient d'expo-font (pas du package google-fonts) pour éviter
 * les divergences natives Expo Go / SDK.
 */
import { useFonts } from 'expo-font';
import {
  CormorantGaramond_500Medium,
  CormorantGaramond_600SemiBold,
  CormorantGaramond_700Bold,
} from '@expo-google-fonts/cormorant-garamond';
import {
  SourceSans3_400Regular,
  SourceSans3_500Medium,
  SourceSans3_600SemiBold,
  SourceSans3_700Bold,
} from '@expo-google-fonts/source-sans-3';
import {
  Cinzel_400Regular,
  Cinzel_600SemiBold,
} from '@expo-google-fonts/cinzel';
import {
  Lora_400Regular,
  Lora_400Regular_Italic,
} from '@expo-google-fonts/lora';
import {
  DMMono_300Light,
  DMMono_400Regular,
  DMMono_500Medium,
} from '@expo-google-fonts/dm-mono';

export const AME_FONT_MAP = {
  CormorantGaramond_500Medium,
  CormorantGaramond_600SemiBold,
  CormorantGaramond_700Bold,
  SourceSans3_400Regular,
  SourceSans3_500Medium,
  SourceSans3_600SemiBold,
  SourceSans3_700Bold,
  // Lantype (Porte Lanternes)
  Cinzel_400Regular,
  Cinzel_600SemiBold,
  Lora_400Regular,
  Lora_400Regular_Italic,
  DMMono_300Light,
  DMMono_400Regular,
  DMMono_500Medium,
};

export function useAmeFonts() {
  return useFonts(AME_FONT_MAP);
}

export function displayStyle(ame, extra = {}) {
  return {
    fontFamily: ame.fonts.display,
    ...ame.typography.display,
    color: ame.colors.text,
    ...extra,
  };
}

export function titleStyle(ame, extra = {}) {
  return {
    fontFamily: ame.fonts.display,
    ...ame.typography.title,
    color: ame.colors.text,
    ...extra,
  };
}

export function bodyStyle(ame, extra = {}) {
  return {
    fontFamily: ame.fonts.ui,
    ...ame.typography.body,
    color: ame.colors.text,
    ...extra,
  };
}

export function uiSemiBold(ame, extra = {}) {
  return {
    fontFamily: ame.fonts.uiSemiBold,
    ...extra,
  };
}
