import { resolveExampleRefs, resolveValue } from '../resolvers';
import { resolveObject } from '../resolvers/object';
import {
  type ContextSpec,
  type GeneratorImport,
  type OpenApiReferenceObject,
  type OpenApiSchemaObject,
  PropertySortOrder,
  type ScalarValue,
  SchemaType,
} from '../types';
import { escape, isReference, isString, jsDoc, pascal } from '../utils';
import { combineSchemas } from './combine';
import { getAliasedImports, getImportAliasForRefOrValue } from './imports';
import { getKey } from './keys';
import { getRefInfo } from './ref';

interface PropertyNamesKeyType {
  value: string;
  imports: GeneratorImport[];
  dependencies: string[];
}

function getPropertyNamesEnumKeyType(
  item: OpenApiSchemaObject,
): PropertyNamesKeyType | undefined {
  if (!('propertyNames' in item) || !item.propertyNames) {
    return undefined;
  }

  const propertyNames = item.propertyNames as {
    enum?: unknown[];
    const?: unknown;
  };

  if (Array.isArray(propertyNames.enum)) {
    const enumValues = propertyNames.enum.filter((val): val is string =>
      isString(val),
    );

    if (enumValues.length > 0) {
      return {
        value: enumValues.map((val) => `'${escape(val)}'`).join(' | '),
        imports: [],
        dependencies: [],
      };
    }
  }

  if (isString(propertyNames.const)) {
    return {
      value: `'${escape(propertyNames.const)}'`,
      imports: [],
      dependencies: [],
    };
  }

  return undefined;
}

/**
 * Resolve a narrowed key type from OpenAPI 3.1 propertyNames.
 * Supports inline enum/const and $ref string enums.
 */
function getPropertyNamesKeyType(
  item: OpenApiSchemaObject,
  context: ContextSpec,
): PropertyNamesKeyType | undefined {
  const inlineKeyType = getPropertyNamesEnumKeyType(item);
  if (inlineKeyType) {
    return inlineKeyType;
  }

  const propertyNames = item.propertyNames as
    | OpenApiSchemaObject
    | OpenApiReferenceObject
    | undefined;
  if (!propertyNames || !isReference(propertyNames)) {
    return undefined;
  }

  const resolvedValue = resolveValue({
    schema: propertyNames,
    context,
  });

  const resolvedConst = resolvedValue.originalSchema.const as unknown;
  const isStringConst =
    resolvedValue.type === 'string' && isString(resolvedConst);

  if (!resolvedValue.isEnum && !isStringConst) {
    return undefined;
  }

  return {
    value: resolvedValue.value,
    imports: resolvedValue.imports,
    dependencies: resolvedValue.dependencies,
  };
}

/**
 * Generate index signature key type based on propertyNames enum or const
 * Returns union type string like "'foo' | 'bar'", "'x'", or 'string' if neither
 */
function getIndexSignatureKey(item: OpenApiSchemaObject): string {
  return getPropertyNamesEnumKeyType(item)?.value ?? 'string';
}

function getPropertyNamesRecordType(
  item: OpenApiSchemaObject,
  valueType: string,
  context: ContextSpec,
): (PropertyNamesKeyType & { value: string }) | undefined {
  const keyType = getPropertyNamesKeyType(item, context);
  if (!keyType) {
    return undefined;
  }

  return {
    ...keyType,
    value: `Partial<Record<${keyType.value}, ${valueType}>>`,
  };
}

/**
 * Context for form request body (multipart/form-data and
 * application/x-www-form-urlencoded) type generation.
 * Discriminated union with two states:
 *
 * 1. `{ atPart: false, encoding }` - At form root, before property iteration
 *    - May traverse through allOf/anyOf/oneOf to reach properties
 *    - Carries encoding map so getObject can look up `encoding[key]`
 *
 * 2. `{ atPart: true, partContentType }` - At a multipart part (top-level property)
 *    - `partContentType` = Encoding Object's `contentType` for this part
 *    - Used by getScalar for file type detection (precedence over contentMediaType)
 *    - Arrays pass this through to items; combiners inside arrays also get context
 *
 * `urlEncoded` marks an application/x-www-form-urlencoded body. Such bodies are
 * built with URLSearchParams, whose values are always strings, so getScalar
 * keeps file/binary fields as `string` instead of `Blob` (#1624).
 *
 * `undefined` means not in form context (or nested inside plain object field = JSON)
 */
