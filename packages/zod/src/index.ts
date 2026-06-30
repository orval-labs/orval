/* eslint-disable unicorn/no-array-reduce */

import {
  buildDynamicScope,
  buildInlineDynamicScope,
  camel,
  type ClientBuilder,
  type ClientDependenciesBuilder,
  type ClientGeneratorsBuilder,
  type ContextSpec,
  generateMutator,
  type GeneratorDependency,
  type GeneratorMutator,
  type GeneratorOptions,
  type GeneratorVerbOptions,
  getDynamicAnchorName,
  getFormDataFieldFileType,
  getNumberWord,
  getRefInfo,
  isBoolean,
  isDynamicReference,
  isNumber,
  isObject,
  isString,
  jsStringEscape,
  jsStringLiteralEscape,
  logVerbose,
  type OpenApiParameterObject,
  type OpenApiReferenceObject,
  type OpenApiRequestBodyObject,
  type OpenApiResponseObject,
  type OpenApiSchemaObject,
  pascal,
  resolveDynamicRef,
  resolveRef,
  stringify,
  type ZodCoerceType,
  type ZodVariantOption,
} from '@orval/core';
import { unique } from 'remeda';

import {
  getLooseObjectFunctionName,
  getObjectFunctionName,
  getZodImportSource,
  getParameterFunctions,
  getZodDateFormat,
  getZodDateTimeFormat,
  getZodTimeFormat,
  assertZodTarget,
  resolveIsZodV4,
} from './compatible-v4';

export const getZodDependencies: ClientDependenciesBuilder = (
  _hasGlobalMutator,
  _hasParamsSerializerOptions,
  _packageJson,
  _httpClient,
  _hasTagsMutator,
  override,
): GeneratorDependency[] => [
  {
    exports: [
      {
        default: false,
        name: 'zod',
        syntheticDefaultImport: false,
        namespaceImport: true,
        values: true,
      },
    ],
    dependency: getZodImportSource(override?.zod.variant),
  },
];

/**
 * values that may appear in "type". Equals SchemaObjectType
 */
const possibleSchemaTypes = new Set([
  'integer',
  'number',
  'string',
  'boolean',
  'object',
  'strictObject',
  'null',
  'array',
]);

export const predefinedZodFormats = new Set([
  'date',
  'time',
  'date-time',
  'email',
  'uri',
  'hostname',
  'uuid',
]);

type ResolvedZodType =
  | string
  | {
      multiType: string[];
    };

const resolveZodType = (schema: OpenApiSchemaObject): ResolvedZodType => {
  const schemaTypeValue = schema.type as unknown;

  // Handle array of types (OpenAPI 3.1+)
  if (Array.isArray(schemaTypeValue)) {
    // Filter out 'null' type as it's handled separately via nullable
    const nonNullTypes = schemaTypeValue
      .filter((t): t is string => isString(t))
      .filter((t) => t !== 'null' && possibleSchemaTypes.has(t))
      .map((t) => (t === 'integer' ? 'number' : t));

    // If multiple types, return a special marker for union handling
    if (nonNullTypes.length > 1) {
      return { multiType: nonNullTypes };
    }

    // Single type
    const type = nonNullTypes[0];

    // Handle prefixItems for tuples
    if (type === 'array' && 'prefixItems' in schema) {
      return 'tuple';
    }

    return type;
  }

  // Handle single type value
  const type = isString(schemaTypeValue) ? schemaTypeValue : undefined;

  // TODO: if "prefixItems" exists and type is "array", then generate a "tuple"
  if (schema.type === 'array' && 'prefixItems' in schema) {
    return 'tuple';
  }

  switch (type) {
    case 'integer': {
      return 'number';
    }
    default: {
      return type ?? 'unknown';
    }
  }
};

// https://github.com/colinhacks/zod#coercion-for-primitives
const COERCIBLE_TYPES = new Set([
  'string',
  'number',
  'boolean',
  'bigint',
  'date',
]);

const PURE_COMMENT = '/*#__PURE__*/ ';

const zodMiniCall = (fn: string, args = '') =>
  `${PURE_COMMENT}zod.${fn}(${args})`;

const zodMiniCoerceCall = (fn: string, args = '') =>
  `${PURE_COMMENT}zod.coerce.${fn}(${args})`;

export interface ZodValidationSchemaDefinition {
  functions: [string, unknown][];
  consts: string[];
}

const minAndMaxTypes = new Set(['number', 'string', 'array']);

const removeReadOnlyProperties = (
  schema: OpenApiSchemaObject,
): OpenApiSchemaObject => {
  if (schema.properties && isObject(schema.properties)) {
    const filteredProperties: Record<string, OpenApiSchemaObject> = {};

    for (const [key, value] of Object.entries(schema.properties)) {
      if (isObject(value) && 'readOnly' in value && value.readOnly) {
        continue;
      }
      filteredProperties[key] = value as OpenApiSchemaObject;
    }

    return {
      ...(schema as Record<string, unknown>),
      properties: filteredProperties,
    };
  }
  if (schema.items && isObject(schema.items) && 'properties' in schema.items) {
    return {
      ...(schema as Record<string, unknown>),
      items: removeReadOnlyProperties(schema.items as OpenApiSchemaObject),
    };
  }
  return schema;
};

interface DateTimeOptions {
  offset?: boolean;
  local?: boolean;
  precision?: number;
}

interface TimeOptions {
  precision?: -1 | 0 | 1 | 2 | 3;
}

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

const COMPONENT_SCHEMAS_REF_PATTERN = /^#\/components\/schemas\/[^/]+$/;

const isComponentSchemaRef = (ref: string): boolean =>
  COMPONENT_SCHEMAS_REF_PATTERN.test(ref);

