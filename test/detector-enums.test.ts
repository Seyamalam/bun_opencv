import { expect, test } from "bun:test";

/* oxlint-disable anti-slop/no-runtime-typeof, anti-slop/no-chained-type-assertions, anti-slop/require-safety-comment-for-type-assertion, anti-slop/no-unknown-parameters, anti-slop/no-unknown-returns, typescript/no-unsafe-type-assertion, typescript/no-base-to-string */

import {
  AgastFeatureDetector,
  AgastFeatureDetector_DetectorType,
  AKAZE,
  AKAZE_DescriptorType,
  BindingError,
  FastFeatureDetector,
  FastFeatureDetector_DetectorType,
  KAZE,
  KAZE_DiffusivityType,
} from "../src/index.js";
import type { EmbindEnumValue } from "../src/index.js";

const namespaceCases = [
  [
    "AKAZE_DescriptorType",
    AKAZE_DescriptorType,
    ["DESCRIPTOR_KAZE_UPRIGHT", "DESCRIPTOR_KAZE", "DESCRIPTOR_MLDB_UPRIGHT", "DESCRIPTOR_MLDB"],
    [2, 3, 4, 5],
  ],
  [
    "KAZE_DiffusivityType",
    KAZE_DiffusivityType,
    ["DIFF_PM_G1", "DIFF_PM_G2", "DIFF_WEICKERT", "DIFF_CHARBONNIER"],
    [0, 1, 2, 3],
  ],
  [
    "AgastFeatureDetector_DetectorType",
    AgastFeatureDetector_DetectorType,
    ["AGAST_5_8", "AGAST_7_12d", "AGAST_7_12s", "OAST_9_16"],
    [0, 1, 2, 3],
  ],
  [
    "FastFeatureDetector_DetectorType",
    FastFeatureDetector_DetectorType,
    ["TYPE_5_8", "TYPE_7_12", "TYPE_9_16"],
    [0, 1, 2],
  ],
] as const;

test("detector enum namespaces expose Embind singleton objects", () => {
  for (const [namespaceName, namespace, constantNames, values] of namespaceCases) {
    expect(typeof namespace).toBe("function");
    expect(namespace.name).toBe(namespaceName);
    expect(new Set(Object.keys(namespace))).toEqual(new Set([...constantNames, "values"]));
    const valueLookup = (
      namespace as unknown as Function & {
        readonly values: Readonly<Record<number, EmbindEnumValue>>;
      }
    ).values;
    expect(Object.keys(valueLookup)).toEqual(values.map(String));

    for (const [index, constantName] of constantNames.entries()) {
      const constant = (namespace as unknown as Function & Record<string, EmbindEnumValue>)[
        constantName
      ]!;
      expect(Object.getOwnPropertyDescriptor(namespace, constantName)).toMatchObject({
        configurable: true,
        enumerable: true,
        writable: true,
      });
      expect(constant.value).toBe(values[index]!);
      expect(Object.keys(constant)).toEqual([]);
      expect(Object.getOwnPropertyNames(constant)).toEqual(["constructor", "value"]);
      expect(Object.getOwnPropertyDescriptor(constant, "value")).toMatchObject({
        configurable: false,
        enumerable: false,
        writable: false,
      });
      expect(Object.getOwnPropertyDescriptor(constant, "constructor")).toMatchObject({
        configurable: false,
        enumerable: false,
        writable: false,
      });
      expect(constant.constructor.name).toBe(`${namespaceName}_${constantName}`);
      expect(Object.getPrototypeOf(constant)).toBe(namespace.prototype);
      expect(constant instanceof namespace).toBe(true);
      expect(Object.isExtensible(constant)).toBe(true);
      expect(Object.isSealed(constant)).toBe(false);
      expect(Object.isFrozen(constant)).toBe(false);
      expect(String(constant)).toBe("[object Object]");
      expect(Number(constant)).toBeNaN();
      expect(JSON.stringify(constant)).toBe("{}");
      expect(valueLookup[values[index]!]).toBe(constant);
    }
  }
});

