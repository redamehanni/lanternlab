/**
 * Eclairages de reference.
 *
 * Un materiau doit rester coherent sous plusieurs ambiances : ces environnements
 * permettent de le verifier instantanement sans changer le fond.
 */
import { hexToRgb } from '../lib/color';

export type LightEnvironment = {
  id: string;
  label: string;
  /** Teinte multipliee sur le materiau. */
  tint: string;
  /** Force de l application de la teinte (0 = neutre). */
  intensity: number;
  /** Voile pose sur toute la scene, pour simuler l ambiance du lieu. */
  wash: string;
  washOpacity: number;
};

export const ENVIRONMENTS: LightEnvironment[] = [
  {
    id: 'neutre',
    label: 'Lumiere neutre',
    tint: '#ffffff',
    intensity: 0,
    wash: '#ffffff',
    washOpacity: 0,
  },
  {
    id: 'nuit',
    label: 'Nuit profonde',
    tint: '#6f86b8',
    intensity: 0.55,
    wash: '#050914',
    washOpacity: 0.42,
  },
  {
    id: 'ambre',
    label: 'Ambre chaud',
    tint: '#ffb257',
    intensity: 0.45,
    wash: '#3a1c04',
    washOpacity: 0.22,
  },
  {
    id: 'violet',
    label: 'Violet magique',
    tint: '#c07bff',
    intensity: 0.5,
    wash: '#1b0630',
    washOpacity: 0.3,
  },
  {
    id: 'froide',
    label: 'Lumiere froide',
    tint: '#9fd4ff',
    intensity: 0.42,
    wash: '#04141f',
    washOpacity: 0.24,
  },
];

export function getEnvironment(id: string): LightEnvironment {
  return ENVIRONMENTS.find((e) => e.id === id) ?? ENVIRONMENTS[0];
}

export function ambientFor(env: LightEnvironment): {
  color: [number, number, number];
  intensity: number;
} {
  return { color: hexToRgb(env.tint), intensity: env.intensity };
}