export const generateZodValidationSchemaDefinition = (
  schema: OpenApiSchemaObject | OpenApiReferenceObject | undefined,
  context: ContextSpec,
  name: string,
  strict: boolean,
  isZodV4: boolean,
  rules?: {
    required?: boolean;
    /**
     * Required keys inherited from sibling `allOf` members. Per JSON Schema /
     * OpenAPI 3.1, a `required` array in one `allOf` member applies to
     * properties contributed by ANY member, so it is collected at the `allOf`
     * level and applied here. Consumed at THIS object level only — never
     * forwarded into nested property schemas, so a deeper object sharing a key
     * name is unaffected. (#3171)
     */
    additionalRequired?: string[];
    dateTimeOptions?: DateTimeOptions;
    timeOptions?: TimeOptions;
    /**
     * Override schemas for properties at THIS level only.
     * Not passed to nested schemas. Used by form-data for file type handling.
     */
    propertyOverrides?: Record<string, ZodValidationSchemaDefinition>;
    /**
     * Internal registry to keep generated const names unique within a single
     * schema generation tree without leaking suffixes across unrelated top-level
     * schemas.
     */
    constNameRegistry?: Record<string, number>;
    /**
     * When true, plain `$ref`s into `#/components/schemas/*` emit a `namedRef`
     * placeholder instead of being inlined.
     */
    useReusableSchemas?: boolean;
    /**
     * When true, suppress File/Blob coercion for binary string fields anywhere
     * in the tree (`format: binary` / `contentMediaType: application/octet-stream`),
     * keeping them as `string`. Set for `application/x-www-form-urlencoded` bodies,
     * which serialize via URLSearchParams (string-only) — mirrors core's
     * `formDataContext.urlEncoded` handling in getScalar (#1624). Threaded into
     * every recursive call so nested/array/composed fields are covered too.
     */
    urlEncoded?: boolean;
    /**
     * When true (and `isZodV4`), the top-level (named component) schema emits a
     * `.meta({ id, description?, deprecated? })` instead of `.describe(...)`.
     * Set ONLY for top-level component-schema generation — recursive calls omit
     * it, so nested schemas keep `.describe()` and never get a duplicate `id`.
     */
    emitMeta?: boolean;
  },
): ZodValidationSchemaDefinition => {
  if (!schema) return { functions: [], consts: [] };

  const CHAINABLE_SIBLINGS = new Set(['nullable', 'default', 'description']);
  const isChainable = (k: string) => CHAINABLE_SIBLINGS.has(k);

  const applyChainableSiblings = (
    functions: [string, unknown][],
    consts: string[],
    siblingSchema: OpenApiSchemaObject & {
      nullable?: boolean;
      default?: unknown;
      description?: string;
    },
  ): void => {
    const refRequired = rules?.required ?? false;
    const refHasDefault = siblingSchema.default !== undefined;

    if (!refRequired && siblingSchema.nullable) {
      functions.push(['nullish', undefined]);
    } else if (siblingSchema.nullable) {
      functions.push(['nullable', undefined]);
    } else if (!refRequired && !refHasDefault) {
      functions.push(['optional', undefined]);
    }

    if (refHasDefault) {
      const registry = rules?.constNameRegistry ?? {};
      const counter = isNumber(registry[name]) ? registry[name] + 1 : 0;
      registry[name] = counter;
      const suffix = counter ? pascal(getNumberWord(counter)) : '';
      const defaultVarName = `${name}Default${suffix}`;
      const defaultLiteral = stringify(siblingSchema.default);
      if (defaultLiteral !== undefined) {
        consts.push(`export const ${defaultVarName} = ${defaultLiteral};`);
        functions.push(['default', defaultVarName]);
      }
    }

    if (typeof siblingSchema.description === 'string') {
      // Use the same single-quoted, fully JS-escaped form as the primitive
      // description path (see `pushDescriptionOrMeta`). `escape` only escapes
      // quote chars, so a multi-line description would emit raw newlines and
      // break the generated string literal (TS1002).
      functions.push([
        'describe',
        `'${jsStringEscape(siblingSchema.description)}'`,
      ]);
    }
  };

  // Ref-aware path: emit a placeholder that the orchestrator will rewrite into
  // either a direct identifier or `z.lazy(() => Name)`.
  if (
    rules?.useReusableSchemas &&
    '$ref' in schema &&
    typeof schema.$ref === 'string' &&
    isComponentSchemaRef(schema.$ref)
  ) {
    const siblings = Object.keys(schema).filter((k) => k !== '$ref');
    const allSiblingsChainable = siblings.every((k) => isChainable(k));

    if (allSiblingsChainable) {
      const refName = getRefInfo(schema.$ref, context).name;
      const functions: [string, unknown][] = [
        ['namedRef', { name: refName, sourceRef: schema.$ref }],
      ];
      const consts: string[] = [];

      applyChainableSiblings(
        functions,
        consts,
        schema as OpenApiSchemaObject & {
          $ref: string;
          nullable?: boolean;
          default?: unknown;
          description?: string;
        },
      );

      return { functions, consts };
    }

    logVerbose(
      `[orval/zod] $ref ${schema.$ref} has non-chainable siblings ` +
        `[${siblings.filter((s) => !isChainable(s)).join(', ')}]; falling back to inlining.`,
    );
    schema = dereference(
      schema as OpenApiSchemaObject | OpenApiReferenceObject,
      context,
    );
  }

  // Dynamic-ref-aware path: when useReusableSchemas is true, resolve the
  // anchor and emit a namedRef sentinel if the target is a concrete component
  // schema. The SCC pipeline then decides direct vs zod.lazy().
  if (rules?.useReusableSchemas && isDynamicReference(schema)) {
    const anchorName = getDynamicAnchorName(schema.$dynamicRef);
    if (anchorName) {
      const { resolvedTypeName, schemaName } = resolveDynamicRef(
        anchorName,
        context,
      );

      if (resolvedTypeName !== 'unknown' && schemaName) {
        const siblings = Object.keys(schema).filter((k) => k !== '$dynamicRef');
        const allSiblingsChainable = siblings.every((k) => isChainable(k));

        if (allSiblingsChainable) {
          const sourceRef = `${COMPONENT_SCHEMAS_PREFIX}${encodeSegment(schemaName)}`;
          const functions: [string, unknown][] = [
            ['namedRef', { name: resolvedTypeName, sourceRef }],
          ];
          const consts: string[] = [];

          applyChainableSiblings(
            functions,
            consts,
            schema as OpenApiSchemaObject & {
              $dynamicRef: string;
              nullable?: boolean;
              default?: unknown;
              description?: string;
            },
          );

          return { functions, consts };
        }

        logVerbose(
          `[orval/zod] $dynamicRef ${schema.$dynamicRef} has non-chainable siblings ` +
            `[${siblings.filter((s) => !isChainable(s)).join(', ')}]; falling back to inlining.`,
        );
      }
    }

    // Not emitted as namedRef (non-chainable siblings, unresolvable anchor,
    // or external ref) — dereference now so the main body sees a resolved
    // schema with a proper type instead of the raw $dynamicRef (which
    // resolveZodType classifies as 'unknown').
    schema = dereference(
      schema as OpenApiSchemaObject | OpenApiReferenceObject,
      context,
    );
  }

  const useReusableSchemas = rules?.useReusableSchemas ?? false;
  const urlEncoded = rules?.urlEncoded ?? false;
  const consts: string[] = [];
  const constNameRegistry = rules?.constNameRegistry ?? {};
  const constsCounter = isNumber(constNameRegistry[name])
    ? constNameRegistry[name] + 1
    : 0;

  const constsCounterValue = constsCounter
    ? pascal(getNumberWord(constsCounter))
    : '';

  constNameRegistry[name] = constsCounter;

  const functions: [string, unknown][] = [];

  // Emit the schema's trailing description/metadata. On zod v4 with `emitMeta`
  // (top-level component schemas only) this is a single `.meta({ id, ... })`
  // carrying the schema name as `id` plus description/deprecated when present;
  // otherwise it falls back to the plain `.describe(...)`. Called from both
  // return points (the multi-type union exit and the main exit) so every schema
  // shape is covered. `.meta()` must be the LAST modifier in the chain — zod v4
  // turns `.meta({id}).describe(...)` into a `$ref` wrapper, whereas
  // `.describe(...).meta({id})` (and a lone `.meta`) stay flat.
  const pushDescriptionOrMeta = () => {
    // Empty-string descriptions are treated as absent — preserves the prior
    // `if (schema.description)` falsy-check semantics (which skipped both `''`
    // and `undefined`), so this change never emits a no-op `.describe('')` or
    // `description: ''` in meta.
    const description =
      typeof schema.description === 'string' && schema.description.length > 0
        ? schema.description
        : undefined;
    const deprecated =
      'deprecated' in schema && schema.deprecated === true ? true : undefined;

    if (rules?.emitMeta && isZodV4) {
      const meta: Record<string, unknown> = { id: name };
      if (description !== undefined) meta.description = description;
      if (deprecated) meta.deprecated = true;
      functions.push(['meta', meta]);
    } else if (description !== undefined) {
      functions.push(['describe', `'${jsStringEscape(description)}'`]);
    }
  };

  const type = resolveZodType(schema);
  const required = rules?.required ?? false;
  const hasDefault = schema.default !== undefined;
  const nullable =
    // changing to ?? here changes behavior - so don't
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    ('nullable' in schema && schema.nullable) ||
    (Array.isArray(schema.type) && schema.type.includes('null'));
  const min = schema.minimum ?? schema.minLength ?? schema.minItems;
  const max = schema.maximum ?? schema.maxLength ?? schema.maxItems;

  // Handle exclusiveMinimum and exclusiveMaximum (OpenAPI 3.0 vs 3.1 compatibility)
  // OpenAPI 3.0: exclusiveMinimum/exclusiveMaximum are booleans indicating if minimum/maximum is exclusive
  // OpenAPI 3.1: exclusiveMinimum/exclusiveMaximum are numbers (the value itself)
  const exclusiveMinRaw =
    'exclusiveMinimum' in schema ? schema.exclusiveMinimum : undefined;
  const exclusiveMaxRaw =
    'exclusiveMaximum' in schema ? schema.exclusiveMaximum : undefined;

  // Convert boolean to number if using OpenAPI 3.0 format
  const exclusiveMin =
    isBoolean(exclusiveMinRaw) && exclusiveMinRaw ? min : exclusiveMinRaw;
  const exclusiveMax =
    isBoolean(exclusiveMaxRaw) && exclusiveMaxRaw ? max : exclusiveMaxRaw;

  const multipleOf = schema.multipleOf;
  const matches = schema.pattern ?? undefined;
  // Enum-based schemas are emitted as `zod.enum(...)` or literal unions, so
  // chaining scalar constraints onto the parent schema would generate invalid
  // Zod output. Arrays are handled separately via their item schema.
  const hasNonArrayEnum = !!schema.enum && type !== 'array';

  // Check for allOf/oneOf/anyOf BEFORE processing by type
  // This ensures these constraints work with any base type (string, number, object, etc.)
  let skipSwitchStatement = false;
  if (schema.allOf || schema.oneOf || schema.anyOf) {
    const separator = schema.allOf ? 'allOf' : schema.oneOf ? 'oneOf' : 'anyOf';

    const schemas = (schema.allOf ?? schema.oneOf ?? schema.anyOf) as (
      | OpenApiSchemaObject
      | OpenApiReferenceObject
    )[];

    // In JSON Schema / OpenAPI 3.1 a `required` array in any `allOf` member
    // (and on the composing schema itself) applies to properties contributed by
    // any member. Collect them all so each member's own properties can be marked
    // required even when the `required` lives in a sibling member — e.g. props
    // in a `$ref` base + `required` in a constraint-only sibling. Only valid for
    // `allOf` (a conjunction); `oneOf`/`anyOf` are alternatives. (#3171)
    const allOfRequired = schema.allOf
      ? [
          ...new Set([
            ...(schema.required ?? []),
            ...schemas.flatMap((member) => {
              // Only the member's top-level `required` is needed. For `$ref`
              // members resolve shallowly (no deep property dereference) and
              // tolerate unresolvable refs — they simply contribute no keys.
              const resolved =
                '$ref' in member && typeof member.$ref === 'string'
                  ? tryResolveRefSchema(member.$ref, context)
                  : (member as OpenApiSchemaObject);
              const memberRequired = resolved?.required;
              return Array.isArray(memberRequired)
                ? (memberRequired as string[])
                : [];
            }),
          ]),
        ]
      : undefined;

    // Use index-based naming to ensure uniqueness when processing multiple schemas
    // This prevents duplicate schema names when nullable refs are used
    const baseSchemas = schemas.map((schema, index) =>
      generateZodValidationSchemaDefinition(
        schema as OpenApiSchemaObject,
        context,
        `${camel(name)}${pascal(getNumberWord(index + 1))}`,
        strict,
        isZodV4,
        {
          required: true,
          additionalRequired: allOfRequired,
          constNameRegistry,
          useReusableSchemas,
          urlEncoded,
        },
      ),
    );

    // Handle allOf/oneOf/anyOf with additional properties - merge additional properties into the schema
    if ((schema.allOf || schema.oneOf || schema.anyOf) && schema.properties) {
      const additionalPropertiesSchema = {
        properties: schema.properties,
        required: schema.required,
        additionalProperties: schema.additionalProperties,
        type: schema.type,
      } as OpenApiSchemaObject;

      // Use index-based naming to ensure uniqueness
      const additionalIndex = baseSchemas.length + 1;
      const additionalPropertiesDefinition =
        generateZodValidationSchemaDefinition(
          additionalPropertiesSchema,
          context,
          `${camel(name)}${pascal(getNumberWord(additionalIndex))}`,
          strict,
          isZodV4,
          {
            required: true,
            additionalRequired: allOfRequired,
            constNameRegistry,
            useReusableSchemas,
            urlEncoded,
          },
        );

      // For oneOf/anyOf, use allOf to combine union with common properties
      // This generates: zod.union([...]).and(commonProperties)
      if (schema.oneOf || schema.anyOf) {
        functions.push([
          'allOf',
          [
            { functions: [[separator, baseSchemas]], consts: [] },
            additionalPropertiesDefinition,
          ],
        ]);
      } else {
        // For allOf, just add to the list
        baseSchemas.push(additionalPropertiesDefinition);
        functions.push([separator, baseSchemas]);
      }
    } else {
      functions.push([separator, baseSchemas]);
    }
    skipSwitchStatement = true;
  }

  let defaultVarName: string | undefined;
  if (schema.default !== undefined) {
    defaultVarName = `${name}Default${constsCounterValue}`;
    let defaultValue: string | undefined;

    const isDateType =
      schema.type === 'string' &&
      (schema.format === 'date' || schema.format === 'date-time') &&
      context.output.override.useDates;

    if (isDateType) {
      // OpenApiSchemaObject defines default as 'any'
      defaultValue = `new Date(${JSON.stringify(schema.default)})`;
    } else if (isObject(schema.default)) {
      // Narrow string literals individually with `as const` so `zod.enum([...])`
      // properties accept the emitted default (#3244). Whole-object/array
      // `as const` would make nested arrays `readonly`, which zod v4's
      // `.default()` rejects against its mutable parameter type (#3399).
      const entries = Object.entries(schema.default)
        .map(([key, value]) => {
          if (isString(value)) {
            return `${key}: ${JSON.stringify(value)} as const`;
          }

          if (Array.isArray(value)) {
            const arrayItems = value.map((item) =>
              isString(item) ? `${JSON.stringify(item)} as const` : `${item}`,
            );
            return `${key}: [${arrayItems.join(', ')}]`;
          }

          if (
            value === null ||
            value === undefined ||
            isNumber(value) ||
            isBoolean(value)
          )
            return `${key}: ${value}`;
        })
        .join(', ');
      defaultValue = entries.length === 0 ? `{}` : `{ ${entries} }`;
    } else {
      // OpenApiSchemaObject defines default as 'any'
      const rawStringified = stringify(schema.default);
      defaultValue =
        rawStringified === undefined
          ? 'null'
          : rawStringified.replaceAll("'", '`');

      // If the schema is an array with enum items, inject inplace to avoid issues with default values
      const isArrayWithEnumItems =
        Array.isArray(schema.default) &&
        type === 'array' &&
        schema.items &&
        'enum' in schema.items &&
        schema.default.length > 0;

      if (isArrayWithEnumItems) {
        defaultVarName = defaultValue;
        defaultValue = undefined;
      }
    }
    if (defaultValue) {
      consts.push(`export const ${defaultVarName} = ${defaultValue};`);
    }
  }

  // Handle multi-type schemas (OpenAPI 3.1+ type arrays)
  if (isObject(type) && 'multiType' in type) {
    const types = type.multiType;
    functions.push([
      'oneOf',
      types.map((t) =>
        generateZodValidationSchemaDefinition(
          {
            ...(schema as Record<string, unknown>),
            type: t,
          } as OpenApiSchemaObject,
          context,
          name,
          strict,
          isZodV4,
          {
            required: true,
            constNameRegistry,
            useReusableSchemas,
            urlEncoded,
          },
        ),
      ),
    ]);

    if (!required && nullable) {
      functions.push(['nullish', undefined]);
    } else if (nullable) {
      functions.push(['nullable', undefined]);
    } else if (!required) {
      functions.push(['optional', undefined]);
    }

    pushDescriptionOrMeta();

    return { functions, consts };
  }

  if (!skipSwitchStatement) {
    switch (type) {
      case 'tuple': {
        /**
         *
         * > 10.3.1.1. prefixItems
         * > The value of "prefixItems" MUST be a non-empty array of valid JSON Schemas.
         * >
         * > Validation succeeds if each element of the instance validates against the schema at the same position, if any.
         * > This keyword does not constrain the length of the array. If the array is longer than this keyword's value,
         * > this keyword validates only the prefix of matching length.
         * >
         * > This keyword produces an annotation value which is the largest index to which this keyword applied a subschema.
         * > The value MAY be a boolean true if a subschema was applied to every index of the instance, such as is produced by the "items" keyword.
         * > This annotation affects the behavior of "items" and "unevaluatedItems".
         * >
         * > Omitting this keyword has the same assertion behavior as an empty array.
         */
        if ('prefixItems' in schema) {
          const schema31 = schema as OpenApiSchemaObject;
          const prefixItems = Array.isArray(schema31.prefixItems)
            ? (schema31.prefixItems as (
                | OpenApiSchemaObject
                | OpenApiReferenceObject
              )[])
            : [];

          if (prefixItems.length > 0) {
            functions.push([
              'tuple',
              prefixItems.map((item, idx) =>
                generateZodValidationSchemaDefinition(
                  dereference(item, context),
                  context,
                  camel(`${name}-${idx}-item`),
                  isZodV4,
                  strict,
                  {
                    required: true,
                    constNameRegistry,
                    useReusableSchemas,
                    urlEncoded,
                  },
                ),
              ),
            ]);

            if (
              schema.items &&
              (max ?? Number.POSITIVE_INFINITY) > prefixItems.length
            ) {
              // only add zod.rest() if number of tuple elements can exceed provided prefixItems:
              functions.push([
                'rest',
                generateZodValidationSchemaDefinition(
                  schema.items as OpenApiSchemaObject | undefined,
                  context,
                  camel(`${name}-item`),
                  strict,
                  isZodV4,
                  {
                    required: true,
                    constNameRegistry,
                    useReusableSchemas,
                    urlEncoded,
                  },
                ),
              ]);
            }
          }
        }
        break;
      }
      case 'array': {
        functions.push([
          'array',
          generateZodValidationSchemaDefinition(
            schema.items as OpenApiSchemaObject | undefined,
            context,
            camel(`${name}-item`),
            strict,
            isZodV4,
            {
              required: true,
              constNameRegistry,
              useReusableSchemas,
              urlEncoded,
            },
          ),
        ]);
        break;
      }
      case 'string': {
        if (schema.enum) {
          break;
        }

        if (
          context.output.override.useDates &&
          (schema.format === 'date' || schema.format === 'date-time')
        ) {
          functions.push(['date', undefined]);
          break;
        }

        // url-encoded bodies serialize via URLSearchParams (strings only), so
        // binary fields stay `string` rather than becoming `File` (#3664).
        if (!urlEncoded && schema.format === 'binary') {
          functions.push(['instanceof', 'File']);
          break;
        }

        // The @scalar/openapi-parser upgrader converts format: binary to
        // contentMediaType: application/octet-stream when upgrading
        // Swagger 2.0 / OAS 3.0 → OAS 3.1. Treat it the same as
        // format: binary so $ref-based model types generate File validation.
        if (
          !urlEncoded &&
          schema.contentMediaType === 'application/octet-stream' &&
          !schema.contentEncoding
        ) {
          functions.push(['instanceof', 'File']);
          break;
        }

        if (isZodV4) {
          if (!predefinedZodFormats.has(schema.format ?? '')) {
            if ('const' in schema) {
              functions.push(['literal', JSON.stringify(String(schema.const))]);
            } else if (schema.pattern && schema.format) {
              const isStartWithSlash = schema.pattern.startsWith('/');
              const isEndWithSlash = schema.pattern.endsWith('/');
              const regexp = `new RegExp('${jsStringLiteralEscape(
                schema.pattern.slice(
                  isStartWithSlash ? 1 : 0,
                  isEndWithSlash ? -1 : undefined,
                ),
              )}')`;
              consts.push(
                `export const ${name}RegExp${constsCounterValue} = ${regexp};\n`,
              );
              functions.push([
                'stringFormat',
                [
                  `'${jsStringLiteralEscape(schema.format)}'`,
                  `${name}RegExp${constsCounterValue}`,
                ],
              ]);
            } else {
              functions.push([type as string, undefined]);
            }
            break;
          }
        } else {
          if ('const' in schema) {
            functions.push(['literal', JSON.stringify(String(schema.const))]);
          } else {
            functions.push([type as string, undefined]);
          }
        }

        if (schema.format === 'date') {
          const formatAPI = getZodDateFormat(isZodV4);

          functions.push([formatAPI, undefined]);
          break;
        }

        if (schema.format === 'time') {
          const options = context.output.override.zod.timeOptions;
          const formatAPI = getZodTimeFormat(isZodV4);

          functions.push([formatAPI, JSON.stringify(options)]);
          break;
        }

        if (schema.format === 'date-time') {
          const options = context.output.override.zod.dateTimeOptions;
          const formatAPI = getZodDateTimeFormat(isZodV4);

          functions.push([formatAPI, JSON.stringify(options)]);
          break;
        }

        if (schema.format === 'email') {
          functions.push(['email', undefined]);
          break;
        }

        if (schema.format === 'uri') {
          functions.push(['url', undefined]);
          break;
        }

        if (schema.format === 'hostname') {
          if (isZodV4) {
            functions.push(['hostname', undefined]);
          } else {
            functions.push(['url', undefined]);
          }
          break;
        }

        if (schema.format === 'uuid') {
          functions.push(['uuid', undefined]);
          break;
        }

        break;
      }
      default: {
        const hasProperties = !!schema.properties;
        const properties = schema.properties ?? {};
        const hasDefinedProperties = Object.keys(properties).length > 0;
        const hasAdditionalPropertiesSchema =
          !!schema.additionalProperties &&
          !isBoolean(schema.additionalProperties);

        // A plain `type: object` without explicit properties/additionalProperties
        // represents an open dictionary-like object in OpenAPI and should not be
        // generated as a strict object.
        const shouldUseLooseObject =
          type === 'object' &&
          !hasDefinedProperties &&
          schema.additionalProperties === undefined &&
          !hasAdditionalPropertiesSchema;

        if (hasProperties && hasDefinedProperties) {
          const objectType = getObjectFunctionName(isZodV4, strict);

          // A property is required when this schema requires it OR when a
          // sibling `allOf` member requires it (propagated via additionalRequired). (#3171)
          const requiredKeys = new Set<string>([
            ...(schema.required ?? []),
            ...(rules?.additionalRequired ?? []),
          ]);

          functions.push([
            objectType,
            Object.keys(properties)
              .map((key) => ({
                [key]:
                  rules?.propertyOverrides?.[key] ??
                  generateZodValidationSchemaDefinition(
                    properties[key] as OpenApiSchemaObject | undefined,
                    context,
                    camel(`${name}-${key}`),
                    strict,
                    isZodV4,
                    {
                      required: requiredKeys.has(key),
                      constNameRegistry,
                      useReusableSchemas,
                      urlEncoded,
                    },
                  ),
              }))
              .reduce((acc, curr) => ({ ...acc, ...curr }), {}),
          ]);

          if (strict && !isZodV4) {
            functions.push(['strict', undefined]);
          }

          break;
        }

        if (shouldUseLooseObject) {
          const looseObjectType = getLooseObjectFunctionName(isZodV4);

          functions.push([looseObjectType, {}]);

          if (!isZodV4) {
            functions.push(['passthrough', undefined]);
          }

          break;
        }

        if (schema.additionalProperties) {
          functions.push([
            'additionalProperties',
            generateZodValidationSchemaDefinition(
              isBoolean(schema.additionalProperties)
                ? {}
                : (schema.additionalProperties as OpenApiSchemaObject),
              context,
              name,
              strict,
              isZodV4,
              {
                required: true,
                constNameRegistry,
                useReusableSchemas,
                urlEncoded,
              },
            ),
          ]);

          break;
        }

        if (schema.enum) {
          break;
        }

        functions.push([type, undefined]);

        break;
      }
    }
  }

  if (!hasNonArrayEnum && isString(type) && minAndMaxTypes.has(type)) {
    // Handle minimum constraints: exclusiveMinimum (>.gt()) takes priority over minimum (.min())
    // Check if exclusive flag was set (boolean format in OpenAPI 3.0) or a different value (OpenAPI 3.1)
    const shouldUseExclusiveMin = exclusiveMinRaw !== undefined;
    const shouldUseExclusiveMax = exclusiveMaxRaw !== undefined;

    if (shouldUseExclusiveMin && exclusiveMin !== undefined) {
      consts.push(
        `export const ${name}ExclusiveMin${constsCounterValue} = ${exclusiveMin};`,
      );
      // Generate .gt() for exclusive minimum (> instead of >=)
      functions.push(['gt', `${name}ExclusiveMin${constsCounterValue}`]);
    } else if (min !== undefined) {
      if (min === 1) {
        functions.push(['min', `${min}`]);
      } else {
        consts.push(`export const ${name}Min${constsCounterValue} = ${min};`);
        functions.push(['min', `${name}Min${constsCounterValue}`]);
      }
    }

    // Handle maximum constraints: exclusiveMaximum (<.lt()) takes priority over maximum (.max())
    if (shouldUseExclusiveMax && exclusiveMax !== undefined) {
      consts.push(
        `export const ${name}ExclusiveMax${constsCounterValue} = ${exclusiveMax};`,
      );
      // Generate .lt() for exclusive maximum (< instead of <=)
      functions.push(['lt', `${name}ExclusiveMax${constsCounterValue}`]);
    } else if (max !== undefined) {
      consts.push(`export const ${name}Max${constsCounterValue} = ${max};`);
      functions.push(['max', `${name}Max${constsCounterValue}`]);
    }

    if (multipleOf !== undefined) {
      consts.push(
        `export const ${name}MultipleOf${constsCounterValue} = ${multipleOf.toString()};`,
      );
      functions.push(['multipleOf', `${name}MultipleOf${constsCounterValue}`]);
    }
    if (
      exclusiveMin !== undefined ||
      min !== undefined ||
      exclusiveMax !== undefined ||
      multipleOf !== undefined ||
      max !== undefined
    ) {
      consts.push(`\n`);
    }
  }

  const stringFormatAlreadyEmitted =
    isZodV4 &&
    type === 'string' &&
    !!matches &&
    !!schema.format &&
    !predefinedZodFormats.has(schema.format ?? '');

  if (
    matches &&
    !hasNonArrayEnum &&
    type === 'string' &&
    !stringFormatAlreadyEmitted
  ) {
    const isStartWithSlash = matches.startsWith('/');
    const isEndWithSlash = matches.endsWith('/');

    const regexp = `new RegExp('${jsStringLiteralEscape(
      matches.slice(isStartWithSlash ? 1 : 0, isEndWithSlash ? -1 : undefined),
    )}')`;

    consts.push(
      `export const ${name}RegExp${constsCounterValue} = ${regexp};\n`,
    );
    if (schema.format && !predefinedZodFormats.has(schema.format) && isZodV4) {
      functions.push([
        'stringFormat',
        [
          `'${jsStringLiteralEscape(schema.format)}'`,
          `${name}RegExp${constsCounterValue}`,
        ],
      ]);
    } else {
      functions.push(['regex', `${name}RegExp${constsCounterValue}`]);
    }
  }

  // Array item enums are handled by the nested item schema. Guard parent-array
  // enum emission to avoid generating invalid trailing `.enum(...)` chains.
  if (schema.enum && type !== 'array') {
    const uniqueEnumValues = unique(schema.enum);

    if (uniqueEnumValues.every((value) => isString(value))) {
      functions.push([
        'enum',
        `[${uniqueEnumValues.map((value) => `'${jsStringLiteralEscape(value)}'`).join(', ')}]`,
      ]);
    } else {
      functions.push([
        'oneOf',
        uniqueEnumValues.map((value) => ({
          functions: [
            [
              'literal',
              isString(value) ? `'${jsStringLiteralEscape(value)}'` : value,
            ],
          ],
          consts: [],
        })),
      ]);
    }
  }

  if (!required && nullable) {
    functions.push(['nullish', undefined]);
  } else if (nullable) {
    functions.push(['nullable', undefined]);
  } else if (!required && !hasDefault) {
    functions.push(['optional', undefined]);
  }

  if (hasDefault) {
    functions.push(['default', defaultVarName]);
  }

  pushDescriptionOrMeta();

  return { functions, consts: unique(consts) };
};

