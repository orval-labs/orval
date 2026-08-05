import {
  type ContextSpec,
  type GeneratorImport,
  getKey,
  getRefInfo,
  isReference,
  type MockOptions,
  type OpenApiReferenceObject,
  type OpenApiSchemaObject,
  PropertySortOrder,
} from '@orval/core';
import { prop } from 'remeda';

import type { MockDefinition, MockSchema, MockSchemaObject } from '../../types';
import { DEFAULT_OBJECT_KEY_MOCK } from '../constants';
import {
  resolveMockValue,
  getNullable,
  isNullableSchema,
} from '../resolvers/value';
import { mergeReturnedMockImports } from '../imports';
import { combineSchemasMock } from './combine';

export const overrideVarName = 'overrideResponse';

function wrapRootNullableObjectValue(
  value: string,
  schemaItem: MockSchemaObject,
  mockOptions: MockOptions | undefined,
  combine?: GetMockObjectOptions['combine'],
): { value: string; nullWrapped: boolean } {
  const nullableAtRoot =
    !combine && isNullableSchema(schemaItem) && !mockOptions?.nonNullable;

  return {
    value: nullableAtRoot ? getNullable(value, true) : value,
    nullWrapped: nullableAtRoot,
  };
}

function getReferenceName(
  ref: string | undefined,
  context: ContextSpec,
): string {
  if (!ref) return '';

  return getRefInfo(ref, context).name;
}

function resolveRefTarget(
  ref: string | undefined,
  context: ContextSpec,
): Partial<OpenApiSchemaObject> | undefined {
  if (typeof ref !== 'string') return undefined;
  const { refPaths } = getRefInfo(ref, context);
  if (!Array.isArray(refPaths)) return undefined;

  return prop(
    context.spec,
    // @ts-expect-error: [ts2556] refPaths are not guaranteed to be valid keys of the spec
    ...refPaths,
  ) as Partial<OpenApiSchemaObject> | undefined;
}

function isNullableRefTarget(
  ref: string | undefined,
  context: ContextSpec,
): boolean {
  return isNullableSchema(resolveRefTarget(ref, context));
}

// One-hop lookahead for a recursive ref about to be re-expanded: when the
// target's own required `$ref` properties already sit on the resolution path
// and can neither be nulled nor cut, the re-expansion is guaranteed to end in
// casts and collapse back to one. Predicting that here skips the wasted work,
// which otherwise dominates generation time on dense recursive specs.
function reExpansionWouldCollapse(
  ref: string | undefined,
  context: ContextSpec,
  existingReferencedProperties: string[],
  nonNullable: boolean | undefined,
): boolean {
  const target = resolveRefTarget(ref, context);
  const targetProperties = target?.properties as
    | Record<string, OpenApiReferenceObject | OpenApiSchemaObject>
    | undefined;
  const targetRequired = target?.required as string[] | undefined;
  if (!targetProperties || !Array.isArray(targetRequired)) return false;

  return Object.entries(targetProperties).some(([key, property]) => {
    if (!targetRequired.includes(key) || !isReference(property)) return false;
    if (
      !existingReferencedProperties.includes(
        getReferenceName(property.$ref, context),
      )
    ) {
      return false;
    }
    return nonNullable || !isNullableRefTarget(property.$ref, context);
  });
}

interface GetMockObjectOptions {
  item: MockSchemaObject;
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
  // Tracks the current contiguous `allOf` composition to break cyclic
  // inheritance. See `existingReferencedAllOfRefs` docs in getters/combine.ts.
  existingReferencedAllOfRefs?: string[];
  splitMockImplementations: string[];
  // This is used to add the overrideResponse to the object
  allowOverride?: boolean;
}

