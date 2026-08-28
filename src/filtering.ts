/** Border interpolation codes used by neighborhood and geometric operations. */
export const BORDER_CONSTANT = 0 as const;
export const BORDER_REPLICATE = 1 as const;
export const BORDER_REFLECT = 2 as const;
export const BORDER_WRAP = 3 as const;
export const BORDER_REFLECT_101 = 4 as const;
export const BORDER_TRANSPARENT = 5 as const;
export const BORDER_DEFAULT = BORDER_REFLECT_101;
export const BORDER_ISOLATED = 16 as const;

/** Geometric-warp flag bits. */
export const WARP_FILL_OUTLIERS = 8 as const;
export const WARP_INVERSE_MAP = 16 as const;
export const WARP_RELATIVE_MAP = 32 as const;

/** Morphological operation codes. */
export const MORPH_ERODE = 0 as const;
export const MORPH_DILATE = 1 as const;
export const MORPH_OPEN = 2 as const;
export const MORPH_CLOSE = 3 as const;
export const MORPH_GRADIENT = 4 as const;
export const MORPH_TOPHAT = 5 as const;
export const MORPH_BLACKHAT = 6 as const;
export const MORPH_HITMISS = 7 as const;

export type MorphologyOperation =
  | typeof MORPH_ERODE
  | typeof MORPH_DILATE
  | typeof MORPH_OPEN
  | typeof MORPH_CLOSE
  | typeof MORPH_GRADIENT
  | typeof MORPH_TOPHAT
  | typeof MORPH_BLACKHAT;