/**
 * Runtime shape passed to the user-supplied `override.zod.params` function for
 * every emitted validator. Exported so consumers can type their function with
 * `import type { ZodParamsContext } from 'orval'` instead of hand-writing it.
 */
export interface ZodParamsContext {
  /** The OpenAPI `operationId`, or `''` for shared component schemas. */
  operationId: string;
  /** `'schema'` is used for shared component schemas with no owning operation. */
  location: 'param' | 'query' | 'header' | 'body' | 'response' | 'schema';
  /** Generated schema name, e.g. `CreateUserBody`, or the component name. */
  schemaName: string;
  /** Path to the current property within the schema. Only object property names are appended. */
  fieldPath: string[];
  /** The Zod method being emitted, e.g. `'string'`, `'min'`, `'email'`. */
  validator: string;
}

export interface ZodParamsInjection extends Pick<
  ZodParamsContext,
  'operationId' | 'location' | 'schemaName'
> {
  mutator: GeneratorMutator;
}

const PARAMS_MODIFIER_VALIDATORS = new Set([
  'optional',
  'nullable',
  'nullish',
  'default',
  'describe',
  // Nullary / degenerate validators — either no params arg accepted in zod v3
  // (e.g. .unknown(), .any(), .never(), .null(), .undefined(), .void()) or no
  // meaningful error to attach (unknown/any accept everything).
  'unknown',
  'any',
  'never',
  'null',
  'undefined',
  'void',
]);

