/** Interpolation codes exposed by the pinned OpenCV.js resize and warp bindings. */
export const INTER_NEAREST = 0 as const;
export const INTER_LINEAR = 1 as const;
export const INTER_CUBIC = 2 as const;
export const INTER_AREA = 3 as const;
export const INTER_LANCZOS4 = 4 as const;
export const INTER_LINEAR_EXACT = 5 as const;
export const INTER_NEAREST_EXACT = 6 as const;

export type Interpolation =
  | typeof INTER_NEAREST
  | typeof INTER_LINEAR
  | typeof INTER_CUBIC
  | typeof INTER_AREA
  | typeof INTER_LANCZOS4
  | typeof INTER_LINEAR_EXACT
  | typeof INTER_NEAREST_EXACT;
