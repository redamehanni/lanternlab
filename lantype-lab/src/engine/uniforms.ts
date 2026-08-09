/**
 * Empaquetage des uniforms pour un RuntimeEffect.
 *
 * On ne devine jamais la disposition memoire : elle est lue dans les metadonnees
 * du shader compile (nom + slot), donc ajouter ou reordonner un uniform dans le
 * SkSL ne casse rien.
 */
import type { RuntimeEffect } from 'canvaskit-wasm';

export function packUniforms(
  effect: RuntimeEffect,
  values: Record<string, number | number[]>,
): Float32Array {
  const data = new Float32Array(effect.getUniformFloatCount());

  for (let i = 0; i < effect.getUniformCount(); i += 1) {
    const name = effect.getUniformName(i);
    const info = effect.getUniform(i);
    const value = values[name];

    if (value === undefined) continue;

    if (typeof value === 'number') {
      data[info.slot] = value;
      continue;
    }

    const count = Math.min(value.length, info.columns * info.rows);
    for (let k = 0; k < count; k += 1) {
      data[info.slot + k] = value[k];
    }
  }

  return data;
}