export function getMockObject({
  item,
  mockOptions,
  operationId,
  tags,
  combine,
  context,
  imports,
  existingReferencedProperties,
  existingReferencedAllOfRefs = [],
  splitMockImplementations,
  allowOverride = false,
}: GetMockObjectOptions): MockDefinition {
  if (isReference(item)) {
    return resolveMockValue({
      schema: {
        ...item,
        name: item.name,
        path: item.path ? `${item.path}.${item.name}` : item.name,
      },
      mockOptions,
      operationId,
      tags,
      context,
      imports,
      existingReferencedProperties,
      existingReferencedAllOfRefs,
      splitMockImplementations,
    });
  }

  const schemaItem = item as MockSchemaObject & Record<string, unknown>;
  const itemAllOf = schemaItem.allOf as MockSchema[] | undefined;
  const itemOneOf = schemaItem.oneOf as MockSchema[] | undefined;
  const itemAnyOf = schemaItem.anyOf as MockSchema[] | undefined;
  const itemType = schemaItem.type as string | string[] | undefined;
  const itemProperties = schemaItem.properties as
    | Record<string, OpenApiReferenceObject | OpenApiSchemaObject>
    | undefined;
  const itemRequired = schemaItem.required as string[] | undefined;
  const itemAdditionalProperties = schemaItem.additionalProperties as
    | boolean
    | OpenApiReferenceObject
    | OpenApiSchemaObject
    | undefined;

  if (itemAllOf || itemOneOf || itemAnyOf) {
    const separator = itemAllOf ? 'allOf' : itemOneOf ? 'oneOf' : 'anyOf';
    return combineSchemasMock({
      item: schemaItem,
      separator,
      mockOptions,
      operationId,
      tags,
      combine,
      context,
      imports,
      existingReferencedProperties,
      existingReferencedAllOfRefs,
      splitMockImplementations,
    });
  }

  if (Array.isArray(itemType)) {
    const nonNullTypes = mockOptions?.nonNullable
      ? itemType.filter((type) => type !== 'null')
      : itemType;

    if (nonNullTypes.length === 0) {
      return { value: 'null', imports: [], name: schemaItem.name };
    }

    if (nonNullTypes.length === 1) {
      return getMockObject({
        item: {
          ...schemaItem,
          type: nonNullTypes[0],
        } as MockSchemaObject & Record<string, unknown>,
        mockOptions,
        operationId,
        tags,
        combine,
        context,
        imports,
        existingReferencedProperties,
        existingReferencedAllOfRefs,
        splitMockImplementations,
        allowOverride,
      });
    }

    // Spread the base schema into each type entry so that object properties
    // (e.g. `properties`, `required`, `additionalProperties`) are preserved.
    // Without this, `{ type: "object", properties: {...} }` collapses to
    // `{ type: "object" }` and the mock generator returns `{}` instead of
    // building the actual object shape. Mirrors the fix in core getters/object.ts.
    const isPropertylessObject =
      !itemProperties &&
      (!itemRequired || itemRequired.length === 0) &&
      !itemAdditionalProperties;

    if (
      isPropertylessObject &&
      nonNullTypes.includes('object') &&
      nonNullTypes.includes('null') &&
      nonNullTypes.every((type) => type === 'object' || type === 'null')
    ) {
      if (mockOptions?.nonNullable) {
        return { value: '{}', imports: [], name: schemaItem.name };
      }

      return {
        value: 'faker.helpers.arrayElement([{}, null])',
        imports: [],
        name: schemaItem.name,
      };
    }

    const baseItem = schemaItem as Record<string, unknown>;
    return combineSchemasMock({
      item: {
        anyOf: nonNullTypes.map((type) => ({
          ...baseItem,
          type,
        })) as unknown as MockSchema[],
        name: schemaItem.name,
      },
      separator: 'anyOf',
      mockOptions,
      operationId,
      tags,
      combine,
      context,
      imports,
      existingReferencedProperties,
      existingReferencedAllOfRefs,
      splitMockImplementations,
    });
  }

  if (itemProperties) {
    let value =
      !combine || combine.separator === 'oneOf' || combine.separator === 'anyOf'
        ? '{'
        : '';
    const imports: GeneratorImport[] = [];
    const includedProperties: string[] = [];

    const entries = Object.entries(itemProperties);
    if (context.output.propertySortOrder === PropertySortOrder.ALPHABETICAL) {
      entries.sort((a, b) => {
        return a[0].localeCompare(b[0], 'en', { numeric: true });
      });
    }
    const propertyScalars = entries
      .map(
        ([key, prop]: [
          string,
          OpenApiReferenceObject | OpenApiSchemaObject,
        ]) => {
          if (combine?.includedProperties.includes(key)) {
            return;
          }

          const isRequired =
            mockOptions?.required ??
            (Array.isArray(itemRequired) ? itemRequired : []).includes(key);

          const hasNullable = 'nullable' in prop && prop.nullable === true;

          const refName = isReference(prop)
            ? getReferenceName(prop.$ref, context)
            : '';
          const refVisits = refName
            ? existingReferencedProperties.filter(
                (existing) => existing === refName,
              ).length
            : 0;

          // A property `$ref` already on the resolution path is recursive.
          // Optional: drop it. Nullable: `null` is valid. Anything else
          // expands once more so the array/union guards a hop deeper can
          // close the cycle with a value the type accepts. At most one such
          // re-expansion per path (any repeated name on the path casts
          // immediately), and a re-expansion that still needed casts inside
          // collapses back to a single cast below: an all-required cycle has
          // no finite value anyway, and unbounded re-expansion blows up the
          // output on dense recursive specs.
          if (refVisits > 0) {
            if (!isRequired) {
              return;
            }
            const keyDefinition = getKey(key);
            if (
              !mockOptions?.nonNullable &&
              (hasNullable ||
                (isReference(prop) && isNullableRefTarget(prop.$ref, context)))
            ) {
              return `${keyDefinition}: null`;
            }
            const inReExpansion =
              new Set(existingReferencedProperties).size !==
              existingReferencedProperties.length;
            if (
              refVisits >= 2 ||
              inReExpansion ||
              (isReference(prop) &&
                reExpansionWouldCollapse(
                  prop.$ref,
                  context,
                  existingReferencedProperties,
                  mockOptions?.nonNullable,
                ))
            ) {
              imports.push({ name: refName });
              return `${keyDefinition}: {} as unknown as ${refName}`;
            }
          }

          const importsBefore = imports.length;
          const resolvedValue = resolveMockValue({
            schema: {
              ...(prop as Record<string, unknown>),
              name: key,
              parentName: schemaItem.name,
              path: schemaItem.path ? `${schemaItem.path}.${key}` : `#.${key}`,
            },
            mockOptions,
            operationId,
            tags,
            context,
            imports,
            existingReferencedProperties,
            // A property value is a fresh mock instance, not part of this
            // object's allOf composition — reset the chain.
            // See `existingReferencedAllOfRefs` docs in getters/combine.ts.
            existingReferencedAllOfRefs: [],
            splitMockImplementations,
          });

          mergeReturnedMockImports(
            imports,
            importsBefore,
            resolvedValue.imports,
          );

          includedProperties.push(key);

          const keyDefinition = getKey(key);

          // A required `$ref` union whose variants were all recursively
          // skipped resolves to `undefined`; cast it so the emitted literal
          // still satisfies the type.
          if (isRequired && refName && resolvedValue.value === 'undefined') {
            imports.push({ name: refName });
            return `${keyDefinition}: undefined as unknown as ${refName}`;
          }

          // A re-expansion that still needed casts gained nothing over
          // casting here directly, so keep the smaller form.
          if (
            isRequired &&
            refVisits > 0 &&
            resolvedValue.value.includes(' as unknown as ')
          ) {
            imports.push({ name: refName });
            return `${keyDefinition}: {} as unknown as ${refName}`;
          }

          const hasDefault = 'default' in prop && prop.default !== undefined;

          if (!isRequired && !resolvedValue.overrided && !hasDefault) {
            const omitValue =
              mockOptions?.nonNullable || !hasNullable ? 'undefined' : 'null';
            return `${keyDefinition}: faker.helpers.arrayElement([${resolvedValue.value}, ${omitValue}])`;
          }

          const isNullable =
            Array.isArray(prop.type) && prop.type.includes('null');
          if (
            isNullable &&
            !resolvedValue.nullWrapped &&
            !resolvedValue.overrided &&
            !mockOptions?.nonNullable
          ) {
            return `${keyDefinition}: faker.helpers.arrayElement([${resolvedValue.value}, null])`;
          }

          return `${keyDefinition}: ${resolvedValue.value}`;
        },
      )
      .filter(Boolean);

    if (allowOverride) {
      propertyScalars.push(`...${overrideVarName}`);
    }

    value += propertyScalars.join(', ');
    value +=
      !combine || combine.separator === 'oneOf' || combine.separator === 'anyOf'
        ? '}'
        : '';

    const { value: finalValue, nullWrapped } = wrapRootNullableObjectValue(
      value,
      schemaItem,
      mockOptions,
      combine,
    );

    return {
      value: finalValue,
      nullWrapped,
      imports,
      name: schemaItem.name,
      includedProperties,
    };
  }

  if (itemAdditionalProperties) {
    if (itemAdditionalProperties === true) {
      const { value: finalValue, nullWrapped } = wrapRootNullableObjectValue(
        `{}`,
        schemaItem,
        mockOptions,
        combine,
      );

      return {
        value: finalValue,
        nullWrapped,
        imports: [],
        name: schemaItem.name,
      };
    }
    const additionalProperties = itemAdditionalProperties;
    if (
      isReference(additionalProperties) &&
      existingReferencedProperties.includes(
        getReferenceName(additionalProperties.$ref, context),
      )
    ) {
      const { value: finalValue, nullWrapped } = wrapRootNullableObjectValue(
        `{}`,
        schemaItem,
        mockOptions,
        combine,
      );

      return {
        value: finalValue,
        nullWrapped,
        imports: [],
        name: schemaItem.name,
      };
    }

    const resolvedValue = resolveMockValue({
      schema: {
        ...additionalProperties,
        name: schemaItem.name,
        path: schemaItem.path ? `${schemaItem.path}.#` : '#',
      },
      mockOptions,
      operationId,
      tags,
      context,
      imports,
      existingReferencedProperties,
      // An additionalProperties value is a fresh mock instance — reset the
      // chain, as with property values above.
      // See `existingReferencedAllOfRefs` docs in getters/combine.ts.
      existingReferencedAllOfRefs: [],
      splitMockImplementations,
    });

    const objectValue = `{
        [${DEFAULT_OBJECT_KEY_MOCK}]: ${resolvedValue.value}
      }`;
    const { value: finalValue, nullWrapped } = wrapRootNullableObjectValue(
      objectValue,
      schemaItem,
      mockOptions,
      combine,
    );

    return {
      ...resolvedValue,
      value: finalValue,
      nullWrapped,
    };
  }

  const { value: finalValue, nullWrapped } = wrapRootNullableObjectValue(
    '{}',
    schemaItem,
    mockOptions,
    combine,
  );

  return { value: finalValue, nullWrapped, imports: [], name: schemaItem.name };
}
