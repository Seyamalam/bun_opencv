export type ParityStatus = "implemented" | "planned";

export interface ParityEntry {
  readonly implementationOrigin: "not-started" | "original";
  readonly method: string;
  readonly module: "core" | "imgproc";
  readonly notes: string;
  readonly patentReview: "required" | "reviewed";
  readonly sources: readonly string[];
  readonly status: ParityStatus;
  readonly upstream: string;
  readonly wasmExport?: string;
}

export interface ParityManifest {
  readonly baseline: string;
  readonly baselineSource: string;
  readonly entries: readonly ParityEntry[];
  readonly inventoryPolicy: string;
  readonly packageVersion: string;
  readonly schemaVersion: 1;
}

export const PARITY_MANIFEST = {
  baseline: "OpenCV.js 4.13.0 public browser bindings",
  baselineSource: "https://github.com/opencv/opencv/blob/4.13.0/platforms/js/opencv_js.config.py",
  entries: [
    {
      implementationOrigin: "original",
      method: "grayscale",
      module: "imgproc",
      notes: "Converts RGBA pixels with fixed-point BT.601 luma weights and preserves alpha.",
      patentReview: "required",
      sources: ["https://docs.opencv.org/4.13.0/d8/d01/group__imgproc__color__conversions.html"],
      status: "implemented",
      upstream: "cv::cvtColor with COLOR_RGBA2GRAY",
      wasmExport: "grayscaleRgba",
    },
    {
      implementationOrigin: "original",
      method: "invert",
      module: "core",
      notes: "Inverts RGB channels and preserves alpha.",
      patentReview: "required",
      sources: ["https://docs.opencv.org/4.13.0/d2/de8/group__core__array.html"],
      status: "implemented",
      upstream: "cv::bitwise_not",
      wasmExport: "invertRgba",
    },
    {
      implementationOrigin: "original",
      method: "resizeNearest",
      module: "imgproc",
      notes: "Resizes RGBA pixels with nearest-neighbor sampling.",
      patentReview: "required",
      sources: ["https://docs.opencv.org/4.13.0/da/d54/group__imgproc__transform.html"],
      status: "implemented",
      upstream: "cv::resize with INTER_NEAREST",
      wasmExport: "resizeNearestRgba",
    },
    {
      implementationOrigin: "original",
      method: "threshold",
      module: "imgproc",
      notes: "Applies an inclusive binary threshold to luma and preserves alpha.",
      patentReview: "required",
      sources: ["https://docs.opencv.org/4.13.0/d7/d1b/group__imgproc__misc.html"],
      status: "implemented",
      upstream: "cv::threshold with THRESH_BINARY",
      wasmExport: "thresholdRgba",
    },
    {
      implementationOrigin: "not-started",
      method: "cvtColor",
      module: "imgproc",
      notes: "General color conversion codes are not implemented.",
      patentReview: "required",
      sources: ["https://docs.opencv.org/4.13.0/d8/d01/group__imgproc__color__conversions.html"],
      status: "planned",
      upstream: "cv::cvtColor",
    },
    {
      implementationOrigin: "not-started",
      method: "gaussianBlur",
      module: "imgproc",
      notes: "Kernel-based Gaussian blur is not implemented.",
      patentReview: "required",
      sources: ["https://docs.opencv.org/4.13.0/d4/d86/group__imgproc__filter.html"],
      status: "planned",
      upstream: "cv::GaussianBlur",
    },
    {
      implementationOrigin: "not-started",
      method: "canny",
      module: "imgproc",
      notes: "Canny edge detection is not implemented.",
      patentReview: "required",
      sources: ["https://docs.opencv.org/4.13.0/dd/d1a/group__imgproc__feature.html"],
      status: "planned",
      upstream: "cv::Canny",
    },
    {
      implementationOrigin: "not-started",
      method: "findContours",
      module: "imgproc",
      notes: "Contour extraction is not implemented.",
      patentReview: "required",
      sources: ["https://docs.opencv.org/4.13.0/d3/dc0/group__imgproc__shape.html"],
      status: "planned",
      upstream: "cv::findContours",
    },
    {
      implementationOrigin: "not-started",
      method: "warpPerspective",
      module: "imgproc",
      notes: "Perspective transforms are not implemented.",
      patentReview: "required",
      sources: ["https://docs.opencv.org/4.13.0/da/d54/group__imgproc__transform.html"],
      status: "planned",
      upstream: "cv::warpPerspective",
    },
  ],
  inventoryPolicy: "Independently authored from public documentation and runtime behavior",
  packageVersion: "0.1.0",
  schemaVersion: 1,
} as const satisfies ParityManifest;
