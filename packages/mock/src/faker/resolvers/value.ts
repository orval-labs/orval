import {
  type ContextSpec,
  type GeneratorImport,
  getRefInfo,
  isFunction,
  isReference,
  type MockOptions,
  type OpenApiSchemaObject,
  OutputMockType,
  pascal,
} from '@orval/core';
import { prop } from 'remeda';

import type { MockDefinition, MockSchema, MockSchemaObject } from '../../types';
import {
  formatMockFactoryDeclaration,
  getMockFactorySignatureParts,
} from '../../mock-types';
import { overrideVarName } from '../getters';
import { getMockScalar } from '../getters/scalar';

function isRegex(key: string) {
  return key.startsWith('/') && key.endsWith('/');
}

// Drop `[]` array-items segments from a dotted JSON-pointer-ish path. Treating
// the marker as transparent for property override matching lets a bare
// property-name override apply wherever the property literally appears, even
// inside arrays (#2465). Segment-based so both leading (`[].id`) and embedded
// (`foo.[].id`) markers normalize equivalently.
function stripArrayMarkerSegments(s: string): string {
  return s
    .split('.')
    .filter((seg) => seg !== '[]')
    .join('.');
}

export function resolveMockOverride(
  properties: Record<string, unknown> | undefined = {},
  item: OpenApiSchemaObject & { name: string; path?: string },
  nonNullableOption?: boolean,
) {
  const path = item.path ?? `#.${item.name}`;
  // Regex keys still match against the original (un-normalized) path so users
  // can opt into array-scoped targeting explicitly if ever needed.
  const normalizedPath = stripArrayMarkerSegments(path);
  const property = Object.entries(properties).find(([key]) => {
    if (isRegex(key)) {
      const regex = new RegExp(key.slice(1, -1));
      if (regex.test(item.name) || regex.test(path)) {
        return true;
      }
    }

    if (`#.${stripArrayMarkerSegments(key)}` === normalizedPath) {
      return true;
    }

    return false;
  });

  if (!property) {
    return;
  }

  return {
    value: getNullable(
      property[1] as string,
      isNullableSchema(item),
      nonNullableOption,
    ),
    imports: [],
    name: item.name,
    overrided: true,
  };
}

/** OpenAPI 3.0 `nullable: true` or 3.1 `type` unions that include `null`. */
export function isNullableSchema(schema: unknown): boolean {
  if (!schema || typeof schema !== 'object') {
    return false;
  }

  const { type, nullable } = schema as {
    type?: unknown;
    nullable?: unknown;
  };

  return nullable === true || (Array.isArray(type) && type.includes('null'));
}

/** When `nonNullableOption` is true (`override.mock.nonNullable`), omit the null branch. */
export function getNullable(
  value: string,
  nullable?: boolean,
  nonNullableOption?: boolean,
) {
  if (!nullable || nonNullableOption) {
    return value;
  }

  return `faker.helpers.arrayElement([${value}, null])`;
}

/**
 * True when the active faker generator entry asks for consolidated schema
 * mock factories and the output is configured to host them (i.e. there is a
 * dedicated schemas directory we can import `index.faker` from). Used to
 * decide whether an operation factory should inline a `$ref`'d schema or
 * delegate to its `get<X>Mock` factory.
 */
function shouldDelegateToSchemaFactories(context: ContextSpec): boolean {
  if (!context.output.schemas) return false;
  // The duplicate-type guard in `normalizeMocksOption` (see
  // `packages/orval/src/utils/options.ts`) ensures at most one faker entry
  // exists per output, so finding the first one that opted into schemas is
  // unambiguous today and remains correct if that guard ever loosens.
  const fakerEntry = context.output.mock.generators.find(
    (g) =>
      !isFunction(g) && g.type === OutputMockType.FAKER && g.schemas === true,
  );
  return !!fakerEntry;
}

/**
 * Predicate: this `$ref` points at a top-level `#/components/schemas/<Name>`
 * (vs. a parameter, response, or inline schema). Only those have a
 * corresponding `get<Name>Mock` factory in the consolidated faker file.
 */
function isComponentsSchemaRef(refPaths: string[] | undefined): boolean {
  return (
    Array.isArray(refPaths) &&
    refPaths[0] === 'components' &&
    refPaths[1] === 'schemas'
  );
}

