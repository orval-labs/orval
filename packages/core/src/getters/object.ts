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
import {
  escape,
  isBoolean,
  isReference,
  isString,
  jsDoc,
  pascal,
} from '../utils';
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
    return item.propertyNames.enum.filter((val): val is string =>
      isString(val),
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

function getPropertyNamesRecordType(
  item: OpenApiSchemaObject,
  valueType: string,
): string | undefined {
  const enumValues = getPropertyNamesEnum(item);
  if (!enumValues || enumValues.length === 0) {
    return undefined;
  }

  const keyType = enumValues.map((val) => `'${val}'`).join(' | ');
  return `Partial<Record<${keyType}, ${valueType}>>`;
}

/**
 * Context for multipart/form-data type generation.
 * Discriminated union with two states:
 *
 * 1. `{ atPart: false, encoding }` - At form-data root, before property iteration
 *    - May traverse through allOf/anyOf/oneOf to reach properties
 *    - Carries encoding map so getObject can look up `encoding[key]`
 *
 * 2. `{ atPart: true, partContentType }` - At a multipart part (top-level property)
 *    - `partContentType` = Encoding Object's `contentType` for this part
 *    - Used by getScalar for file type detection (precedence over contentMediaType)
 *    - Arrays pass this through to items; combiners inside arrays also get context
 *
 * `undefined` means not in form-data context (or nested inside plain object field = JSON)
 */
export type FormDataContext =
  | { atPart: false; encoding: Record<string, { contentType?: string }> }
  | { atPart: true; partContentType?: string };

interface GetObjectOptions {
  item: OpenApiSchemaObject;
  name?: string;
  context: ContextSpec;
  nullable: string;
  /**
   * Multipart/form-data context for file type handling.
   * @see FormDataContext
   */
  formDataContext?: FormDataContext;
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
  formDataContext,
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
      formDataContext,
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
    const acc: ScalarValue = {
      imports: [],
      schemas: [],
      value: '',
      isEnum: false,
      type: 'object' as SchemaType,
      isRef: false,
      schema: {},
      hasReadonlyProps: false,
      useTypeAlias: false,
      dependencies: [],
      example: item.example,
      examples: resolveExampleRefs(item.examples, context),
    };
    for (const [index, [key, schema]] of entries.entries()) {
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

      // Transition multipart context: atPart: false → atPart: true
      // Look up encoding[key].contentType and pass to property resolution
      const propertyFormDataContext: FormDataContext | undefined =
        formDataContext && !formDataContext.atPart
          ? {
              atPart: true,
              partContentType: formDataContext.encoding[key]?.contentType, // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- Record index access can return undefined at runtime
            }
          : undefined;

      const resolvedValue = resolveObject({
        schema,
        propName,
        context,
        formDataContext: propertyFormDataContext,
      });

      const isReadOnly = item.readOnly ?? schema.readOnly;
      if (!index) {
        acc.value += '{';
      }

      const doc = jsDoc(schema, true, context);

      if (isReadOnly ?? false) {
        acc.hasReadonlyProps = true;
      }

      const constValue = 'const' in schema ? schema.const : undefined;
      const hasConst = constValue !== undefined;
      let constLiteral: string | undefined;

      if (!hasConst) {
        constLiteral = undefined;
      } else if (isString(constValue)) {
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

      const finalPropValue = isRequired
        ? propValue
        : context.output.override.useNullForOptional === true
          ? `${propValue} | null`
          : propValue;

      acc.value += `\n  ${doc ? `${doc}  ` : ''}${
        isReadOnly && !context.output.override.suppressReadonlyModifier
          ? 'readonly '
          : ''
      }${getKey(key)}${isRequired ? '' : '?'}: ${finalPropValue};`;
      acc.schemas.push(...resolvedValue.schemas);
      acc.dependencies.push(...resolvedValue.dependencies);

      if (entries.length - 1 === index) {
        if (item.additionalProperties) {
          if (isBoolean(item.additionalProperties)) {
            const recordType = getPropertyNamesRecordType(item, 'unknown');
            if (recordType) {
              acc.value += '\n}';
              acc.value += ` & ${recordType}`;
              acc.useTypeAlias = true;
            } else {
              const keyType = getIndexSignatureKey(item);
              acc.value += `\n  [key: ${keyType}]: unknown;\n }`;
            }
          } else {
            const resolvedValue = resolveValue({
              schema: item.additionalProperties,
              name,
              context,
            });
            const recordType = getPropertyNamesRecordType(
              item,
              resolvedValue.value,
            );
            if (recordType) {
              acc.value += '\n}';
              acc.value += ` & ${recordType}`;
              acc.useTypeAlias = true;
            } else {
              const keyType = getIndexSignatureKey(item);
              acc.value += `\n  [key: ${keyType}]: ${resolvedValue.value};\n}`;
            }
            acc.dependencies.push(...resolvedValue.dependencies);
          }
        } else {
          acc.value += '\n}';
        }

        acc.value += nullable;
      }
    }
    return acc;
  }

  if (item.additionalProperties) {
    if (isBoolean(item.additionalProperties)) {
      const recordType = getPropertyNamesRecordType(item, 'unknown');
      if (recordType) {
        return {
          value: recordType + nullable,
          imports: [],
          schemas: [],
          isEnum: false,
          type: 'object',
          isRef: false,
          hasReadonlyProps: item.readOnly ?? false,
          useTypeAlias: true,
          dependencies: [],
        };
      }
      const keyType = getIndexSignatureKey(item);
      return {
        value: `{ [key: ${keyType}]: unknown }` + nullable,
        imports: [],
        schemas: [],
        isEnum: false,
        type: 'object',
        isRef: false,
        hasReadonlyProps: item.readOnly ?? false,
        useTypeAlias: false,
        dependencies: [],
      };
    }
    const resolvedValue = resolveValue({
      schema: item.additionalProperties,
      name,
      context,
    });
    const recordType = getPropertyNamesRecordType(item, resolvedValue.value);
    if (recordType) {
      return {
        value: recordType + nullable,
        imports: resolvedValue.imports,
        schemas: resolvedValue.schemas,
        isEnum: false,
        type: 'object',
        isRef: false,
        hasReadonlyProps: resolvedValue.hasReadonlyProps,
        useTypeAlias: true,
        dependencies: resolvedValue.dependencies,
      };
    }
    const keyType = getIndexSignatureKey(item);
    return {
      value: `{[key: ${keyType}]: ${resolvedValue.value}}` + nullable,
      imports: resolvedValue.imports,
      schemas: resolvedValue.schemas,
      isEnum: false,
      type: 'object',
      isRef: false,
      hasReadonlyProps: resolvedValue.hasReadonlyProps,
      useTypeAlias: false,
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
      hasReadonlyProps: item.readOnly ?? false,
      dependencies: [],
    };
  }

  const keyType =
    item.type === 'object' ? getIndexSignatureKey(item) : 'string';
  const recordType = getPropertyNamesRecordType(item, 'unknown');
  if (item.type === 'object' && recordType) {
    return {
      value: recordType + nullable,
      imports: [],
      schemas: [],
      isEnum: false,
      type: 'object',
      isRef: false,
      hasReadonlyProps: item.readOnly ?? false,
      useTypeAlias: true,
      dependencies: [],
    };
  }
  return {
    value:
      (item.type === 'object' ? `{ [key: ${keyType}]: unknown }` : 'unknown') +
      nullable,
    imports: [],
    schemas: [],
    isEnum: false,
    type: 'object',
    isRef: false,
    hasReadonlyProps: item.readOnly ?? false,
    useTypeAlias: false,
    dependencies: [],
  };
}