// Validators whose single argument is already a params-shaped options object
// (e.g. `z.iso.datetime({ offset, precision })`). For these, the injected
// params must merge into the existing object rather than be appended as a
// second argument.
const PARAMS_MERGE_INTO_OPTIONS_VALIDATORS = new Set([
  'datetime',
  'time',
  'iso.datetime',
  'iso.time',
]);

export const parseZodValidationSchemaDefinition = (
  input: ZodValidationSchemaDefinition,
  context: ContextSpec,
  coerceTypes: boolean | ZodCoerceType[] = false,
  strict: boolean,
  isZodV4: boolean,
  preprocess?: GeneratorMutator,
  paramsInjection?: ZodParamsInjection,
  variant: ZodVariantOption = 'classic',
): { zod: string; consts: string; usedRefs: Set<string> } => {
  if (input.functions.length === 0) {
    return { zod: '', consts: '', usedRefs: new Set() };
  }

  let consts = '';
  const usedRefs = new Set<string>();

  const appendConstsChunk = (chunk: string) => {
    if (!chunk) {
      return;
    }

    if (
      consts.length > 0 &&
      !consts.endsWith('\n') &&
      !chunk.startsWith('\n')
    ) {
      consts += '\n';
    }

    consts += chunk;
  };

  const formatFunctionArgs = (value: unknown): string => {
    if (value === undefined) return '';
    if (value === null) return 'null';
    if (isString(value)) return value;
    if (Array.isArray(value)) {
      return value.map((item) => formatFunctionArgs(item)).join(', ');
    }
    if (isObject(value)) {
      return stringify(value) ?? '';
    }
    if (isNumber(value) || isBoolean(value)) return `${value}`;
    return '';
  };

  const buildParamsArg = (
    fn: string,
    fieldPath: readonly string[],
  ): string | undefined => {
    if (!paramsInjection) return undefined;
    if (PARAMS_MODIFIER_VALIDATORS.has(fn)) return undefined;
    const ctx: ZodParamsContext = {
      operationId: paramsInjection.operationId,
      location: paramsInjection.location,
      schemaName: paramsInjection.schemaName,
      fieldPath: [...fieldPath],
      validator: fn,
    };
    return `${paramsInjection.mutator.name}(${JSON.stringify(ctx)})`;
  };

  const shouldCoerce = (fn: string) =>
    coerceTypes &&
    (Array.isArray(coerceTypes)
      ? coerceTypes.includes(fn as ZodCoerceType)
      : COERCIBLE_TYPES.has(fn));

  const buildCombinedArgs = (
    fn: string,
    args: unknown,
    fieldPath: readonly string[],
  ) => {
    const formattedArgs = formatFunctionArgs(args);
    const paramsArg = buildParamsArg(fn, fieldPath);
    if (
      paramsArg &&
      formattedArgs &&
      PARAMS_MERGE_INTO_OPTIONS_VALIDATORS.has(fn)
    ) {
      return `{ ...${formattedArgs}, ...${paramsArg} }`;
    }
    if (paramsArg) {
      return formattedArgs ? `${formattedArgs}, ${paramsArg}` : paramsArg;
    }
    return formattedArgs;
  };

  type MiniRendered = { expr: string; kind?: string };

  const renderMiniDefinition = (
    definition: ZodValidationSchemaDefinition,
    fieldPath: readonly string[] = [],
  ): MiniRendered => {
    let current: MiniRendered | undefined;

    const requireCurrent = (fn: string) => {
      if (!current) {
        throw new Error(`Cannot render zod mini ${fn} without a base schema`);
      }
      return current;
    };

    const renderObject = (
      objectArgs: Record<string, ZodValidationSchemaDefinition>,
      objectType: string,
    ): MiniRendered => ({
      kind: 'object',
      expr: `${zodMiniCall(
        objectType,
        `{
${Object.entries(objectArgs)
  .map(([key, schema]) => {
    const rendered = renderMiniDefinition(schema, [...fieldPath, key]);
    appendConstsChunk(schema.consts.join('\n'));
    const coerceArrays =
      Array.isArray(coerceTypes) &&
      coerceTypes.includes('array' as ZodCoerceType);
    if (coerceArrays && schema.functions.some(([fn]) => fn === 'array')) {
      return `  "${key}": ${zodMiniCall('pipe', `${zodMiniCall('transform', '(value) => value === undefined || Array.isArray(value) ? value : [value]')}, ${rendered.expr}`)}`;
    }
    return `  "${key}": ${rendered.expr}`;
  })
  .join(',\n')}
}`,
      )}`,
    });

    for (let index = 0; index < definition.functions.length; index++) {
      const [fn, args = ''] = definition.functions[index];

      if (fn === 'namedRef') {
        const refArgs = args as { name: string; sourceRef: string };
        usedRefs.add(refArgs.name);
        current = { expr: `__REF_${refArgs.name}__`, kind: 'ref' };
        continue;
      }

      if (fn === 'fileOrString') {
        current = {
          expr: zodMiniCall(
            'union',
            `[${zodMiniCall('instanceof', 'File')}, ${zodMiniCall('string')}]`,
          ),
          kind: 'union',
        };
        continue;
      }

      if (fn === 'allOf') {
        const allOfArgs = args as ZodValidationSchemaDefinition[];
        const allAreObjects =
          strict &&
          allOfArgs.length > 0 &&
          allOfArgs.every((partSchema) => {
            if (partSchema.functions.length === 0) return false;
            const firstFn = partSchema.functions[0][0];
            return firstFn === 'object' || firstFn === 'strictObject';
          });

        if (allAreObjects) {
          const mergedProperties: Record<
            string,
            ZodValidationSchemaDefinition
          > = {};
          const allConsts: string[] = [];
          for (const partSchema of allOfArgs) {
            if (partSchema.consts.length > 0) {
              allConsts.push(partSchema.consts.join('\n'));
            }
            const objectFunctionIndex = partSchema.functions.findIndex(
              ([fnName]) => fnName === 'object' || fnName === 'strictObject',
            );
            if (objectFunctionIndex !== -1) {
              const objectArgs = partSchema.functions[objectFunctionIndex][1];
              if (isObject(objectArgs)) {
                Object.assign(
                  mergedProperties,
                  objectArgs as Record<string, ZodValidationSchemaDefinition>,
                );
              }
            }
          }
          appendConstsChunk(allConsts.join('\n'));
          current = renderObject(
            mergedProperties,
            getObjectFunctionName(true, strict),
          );
          continue;
        }

        const rendered = allOfArgs.map((partSchema) => {
          appendConstsChunk(partSchema.consts.join('\n'));
          return renderMiniDefinition(partSchema, fieldPath).expr;
        });
        if (rendered.length === 0) {
          current = { expr: '' };
          continue;
        }
        current = {
          expr: rendered.reduce((acc, value) =>
            acc ? zodMiniCall('intersection', `${acc}, ${value}`) : value,
          ),
          kind: 'intersection',
        };
        continue;
      }

      if (fn === 'oneOf' || fn === 'anyOf') {
        const unionArgs = args as ZodValidationSchemaDefinition[];
        if (unionArgs.length === 1) {
          appendConstsChunk(unionArgs[0].consts.join('\n'));
          current = renderMiniDefinition(unionArgs[0], fieldPath);
          continue;
        }
        current = {
          expr: zodMiniCall(
            'union',
            `[${unionArgs
              .map((arg) => {
                appendConstsChunk(arg.consts.join('\n'));
                return renderMiniDefinition(arg, fieldPath).expr;
              })
              .join(',')}]`,
          ),
          kind: 'union',
        };
        continue;
      }

      if (fn === 'additionalProperties') {
        const additionalPropertiesArgs = args as ZodValidationSchemaDefinition;
        const rendered = renderMiniDefinition(
          additionalPropertiesArgs,
          fieldPath,
        );
        if (Array.isArray(additionalPropertiesArgs.consts)) {
          appendConstsChunk(additionalPropertiesArgs.consts.join('\n'));
        }
        current = {
          expr: zodMiniCall(
            'record',
            `${zodMiniCall('string')}, ${rendered.expr}`,
          ),
          kind: 'object',
        };
        continue;
      }

      if (fn === 'object' || fn === 'strictObject' || fn === 'looseObject') {
        const objectType =
          fn === 'looseObject'
            ? 'looseObject'
            : getObjectFunctionName(true, strict);
        current = renderObject(
          args as Record<string, ZodValidationSchemaDefinition>,
          objectType,
        );
        continue;
      }

      if (fn === 'passthrough' || fn === 'strict') {
        continue;
      }

      if (fn === 'array') {
        const arrayArgs = args as ZodValidationSchemaDefinition;
        const rendered = renderMiniDefinition(arrayArgs, fieldPath);
        if (isString(arrayArgs.consts)) {
          appendConstsChunk(arrayArgs.consts);
        } else if (Array.isArray(arrayArgs.consts)) {
          appendConstsChunk(arrayArgs.consts.join('\n'));
        }
        current = { expr: zodMiniCall('array', rendered.expr), kind: 'array' };
        continue;
      }

      if (fn === 'tuple') {
        const tupleItems = (args as ZodValidationSchemaDefinition[])
          .map((x) => {
            const rendered = renderMiniDefinition(x, fieldPath);
            appendConstsChunk(x.consts.join('\n'));
            return rendered.expr;
          })
          .join(',\n');
        const next = definition.functions[index + 1];
        if (next?.[0] === 'rest') {
          const restDefinition = next[1] as ZodValidationSchemaDefinition;
          const rest = renderMiniDefinition(restDefinition, fieldPath).expr;
          appendConstsChunk(restDefinition.consts.join('\n'));
          current = {
            expr: zodMiniCall('tuple', `[${tupleItems}], ${rest}`),
            kind: 'tuple',
          };
          index++;
        } else {
          current = {
            expr: zodMiniCall('tuple', `[${tupleItems}]`),
            kind: 'tuple',
          };
        }
        continue;
      }

      const combinedArgs = buildCombinedArgs(fn, args, fieldPath);

      if (fn === 'optional' || fn === 'nullable' || fn === 'nullish') {
        const value = requireCurrent(fn);
        current = { expr: zodMiniCall(fn, value.expr), kind: value.kind };
        continue;
      }

      if (fn === 'default') {
        const value = requireCurrent(fn);
        current = {
          expr: zodMiniCall('_default', `${value.expr}, ${combinedArgs}`),
          kind: value.kind,
        };
        continue;
      }

      if (fn === 'describe' || fn === 'meta') {
        const value = requireCurrent(fn);
        current = {
          expr: `${value.expr}.check(${zodMiniCall(fn, combinedArgs)})`,
          kind: value.kind,
        };
        continue;
      }

      if (
        fn === 'min' ||
        fn === 'max' ||
        fn === 'gt' ||
        fn === 'lt' ||
        fn === 'multipleOf' ||
        fn === 'regex' ||
        fn === 'length'
      ) {
        const value = requireCurrent(fn);
        const checkName =
          fn === 'min'
            ? value.kind === 'number'
              ? 'gte'
              : 'minLength'
            : fn === 'max'
              ? value.kind === 'number'
                ? 'lte'
                : 'maxLength'
              : fn;
        current = {
          expr: `${value.expr}.check(${zodMiniCall(checkName, combinedArgs)})`,
          kind: value.kind,
        };
        continue;
      }

      if (
        (fn !== 'date' && shouldCoerce(fn)) ||
        (fn === 'date' && shouldCoerce(fn) && context.output.override.useDates)
      ) {
        current = {
          expr: zodMiniCoerceCall(fn, combinedArgs),
          kind: fn,
        };
        continue;
      }

      current = {
        expr: zodMiniCall(fn, combinedArgs),
        kind:
          fn === 'enum' || fn === 'literal' || fn === 'stringFormat'
            ? 'string'
            : fn.split('.')[0],
      };
    }

    return current ?? { expr: '' };
  };

  const parseProperty = (
    property: [string, unknown],
    fieldPath: readonly string[] = [],
  ): string => {
    const [fn, args = ''] = property;

    if (fn === 'namedRef') {
      const refArgs = args as { name: string; sourceRef: string };
      usedRefs.add(refArgs.name);
      return `__REF_${refArgs.name}__`;
    }

    // `.meta({ id, description?, deprecated? })` — registry metadata for zod v4.
    // Built explicitly (rather than via stringify) so the description is
    // JS-string-escaped and the field order is stable: id, description,
    // deprecated.
    if (fn === 'meta') {
      const metaArgs = args as {
        id: string;
        description?: string;
        deprecated?: boolean;
      };
      const parts = [`id: '${jsStringEscape(metaArgs.id)}'`];
      if (metaArgs.description !== undefined) {
        parts.push(`description: '${jsStringEscape(metaArgs.description)}'`);
      }
      if (metaArgs.deprecated) {
        parts.push('deprecated: true');
      }
      return `.meta({ ${parts.join(', ')} })`;
    }

    // File | string for text contentMediaType/encoding (user can pass string, runtime wraps in Blob)
    if (fn === 'fileOrString') {
      return 'zod.instanceof(File).or(zod.string())';
    }

    if (fn === 'allOf') {
      const allOfArgs = args as ZodValidationSchemaDefinition[];
      // Check if all parts are objects and we need to merge them for strict mode
      const allAreObjects =
        strict &&
        allOfArgs.length > 0 &&
        allOfArgs.every((partSchema) => {
          if (partSchema.functions.length === 0) return false;
          const firstFn = partSchema.functions[0][0];
          // Check if first function is object or strictObject
          // For Zod v3 with strict, it will be object followed by strict
          return firstFn === 'object' || firstFn === 'strictObject';
        });

      if (allAreObjects) {
        // Merge all object properties into a single object
        const mergedProperties: Record<string, ZodValidationSchemaDefinition> =
          {};
        let allConsts = '';

        for (const partSchema of allOfArgs) {
          if (partSchema.consts.length > 0) {
            allConsts += partSchema.consts.join('\n');
          }

          // Find the object function (might be first or second after strict)
          const objectFunctionIndex = partSchema.functions.findIndex(
            ([fnName]) => fnName === 'object' || fnName === 'strictObject',
          );

          if (objectFunctionIndex !== -1) {
            const objectArgs = partSchema.functions[objectFunctionIndex][1];
            if (isObject(objectArgs)) {
              // Merge properties (later schemas override earlier ones)
              Object.assign(
                mergedProperties,
                objectArgs as Record<string, ZodValidationSchemaDefinition>,
              );
            }
          }
        }

        if (allConsts.length > 0) {
          appendConstsChunk(allConsts);
        }

        // Generate merged object
        const objectType = getObjectFunctionName(isZodV4, strict);
        const mergedObjectString = `zod.${objectType}({
${Object.entries(mergedProperties)
  .map(([key, schema]) => {
    const value = schema.functions
      .map((prop) => parseProperty(prop, [...fieldPath, key]))
      .join('');
    appendConstsChunk(schema.consts.join('\n'));
    return `  "${key}": ${value.startsWith('.') ? 'zod' : ''}${value}`;
  })
  .join(',\n')}
})`;

        // Apply strict only once for Zod v3 (v4 uses strictObject)
        if (!isZodV4) {
          return `${mergedObjectString}.strict()`;
        }

        return mergedObjectString;
      }

      // Fallback to original .and() approach for non-object or non-strict cases
      let acc = '';
      for (const partSchema of allOfArgs) {
        const value = partSchema.functions
          .map((prop) => parseProperty(prop, fieldPath))
          .join('');
        const valueWithZod = `${value.startsWith('.') ? 'zod' : ''}${value}`;

        if (partSchema.consts.length > 0) {
          appendConstsChunk(partSchema.consts.join('\n'));
        }

        if (acc.length === 0) {
          acc = valueWithZod;
        } else {
          acc += `.and(${valueWithZod})`;
        }
      }

      return acc;
    }
    if (fn === 'oneOf' || fn === 'anyOf') {
      const unionArgs = args as ZodValidationSchemaDefinition[];
      // Can't use zod.union() with a single item
      if (unionArgs.length === 1) {
        appendConstsChunk(unionArgs[0].consts.join('\n'));
        return unionArgs[0].functions
          .map((prop: [string, unknown]) => parseProperty(prop, fieldPath))
          .join('');
      }

      const union = unionArgs.map(
        ({
          functions,
          consts: argConsts,
        }: {
          functions: [string, unknown][];
          consts: string[];
        }) => {
          const value = functions
            .map((prop) => parseProperty(prop, fieldPath))
            .join('');
          const valueWithZod = `${value.startsWith('.') ? 'zod' : ''}${value}`;
          // consts are missing here
          appendConstsChunk(argConsts.join('\n'));
          return valueWithZod;
        },
      );

      return `.union([${union.join(',')}])`;
    }

    if (fn === 'additionalProperties') {
      const additionalPropertiesArgs = args as ZodValidationSchemaDefinition;
      const value = additionalPropertiesArgs.functions
        .map((prop: [string, unknown]) => parseProperty(prop, fieldPath))
        .join('');
      const valueWithZod = `${value.startsWith('.') ? 'zod' : ''}${value}`;
      if (Array.isArray(additionalPropertiesArgs.consts)) {
        appendConstsChunk(additionalPropertiesArgs.consts.join('\n'));
      }
      return `zod.record(zod.string(), ${valueWithZod})`;
    }

    if (fn === 'object' || fn === 'strictObject' || fn === 'looseObject') {
      const objectArgs = args as Record<string, ZodValidationSchemaDefinition>;
      const objectType =
        fn === 'looseObject'
          ? isZodV4
            ? 'looseObject'
            : 'object'
          : getObjectFunctionName(isZodV4, strict);

      const parsedObject = `zod.${objectType}({
${Object.entries(objectArgs)
  .map(([key, schema]) => {
    const value = schema.functions
      .map((prop) => parseProperty(prop, [...fieldPath, key]))
      .join('');
    appendConstsChunk(schema.consts.join('\n'));
    const fieldZod = `${value.startsWith('.') ? 'zod' : ''}${value}`;
    // Opt-in via `coerce.<location>: ['array', ...]`: a server framework (e.g.
    // Hono) delivers a single repeated-key value as a scalar, not a 1-element
    // array, so `?t=a` would fail z.array(...). Wrap so both `?t=a` and
    // `?t=a&t=b` parse. Undefined passes through so an outer `.optional()`/
    // `.default()` still applies. Already-arrays are left untouched (no-op for
    // JSON-body arrays).
    const coerceArrays =
      Array.isArray(coerceTypes) &&
      coerceTypes.includes('array' as ZodCoerceType);
    if (coerceArrays && schema.functions.some(([fn]) => fn === 'array')) {
      return `  "${key}": zod.preprocess((value) => value === undefined || Array.isArray(value) ? value : [value], ${fieldZod})`;
    }
    return `  "${key}": ${fieldZod}`;
  })
  .join(',\n')}
})`;

      if (fn === 'looseObject' && !isZodV4) {
        return `${parsedObject}.passthrough()`;
      }

      return parsedObject;
    }

    if (fn === 'passthrough') {
      return '.passthrough()';
    }

    if (fn === 'array') {
      const arrayArgs = args as ZodValidationSchemaDefinition;
      const value = arrayArgs.functions
        .map((prop: [string, unknown]) => parseProperty(prop, fieldPath))
        .join('');
      if (isString(arrayArgs.consts)) {
        appendConstsChunk(arrayArgs.consts);
      } else if (Array.isArray(arrayArgs.consts)) {
        appendConstsChunk(arrayArgs.consts.join('\n'));
      }
      return `.array(${value.startsWith('.') ? 'zod' : ''}${value})`;
    }

    if (fn === 'strict' && !isZodV4) {
      return '.strict()';
    }

    if (fn === 'tuple') {
      return `zod.tuple([${(args as ZodValidationSchemaDefinition[])
        .map((x) => {
          const value = x.functions
            .map((prop) => parseProperty(prop, fieldPath))
            .join('');
          return `${value.startsWith('.') ? 'zod' : ''}${value}`;
        })
        .join(',\n')}])`;
    }
    if (fn === 'rest') {
      return `.rest(zod${(args as ZodValidationSchemaDefinition).functions
        .map((prop) => parseProperty(prop, fieldPath))
        .join('')})`;
    }
    const shouldCoerceType =
      coerceTypes &&
      (Array.isArray(coerceTypes)
        ? coerceTypes.includes(fn as ZodCoerceType)
        : COERCIBLE_TYPES.has(fn));

    const formattedArgs = formatFunctionArgs(args);
    const paramsArg = buildParamsArg(fn, fieldPath);
    let combinedArgs: string;
    if (
      paramsArg &&
      formattedArgs &&
      PARAMS_MERGE_INTO_OPTIONS_VALIDATORS.has(fn)
    ) {
      combinedArgs = `{ ...${formattedArgs}, ...${paramsArg} }`;
    } else if (paramsArg) {
      combinedArgs = formattedArgs
        ? `${formattedArgs}, ${paramsArg}`
        : paramsArg;
    } else {
      combinedArgs = formattedArgs;
    }

    if (
      (fn !== 'date' && shouldCoerceType) ||
      (fn === 'date' && shouldCoerceType && context.output.override.useDates)
    ) {
      return `.coerce.${fn}(${combinedArgs})`;
    }

    return `.${fn}(${combinedArgs})`;
  };

  appendConstsChunk(input.consts.join('\n'));

  if (variant === 'mini') {
    const rendered = renderMiniDefinition(input);
    const value = preprocess
      ? zodMiniCall(
          'pipe',
          `${zodMiniCall('transform', preprocess.name)}, ${rendered.expr}`,
        )
      : rendered.expr;
    if (consts.includes(',export')) {
      consts = consts.replaceAll(',export', '\nexport');
    }
    return { zod: value, consts, usedRefs };
  }

  const schema = input.functions.map((prop) => parseProperty(prop)).join('');
  const value = preprocess
    ? `.preprocess(${preprocess.name}, ${
        schema.startsWith('.') ? 'zod' : ''
      }${schema})`
    : schema;

  const zod = `${value.startsWith('.') ? 'zod' : ''}${value}`;
  // Some export consts includes `,` as prefix, adding replace to remove those
  if (consts.includes(',export')) {
    consts = consts.replaceAll(',export', '\nexport');
  }
  return { zod, consts, usedRefs };
};