/**
 * Returns true when an operation- or tag-level mock override touches any
 * property declared on the referenced schema. In that case we must inline
 * the schema body so the override actually applies; the shared
 * `get<X>Mock` factory has no knowledge of operation-scoped overrides.
 *
 * Reuses `resolveMockOverride` so the same matching rules apply as for
 * regular property mocks — bare name, regex (`/.../`), and exact-path
 * (`#.foo.bar`). The parent's `path` (where the `$ref` appears in the
 * surrounding schema) gets composed into each synthetic property item so
 * exact-path overrides like `#.color.value` resolve correctly.
 */
function hasOverrideTouchingSchema(
  schemaProperties: Record<string, unknown> | undefined,
  mockOptions: MockOptions | undefined,
  operationId: string,
  tags: string[],
  parentPath: string | undefined,
): boolean {
  if (!schemaProperties) return false;
  const propertyNames = Object.keys(schemaProperties);
  if (propertyNames.length === 0) return false;

  const overrideBuckets: (Record<string, unknown> | undefined)[] = [
    mockOptions?.operations?.[operationId]?.properties,
  ];
  for (const tag of tags) {
    overrideBuckets.push(mockOptions?.tags?.[tag]?.properties);
  }

  return overrideBuckets.some((bucket) => {
    if (!bucket) return false;
    return propertyNames.some((propertyName) => {
      const synthetic = {
        name: propertyName,
        path: parentPath ? `${parentPath}.${propertyName}` : propertyName,
      } as OpenApiSchemaObject & { name: string; path?: string };
      return !!resolveMockOverride(bucket, synthetic);
    });
  });
}

interface ResolveMockValueOptions {
  schema: MockSchema;
  operationId: string;
  mockOptions?: MockOptions;
  tags: string[];
  combine?: {
    separator: 'allOf' | 'oneOf' | 'anyOf';
    includedProperties: string[];
  };
  context: ContextSpec;
  imports: GeneratorImport[];
  // This is used to prevent recursion when combining schemas
  // When an element is added to the array, it means on this iteration, we've already seen this property
  existingReferencedProperties: string[];
  splitMockImplementations: string[];
  allowOverride?: boolean;
}

