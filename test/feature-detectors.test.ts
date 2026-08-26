import { expect, test } from "bun:test";

import { AgastFeatureDetector, BindingError, FastFeatureDetector } from "../src/index.js";
import type {
  WasmAgastFeatureDetectorHandle,
  WasmFastFeatureDetectorHandle,
} from "../src/index.js";

interface JavaScriptDetectorCalls {
  delete(first?: number, second?: number): void;
  getDefaultName(extra?: string): string;
  getNonmaxSuppression(extra?: string): boolean;
  getThreshold(extra?: string): number;
  setNonmaxSuppression(value?: JavaScriptScalar, extra?: string): void;
  setThreshold(value?: JavaScriptScalar, extra?: string): void;
}

interface JavaScriptObjectScalar {
  toString(): string;
}

type JavaScriptScalar = boolean | number | JavaScriptObjectScalar | string | null | undefined;

class MemoryDetectorHandle
  implements WasmAgastFeatureDetectorHandle, WasmFastFeatureDetectorHandle
{
  freeCount = 0;

  constructor(
    private readonly name: string,
    private threshold = 10,
    private nonmaxSuppression = true,
    private type = 2,
  ) {}

  free(): void {
    this.freeCount += 1;
  }

  getDefaultName(): string {
    return this.name;
  }

  getNonmaxSuppression(): boolean {
    return this.nonmaxSuppression;
  }

  getThreshold(): number {
    return this.threshold;
  }

  getType(): number {
    return this.type;
  }

  setNonmaxSuppression(value: boolean): void {
    this.nonmaxSuppression = value;
  }

  setThreshold(value: number): void {
    this.threshold = value;
  }

  setType(value: number): void {
    this.type = value;
  }
}

type Detector = AgastFeatureDetector | FastFeatureDetector;
type DetectorConstructor = new (handle: MemoryDetectorHandle) => Detector;

const cases: ReadonlyArray<
  readonly [name: string, constructor: DetectorConstructor, defaultName: string]
> = [
  ["AgastFeatureDetector", AgastFeatureDetector, "Feature2D.AgastFeatureDetector"],
  ["FastFeatureDetector", FastFeatureDetector, "Feature2D.FastFeatureDetector"],
];

