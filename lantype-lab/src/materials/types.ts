/**
 * Contrat materiau — le coeur de l'extensibilite du labo.
 *
 * Toute l'interface est GENEREE a partir de ces descriptions. Ajouter le metal,
 * le bois, l'eau ou la fumee ne demande qu'un nouveau module conforme a ce
 * contrat : aucun composant d'interface n'est a ecrire.
 */

export type ControlValue = number | boolean | string | [number, number];

export type Control =
  | {
      kind: 'slider';
      key: string;
      label: string;
      min: number;
      max: number;
      step: number;
      value: number;
      unit?: string;
      hint?: string;
    }
  | { kind: 'color'; key: string; label: string; value: string; hint?: string }
  | { kind: 'toggle'; key: string; label: string; value: boolean; hint?: string }
  | {
      kind: 'select';
      key: string;
      label: string;
      options: { value: number; label: string }[];
      value: number;
      hint?: string;
    }
  | { kind: 'angle'; key: string; label: string; value: number; hint?: string }
  | {
      kind: 'point';
      key: string;
      label: string;
      value: [number, number];
      hint?: string;
    };

export type ParamGroup = {
  id: string;
  label: string;
  controls: Control[];
};

/** Une couche isolable dans le mode Inspect. */
export type LayerDef = {
  id: string;
  label: string;
  /** Valeur passee au shader via l'uniform uLayer. */
  code: number;
};

export type Params = Record<string, Record<string, ControlValue>>;

export type Rect = { x: number; y: number; width: number; height: number };

export type FrameContext = {
  card: Rect;
  stage: { width: number; height: number };
  time: number;
  layerCode: number;
  /** Teinte et intensite de l'environnement lumineux de reference. */
  ambient: { color: [number, number, number]; intensity: number };
};

/** Effets dessines par Skia autour du shader (ombre portee, halo, contour). */
export type RenderPlan = {
  shaderSource: string;
  uniforms: Record<string, number | number[]>;
  /** Rayon (mode arrondi) — conserve pour compat. */
  radius: number;
  /** 0 = arrondi, 1 = coupe droite (chanfrein). */
  cornerType: number;
  /** Taille de la coupe d angle (px), mode coupe droite. */
  chamfer: number;
  /** Rectangle final de la carte, animation comprise. */
  rect: Rect;
  outerShadow?: {
    color: [number, number, number, number];
    blur: number;
    dx: number;
    dy: number;
  };
  glow?: {
    color: [number, number, number, number];
    blur: number;
    spread: number;
    /** Decalage du halo soft vers la source. */
    dx: number;
    dy: number;
    /** 0 = doux, 1 = particules. */
    type: number;
    /** Quantite de particules (0..1). */
    particles: number;
    /** Direction en radians. */
    angle: number;
  };
  border?: {
    color: [number, number, number, number];
    width: number;
    /** 0 = continu, sinon longueur des tirets. */
    dash: number;
    /** 0 = tirets reguliers, 1 = pointilles tres irreguliers. */
    dashIrregularity: number;
    /** Portion du contour eclairee (0..1), 1 = tout le contour. */
    lit: number;
  };
};

export type MaterialModule = {
  id: string;
  label: string;
  /** Description compacte affichee dans le selecteur de materiau. */
  summary: string;
  groups: ParamGroup[];
  layers: LayerDef[];
  /** Construit le plan de rendu complet pour une image donnee. */
  plan(params: Params, ctx: FrameContext): RenderPlan;
};

/** Valeurs par defaut derivees du schema : la source unique reste le schema. */
export function defaultParams(groups: ParamGroup[]): Params {
  const params: Params = {};
  for (const group of groups) {
    params[group.id] = {};
    for (const control of group.controls) {
      params[group.id][control.key] = control.value;
    }
  }
  return params;
}

export function num(params: Params, group: string, key: string, fallback = 0): number {
  const value = params[group]?.[key];
  return typeof value === 'number' ? value : fallback;
}

export function bool(params: Params, group: string, key: string, fallback = false): boolean {
  const value = params[group]?.[key];
  return typeof value === 'boolean' ? value : fallback;
}

export function str(params: Params, group: string, key: string, fallback = '#000000'): string {
  const value = params[group]?.[key];
  return typeof value === 'string' ? value : fallback;
}

export function point(
  params: Params,
  group: string,
  key: string,
  fallback: [number, number] = [0.5, 0.5],
): [number, number] {
  const value = params[group]?.[key];
  return Array.isArray(value) ? (value as [number, number]) : fallback;
}