class EnumHandle {
  free(): void {}
  getDefaultName(): string {
    return "Feature2D.Enum";
  }
  getDescriptorChannels(): number {
    return 3;
  }
  getDescriptorSize(): number {
    return 0;
  }
  getDescriptorType(): number {
    return this.descriptorType;
  }
  getDiffusivity(): number {
    return this.diffusivity;
  }
  getNOctaveLayers(): number {
    return 4;
  }
  getNOctaves(): number {
    return 4;
  }
  getThreshold(): number {
    return 0.001;
  }
  getExtended(): boolean {
    return false;
  }
  getUpright(): boolean {
    return false;
  }
  getNonmaxSuppression(): boolean {
    return true;
  }
  getType(): number {
    return this.type;
  }
  setDescriptorChannels(): void {}
  setDescriptorSize(): void {}
  setDescriptorType(value: number): void {
    this.descriptorType = value;
  }
  setDiffusivity(value: number): void {
    this.diffusivity = value;
  }
  setNOctaveLayers(): void {}
  setNOctaves(): void {}
  setThreshold(): void {}
  setExtended(): void {}
  setUpright(): void {}
  setNonmaxSuppression(): void {}
  setType(value: number): void {
    this.type = value;
  }

  descriptorType = 5;
  diffusivity = 1;
  type = 2;
}

test("detector enum methods return canonical objects and use structural ToInt32 setters", () => {
  const akazeHandle = new EnumHandle();
  const akaze = new AKAZE(akazeHandle);
  const kaze = new KAZE(new EnumHandle());
  const agast = new AgastFeatureDetector(new EnumHandle());
  const fast = new FastFeatureDetector(new EnumHandle());

  expect(akaze.getDescriptorType()).toBe(AKAZE_DescriptorType.DESCRIPTOR_MLDB);
  expect(akaze.getDiffusivity()).toBe(KAZE_DiffusivityType.DIFF_PM_G2);
  expect(kaze.getDiffusivity()).toBe(KAZE_DiffusivityType.DIFF_PM_G2);
  expect(akaze.getDiffusivity()).toBe(kaze.getDiffusivity());
  expect(agast.getType()).toBe(AgastFeatureDetector_DetectorType.AGAST_7_12s);
  expect(fast.getType()).toBe(FastFeatureDetector_DetectorType.TYPE_9_16);

  const javascriptAkaze = akaze as AKAZE & {
    getDescriptorType(extra?: unknown): unknown;
    setDescriptorType(value?: unknown, extra?: unknown): void;
  };
  expect(() => javascriptAkaze.getDescriptorType(1)).toThrow(
    new BindingError("function AKAZE.getDescriptorType called with 1 arguments, expected 0 args!"),
  );
  expect(() => javascriptAkaze.setDescriptorType()).toThrow(
    new BindingError("function AKAZE.setDescriptorType called with 0 arguments, expected 1 args!"),
  );
  expect(() => javascriptAkaze.setDescriptorType({ value: 1 }, 2)).toThrow(
    new BindingError("function AKAZE.setDescriptorType called with 2 arguments, expected 1 args!"),
  );

  const inputs: ReadonlyArray<readonly [unknown, number]> = [
    [{ value: 1.9 }, 1],
    [{ value: "2" }, 2],
    [{ value: true }, 1],
    [{ value: Number.NaN }, 0],
    [{ value: Number.POSITIVE_INFINITY }, 0],
    [{ value: 4_294_967_296 }, 0],
    [{}, 0],
    [2, 0],
    ["2", 0],
    [true, 0],
  ];
  for (const [input, expected] of inputs) {
    javascriptAkaze.setDescriptorType(input);
    expect(akazeHandle.descriptorType).toBe(expected);
  }
  expect(() => javascriptAkaze.setDescriptorType(null)).toThrow(
    new TypeError("Cannot read properties of null (reading 'value')"),
  );
  expect(() => javascriptAkaze.setDescriptorType(undefined)).toThrow(
    new TypeError("Cannot read properties of undefined (reading 'value')"),
  );

  javascriptAkaze.setDescriptorType({ value: -1 });
  expect(akaze.getDescriptorType()).toBeUndefined();
});

test("detector enum methods use const getter and mutable setter lifetime errors", () => {
  const kaze = new KAZE(new EnumHandle());
  kaze.delete();
  expect(() => kaze.getDiffusivity()).toThrow(
    new BindingError("Cannot pass deleted object as a pointer of type KAZE const*"),
  );
  expect(() => kaze.setDiffusivity(KAZE_DiffusivityType.DIFF_PM_G1)).toThrow(
    new BindingError("Cannot pass deleted object as a pointer of type KAZE"),
  );
});