const dereferenceScalar = (value: unknown, context: ContextSpec): unknown => {
  if (isObject(value)) {
    return dereference(
      value as OpenApiSchemaObject | OpenApiReferenceObject,
      context,
    );
  } else if (Array.isArray(value)) {
    return value.map((item) => dereferenceScalar(item, context));
  } else {
    return value;
  }
};

/**
 * Attempts to resolve a `$ref` to its target schema. Returns `undefined`
 * instead of throwing when the ref cannot be found (e.g. external refs
 * not yet bundled). Logs a verbose warning on failure to aid debugging.
 */
function tryResolveRefSchema(
  $ref: string,
  context: ContextSpec,
): OpenApiSchemaObject | undefined {
  try {
    return resolveRef({ $ref } as OpenApiReferenceObject, context)
      .schema as OpenApiSchemaObject;
  } catch (error) {
    logVerbose(
      `[orval/zod] Failed to resolve $ref "${$ref}":`,
      error instanceof Error ? error.message : error,
    );
    return;
  }
}

const COMPONENT_SCHEMAS_PREFIX = '#/components/schemas/';

function extractSchemaNameFromRef($ref: string): string | undefined {
  if (!$ref.startsWith(COMPONENT_SCHEMAS_PREFIX)) return undefined;
  const raw = $ref.slice(COMPONENT_SCHEMAS_PREFIX.length);
  return decodeURIComponent(raw.replaceAll('~1', '/').replaceAll('~0', '~'));
}

