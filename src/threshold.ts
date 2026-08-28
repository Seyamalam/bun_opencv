/** Base threshold operations and automatic threshold-selection flags. */
export const THRESH_BINARY = 0 as const;
export const THRESH_BINARY_INV = 1 as const;
export const THRESH_TRUNC = 2 as const;
export const THRESH_TOZERO = 3 as const;
export const THRESH_TOZERO_INV = 4 as const;
export const THRESH_MASK = 7 as const;
export const THRESH_OTSU = 8 as const;
export const THRESH_TRIANGLE = 16 as const;
export const THRESH_DRYRUN = 128 as const;

export type ThresholdMode =
  | typeof THRESH_BINARY
  | typeof THRESH_BINARY_INV
  | typeof THRESH_TRUNC
  | typeof THRESH_TOZERO
  | typeof THRESH_TOZERO_INV;
