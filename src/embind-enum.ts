/** Structural enum value accepted by Emscripten's generated enum setters. */
export interface EmbindEnumInput {
  readonly value: unknown;
}

/** Shared observable shape of an Emscripten enum singleton. */
export interface EmbindEnumValue {
  readonly constructor: Function;
  readonly value: number;
}

/** Builds the function namespace and canonical singleton objects emitted by Embind. */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- The caller supplies its named constant properties.
export function createEmbindEnumNamespace<T extends Function>(
  namespaceName: string,
  entries: ReadonlyArray<readonly [name: string, value: number]>,
): T {
  // SAFETY: This function defines every caller-declared enum constant before returning the namespace.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions, typescript/no-unsafe-type-assertion
  const namespace = function () {} as unknown as T;
  Object.defineProperty(namespace, "name", { configurable: true, value: namespaceName });
  const values: Record<number, EmbindEnumValue> = {};

  for (const [constantName, value] of entries) {
    const constant: EmbindEnumValue = Object.create(namespace.prototype);
    // oxlint-disable-next-line unicorn/consistent-function-scoping -- Every singleton has a distinct constructor identity.
    const constantConstructor = function () {};
    Object.defineProperty(constantConstructor, "name", {
      configurable: true,
      value: `${namespaceName}_${constantName}`,
    });
    Object.defineProperties(constant, {
      constructor: { value: constantConstructor },
      value: { value },
    });
    Object.defineProperty(namespace, constantName, {
      configurable: true,
      enumerable: true,
      value: constant,
      writable: true,
    });
    values[value] = constant;
  }

  Object.defineProperty(namespace, "values", {
    configurable: true,
    enumerable: true,
    value: values,
    writable: true,
  });

  return namespace;
}

/** Reads an enum object's value and applies JavaScript's signed 32-bit conversion. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- Plain JavaScript may pass any value through this Embind boundary.
export function enumInputToI32(input: unknown): number {
  if (input === null) {
    throw new TypeError("Cannot read properties of null (reading 'value')");
  }
  if (input === undefined) {
    throw new TypeError("Cannot read properties of undefined (reading 'value')");
  }
  // SAFETY: Nullish inputs were rejected above; property access is intentionally structural.
  return Number((input as Partial<EmbindEnumInput>).value) | 0;
}

/** Returns the canonical singleton for a raw integer code. */
export function enumValueFromI32<T extends EmbindEnumValue>(
  values: ReadonlyMap<number, T>,
  value: number,
): T | undefined {
  return values.get(value);
}