/**
 * Recursively inlines all `$ref` and `$dynamicRef` references in an OpenAPI
 * schema tree, producing a fully-resolved schema suitable for Zod code generation.
 *
 * Tracks visited `$ref` paths via `context.parents` to break circular
 * references (returning `{}` for cycles).
 *
 * `$dynamicRef` is resolved using the dynamic scope attached to `context`:
 *  1. Look up the anchor name in `context.dynamicScope`.
 *  2. If not found, fall back to scanning `components.schemas` for a schema
 *     that declares `$dynamicAnchor` with the same name.
 *  3. If resolved to a concrete schema, inline it (same as `$ref`).
 *  4. If unresolved, external, or a generic parameter → return `{}`.
 */
export const dereference = (
  schema: OpenApiSchemaObject | OpenApiReferenceObject,
  context: ContextSpec,
): OpenApiSchemaObject => {
  const refName = '$ref' in schema ? schema.$ref : undefined;
  if (refName && context.parents?.includes(refName)) {
    return {};
  }

  if (isDynamicReference(schema)) {
    return dereferenceDynamicRef(schema, context);
  }

  const childContext: ContextSpec = {
    ...context,
    ...(refName
      ? { parents: [...(context.parents ?? []), refName] }
      : undefined),
  };

  const resolvedSchema: OpenApiSchemaObject | undefined =
    '$ref' in schema
      ? (() => {
          const referencedSchema = tryResolveRefSchema(schema.$ref, context);

          if (!referencedSchema || !isObject(referencedSchema)) {
            return;
          }

          const siblingProperties = Object.fromEntries(
            Object.entries(schema as Record<string, unknown>).filter(
              ([key]) => key !== '$ref',
            ),
          );

          return {
            ...(referencedSchema as Record<string, unknown>),
            ...siblingProperties,
          } as OpenApiSchemaObject;
        })()
      : schema;

  if (!resolvedSchema) {
    return {};
  }

  const resolvedContext = buildScopedContext(
    childContext,
    refName,
    resolvedSchema,
  );

  if (isDynamicReference(resolvedSchema)) {
    return dereferenceDynamicRef(resolvedSchema, resolvedContext);
  }

  return dereferenceProperties(resolvedSchema, resolvedContext);
};

function dereferenceProperties(
  schema: OpenApiSchemaObject,
  context: ContextSpec,
): OpenApiSchemaObject {
  return Object.entries(schema).reduce<Record<string, unknown>>(
    (acc, [key, value]) => {
      if (key === 'properties' && isObject(value)) {
        acc[key] = Object.entries(value).reduce<
          Record<string, OpenApiSchemaObject>
        >((props, [propKey, propSchema]) => {
          props[propKey] = dereference(
            propSchema as OpenApiSchemaObject | OpenApiReferenceObject,
            context,
          );
          return props;
        }, {});
      } else if (key === 'default' || key === 'example' || key === 'examples') {
        acc[key] = value;
      } else {
        acc[key] = dereferenceScalar(value, context);
      }

      return acc;
    },
    {},
  ) as OpenApiSchemaObject;
}

function buildScopedContext(
  childContext: ContextSpec,
  refName: string | undefined,
  resolvedSchema: OpenApiSchemaObject,
): ContextSpec {
  if (refName) {
    const schemaName = extractSchemaNameFromRef(refName);
    if (!schemaName) return childContext;

    const schemaRecord = resolvedSchema as Record<string, unknown>;
    const hasDynamicAnchor = typeof schemaRecord.$dynamicAnchor === 'string';
    const defs = schemaRecord.$defs as Record<string, unknown> | undefined;
    const hasDefsAnchors =
      defs &&
      typeof defs === 'object' &&
      Object.values(defs).some(
        (d) => d && typeof d === 'object' && '$dynamicAnchor' in d,
      );

    if (!hasDynamicAnchor && !hasDefsAnchors) return childContext;

    return {
      ...childContext,
      dynamicScope: buildDynamicScope(schemaName, resolvedSchema, childContext),
    };
  }

  // Anonymous inline subschema (reached via allOf/items/nested props without a
  // $ref). Detect inline $dynamicAnchor / $defs anchors and merge them over the
  // existing scope so the inline override shadows the parent anchor while
  // non-overridden parent anchors remain reachable. See #3492.
  const inlineScope = buildInlineDynamicScope(resolvedSchema);
  if (Object.keys(inlineScope).length === 0) return childContext;

  return {
    ...childContext,
    dynamicScope: { ...childContext.dynamicScope, ...inlineScope },
  };
}

function dereferenceDynamicRef(
  schema: object & { $dynamicRef: string },
  context: ContextSpec,
): OpenApiSchemaObject {
  const dynamicRef = schema.$dynamicRef;
  const anchorName = getDynamicAnchorName(dynamicRef);
  if (!anchorName) {
    return {};
  }

  const {
    resolvedTypeName,
    schema: resolvedSchema,
    schemaName,
  } = resolveDynamicRef(anchorName, context);

  // Cycle key. Inline overrides resolve with `schemaName: undefined`, so every
  // resolution of the same anchor collapses to `@?`. This is correct for a
  // self-referential inline override. A false positive is possible only in the
  // contrived shape where an inline override A (reached via `$dynamicRef`) itself
  // contains a *distinct* nested inline override B of the same anchor with a
  // `$dynamicRef` descendant — B's resolution inherits A's key from `parents`
  // and returns `{}` instead of B. Siblings don't leak (each `dereference` uses
  // an immutable parent context), only this nested-via-`$dynamicRef` shape.
  // Acceptable given how exotic it is. See #3492.
  const dynamicRefPath = `$dynamicRef:${dynamicRef}@${schemaName ?? '?'}`;
  if (context.parents?.includes(dynamicRefPath)) {
    return {};
  }

  if (resolvedTypeName === 'unknown' || !isObject(resolvedSchema)) {
    return {};
  }

  const childContext: ContextSpec = {
    ...context,
    parents: [...(context.parents ?? []), dynamicRefPath],
  };

  const scopedContext = buildScopedContext(
    childContext,
    schemaName
      ? `${COMPONENT_SCHEMAS_PREFIX}${encodeSegment(schemaName)}`
      : undefined,
    resolvedSchema,
  );

  const siblingProperties = Object.fromEntries(
    Object.entries(schema).filter(([key]) => key !== '$dynamicRef'),
  );

  const merged: OpenApiSchemaObject = {
    ...(resolvedSchema as Record<string, unknown>),
    ...siblingProperties,
  } as OpenApiSchemaObject;

  return dereferenceProperties(merged, scopedContext);
}

function encodeSegment(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}

/**
 * Generate zod schema for form-data request body.
 * Handles file type detection for top-level properties based on encoding.contentType
 * and contentMediaType. Mirrors type gen's resolveFormDataRootObject.
 */
export const generateFormDataZodSchema = (
  schema: OpenApiSchemaObject,
  context: ContextSpec,
  name: string,
  strict: boolean,
  isZodV4: boolean,
  encoding?: Record<string, { contentType?: string }>,
  useReusableSchemas?: boolean,
): ZodValidationSchemaDefinition => {
  // Precompute file type overrides for top-level properties only
  const propertyOverrides: Record<string, ZodValidationSchemaDefinition> = {};

  if (schema.properties) {
    for (const key of Object.keys(schema.properties)) {
      const propSchema = schema.properties[key];
      const resolvedPropSchema = propSchema
        ? dereference(
            propSchema as OpenApiSchemaObject | OpenApiReferenceObject,
            context,
          )
        : undefined;

      const fileType = resolvedPropSchema
        ? getFormDataFieldFileType(
            resolvedPropSchema,
            encoding?.[key]?.contentType,
          )
        : undefined;

      if (fileType) {
        const isRequired = schema.required?.includes(key);
        const fileFunctions: [string, unknown][] = [
          fileType === 'binary'
            ? ['instanceof', 'File']
            : ['fileOrString', undefined],
        ];
        if (!isRequired) {
          fileFunctions.push(['optional', undefined]);
        }
        propertyOverrides[key] = { functions: fileFunctions, consts: [] };
      }
    }
  }

  // Delegate to generic handler with file type overrides
  return generateZodValidationSchemaDefinition(
    schema,
    context,
    name,
    strict,
    isZodV4,
    {
      required: true,
      propertyOverrides:
        Object.keys(propertyOverrides).length > 0
          ? propertyOverrides
          : undefined,
      useReusableSchemas,
    },
  );
};

/**
 * Generate zod schema for an application/x-www-form-urlencoded request body.
 *
 * These bodies are serialized via URLSearchParams, whose values are always
 * strings, so — unlike multipart/form-data — file/binary top-level fields must
 * stay `string` rather than becoming `File`. This mirrors core's urlEncoded
 * handling in getScalar, which skips Blob coercion for such bodies (#1624).
 * Otherwise it behaves exactly like plain-object generation.
 */