export type FormDataContext =
  | {
      atPart: false;
      encoding: Record<string, { contentType?: string }>;
      urlEncoded?: boolean;
    }
  | { atPart: true; partContentType?: string; urlEncoded?: boolean };

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

  const schemaItem = item as OpenApiSchemaObject & Record<string, unknown>;
  const itemAllOf = schemaItem.allOf as
    | (OpenApiSchemaObject | OpenApiReferenceObject)[]
    | undefined;
  const itemOneOf = schemaItem.oneOf as
    | (OpenApiSchemaObject | OpenApiReferenceObject)[]
    | undefined;
  const itemAnyOf = schemaItem.anyOf as
    | (OpenApiSchemaObject | OpenApiReferenceObject)[]
    | undefined;
  const itemType = schemaItem.type as string | string[] | undefined;

  if (itemAllOf || itemOneOf || itemAnyOf) {
    const separator = itemAllOf ? 'allOf' : itemOneOf ? 'oneOf' : 'anyOf';

    // A nullable object spelled as the explicit OAS 3.1 composition
    // `anyOf|oneOf: [{ inline object with properties }, { type: 'null' }]` must
    // keep its `name` so nested enum properties are extracted into named
    // `as const` consts. Routing it through combineSchemas resolves the object
    // member with `combined: true` and an undefined propName, which drops the
    // name and inlines those enums. Divert the single object member to the
    // property-iteration path instead — the same fix #3340 applied one level
    // down for the `type: ['object', 'null']` shape. See issue #3563.
    // `allOf` is intersection, not a nullable union, so it is excluded; real
    // unions, `$ref` object members, primitive members, and empty objects keep
    // the combineSchemas behavior via the guard below.
    const members = itemAnyOf ?? itemOneOf;
    if (members) {
      const isNullMember = (
        member: OpenApiSchemaObject | OpenApiReferenceObject,
      ): boolean => {
        if (isReference(member)) {
          return false;
        }
        const memberType = member.type as string | string[] | undefined;
        return (
          memberType === 'null' ||
          (Array.isArray(memberType) &&
            memberType.length === 1 &&
            memberType[0] === 'null')
        );
      };

      const objectMembers = members.filter((member) => !isNullMember(member));
      const objectMember = objectMembers[0];
      // Bridge assertion: AnyOtherAttribute infects member property access to
      // `any`; cast to the documented shapes after excluding `$ref` members.
      const objectMemberType =
        objectMember && !isReference(objectMember)
          ? (objectMember.type as string | string[] | undefined)
          : undefined;
      const objectMemberProperties =
        objectMember && !isReference(objectMember)
          ? (objectMember.properties as
              | Record<string, OpenApiSchemaObject | OpenApiReferenceObject>
              | undefined)
          : undefined;

      const isNullableObjectComposition =
        members.some(isNullMember) &&
        objectMembers.length === 1 &&
        objectMember != null &&
        !isReference(objectMember) &&
        (objectMemberType === 'object' ||
          (objectMemberType == null && objectMemberProperties != null)) &&
        objectMemberProperties != null &&
        Object.keys(objectMemberProperties).length > 0;

      if (isNullableObjectComposition) {
        // `nullable` is empty for the composition form (the null lives in a
        // member, not on the parent), so synthesize ` | null`; the
        // property-iteration path appends it to the rendered object.
        return getObject({
          item: objectMember as OpenApiSchemaObject,
          name,
          context,
          nullable: nullable || ' | null',
          formDataContext,
        });
      }
    }

    return combineSchemas({
      schema: schemaItem,
      name,
      separator,
      context,
      nullable,
      formDataContext,
    });
  }

  if (Array.isArray(itemType)) {
    const typeArray = itemType;
    // A nullable object (`type: ['object', 'null']`, e.g. OAS 3.0 `nullable: true`
    // after the @scalar upgrade) must stay on the object property-iteration path
    // below so its `name` is preserved and nested enum properties keep being
    // extracted into named consts. Routing it through combineSchemas resolves the
    // object variant with an undefined propName, which drops the name and inlines
    // those enums instead. See issue #3340. Real unions (e.g. `['string', 'number']`)
    // keep the combineSchemas path.
    const nonNullTypes = typeArray.filter((type) => type !== 'null');
    // Bridge assertion: AnyOtherAttribute infects `properties` to `any`; cast to
    // the documented property-map shape, matching the itemProperties cast below.
    const typeArrayProperties = schemaItem.properties as
      | Record<string, OpenApiSchemaObject | OpenApiReferenceObject>
      | undefined;
    // Only divert when there are properties to walk — an empty nullable object
    // has no nested enums to extract, and routing it through the property path
    // would render it as `unknown` instead of `{ [key: string]: unknown }`.
    const isNullableObject =
      nonNullTypes.length === 1 &&
      nonNullTypes[0] === 'object' &&
      typeArrayProperties != null &&
      Object.keys(typeArrayProperties).length > 0;

    if (!isNullableObject) {
      // Bridge: item is OpenApiSchemaObject which includes AnyOtherAttribute index signature.
      // Spreading it directly would carry `any` into the result. Cast to break the chain.
      const baseItem = schemaItem as Record<string, unknown>;
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
    // Fall through to the property-iteration path; `nullable` already carries
    // the ` | null` computed by getScalar for this type array.
  }

  // Bridge assertion: item.properties is typed as { [name: string]: ReferenceObject | SchemaObject }
  // but AnyOtherAttribute index signature infects all property access to return `any`
  const itemProperties = schemaItem.properties as
    | Record<string, OpenApiSchemaObject | OpenApiReferenceObject>
    | undefined;

  if (itemProperties && Object.entries(itemProperties).length > 0) {
    const entries = Object.entries(itemProperties);
    if (context.output.propertySortOrder === PropertySortOrder.ALPHABETICAL) {
      entries.sort((a, b) => {
        return a[0].localeCompare(b[0], 'en', {
          numeric: true,
        });
      });
    }
    const acc: ScalarValue = {
      imports: [],
      schemas: [],
      value: '',
      isEnum: false,
      type: 'object' as SchemaType,
      isRef: false,
      hasReadonlyProps: false,
      useTypeAlias: false,
      dependencies: [],
      example: schemaItem.example as unknown,
      examples: resolveExampleRefs(
        schemaItem.examples as
          | Record<string, OpenApiReferenceObject | { value?: unknown }>
          | undefined,
        context,
      ),
    };
    const itemRequired = schemaItem.required as string[] | undefined;
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

      // Transition form context: atPart: false → atPart: true
      // Look up encoding[key].contentType and pass to property resolution.
      // The urlEncoded flag is carried through so nested scalars stay strings.
      const propertyFormDataContext: FormDataContext | undefined =
        formDataContext && !formDataContext.atPart
          ? {
              atPart: true,
              partContentType: formDataContext.encoding[key]?.contentType, // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- Record index access can return undefined at runtime
              urlEncoded: formDataContext.urlEncoded,
            }
          : undefined;

      const resolvedValue = resolveObject({
        schema,
        propName,
        context,
        formDataContext: propertyFormDataContext,
      });

      const isReadOnly =
        Boolean(schemaItem.readOnly) ||
        Boolean((schema as OpenApiSchemaObject).readOnly);
      if (!index) {
        acc.value += '{';
      }

      const doc = jsDoc(schema, true, context);
      const propertyDoc = doc
        ? `${doc
            .trimEnd()
            .split('\n')
            .map((line) => `  ${line}`)
            .join('\n')}\n`
        : '';

      // Propagate readonly state from nested schemas ($ref targets or inline
      // objects), not just this property's own readOnly flag. Otherwise an
      // object whose readonly props come solely from nested schemas is never
      // wrapped in `NonReadonly<>`, leaking the readonly modifier into request
      // body types. See issue #826.
      if (isReadOnly || resolvedValue.hasReadonlyProps) {
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
      const usedResolvedValue = !hasConst || needsValueImport;

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

      acc.value += `\n${propertyDoc}${
        isReadOnly && !context.output.override.suppressReadonlyModifier
          ? '  readonly '
          : '  '
      }${getKey(key)}${isRequired ? '' : '?'}: ${finalPropValue};`;
      if (usedResolvedValue) {
        acc.schemas.push(...resolvedValue.schemas);
        acc.dependencies.push(...resolvedValue.dependencies);
      }

      if (entries.length - 1 === index) {
        // Bridge assertion: additionalProperties is boolean | ReferenceObject | SchemaObject
        // but AnyOtherAttribute infects property access
        const additionalProps = schemaItem.additionalProperties as
          | boolean
          | OpenApiSchemaObject
          | OpenApiReferenceObject
          | undefined;
        if (additionalProps) {
          if (additionalProps === true) {
            const recordType = getPropertyNamesRecordType(
              schemaItem,
              'unknown',
              context,
            );
            if (recordType) {
              acc.value += '\n}';
              acc.value += ` & ${recordType.value}`;
              acc.useTypeAlias = true;
              acc.imports.push(...recordType.imports);
              acc.dependencies.push(...recordType.dependencies);
            } else {
              const keyType = getIndexSignatureKey(schemaItem);
              acc.value += `\n  [key: ${keyType}]: unknown;\n }`;
            }
          } else {
            const resolvedValue = resolveValue({
              schema: additionalProps as
                | OpenApiSchemaObject
                | OpenApiReferenceObject,
              name,
              context,
            });
            const recordType = getPropertyNamesRecordType(
              schemaItem,
              resolvedValue.value,
              context,
            );
            if (recordType) {
              // `propertyNames` constrains the keys to a literal union, so this
              // emits `Partial<Record<'a' | 'b', T>>` — specific optional keys,
              // not a string index signature. Named properties never collide
              // with it, so keep the precise additionalProperties value type.
              acc.value += '\n}';
              acc.value += ` & ${recordType.value}`;
              acc.useTypeAlias = true;
              acc.imports.push(...recordType.imports);
              acc.dependencies.push(...recordType.dependencies);
              acc.imports.push(...resolvedValue.imports);
              acc.schemas.push(...resolvedValue.schemas);
              acc.dependencies.push(...resolvedValue.dependencies);
            } else {
              // A bare `[key: string]: T` index signature also covers the named
              // keys, so any named property whose type differs from T makes the
              // object unrepresentable (TS2411) — or unconstructable if T is
              // pushed into an intersection, since the index still constrains
              // the named keys. Fall back to `unknown`, matching
              // `additionalProperties: true`, so the generated type stays valid
              // and assignable regardless of the named property types. The
              // additionalProperties value type (and its imports) is dropped
              // here, so it is intentionally not pushed. See issues #3321 / #3255.
              const keyType = getIndexSignatureKey(schemaItem);
              acc.value += `\n  [key: ${keyType}]: unknown;\n}`;
            }
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
  const outerAdditionalProps = schemaItem.additionalProperties as
    | boolean
    | OpenApiSchemaObject
    | OpenApiReferenceObject
    | undefined;
  const readOnlyFlag = schemaItem.readOnly as boolean | undefined;
  if (outerAdditionalProps) {
    if (outerAdditionalProps === true) {
      const recordType = getPropertyNamesRecordType(
        schemaItem,
        'unknown',
        context,
      );
      if (recordType) {
        return {
          value: recordType.value + nullable,
          imports: recordType.imports,
          schemas: [],
          isEnum: false,
          type: 'object',
          isRef: false,
          hasReadonlyProps: readOnlyFlag ?? false,
          useTypeAlias: true,
          dependencies: recordType.dependencies,
        };
      }
      const keyType = getIndexSignatureKey(schemaItem);
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
      schema: outerAdditionalProps as
        | OpenApiSchemaObject
        | OpenApiReferenceObject,
      name,
      context,
    });
    const recordType = getPropertyNamesRecordType(
      schemaItem,
      resolvedValue.value,
      context,
    );
    if (recordType) {
      return {
        value: recordType.value + nullable,
        imports: [...recordType.imports, ...resolvedValue.imports],
        schemas: resolvedValue.schemas,
        isEnum: false,
        type: 'object',
        isRef: false,
        hasReadonlyProps: resolvedValue.hasReadonlyProps,
        useTypeAlias: true,
        dependencies: [
          ...recordType.dependencies,
          ...resolvedValue.dependencies,
        ],
      };
    }
    const keyType = getIndexSignatureKey(schemaItem);
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

  const constValue = schemaItem.const as unknown;
  if (constValue !== undefined) {
    let type: SchemaType;
    if (Array.isArray(constValue)) {
      type = 'array';
    } else if (constValue === null) {
      type = 'null';
    } else if (typeof constValue === 'string') {
      type = 'string';
    } else if (typeof constValue === 'number') {
      type = 'number';
    } else if (typeof constValue === 'boolean') {
      type = 'boolean';
    } else {
      type = 'object';
    }

    return {
      value:
        typeof constValue === 'string'
          ? `'${escape(constValue)}'`
          : JSON.stringify(constValue),
      imports: [],
      schemas: [],
      isEnum: false,
      type,
      isRef: false,
      hasReadonlyProps: readOnlyFlag ?? false,
      dependencies: [],
    };
  }

  const keyType =
    itemType === 'object' ? getIndexSignatureKey(schemaItem) : 'string';
  const recordType = getPropertyNamesRecordType(schemaItem, 'unknown', context);
  if (itemType === 'object' && recordType) {
    return {
      value: recordType.value + nullable,
      imports: recordType.imports,
      schemas: [],
      isEnum: false,
      type: 'object',
      isRef: false,
      hasReadonlyProps: readOnlyFlag ?? false,
      useTypeAlias: true,
      dependencies: recordType.dependencies,
    };
  }
  return {
    value:
      (itemType === 'object' ? `{ [key: ${keyType}]: unknown }` : 'unknown') +
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