for (const [className, DetectorClass, defaultName] of cases) {
  test(`${className} primitive methods enforce OpenCV.js arity without mutation`, () => {
    const detector = new DetectorClass(new MemoryDetectorHandle(defaultName));
    const javascriptDetector: JavaScriptDetectorCalls = detector;

    expect(detector.getDefaultName).toHaveLength(0);
    expect(detector.getNonmaxSuppression).toHaveLength(0);
    expect(detector.getThreshold).toHaveLength(0);
    expect(detector.setNonmaxSuppression).toHaveLength(1);
    expect(detector.setThreshold).toHaveLength(1);

    const wrongArityCalls: ReadonlyArray<readonly [() => void, string]> = [
      [
        () => javascriptDetector.getDefaultName("extra"),
        `function ${className}.getDefaultName called with 1 arguments, expected 0 args!`,
      ],
      [
        () => javascriptDetector.getNonmaxSuppression("extra"),
        `function ${className}.getNonmaxSuppression called with 1 arguments, expected 0 args!`,
      ],
      [
        () => javascriptDetector.getThreshold("extra"),
        `function ${className}.getThreshold called with 1 arguments, expected 0 args!`,
      ],
      [
        () => javascriptDetector.setNonmaxSuppression(),
        `function ${className}.setNonmaxSuppression called with 0 arguments, expected 1 args!`,
      ],
      [
        () => javascriptDetector.setThreshold(),
        `function ${className}.setThreshold called with 0 arguments, expected 1 args!`,
      ],
      [
        () => javascriptDetector.setNonmaxSuppression(false, "extra"),
        `function ${className}.setNonmaxSuppression called with 2 arguments, expected 1 args!`,
      ],
      [
        () => javascriptDetector.setThreshold(25, "extra"),
        `function ${className}.setThreshold called with 2 arguments, expected 1 args!`,
      ],
    ];

    for (const [call, message] of wrongArityCalls) {
      expect(call).toThrow(new BindingError(message));
    }
    expect(detector.getDefaultName()).toBe(defaultName);
    expect(detector.getNonmaxSuppression()).toBe(true);
    expect(detector.getThreshold()).toBe(10);
  });

  test(`${className} primitive setters match Embind scalar conversion`, () => {
    const detector = new DetectorClass(new MemoryDetectorHandle(defaultName));
    const javascriptDetector: JavaScriptDetectorCalls = detector;

    expect(javascriptDetector.setThreshold(27.9)).toBeUndefined();
    expect(detector.getThreshold()).toBe(27);
    javascriptDetector.setThreshold(-27.9);
    expect(detector.getThreshold()).toBe(-27);
    javascriptDetector.setThreshold(Number.NaN);
    expect(detector.getThreshold()).toBe(0);
    javascriptDetector.setThreshold(true);
    expect(detector.getThreshold()).toBe(1);
    javascriptDetector.setThreshold(false);
    expect(detector.getThreshold()).toBe(0);

    const rejected: ReadonlyArray<readonly [JavaScriptScalar, string]> = [
      [
        Number.POSITIVE_INFINITY,
        'Passing a number "Infinity" from JS side to C/C++ side to an argument of type "int", which is outside the valid range [-2147483648, 2147483647]!',
      ],
      [
        2_147_483_648,
        'Passing a number "2147483648" from JS side to C/C++ side to an argument of type "int", which is outside the valid range [-2147483648, 2147483647]!',
      ],
      [null, 'Cannot convert "null" to int'],
      ["25", 'Cannot convert "25" to int'],
      [undefined, 'Cannot convert "undefined" to int'],
    ];
    for (const [value, message] of rejected) {
      expect(() => javascriptDetector.setThreshold(value)).toThrow(new TypeError(message));
      expect(detector.getThreshold()).toBe(0);
    }

    javascriptDetector.setNonmaxSuppression(0);
    expect(detector.getNonmaxSuppression()).toBe(false);
    javascriptDetector.setNonmaxSuppression(1);
    expect(detector.getNonmaxSuppression()).toBe(true);
    javascriptDetector.setNonmaxSuppression("");
    expect(detector.getNonmaxSuppression()).toBe(false);
    javascriptDetector.setNonmaxSuppression({});
    expect(detector.getNonmaxSuppression()).toBe(true);
  });

  test(`${className} supports OpenCV.js deletion and idempotent package disposal`, () => {
    const extraHandle = new MemoryDetectorHandle(defaultName);
    const extraDetector: JavaScriptDetectorCalls = new DetectorClass(extraHandle);
    expect(extraDetector.delete(1, 2)).toBeUndefined();
    expect(extraHandle.freeCount).toBe(1);

    const handle = new MemoryDetectorHandle(defaultName);
    const detector = new DetectorClass(handle);
    expect(detector.delete).toHaveLength(0);
    expect(detector.delete()).toBeUndefined();
    expect(handle.freeCount).toBe(1);
    expect(() => detector.getDefaultName()).toThrow(
      new BindingError(`Cannot pass deleted object as a pointer of type ${className}`),
    );
    expect(() => detector.setNonmaxSuppression(true)).toThrow(
      new BindingError(`Cannot pass deleted object as a pointer of type ${className}`),
    );
    expect(() => detector.setThreshold(20)).toThrow(
      new BindingError(`Cannot pass deleted object as a pointer of type ${className}`),
    );
    expect(() => detector.getNonmaxSuppression()).toThrow(
      new BindingError(`Cannot pass deleted object as a pointer of type ${className} const*`),
    );
    expect(() => detector.getThreshold()).toThrow(
      new BindingError(`Cannot pass deleted object as a pointer of type ${className} const*`),
    );
    expect(() => detector.delete()).toThrow(
      new BindingError(`${className} instance already deleted`),
    );
    expect(detector.dispose()).toBeUndefined();
    expect(handle.freeCount).toBe(1);

    const disposeHandle = new MemoryDetectorHandle(defaultName);
    const disposed = new DetectorClass(disposeHandle);
    expect(disposed.dispose()).toBeUndefined();
    expect(disposed.dispose()).toBeUndefined();
    expect(disposeHandle.freeCount).toBe(1);
  });
}