export function resolveMockValue({
  schema,
  mockOptions,
  operationId,
  tags,
  combine,
  context,
  imports,
  existingReferencedProperties,
  splitMockImplementations,
  allowOverride,
}: ResolveMockValueOptions): MockDefinition & { type?: string } {
  if (isReference(schema)) {
    const schemaReference = schema as MockSchema & {
      path?: string;
      required?: string[];
      nullable?: boolean;
    };
    const schemaRefPath = typeof schema.$ref === 'string' ? schema.$ref : '';
    const { name, refPaths } = getRefInfo(schemaRefPath, context);

    const schemaRef = Array.isArray(refPaths)
      ? (prop(
          context.spec,
          // @ts-expect-error: [ts2556] refPaths are not guaranteed to be valid keys of the spec
          ...refPaths,
        ) as Partial<OpenApiSchemaObject>)
      : undefined;

    const newSchema = {
      ...schemaRef,
      name,
      path: schemaReference.path,
      isRef: true,
      required: [
        ...((schemaRef?.required as string[] | undefined) ?? []),
        ...(schemaReference.required ?? []),
      ],
      ...(schemaReference.nullable === undefined
        ? {}
        : { nullable: schemaReference.nullable }),
    } as MockSchemaObject;

    // When a discriminator parent ($ref-loaded schema with both `discriminator`
    // and `oneOf`) is being expanded inside an `allOf` chain AND the chain
    // is rooted at one of that parent's mapping targets (i.e. the current
    // schema *is* a variant via `allOf: [parent, ...extras]`), the parent's
    // `oneOf` is descriptive of the union, not additive to this specific
    // variant. Re-expanding it inlines sibling factory calls into the derived
    // variant's mock body (#2155). Drop the `oneOf` side here; the parent
    // still contributes its own `properties` and other base attributes
    // through the remaining schema fields.
    //
    // The mapping-target check guards against cases like
    // `someField: allOf: [<discriminator parent>]` (e.g. #one-of-nested
    // `Example2.expiry`), where the surrounding schema is NOT a variant of
    // the parent and we still need the full union to randomize over.
    //
    // Symmetrically with the oneOf-side fix in `combineSchemasMock` (#3429),
    // also drop the discriminator key from the parent's `properties`: each
    // variant already carries a constrained discriminator value via
    // `resolveDiscriminators`, so leaving the parent's free-choice enum in
    // would just emit dead code (immediately shadowed by the variant's
    // constrained value through spread merge).
    if (
      combine?.separator === 'allOf' &&
      newSchema.discriminator &&
      newSchema.oneOf
    ) {
      const parentDiscriminator = newSchema.discriminator as {
        propertyName?: string;
        mapping?: Record<string, string>;
      };
      const mappingTargetNames = parentDiscriminator.mapping
        ? Object.values(parentDiscriminator.mapping).map((ref) =>
            pascal(ref.split('/').pop() ?? ''),
          )
        : [];
      const expandingAsVariant = existingReferencedProperties.some((refName) =>
        mappingTargetNames.includes(refName),
      );

      if (expandingAsVariant) {
        const mutableSchema = newSchema as Record<string, unknown>;
        delete mutableSchema.oneOf;
        const parentProperties = newSchema.properties as
          | Record<string, unknown>
          | undefined;
        if (
          parentDiscriminator.propertyName &&
          parentProperties &&
          parentDiscriminator.propertyName in parentProperties
        ) {
          const remainingProperties = Object.fromEntries(
            Object.entries(parentProperties).filter(
              ([key]) => key !== parentDiscriminator.propertyName,
            ),
          );
          if (Object.keys(remainingProperties).length === 0) {
            delete mutableSchema.properties;
          } else {
            mutableSchema.properties = remainingProperties;
          }
          const parentRequired = newSchema.required as string[] | undefined;
          if (Array.isArray(parentRequired)) {
            const filteredRequired = parentRequired.filter(
              (key) => key !== parentDiscriminator.propertyName,
            );
            if (filteredRequired.length === 0) {
              delete mutableSchema.required;
            } else {
              mutableSchema.required = filteredRequired;
            }
          }
        }
      }
    }

    const newSeparator = newSchema.allOf
      ? 'allOf'
      : newSchema.oneOf
        ? 'oneOf'
        : 'anyOf';

    // When schema-level faker factories are being emitted (`schemas: true`),
    // delegate to `get<X>Mock()` instead of inlining the body. The factory
    // already encodes the same fields, so this both deduplicates the output
    // and lets a single source of truth drive shared mocks.
    const canDelegate =
      shouldDelegateToSchemaFactories(context) &&
      isComponentsSchemaRef(refPaths) &&
      !hasOverrideTouchingSchema(
        schemaRef?.properties as Record<string, unknown> | undefined,
        mockOptions,
        operationId,
        tags,
        schemaReference.path,
      );

    if (canDelegate) {
      const factoryName = `get${pascal(name)}Mock`;
      imports.push({
        name: factoryName,
        values: true,
        schemaFactory: true,
      });
      // For object-like refs the historical inline output is `{ ...body }`
      // so the spread form keeps callers (combineSchemasMock, object
      // properties) working without other changes. For everything else
      // (scalars, arrays, nullables) emit the bare call.
      //
      // A `oneOf`/`anyOf` is only object-like when *every* branch resolves to
      // an object. A composition of primitives (e.g. `number | string`) makes
      // the factory return a primitive union, which is not spreadable: emitting
      // `{ ...get<X>Mock() }` is invalid TypeScript (TS2698) and would discard
      // the value as `{}` at runtime, so it must use the bare call (#3200).
      const isObjectLike =
        newSchema.type === 'object' ||
        !!newSchema.allOf ||
        resolvesToObjectLike(newSchema, context);
      const callValue = isObjectLike
        ? `{ ...${factoryName}() }`
        : `${factoryName}()`;

      return {
        value: getNullable(
          callValue,
          Boolean(newSchema.nullable),
          mockOptions?.nonNullable,
        ),
        imports,
        name: newSchema.name,
        type: getType(newSchema),
        nullWrapped: Boolean(newSchema.nullable) && !mockOptions?.nonNullable,
      };
    }

    const scalar = getMockScalar({
      item: newSchema,
      mockOptions,
      operationId,
      tags,
      combine: combine
        ? {
            separator:
              combine.separator === 'anyOf' ? newSeparator : combine.separator,
            includedProperties:
              newSeparator === 'allOf' ? [] : combine.includedProperties,
          }
        : undefined,
      context,
      imports,
      existingReferencedProperties,
      splitMockImplementations,
      allowOverride,
    });
    if (
      scalar.value &&
      (newSchema.type === 'object' || newSchema.allOf) &&
      combine?.separator === 'oneOf'
    ) {
      const funcName = `get${pascal(operationId)}Response${pascal(newSchema.name)}Mock`;
      if (
        !splitMockImplementations.some((f) =>
          f.includes(`export const ${funcName}`),
        )
      ) {
        const discriminator = newSchema.discriminator as
          | { propertyName?: string }
          | undefined;
        const discriminatedProperty = discriminator?.propertyName;

        let overrideType = `Partial<${newSchema.name}>`;
        if (discriminatedProperty) {
          overrideType = `Omit<${overrideType}, '${discriminatedProperty}'>`;
        }

        const { param, returnType, returnCast } = getMockFactorySignatureParts(
          newSchema.name,
          mockOptions,
          {
            isOverridable: true,
            overrideType,
          },
        );
        const func = formatMockFactoryDeclaration(
          funcName,
          param,
          returnType,
          `{${scalar.value.startsWith('...') ? '' : '...'}${scalar.value}, ...${overrideVarName}}`,
          returnCast,
        );
        splitMockImplementations.push(func);
      }

      scalar.value = newSchema.nullable
        ? `${funcName}()`
        : `{...${funcName}()}`;

      scalar.imports.push({ name: newSchema.name });
    }

    return {
      ...scalar,
      type: getType(newSchema),
    };
  }

  const scalar = getMockScalar({
    item: schema,
    mockOptions,
    operationId,
    tags,
    combine,
    context,
    imports,
    existingReferencedProperties,
    splitMockImplementations,
    allowOverride,
  });
  return {
    ...scalar,
    type: getType(schema),
  };
}

