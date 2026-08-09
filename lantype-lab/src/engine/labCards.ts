/** Cartes nommees du simulateur Material Lab. */
import { getMaterial } from '../materials/registry';
import { defaultParams, type Params } from '../materials/types';

export type LabCard = {
  id: string;
  name: string;
  width: number;
  height: number;
  /** Decalage vs centre du cadre (px). */
  offsetX: number;
  offsetY: number;
  /** Petit label (ex. EN COURS). */
  eyebrow: string;
  /** Titre principal. */
  title: string;
  /** Corps / citation. */
  body: string;
  /** Afficher le texte sur la carte. */
  showText: boolean;
  /** Inclination haut/bas (deg). */
  rotateX: number;
  /** Inclinaison 3/4 gauche/droite (deg). */
  rotateY: number;
  /** Roullis (deg). */
  rotateZ: number;
  /** Distance camera (px) — plus petit = effet plus fort. */
  perspective: number;
  /** Style verre propre a cette carte (params materiau). */
  params: Params;
  /** Preset associe (null = style libre / edite a la main). */
  styleId: string | null;
  /** Nom affiche du style. */
  styleName: string;
};

export function cloneParams(params: Params): Params {
  return JSON.parse(JSON.stringify(params)) as Params;
}

export function defaultCardParams(materialId = 'glass'): Params {
  return defaultParams(getMaterial(materialId).groups);
}

export function createLabCard(
  name: string,
  overrides: Partial<Omit<LabCard, 'id' | 'name'>> = {},
): LabCard {
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
  const label = name.trim() || 'Carte';
  const { params: paramsOverride, ...rest } = overrides;
  return {
    id: `card-${stamp}`,
    name: label,
    width: 316,
    height: 122,
    offsetX: 0,
    offsetY: 0,
    eyebrow: 'EN COURS',
    title: label.toUpperCase(),
    body: '« Ajoutez votre texte ici. »',
    showText: true,
    rotateX: 0,
    rotateY: 0,
    rotateZ: 0,
    perspective: 1200,
    styleId: null,
    styleName: 'Style libre',
    ...rest,
    params: cloneParams(paramsOverride ?? defaultCardParams('glass')),
  };
}

export function defaultLabCards(): LabCard[] {
  return [
    createLabCard('Carte 1', {
      title: 'LANTERNE DU PONT NEUF',
      body: '« Sous l’arche, un murmure d’ambre attend celui qui sait regarder. »',
    }),
  ];
}
