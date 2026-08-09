/**
 * Registre des materiaux.
 *
 * Ajouter le metal, le bois, l'eau, la fumee ou les particules = ecrire un
 * module conforme au contrat MaterialModule et l'inscrire ici. Rien d'autre.
 */
import type { MaterialModule } from './types';
import { glassMaterial } from './glass';

export const MATERIALS: MaterialModule[] = [glassMaterial];

export function getMaterial(id: string): MaterialModule {
  return MATERIALS.find((m) => m.id === id) ?? MATERIALS[0];
}
