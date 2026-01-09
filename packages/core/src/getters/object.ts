import { resolveExampleRefs, resolveValue } from '../resolvers';
import { resolveObject } from '../resolvers/object';
import {
  type ContextSpec,
  type OpenApiReferenceObject,
  type OpenApiSchemaObject,
  PropertySortOrder,
  type ScalarValue,
  SchemaType,
} from '../types';
import { escape, isBoolean, isReference, jsDoc, pascal } from '../utils';
import { combineSchemas } from './combine';
import { getAliasedImports, getImportAliasForRefOrValue } from './imports';
import { getKey } from './keys';
import { getRefInfo } from './ref';

/**
 * Extract enum values from propertyNames schema (OpenAPI 3.1)
 * Returns undefined if propertyNames doesn't have an enum
 */
function getPropertyNamesEnum(item: OpenApiSchemaObject): string[] | undefined {
  if (
    'propertyNames' in item &&
    item.propertyNames &&
    'enum' in item.propertyNames &&
    Array.isArray(item.propertyNames.enum)
  ) {
    return item.propertyNames.enum.filter(
      (val): val is string => typeof val === 'string',
    );
  }
  return undefined;
}

/**
 * Generate index signature key type based on propertyNames enum
 * Returns union type string like "'foo' | 'bar'" or 'string' if no enum
 */
function getIndexSignatureKey(item: OpenApiSchemaObject): string {
  const enumValues = getPropertyNamesEnum(item);
  if (enumValues && enumValues.length > 0) {
    return enumValues.map((val) => `'${val}'`).join(' | ');
  }
  return 'string';
}

interface GetObjectOptions {
  item: OpenApiSchemaObject;
  name?: string;
  context: ContextSpec;
  nullable: string;
  /**
   * Override resolved values for properties at THIS level only.
   * Not passed to nested schemas. Used by form-data for file type handling.
   */
  propertyOverrides?: Record<string, ScalarValue>;
}

/**
 * Return the output type from an object
 *
 * @param item item with type === "object"
 */