const parseBodyAndResponse = ({
  data,
  context,
  name,
  strict,
  generate,
  isZodV4,
  parseType,
  useReusableSchemas,
}: {
  data:
    | OpenApiResponseObject
    | OpenApiRequestBodyObject
    | OpenApiReferenceObject
    | undefined;
  context: ContextSpec;
  name: string;
  strict: boolean;
  generate: boolean;
  isZodV4: boolean;
  parseType: 'body' | 'response';
  useReusableSchemas?: boolean;
}): {
  input: ZodValidationSchemaDefinition;
  isArray: boolean;
  rules?: {
    min?: number;
    max?: number;
  };
} => {
  if (!data || !generate) {
    return {
      input: { functions: [], consts: [] },
      isArray: false,
    };
  }

  const resolvedRef = resolveRef(data, context).schema as
    | OpenApiResponseObject
    | OpenApiRequestBodyObject;

  // Only handle JSON, form-data and form-urlencoded here; other content types
  // (e.g., application/octet-stream) are skipped - unclear if this is correct
  // behavior for root-level binary/text bodies. The one exception is text/plain
  // responses, which are handled separately below (as a plain string schema).
  const contentEntries = Object.entries(resolvedRef.content ?? {});

  const jsonContent = contentEntries.find(
    isMediaType(
      // application/json
      // application/geo+json
      // application/ld+json
      // application/manifest+json
      // application/vnd.api+json (and other valid vendor subtypes)
      String.raw`^application\/([^/;]+\+)?json$`,
    ),
  );
  const formDataContent = contentEntries.find(
    isMediaType(String.raw`^multipart\/form-data$`),
  );
  // form-urlencoded bodies are plain objects serialized via URLSearchParams, so
  // they validate like JSON (no file fields) — emit a regular object schema.
  const formUrlEncodedContent = contentEntries.find(
    isMediaType(String.raw`^application\/x-www-form-urlencoded$`),
  );
  const [contentType, mediaType] = jsonContent
    ? (['application/json', jsonContent[1]] as const)
    : formDataContent
      ? (['multipart/form-data', formDataContent[1]] as const)
      : formUrlEncodedContent
        ? ([
            'application/x-www-form-urlencoded',
            formUrlEncodedContent[1],
          ] as const)
        : [undefined, undefined];

  // url-encoded bodies serialize via URLSearchParams (strings only); the flag is
  // threaded into the generator so binary fields stay `string` at any depth.
  const isFormUrlEncoded = contentType === 'application/x-www-form-urlencoded';

  const schema = mediaType?.schema;

  if (!schema) {
    if (parseType === 'response') {
      const textPlainContent = contentEntries.find(
        isMediaType(String.raw`^text\/plain$`),
      );
      if (textPlainContent) {
        return {
          input: { functions: [['string', undefined]], consts: [] },
          isArray: false,
        };
      }
    }

    return {
      input: { functions: [], consts: [] },
      isArray: false,
    };
  }

  const encoding = mediaType.encoding;
  const resolvedJsonSchema = dereference(schema, context);

  // keep the same behaviour for array
  if (resolvedJsonSchema.items) {
    const min =
      resolvedJsonSchema.minimum ??
      resolvedJsonSchema.minLength ??
      resolvedJsonSchema.minItems;
    const max =
      resolvedJsonSchema.maximum ??
      resolvedJsonSchema.maxLength ??
      resolvedJsonSchema.maxItems;

    // When useReusableSchemas is on, shallow-resolve one level so that $ref
    // references inside the items schema are preserved for named-ref emission.
    // E.g. Pets = array of {$ref: Pet} → we want to emit Pet (namedRef)
    // rather than inlining Pet's full schema.
    const rawItems: OpenApiSchemaObject | OpenApiReferenceObject =
      useReusableSchemas
        ? (() => {
            const shallowArraySchema = resolveRef(schema, context)
              .schema as OpenApiSchemaObject;
            return (shallowArraySchema.items ??
              resolvedJsonSchema.items) as OpenApiSchemaObject;
          })()
        : resolvedJsonSchema.items;

    return {
      input: generateZodValidationSchemaDefinition(
        parseType === 'body'
          ? removeReadOnlyProperties(rawItems as OpenApiSchemaObject)
          : (rawItems as OpenApiSchemaObject),
        context,
        name,
        strict,
        isZodV4,
        {
          required: true,
          useReusableSchemas,
          urlEncoded: isFormUrlEncoded,
        },
      ),
      isArray: true,
      rules: {
        ...(min === undefined ? {} : { min }),
        ...(max === undefined ? {} : { max }),
      },
    };
  }

  // When useReusableSchemas is on, pass the original schema (possibly a $ref)
  // directly to generateZodValidationSchemaDefinition so that component schema
  // references are emitted as named identifiers instead of being inlined.
  const effectiveSchema: OpenApiSchemaObject | OpenApiReferenceObject =
    useReusableSchemas
      ? parseType === 'body'
        ? removeReadOnlyProperties(schema as OpenApiSchemaObject)
        : schema
      : parseType === 'body'
        ? removeReadOnlyProperties(resolvedJsonSchema)
        : resolvedJsonSchema;

  const isFormData = contentType === 'multipart/form-data';

  return {
    input: isFormData
      ? generateFormDataZodSchema(
          effectiveSchema,
          context,
          name,
          strict,
          isZodV4,
          encoding,
          useReusableSchemas,
        )
      : generateZodValidationSchemaDefinition(
          effectiveSchema,
          context,
          name,
          strict,
          isZodV4,
          { required: true, useReusableSchemas, urlEncoded: isFormUrlEncoded },
        ),
    isArray: false,
  };
};

const isMediaType =
  (pattern: string) =>
  ([contentType]: [string, object]): boolean =>
    new RegExp(pattern).test(contentType.split(';')[0].trim().toLowerCase());

const getSingleResponse = (
  responses:
    | Record<string, OpenApiResponseObject | OpenApiReferenceObject | undefined>
    | undefined,
) => {
  if (!responses) {
    return;
  }

  const otherSuccess = Object.entries(responses).find(
    ([code]) => code.startsWith('2') && code !== '204' && code !== '205',
  )?.[1];

  return (
    responses['200'] ??
    responses['2XX'] ??
    responses['2xx'] ??
    otherSuccess ??
    responses['204'] ??
    responses['205']
  );
};

/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

export const parseParameters = ({
  data,
  context,
  operationName,
  isZodV4,
  strict,
  generate,
  useReusableSchemas,
}: {
  data: (OpenApiParameterObject | OpenApiReferenceObject)[] | undefined;
  context: ContextSpec;
  operationName: string;
  isZodV4: boolean;
  strict: {
    param: boolean;
    query: boolean;
    header: boolean;
    body: boolean;
    response: boolean;
  };
  generate: {
    param: boolean;
    query: boolean;
    header: boolean;
    body: boolean;
    response: boolean;
  };
  useReusableSchemas?: boolean;
}): {
  headers: ZodValidationSchemaDefinition;
  queryParams: ZodValidationSchemaDefinition;
  params: ZodValidationSchemaDefinition;
} => {
  if (!data) {
    return {
      headers: {
        functions: [],
        consts: [],
      },
      queryParams: {
        functions: [],
        consts: [],
      },
      params: {
        functions: [],
        consts: [],
      },
    };
  }

  const initialDefinitionsByParameters: Record<
    'headers' | 'queryParams' | 'params',
    Record<string, { functions: [string, unknown][]; consts: string[] }>
  > = {
    headers: {},
    queryParams: {},
    params: {},
  };

  const defintionsByParameters = data.reduce((acc, val) => {
    const { schema: parameter }: { schema: OpenApiParameterObject } =
      resolveRef(val, context);

    if (!parameter.schema) {
      return acc;
    }
    if (!parameter.in || !parameter.name) {
      return acc;
    }

    // When useReusableSchemas is on, preserve `$ref` schemas verbatim so the
    // generator can take the namedRef path. We only shallow-clone to attach
    // the parameter-level `description` without mutating the shared ref object.
    // When off, fall back to dereferencing for backward compatibility.
    const schemaForGen: OpenApiSchemaObject | OpenApiReferenceObject =
      useReusableSchemas
        ? parameter.description
          ? Object.assign({}, parameter.schema, {
              description: parameter.description,
            })
          : parameter.schema
        : (() => {
            const s = dereference(parameter.schema, context);
            s.description = parameter.description;
            return s;
          })();

    const mapStrict = {
      path: strict.param,
      query: strict.query,
      header: strict.header,
    };

    const mapGenerate = {
      path: generate.param,
      query: generate.query,
      header: generate.header,
    };

    if (
      parameter.in !== 'path' &&
      parameter.in !== 'query' &&
      parameter.in !== 'header'
    ) {
      return acc;
    }

    const definition = generateZodValidationSchemaDefinition(
      schemaForGen,
      context,
      camel(`${operationName}-${parameter.in}-${parameter.name}`),
      mapStrict[parameter.in],
      isZodV4,
      {
        required: parameter.required,
        useReusableSchemas,
      },
    );

    if (parameter.in === 'header' && mapGenerate.header) {
      return {
        ...acc,
        headers: { ...acc.headers, [parameter.name]: definition },
      };
    }

    if (parameter.in === 'query' && mapGenerate.query) {
      return {
        ...acc,
        queryParams: { ...acc.queryParams, [parameter.name]: definition },
      };
    }

    if (parameter.in === 'path' && mapGenerate.path) {
      return {
        ...acc,
        params: { ...acc.params, [parameter.name]: definition },
      };
    }

    return acc;
  }, initialDefinitionsByParameters);

  const headers: ZodValidationSchemaDefinition = {
    functions: [],
    consts: [],
  };

  if (Object.keys(defintionsByParameters.headers).length > 0) {
    const parameterFunctions = getParameterFunctions(
      isZodV4,
      strict.header,
      defintionsByParameters.headers,
    );

    headers.functions.push(...parameterFunctions);
  }

  const queryParams: ZodValidationSchemaDefinition = {
    functions: [],
    consts: [],
  };

  if (Object.keys(defintionsByParameters.queryParams).length > 0) {
    const parameterFunctions = getParameterFunctions(
      isZodV4,
      strict.query,
      defintionsByParameters.queryParams,
    );

    queryParams.functions.push(...parameterFunctions);
  }

  const params: ZodValidationSchemaDefinition = {
    functions: [],
    consts: [],
  };

  if (Object.keys(defintionsByParameters.params).length > 0) {
    const parameterFunctions = getParameterFunctions(
      isZodV4,
      strict.param,
      defintionsByParameters.params,
    );

    params.functions.push(...parameterFunctions);
  }

  return {
    headers,
    queryParams,
    params,
  };
};

