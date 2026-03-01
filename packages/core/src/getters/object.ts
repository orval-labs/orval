import { resolveExampleRefs, resolveValue } from '../resolvers/index.ts';
import { resolveObject } from '../resolvers/object.ts';
import {
  type ContextSpec,
  type GeneratorImport,
  type OpenApiReferenceObject,
  type OpenApiSchemaObject,
  PropertySortOrder,
  type ScalarValue,
  SchemaType,
} from '../types.ts';
import {
  escape,
  isBoolean,
  isReference,
  isString,
  jsDoc,
  pascal,
} from '../utils/index.ts';
import { combineSchemas } from './combine.ts';
import { getAliasedImports, getImportAliasForRefOrValue } from './imports.ts';
import { getKey } from './keys.ts';
import { getRefInfo } from './ref.ts';

/**
 * Extract enum values from propertyNames schema (OpenAPI 3.1)
 * Returns undefined if propertyNames doesn't have an enum
 */
function getPropertyNamesEnum(item: OpenApiSchemaObject): string[] | undefined {
  if (
    'propertyNames' in item &&
    item.propertyNames &&
    'enum' in item.propertyNames
  ) {
    const propertyNames = item.propertyNames as { enum?: unknown[] };
    if (Array.isArray(propertyNames.enum)) {
      return propertyNames.enum.filter((val): val is string => isString(val));
    }
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
    const { name } = getRefInfo(item.$ref as string, context);
    return {
      value: name + nullable,
      imports: [{ name }],
      schemas: [],
      isEnum: false,
      type: 'object',
      isRef: true,
      hasReadonlyProps: (item.readOnly as boolean | undefined) ?? false,
      dependencies: [name],
      example: item.example as unknown,
      examples: resolveExampleRefs(
        item.examples as
          | Record<string, OpenApiReferenceObject | { value?: unknown }>
          | undefined,
        context,
      ),
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
    const typeArray = item.type as string[];
    // Bridge: item is OpenApiSchemaObject which includes AnyOtherAttribute index signature.
    // Spreading it directly would carry `any` into the result. Cast to break the chain.
    const baseItem = item as OpenApiSchemaObject;
    return combineSchemas({
      schema: {
        anyOf: typeArray.map(
          (type) => ({ ...baseItem, type }) as OpenApiSchemaObject,
        ),
      },
      name,
      separator: 'anyOf',
      context,
      nullable,
    });
  }

  // Bridge assertion: item.properties is typed as { [name: string]: ReferenceObject | SchemaObject }
  // but AnyOtherAttribute index signature infects all property access to return `any`
  const itemProperties = item.properties as
    | Record<string, OpenApiSchemaObject | OpenApiReferenceObject>
    | undefined;

  if (itemProperties && Object.entries(itemProperties).length > 0) {
    const entries = Object.entries(itemProperties);
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
      example: item.example as unknown,
      examples: resolveExampleRefs(
        item.examples as
          | Record<string, OpenApiReferenceObject | { value?: unknown }>
          | undefined,
        context,
      ),
    };
    const itemRequired = item.required as string[] | undefined;
    for (const [index, [key, schema]] of entries.entries()) {
      const isRequired = (
        Array.isArray(itemRequired) ? itemRequired : []
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

      const isReadOnly =
        (item.readOnly as boolean | undefined) ??
        ((schema as OpenApiSchemaObject).readOnly as boolean | undefined);
      if (!index) {
        acc.value += '{';
      }

      const doc = jsDoc(schema, true, context);

      if (isReadOnly ?? false) {
        acc.hasReadonlyProps = true;
      }

      const constValue =
        'const' in schema ? (schema.const as unknown) : undefined;
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
        // Bridge assertion: additionalProperties is boolean | ReferenceObject | SchemaObject
        // but AnyOtherAttribute infects property access
        const additionalProps = item.additionalProperties as
          | boolean
          | OpenApiSchemaObject
          | OpenApiReferenceObject
          | undefined;
        if (additionalProps) {
          if (isBoolean(additionalProps)) {
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
              schema: additionalProps,
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

  // Bridge assertion: additionalProperties is boolean | ReferenceObject | SchemaObject
  const outerAdditionalProps = item.additionalProperties as
    | boolean
    | OpenApiSchemaObject
    | OpenApiReferenceObject
    | undefined;
  const readOnlyFlag = item.readOnly as boolean | undefined;
  if (outerAdditionalProps) {
    if (isBoolean(outerAdditionalProps)) {
      const recordType = getPropertyNamesRecordType(item, 'unknown');
      if (recordType) {
        return {
          value: recordType + nullable,
          imports: [],
          schemas: [],
          isEnum: false,
          type: 'object',
          isRef: false,
          hasReadonlyProps: readOnlyFlag ?? false,
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
        hasReadonlyProps: readOnlyFlag ?? false,
        useTypeAlias: false,
        dependencies: [],
      };
    }
    const resolvedValue = resolveValue({
      schema: outerAdditionalProps,
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

  const constValue = item.const as string | undefined;
  if (constValue) {
    return {
      value: `'${constValue}'`,
      imports: [],
      schemas: [],
      isEnum: false,
      type: 'string',
      isRef: false,
      hasReadonlyProps: readOnlyFlag ?? false,
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
      hasReadonlyProps: readOnlyFlag ?? false,
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
    hasReadonlyProps: readOnlyFlag ?? false,
    useTypeAlias: false,
    dependencies: [],
  };
}