export function getObject({
  item,
  name,
  context,
  nullable,
  propertyOverrides,
}: GetObjectOptions): ScalarValue {
  if (isReference(item)) {
    const { name } = getRefInfo(item.$ref, context);
    return {
      value: name + nullable,
      imports: [{ name }],
      schemas: [],
      isEnum: false,
      type: 'object',
      isRef: true,
      hasReadonlyProps: item.readOnly ?? false,
      dependencies: [name],
      example: item.example,
      examples: resolveExampleRefs(item.examples, context),
    };
  }

  if (item.allOf || item.oneOf || item.anyOf) {
    const separator = item.allOf ? 'allOf' : item.oneOf ? 'oneOf' : 'anyOf';

    return combineSchemas({
      schema: item,
      name,
      separator,
      context,
      nullable,
    });
  }

  if (Array.isArray(item.type)) {
    return combineSchemas({
      schema: {
        anyOf: item.type.map((type) => ({
          ...item,
          type,
        })),
      },
      name,
      separator: 'anyOf',
      context,
      nullable,
    });
  }

  if (item.properties && Object.entries(item.properties).length > 0) {
    const entries = Object.entries(item.properties);
    if (context.output.propertySortOrder === PropertySortOrder.ALPHABETICAL) {
      entries.sort((a, b) => {
        return a[0].localeCompare(b[0]);
      });
    }
    return entries.reduce(
      (
        acc,
        [key, schema]: [string, OpenApiReferenceObject | OpenApiSchemaObject],
        index,
        arr,
      ) => {
        const isRequired = (
          Array.isArray(item.required) ? item.required : []
        ).includes(key);

        let propName = '';

        if (name) {
          const isKeyStartWithUnderscore = key.startsWith('_');

          propName += pascal(
            `${isKeyStartWithUnderscore ? '_' : ''}${name}_${key}`,
          );
        }

        const allSpecSchemas = context.spec.components?.schemas ?? {};

        const isNameAlreadyTaken = Object.keys(allSpecSchemas).some(
          (schemaName) => pascal(schemaName) === propName,
        );

        if (isNameAlreadyTaken) {
          propName = propName + 'Property';
        }

        // Check for override first, fall back to standard resolution
        const resolvedValue =
          propertyOverrides?.[key] ??
          resolveObject({
            schema,
            propName,
            context,
          });

        const isReadOnly = item.readOnly || schema.readOnly;
        if (!index) {
          acc.value += '{';
        }

        const doc = jsDoc(schema, true, context);

        acc.hasReadonlyProps ||= isReadOnly || false;

        const constValue = 'const' in schema ? schema.const : undefined;
        const hasConst = constValue !== undefined;
        let constLiteral: string | undefined;

        if (!hasConst) {
          constLiteral = undefined;
        } else if (typeof constValue === 'string') {
          constLiteral = `'${escape(constValue)}'`;
        } else {
          constLiteral = JSON.stringify(constValue);
        }

        const needsValueImport =
          hasConst && (resolvedValue.isEnum || resolvedValue.type === 'enum');

        const aliasedImports: GeneratorImport[] = needsValueImport
          ? resolvedValue.imports.map((imp) => ({ ...imp, isConstant: true }))
          : hasConst
            ? []
            : getAliasedImports({ name, context, resolvedValue });

        if (aliasedImports.length > 0) {
          acc.imports.push(...aliasedImports);
        }

        const alias = getImportAliasForRefOrValue({
          context,
          resolvedValue,
          imports: aliasedImports,
        });

        const propValue = needsValueImport ? alias : (constLiteral ?? alias);

        acc.value += `\n  ${doc ? `${doc}  ` : ''}${
          isReadOnly && !context.output.override.suppressReadonlyModifier
            ? 'readonly '
            : ''
        }${getKey(key)}${isRequired ? '' : '?'}: ${propValue};`;
        acc.schemas.push(...resolvedValue.schemas);
        acc.dependencies.push(...resolvedValue.dependencies);

        if (arr.length - 1 === index) {
          if (item.additionalProperties) {
            const keyType = getIndexSignatureKey(item);
            if (isBoolean(item.additionalProperties)) {
              acc.value += `\n  [key: ${keyType}]: unknown;\n }`;
            } else {
              const resolvedValue = resolveValue({
                schema: item.additionalProperties,
                name,
                context,
              });
              acc.value += `\n  [key: ${keyType}]: ${resolvedValue.value};\n}`;
              acc.dependencies.push(...resolvedValue.dependencies);
            }
          } else {
            acc.value += '\n}';
          }

          acc.value += nullable;
        }

        return acc;
      },
      {
        imports: [],
        schemas: [],
        value: '',
        isEnum: false,
        type: 'object' as SchemaType,
        isRef: false,
        schema: {},
        hasReadonlyProps: false,
        dependencies: [],
        example: item.example,
        examples: resolveExampleRefs(item.examples, context),
      } as ScalarValue,
    );
  }

  if (item.additionalProperties) {
    const keyType = getIndexSignatureKey(item);
    if (isBoolean(item.additionalProperties)) {
      return {
        value: `{ [key: ${keyType}]: unknown }` + nullable,
        imports: [],
        schemas: [],
        isEnum: false,
        type: 'object',
        isRef: false,
        hasReadonlyProps: item.readOnly || false,
        dependencies: [],
      };
    }
    const resolvedValue = resolveValue({
      schema: item.additionalProperties,
      name,
      context,
    });
    return {
      value: `{[key: ${keyType}]: ${resolvedValue.value}}` + nullable,
      imports: resolvedValue.imports ?? [],
      schemas: resolvedValue.schemas ?? [],
      isEnum: false,
      type: 'object',
      isRef: false,
      hasReadonlyProps: resolvedValue.hasReadonlyProps,
      dependencies: resolvedValue.dependencies,
    };
  }

  const itemWithConst = item;
  if (itemWithConst.const) {
    return {
      value: `'${itemWithConst.const}'`,
      imports: [],
      schemas: [],
      isEnum: false,
      type: 'string',
      isRef: false,
      hasReadonlyProps: item.readOnly || false,
      dependencies: [],
    };
  }

  const keyType =
    item.type === 'object' ? getIndexSignatureKey(item) : 'string';
  return {
    value:
      (item.type === 'object' ? `{ [key: ${keyType}]: unknown }` : 'unknown') +
      nullable,
    imports: [],
    schemas: [],
    isEnum: false,
    type: 'object',
    isRef: false,
    hasReadonlyProps: item.readOnly || false,
    dependencies: [],
  };
}