const generateZodRoute = async (
  { operationId, operationName, verb, override }: GeneratorVerbOptions,
  { pathRoute, context, output }: GeneratorOptions,
) => {
  const zodVariant = context.output.override.zod.variant;
  const isZodV4 = resolveIsZodV4(
    context.output.override.zod.version,
    context.output.packageJson,
  );
  assertZodTarget({ variant: zodVariant, isZodV4 });
  const useReusableSchemas =
    context.output.override.zod.generateReusableSchemas;
  const spec = context.spec.paths?.[pathRoute];

  if (spec == undefined) {
    throw new Error(`No such path ${pathRoute} in ${context.projectName}`);
  }

  const parameters = [
    ...(spec.parameters ?? []),
    ...(spec[verb]?.parameters ?? []),
  ];

  const parsedParameters = parseParameters({
    data: parameters,
    context,
    operationName,
    isZodV4,
    strict: override.zod.strict,
    generate: override.zod.generate,
    useReusableSchemas,
  });

  const requestBody = spec[verb]?.requestBody;
  const parsedBody = parseBodyAndResponse({
    data: requestBody,
    context,
    name: camel(`${operationName}-body`),
    strict: override.zod.strict.body,
    generate: override.zod.generate.body,
    isZodV4,
    parseType: 'body',
    useReusableSchemas,
  });

  const responses = (
    context.output.override.zod.generateEachHttpStatus
      ? Object.entries(spec[verb]?.responses ?? {})
      : [['', getSingleResponse(spec[verb]?.responses)]]
  ) as [string, OpenApiResponseObject | OpenApiReferenceObject][];
  const parsedResponses = responses.map(([code, response]) =>
    parseBodyAndResponse({
      data: response,
      context,
      name: camel(`${operationName}-${code}-response`),
      strict: override.zod.strict.response,
      generate: override.zod.generate.response,
      isZodV4,
      parseType: 'response',
      useReusableSchemas,
    }),
  );

  const preprocessParams = override.zod.preprocess?.param
    ? await generateMutator({
        output,
        mutator: override.zod.preprocess.param,
        name: `${operationName}PreprocessParams`,
        workspace: context.workspace,
        tsconfig: context.output.tsconfig,
      })
    : undefined;

  const paramsMutator = override.zod.params
    ? await generateMutator({
        output,
        mutator: override.zod.params,
        name: `${operationName}ZodParams`,
        workspace: context.workspace,
        tsconfig: context.output.tsconfig,
      })
    : undefined;

  const pascalOperationName = pascal(operationName);
  const makeParamsInjection = (
    location: ZodParamsInjection['location'],
    schemaSuffix: string,
  ): ZodParamsInjection | undefined =>
    paramsMutator
      ? {
          mutator: paramsMutator,
          operationId,
          location,
          schemaName: `${pascalOperationName}${schemaSuffix}`,
        }
      : undefined;

  let inputParams = parseZodValidationSchemaDefinition(
    parsedParameters.params,
    context,
    override.zod.coerce.param,
    override.zod.strict.param,
    isZodV4,
    preprocessParams,
    makeParamsInjection('param', 'Params'),
    zodVariant,
  );

  const preprocessQueryParams = override.zod.preprocess?.query
    ? await generateMutator({
        output,
        mutator: override.zod.preprocess.query,
        name: `${operationName}PreprocessQueryParams`,
        workspace: context.workspace,
        tsconfig: context.output.tsconfig,
      })
    : undefined;

  let inputQueryParams = parseZodValidationSchemaDefinition(
    parsedParameters.queryParams,
    context,
    override.zod.coerce.query,
    override.zod.strict.query,
    isZodV4,
    preprocessQueryParams,
    makeParamsInjection('query', 'QueryParams'),
    zodVariant,
  );

  const preprocessHeader = override.zod.preprocess?.header
    ? await generateMutator({
        output,
        mutator: override.zod.preprocess.header,
        name: `${operationName}PreprocessHeader`,
        workspace: context.workspace,
        tsconfig: context.output.tsconfig,
      })
    : undefined;

  let inputHeaders = parseZodValidationSchemaDefinition(
    parsedParameters.headers,
    context,
    override.zod.coerce.header,
    override.zod.strict.header,
    isZodV4,
    preprocessHeader,
    makeParamsInjection('header', 'Header'),
    zodVariant,
  );

  const preprocessBody = override.zod.preprocess?.body
    ? await generateMutator({
        output,
        mutator: override.zod.preprocess.body,
        name: `${operationName}PreprocessBody`,
        workspace: context.workspace,
        tsconfig: context.output.tsconfig,
      })
    : undefined;

  let inputBody = parseZodValidationSchemaDefinition(
    parsedBody.input,
    context,
    override.zod.coerce.body,
    override.zod.strict.body,
    isZodV4,
    preprocessBody,
    makeParamsInjection('body', 'Body'),
    zodVariant,
  );

  const preprocessResponse = override.zod.preprocess?.response
    ? await generateMutator({
        output,
        mutator: override.zod.preprocess.response,
        name: `${operationName}PreprocessResponse`,
        workspace: context.workspace,
        tsconfig: context.output.tsconfig,
      })
    : undefined;

  const inputResponses = parsedResponses.map((parsedResponse, index) =>
    parseZodValidationSchemaDefinition(
      parsedResponse.input,
      context,
      override.zod.coerce.response,
      override.zod.strict.response,
      isZodV4,
      preprocessResponse,
      makeParamsInjection(
        'response',
        responses[index][0] ? `${responses[index][0]}Response` : 'Response',
      ),
      zodVariant,
    ),
  );

  const SENTINEL_PATTERN = /__REF_([A-Za-z_$][A-Za-z0-9_$]*)__/g;
  const rewriteSentinels = (s: string): string =>
    s.replaceAll(SENTINEL_PATTERN, (_m, name: string) => name);

  const allUsedRefs = new Set<string>([
    ...inputParams.usedRefs,
    ...inputQueryParams.usedRefs,
    ...inputHeaders.usedRefs,
    ...inputBody.usedRefs,
    ...inputResponses.flatMap((r) => [...r.usedRefs]),
  ]);

  if (useReusableSchemas && allUsedRefs.size > 0) {
    inputParams = { ...inputParams, zod: rewriteSentinels(inputParams.zod) };
    inputQueryParams = {
      ...inputQueryParams,
      zod: rewriteSentinels(inputQueryParams.zod),
    };
    inputHeaders = {
      ...inputHeaders,
      zod: rewriteSentinels(inputHeaders.zod),
    };
    inputBody = { ...inputBody, zod: rewriteSentinels(inputBody.zod) };
    for (let i = 0; i < inputResponses.length; i++) {
      inputResponses[i] = {
        ...inputResponses[i],
        zod: rewriteSentinels(inputResponses[i].zod),
      };
    }
  }

  if (
    !inputParams.zod &&
    !inputQueryParams.zod &&
    !inputHeaders.zod &&
    !inputBody.zod &&
    responses.length === 0
  ) {
    return {
      implementation: '',
      mutators: [],
      usedRefs: new Set<string>(),
    };
  }

  const useBrandedTypes = override.zod.useBrandedTypes;
  const brand = (name: string) =>
    useBrandedTypes
      ? isZodV4
        ? `.brand("${name}")`
        : `.brand<"${name}">()`
      : '';

  const zodArrayWithBounds = (
    itemName: string,
    rules: { min?: number; max?: number } | undefined,
  ) => {
    const checks = [
      ...(rules?.min ? [zodMiniCall('minLength', `${rules.min}`)] : []),
      ...(rules?.max ? [zodMiniCall('maxLength', `${rules.max}`)] : []),
    ];

    if (zodVariant === 'mini') {
      return `${zodMiniCall('array', itemName)}${checks
        .map((check) => `.check(${check})`)
        .join('')}`;
    }

    return `zod.array(${itemName})${rules?.min ? `.min(${rules.min})` : ''}${
      rules?.max ? `.max(${rules.max})` : ''
    }`;
  };

  // With `generateReusableSchemas`, operations import component schemas by
  // their PascalCase name from a sibling schemas module. When an operation's
  // own pascalized wrapper name (e.g. `ListPetsResponse` from operationId
  // `listPets`) matches an imported ref, the generated `export const` shadows
  // the import and produces a self-referential initializer that TS rejects
  // with TS7022. Detect the collision and append `Schema` (with a counter for
  // further collisions) so the import keeps its meaning. For the array case
  // both the wrapper and its `Item` companion are checked together so they
  // stay in sync. The original name is preserved when there is no collision,
  // so non-colliding operations are unaffected.
  //
  // `localTaken` seeds from the imported refs and accumulates the names this
  // call hands out, so wrappers within the same operation (`Params`, `Body`,
  // per-status `Response`, …) can't pick a name another wrapper just claimed.
  // The fixed suffixes already keep these distinct in practice, but tracking
  // allocations removes the implicit invariant — future suffix additions stay
  // safe by construction.
  const localTaken = new Set(allUsedRefs);
  const allocateExportName = (baseName: string, hasItem: boolean): string => {
    const collides = (name: string) =>
      localTaken.has(name) || (hasItem && localTaken.has(`${name}Item`));
    const reserve = (name: string) => {
      localTaken.add(name);
      if (hasItem) localTaken.add(`${name}Item`);
    };
    if (!collides(baseName)) {
      reserve(baseName);
      return baseName;
    }
    let counter = 0;
    let candidate = `${baseName}Schema`;
    while (collides(candidate)) {
      counter += 1;
      candidate = `${baseName}Schema${counter}`;
    }
    reserve(candidate);
    return candidate;
  };

  const paramsName = allocateExportName(`${pascalOperationName}Params`, false);
  const queryParamsName = allocateExportName(
    `${pascalOperationName}QueryParams`,
    false,
  );
  const headerName = allocateExportName(`${pascalOperationName}Header`, false);
  const bodyName = allocateExportName(
    `${pascalOperationName}Body`,
    parsedBody.isArray,
  );

  return {
    implementation: [
      ...(inputParams.consts ? [inputParams.consts] : []),
      ...(inputParams.zod
        ? [
            `export const ${paramsName} = ${inputParams.zod}${brand(paramsName)}`,
          ]
        : []),
      ...(inputQueryParams.consts ? [inputQueryParams.consts] : []),
      ...(inputQueryParams.zod
        ? [
            `export const ${queryParamsName} = ${inputQueryParams.zod}${brand(queryParamsName)}`,
          ]
        : []),
      ...(inputHeaders.consts ? [inputHeaders.consts] : []),
      ...(inputHeaders.zod
        ? [
            `export const ${headerName} = ${inputHeaders.zod}${brand(headerName)}`,
          ]
        : []),
      ...(inputBody.consts ? [inputBody.consts] : []),
      ...(inputBody.zod
        ? [
            parsedBody.isArray
              ? `export const ${bodyName}Item = ${inputBody.zod}
export const ${bodyName} = ${zodArrayWithBounds(bodyName + 'Item', parsedBody.rules)}${brand(bodyName)}`
              : `export const ${bodyName} = ${inputBody.zod}${brand(bodyName)}`,
          ]
        : []),
      ...inputResponses.flatMap((inputResponse, index) => {
        const operationResponse = allocateExportName(
          pascal(`${operationName}-${responses[index][0]}-response`),
          parsedResponses[index].isArray,
        );

        if (!inputResponse.zod) {
          if (!override.zod.generate.response) {
            return [];
          }

          const noContentStatusCodes = new Set(['204', '205']);
          const statusCode = responses[index][0];
          const isEachHttpStatusMode = !!statusCode;

          let isNoContent: boolean;
          if (isEachHttpStatusMode) {
            isNoContent = noContentStatusCodes.has(statusCode);
          } else {
            const specResponseKeys = new Set(
              Object.keys(spec[verb]?.responses ?? {}),
            );
            const hasStandardSuccess =
              specResponseKeys.has('200') ||
              specResponseKeys.has('2XX') ||
              specResponseKeys.has('2xx');
            isNoContent = !hasStandardSuccess;
          }
          const noContentSchema = isNoContent
            ? zodVariant === 'mini'
              ? zodMiniCall('void')
              : 'zod.void()'
            : zodVariant === 'mini'
              ? zodMiniCall('unknown')
              : 'zod.unknown()';

          return [
            `export const ${operationResponse} = ${noContentSchema}${brand(operationResponse)}`,
          ];
        }

        return [
          ...(inputResponse.consts ? [inputResponse.consts] : []),
          parsedResponses[index].isArray
            ? `export const ${operationResponse}Item = ${inputResponse.zod}
export const ${operationResponse} = ${zodArrayWithBounds(`${operationResponse}Item`, parsedResponses[index].rules)}${brand(operationResponse)}`
            : `export const ${operationResponse} = ${inputResponse.zod}${brand(operationResponse)}`,
        ];
      }),
    ].join('\n\n'),
    mutators: [
      // Gate each request-side preprocess mutator on its parsed `.zod`: it is
      // computed for every operation once the target is configured, so without
      // this an operation lacking the schema would emit an unused import.
      ...(preprocessParams && inputParams.zod ? [preprocessParams] : []),
      ...(preprocessQueryParams && inputQueryParams.zod
        ? [preprocessQueryParams]
        : []),
      ...(preprocessHeader && inputHeaders.zod ? [preprocessHeader] : []),
      ...(preprocessBody && inputBody.zod ? [preprocessBody] : []),
      ...(preprocessResponse ? [preprocessResponse] : []),
      // Unconditional even when this operation's parsed schemas don't
      // reference `paramsMutator.name`: in `single` mode, inline component
      // schemas (which DO reference it) rely on this entry to emit the
      // import. The cost is one harmless `import { zodParams }` line on
      // operations whose request/response have no leaf validators to inject.
      ...(paramsMutator ? [paramsMutator] : []),
    ],
    usedRefs: useReusableSchemas ? allUsedRefs : new Set<string>(),
  };
};

export const generateZod: ClientBuilder = async (verbOptions, options) => {
  const { implementation, mutators, usedRefs } = await generateZodRoute(
    verbOptions,
    options,
  );

  return {
    implementation: implementation ? `${implementation}\n\n` : '',
    // Zod schemas are runtime values (not type-only), so mark with values: true
    // to prevent the import writer from emitting `import type { ... }`. Sort
    // by name so import order is stable across runs.
    imports: [...usedRefs].toSorted().map((name) => ({
      name,
      schemaName: name,
      values: true,
    })),
    mutators,
  };
};

const zodClientBuilder: ClientGeneratorsBuilder = {
  client: generateZod,
  dependencies: getZodDependencies,
};

export const builder = () => () => zodClientBuilder;

export {
  assertZodTarget,
  getZodImportSource,
  getZodTypeName,
  isZodVersionV4,
  resolveIsZodV4,
} from './compatible-v4';

export default builder;