function getType(schema: MockSchema) {
  if (isReference(schema)) {
    return;
  }

  return (
    (schema.type as string | undefined) ??
    (schema.properties ? 'object' : schema.items ? 'array' : undefined)
  );
}

// Whether a schema (or a `$ref` to one) ultimately produces an object mock.
// Used to decide if a delegated `get<X>Mock()` call may be spread into an
// object literal. Object-like schemas are `type: 'object'`, `properties`,
// `additionalProperties` and `allOf`; a `oneOf`/`anyOf` qualifies only when
// every branch resolves to an object. A union containing a primitive
// (e.g. `number | string`) does not, since spreading that union is invalid
// TypeScript. `seen` carries the `$ref`s on the current resolution path to
// guard against self-referential compositions. A fresh copy is taken at each
// `$ref` hop so sibling branches sharing a `$ref` don't falsely trip the guard.
function resolvesToObjectLike(
  schema: MockSchema,
  context: ContextSpec,
  seen = new Set<string>(),
): boolean {
  let resolved: Partial<OpenApiSchemaObject> | undefined;

  if (isReference(schema)) {
    // A non-string or already-visited `$ref` can't be resolved further here.
    if (typeof schema.$ref !== 'string' || seen.has(schema.$ref)) {
      return false;
    }
    seen = new Set(seen).add(schema.$ref);
    const { refPaths } = getRefInfo(schema.$ref, context);
    resolved = Array.isArray(refPaths)
      ? (prop(
          context.spec,
          // @ts-expect-error: refPaths are not guaranteed to be valid keys of the spec
          ...refPaths,
        ) as Partial<OpenApiSchemaObject>)
      : undefined;
  } else {
    resolved = schema as Partial<OpenApiSchemaObject>;
  }

  if (!resolved) {
    return false;
  }

  if (
    resolved.type === 'object' ||
    resolved.properties ||
    resolved.additionalProperties ||
    resolved.allOf
  ) {
    return true;
  }

  const branches = (resolved.oneOf ?? resolved.anyOf) as
    | MockSchema[]
    | undefined;
  if (branches && branches.length > 0) {
    return branches.every((branch) =>
      resolvesToObjectLike(branch, context, seen),
    );
  }

  return false;
}
