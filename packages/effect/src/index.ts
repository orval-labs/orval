/* eslint-disable unicorn/no-array-reduce */

import {
  camel,
  type ClientBuilder,
  type ClientGeneratorsBuilder,
  type ContextSpec,
  type GeneratorDependency,
  type GeneratorOptions,
  type GeneratorVerbOptions,
  getFormDataFieldFileType,
  getNumberWord,
  isBoolean,
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
  resolveRef,
  stringify,
} from '@orval/core';
import { unique } from 'remeda';

const EFFECT_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      {
        default: false,
        name: 'Schema',
        syntheticDefaultImport: false,
        namespaceImport: false,
        values: true,
        alias: 'S',
      },
    ],
    dependency: 'effect',
  },
];

export const getEffectDependencies = () => EFFECT_DEPENDENCIES;

const possibleSchemaTypes = new Set([
  'integer',
  'number',
  'string',
  'boolean',
  'object',
  'null',
  'array',
]);

export const predefinedEffectFormats = new Set([
  'date',
  'date-time',
  'email',
  'uri',
  'uuid',
]);

type ResolvedEffectType =
  | string
  | {
      multiType: string[];
    };

const resolveEffectType = (schema: OpenApiSchemaObject): ResolvedEffectType => {
  const schemaTypeValue = schema.type as unknown;

  if (Array.isArray(schemaTypeValue)) {
    const nonNullTypes = schemaTypeValue
      .filter((t): t is string => isString(t))
      .filter((t) => t !== 'null' && possibleSchemaTypes.has(t))
      .map((t) => (t === 'integer' ? 'number' : t));

    if (nonNullTypes.length > 1) {
      return { multiType: nonNullTypes };
    }

    const type = nonNullTypes[0];

    if (type === 'array' && 'prefixItems' in schema) {
      return 'tuple';
    }

    return type;
  }

  const type = isString(schemaTypeValue) ? schemaTypeValue : undefined;

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

export interface EffectValidationSchemaDefinition {
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

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

export const generateEffectValidationSchemaDefinition = (
  schema: OpenApiSchemaObject | undefined,
  context: ContextSpec,
  name: string,
  strict: boolean,
  rules?: {
    required?: boolean;
    propertyOverrides?: Record<string, EffectValidationSchemaDefinition>;
    constNameRegistry?: Record<string, number>;
  },
): EffectValidationSchemaDefinition => {
  if (!schema) return { functions: [], consts: [] };

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
  const type = resolveEffectType(schema);
  const required = rules?.required ?? false;
  const hasDefault = schema.default !== undefined;
  const nullable =
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    ('nullable' in schema && schema.nullable) ||
    (Array.isArray(schema.type) && schema.type.includes('null'));
  const min = schema.minimum ?? schema.minLength ?? schema.minItems;
  const max = schema.maximum ?? schema.maxLength ?? schema.maxItems;

  const exclusiveMinRaw =
    'exclusiveMinimum' in schema ? schema.exclusiveMinimum : undefined;
  const exclusiveMaxRaw =
    'exclusiveMaximum' in schema ? schema.exclusiveMaximum : undefined;

  const exclusiveMin =
    isBoolean(exclusiveMinRaw) && exclusiveMinRaw ? min : exclusiveMinRaw;
  const exclusiveMax =
    isBoolean(exclusiveMaxRaw) && exclusiveMaxRaw ? max : exclusiveMaxRaw;

  const multipleOf = schema.multipleOf;
  const matches = schema.pattern ?? undefined;
  const hasNonArrayEnum = !!schema.enum && type !== 'array';

  let skipSwitchStatement = false;
  if (schema.allOf || schema.oneOf || schema.anyOf) {
    const separator = schema.allOf ? 'allOf' : schema.oneOf ? 'oneOf' : 'anyOf';

    const schemas = (schema.allOf ?? schema.oneOf ?? schema.anyOf) as (
      | OpenApiSchemaObject
      | OpenApiReferenceObject
    )[];

    const baseSchemas = schemas.map((schema, index) =>
      generateEffectValidationSchemaDefinition(
        schema as OpenApiSchemaObject,
        context,
        `${camel(name)}${pascal(getNumberWord(index + 1))}`,
        strict,
        {
          required: true,
          constNameRegistry,
        },
      ),
    );

    if ((schema.allOf || schema.oneOf || schema.anyOf) && schema.properties) {
      const additionalPropertiesSchema = {
        properties: schema.properties,
        required: schema.required,
        additionalProperties: schema.additionalProperties,
        type: schema.type,
      } as OpenApiSchemaObject;

      const additionalIndex = baseSchemas.length + 1;
      const additionalPropertiesDefinition =
        generateEffectValidationSchemaDefinition(
          additionalPropertiesSchema,
          context,
          `${camel(name)}${pascal(getNumberWord(additionalIndex))}`,
          strict,
          {
            required: true,
            constNameRegistry,
          },
        );

      if (schema.oneOf || schema.anyOf) {
        functions.push([
          'allOf',
          [
            { functions: [[separator, baseSchemas]], consts: [] },
            additionalPropertiesDefinition,
          ],
        ]);
      } else {
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
      defaultValue = `new Date(${JSON.stringify(schema.default)})`;
    } else if (isObject(schema.default)) {
      const entries = Object.entries(schema.default)
        .map(([key, value]) => {
          const safeKey = JSON.stringify(key);
          if (isString(value)) {
            return `${safeKey}: ${JSON.stringify(value)} as const`;
          }
          if (Array.isArray(value)) {
            const arrayItems = value.map((item) =>
              isString(item) ? `${JSON.stringify(item)} as const` : `${item}`,
            );
            return `${safeKey}: [${arrayItems.join(', ')}]`;
          }
          if (
            value === null ||
            value === undefined ||
            isNumber(value) ||
            isBoolean(value)
          )
            return `${safeKey}: ${value}`;
          return;
        })
        .filter((entry): entry is string => entry !== undefined)
        .join(', ');
      defaultValue = entries.length === 0 ? `{}` : `{ ${entries} }`;
    } else {
      const rawStringified = stringify(schema.default);
      defaultValue =
        rawStringified === undefined
          ? 'null'
          : rawStringified.replaceAll("'", '`');

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

  if (isObject(type) && 'multiType' in type) {
    const types = type.multiType;
    functions.push([
      'oneOf',
      types.map((t) =>
        generateEffectValidationSchemaDefinition(
          {
            ...(schema as Record<string, unknown>),
            type: t,
          } as OpenApiSchemaObject,
          context,
          name,
          strict,
          {
            required: true,
            constNameRegistry,
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

    return { functions, consts };
  }

  if (!skipSwitchStatement) {
    switch (type) {
      case 'tuple': {
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
                generateEffectValidationSchemaDefinition(
                  dereference(item, context),
                  context,
                  camel(`${name}-${idx}-item`),
                  strict,
                  {
                    required: true,
                    constNameRegistry,
                  },
                ),
              ),
            ]);
          }
        }
        break;
      }
      case 'array': {
        functions.push([
          'array',
          generateEffectValidationSchemaDefinition(
            schema.items as OpenApiSchemaObject | undefined,
            context,
            camel(`${name}-item`),
            strict,
            {
              required: true,
              constNameRegistry,
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

        if (schema.format === 'binary') {
          functions.push(['instanceof', 'File']);
          break;
        }

        if (
          schema.contentMediaType === 'application/octet-stream' &&
          !schema.contentEncoding
        ) {
          functions.push(['instanceof', 'File']);
          break;
        }

        if ('const' in schema) {
          functions.push(['literal', JSON.stringify(String(schema.const))]);
        } else {
          functions.push([type as string, undefined]);
        }

        if (schema.format === 'date') {
          functions.push(['dateFormat', undefined]);
          break;
        }

        if (schema.format === 'date-time') {
          functions.push(['dateTimeFormat', undefined]);
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

        const shouldUseLooseObject =
          type === 'object' &&
          !hasDefinedProperties &&
          schema.additionalProperties === undefined &&
          !hasAdditionalPropertiesSchema;

        if (hasProperties && hasDefinedProperties) {
          functions.push([
            strict ? 'strictObject' : 'object',
            Object.keys(properties)
              .map((key) => ({
                [key]:
                  rules?.propertyOverrides?.[key] ??
                  generateEffectValidationSchemaDefinition(
                    properties[key] as OpenApiSchemaObject | undefined,
                    context,
                    camel(`${name}-${key}`),
                    strict,
                    {
                      required: schema.required?.includes(key),
                      constNameRegistry,
                    },
                  ),
              }))
              .reduce((acc, curr) => ({ ...acc, ...curr }), {}),
          ]);

          break;
        }

        if (shouldUseLooseObject) {
          functions.push(['looseObject', {}]);
          break;
        }

        if (schema.additionalProperties) {
          functions.push([
            'additionalProperties',
            generateEffectValidationSchemaDefinition(
              isBoolean(schema.additionalProperties)
                ? {}
                : (schema.additionalProperties as OpenApiSchemaObject),
              context,
              name,
              strict,
              {
                required: true,
                constNameRegistry,
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
    const shouldUseExclusiveMin = exclusiveMinRaw !== undefined;
    const shouldUseExclusiveMax = exclusiveMaxRaw !== undefined;

    if (shouldUseExclusiveMin && exclusiveMin !== undefined) {
      consts.push(
        `export const ${name}ExclusiveMin${constsCounterValue} = ${exclusiveMin};`,
      );
      functions.push(['gt', `${name}ExclusiveMin${constsCounterValue}`]);
    } else if (min !== undefined) {
      if (min === 1) {
        functions.push(['min', `${min}`]);
      } else {
        consts.push(`export const ${name}Min${constsCounterValue} = ${min};`);
        functions.push(['min', `${name}Min${constsCounterValue}`]);
      }
    }

    if (shouldUseExclusiveMax && exclusiveMax !== undefined) {
      consts.push(
        `export const ${name}ExclusiveMax${constsCounterValue} = ${exclusiveMax};`,
      );
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

  if (matches && !hasNonArrayEnum && type === 'string') {
    const isStartWithSlash = matches.startsWith('/');
    const isEndWithSlash = matches.endsWith('/');

    const regexp = `new RegExp('${jsStringLiteralEscape(
      matches.slice(isStartWithSlash ? 1 : 0, isEndWithSlash ? -1 : undefined),
    )}')`;

    consts.push(
      `export const ${name}RegExp${constsCounterValue} = ${regexp};\n`,
    );
    functions.push(['regex', `${name}RegExp${constsCounterValue}`]);
  }

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

  if (schema.description) {
    functions.push(['describe', `'${jsStringEscape(schema.description)}'`]);
  }

  return { functions, consts: unique(consts) };
};

/**
 * Categorize a function name so the parser can decide how to render it
 * (constructor base, pipe filter, or schema wrapper).
 */
const CONSTRUCTORS = new Set([
  'string',
  'number',
  'integer',
  'boolean',
  'null',
  'unknown',
  'any',
  'array',
  'tuple',
  'object',
  'strictObject',
  'looseObject',
  'additionalProperties',
  'literal',
  'enum',
  'oneOf',
  'anyOf',
  'allOf',
  'instanceof',
  'fileOrString',
  'date',
]);

const FILTERS = new Set([
  'min',
  'max',
  'gt',
  'lt',
  'multipleOf',
  'regex',
  'email',
  'uuid',
  'url',
  'dateFormat',
  'dateTimeFormat',
]);

/**
 * Renders a single filter for a `.pipe(...)` group, choosing the right
 * Effect Schema function based on the base type (string/number/array).
 */
const renderFilter = (
  fn: string,
  arg: string,
  baseType: 'string' | 'number' | 'array' | 'unknown',
): string => {
  switch (fn) {
    case 'min': {
      if (baseType === 'string') return `S.minLength(${arg})`;
      if (baseType === 'array') return `S.minItems(${arg})`;
      return `S.greaterThanOrEqualTo(${arg})`;
    }
    case 'max': {
      if (baseType === 'string') return `S.maxLength(${arg})`;
      if (baseType === 'array') return `S.maxItems(${arg})`;
      return `S.lessThanOrEqualTo(${arg})`;
    }
    case 'gt': {
      return `S.greaterThan(${arg})`;
    }
    case 'lt': {
      return `S.lessThan(${arg})`;
    }
    case 'multipleOf': {
      return `S.multipleOf(${arg})`;
    }
    case 'regex': {
      return `S.pattern(${arg})`;
    }
    case 'email': {
      return String.raw`S.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)`;
    }
    case 'uuid': {
      return `S.pattern(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)`;
    }
    case 'url': {
      return String.raw`S.pattern(/^https?:\/\/.+/)`;
    }
    case 'dateFormat': {
      return String.raw`S.pattern(/^\d{4}-\d{2}-\d{2}$/)`;
    }
    case 'dateTimeFormat': {
      return String.raw`S.pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/)`;
    }
    default: {
      return '';
    }
  }
};

const determineBaseType = (
  functions: [string, unknown][],
): 'string' | 'number' | 'array' | 'unknown' => {
  for (const [fn] of functions) {
    if (fn === 'string') return 'string';
    if (fn === 'number' || fn === 'integer') return 'number';
    if (fn === 'array') return 'array';
  }
  return 'unknown';
};

export interface ParseEffectOptions {
  /**
   * When emitting inside a Struct property, wrap optionals/defaults with
   * `S.optional` / `S.optionalWith` so they describe an optional field
   * rather than `T | undefined`.
   */
  asStructProperty?: boolean;
  brandName?: string;
}

/**
 * Parse the intermediate definition into Effect Schema source code.
 */
export const parseEffectValidationSchemaDefinition = (
  input: EffectValidationSchemaDefinition,
  context: ContextSpec,
  strict: boolean,
  brandName?: string,
): { effect: string; consts: string } => {
  if (input.functions.length === 0) {
    return { effect: '', consts: '' };
  }

  let consts = '';

  const appendConstsChunk = (chunk: string) => {
    if (!chunk) return;
    if (
      consts.length > 0 &&
      !consts.endsWith('\n') &&
      !chunk.startsWith('\n')
    ) {
      consts += '\n';
    }
    consts += chunk;
  };

  const renderSchema = (
    definition: EffectValidationSchemaDefinition,
    isStructProperty: boolean,
  ): string => {
    const { functions } = definition;
    if (functions.length === 0) return 'S.Unknown';

    appendConstsChunk(definition.consts.join('\n'));

    const baseType = determineBaseType(functions);
    let base = '';
    const filters: string[] = [];
    const wrappers: [
      'nullable' | 'nullish' | 'optional' | 'default' | 'describe',
      unknown,
    ][] = [];

    for (const [fn, arg] of functions) {
      if (CONSTRUCTORS.has(fn) && !base) {
        base = renderConstructor(fn, arg);
        continue;
      }
      if (FILTERS.has(fn)) {
        filters.push(renderFilter(fn, formatArg(arg), baseType));
        continue;
      }
      if (
        fn === 'nullable' ||
        fn === 'nullish' ||
        fn === 'optional' ||
        fn === 'default' ||
        fn === 'describe'
      ) {
        wrappers.push([fn, arg]);
        continue;
      }
      // Unknown function — emit as a comment-free no-op (skip).
    }

    if (!base) base = 'S.Unknown';

    let out = filters.length > 0 ? `${base}.pipe(${filters.join(', ')})` : base;

    let hasDefault = false;
    let defaultValue: unknown;
    let isOptional = false;
    let isNullable = false;
    let isNullish = false;
    let description: unknown;

    for (const [fn, arg] of wrappers) {
      switch (fn) {
        case 'default': {
          hasDefault = true;
          defaultValue = arg;

          break;
        }
        case 'optional': {
          isOptional = true;

          break;
        }
        case 'nullable': {
          isNullable = true;

          break;
        }
        case 'nullish': {
          isNullish = true;

          break;
        }
        case 'describe': {
          description = arg;

          break;
        }
        // No default
      }
    }

    if (isNullable || isNullish) {
      out = `S.NullOr(${out})`;
    }

    if (isStructProperty) {
      if (hasDefault) {
        out = `S.optionalWith(${out}, { default: () => ${defaultValue as string} })`;
      } else if (isOptional || isNullish) {
        out = `S.optional(${out})`;
      }
    } else {
      if (isNullish) {
        out = `S.UndefinedOr(${out})`;
      } else if (isOptional) {
        out = `S.UndefinedOr(${out})`;
      }
    }

    if (description !== undefined) {
      out = `${out}.annotations({ description: ${description as string} })`;
    }

    return out;
  };

  const formatArg = (value: unknown): string => {
    if (value === undefined) return '';
    if (value === null) return 'null';
    if (isString(value)) return value;
    if (Array.isArray(value)) {
      return value.map((item) => formatArg(item)).join(', ');
    }
    if (isObject(value)) return stringify(value) ?? '';
    if (isNumber(value) || isBoolean(value)) return `${value}`;
    return '';
  };

  const renderConstructor = (fn: string, arg: unknown): string => {
    switch (fn) {
      case 'string': {
        return 'S.String';
      }
      case 'number':
      case 'integer': {
        return 'S.Number';
      }
      case 'boolean': {
        return 'S.Boolean';
      }
      case 'null': {
        return 'S.Null';
      }
      case 'unknown': {
        return 'S.Unknown';
      }
      case 'any': {
        return 'S.Any';
      }
      case 'date': {
        return 'S.DateFromString';
      }
      case 'literal': {
        return `S.Literal(${arg as string})`;
      }
      case 'enum': {
        // arg is "[ 'a', 'b' ]" — strip brackets to spread as Literal args
        return `S.Literal(${(arg as string).replaceAll(/^\[|\]$/g, '')})`;
      }
      case 'instanceof': {
        return `S.instanceOf(${arg as string})`;
      }
      case 'fileOrString': {
        return 'S.Union(S.instanceOf(File), S.String)';
      }
      case 'array': {
        const inner = renderSchema(
          arg as EffectValidationSchemaDefinition,
          false,
        );
        return `S.Array(${inner})`;
      }
      case 'tuple': {
        const items = (arg as EffectValidationSchemaDefinition[])
          .map((d) => renderSchema(d, false))
          .join(', ');
        return `S.Tuple(${items})`;
      }
      case 'object':
      case 'strictObject':
      case 'looseObject': {
        const props = arg as Record<string, EffectValidationSchemaDefinition>;
        const entries = Object.entries(props).map(([key, def]) => {
          const value = renderSchema(def, true);
          return `  ${JSON.stringify(key)}: ${value}`;
        });
        const struct = `S.Struct({\n${entries.join(',\n')}\n})`;
        if (fn === 'looseObject') {
          return `S.extend(${struct}, S.Record({ key: S.String, value: S.Unknown }))`;
        }
        return struct;
      }
      case 'additionalProperties': {
        const inner = renderSchema(
          arg as EffectValidationSchemaDefinition,
          false,
        );
        return `S.Record({ key: S.String, value: ${inner} })`;
      }
      case 'oneOf':
      case 'anyOf': {
        const args = arg as EffectValidationSchemaDefinition[];
        if (args.length === 1) {
          return renderSchema(args[0], false);
        }
        const items = args.map((d) => renderSchema(d, false)).join(', ');
        return `S.Union(${items})`;
      }
      case 'allOf': {
        const args = arg as EffectValidationSchemaDefinition[];
        if (args.length === 1) {
          return renderSchema(args[0], false);
        }
        // S.extend takes pairs; chain via reduce.
        return args
          .map((d) => renderSchema(d, false))
          .reduce((acc, cur) => `S.extend(${acc}, ${cur})`);
      }
      default: {
        return 'S.Unknown';
      }
    }
  };

  appendConstsChunk(input.consts.join('\n'));

  let effect = renderSchema(input, false);

  if (brandName) {
    effect = `${effect}.pipe(S.brand("${brandName}"))`;
  }

  if (consts.includes(',export')) {
    consts = consts.replaceAll(',export', '\nexport');
  }

  // Silence the unused-strict warning — strict is consumed inside the tree
  // generator and threaded through here for future use.
  void strict;
  void context;

  return { effect, consts };
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

function tryResolveRefSchema(
  $ref: string,
  context: ContextSpec,
): OpenApiSchemaObject | undefined {
  try {
    return resolveRef({ $ref } as OpenApiReferenceObject, context)
      .schema as OpenApiSchemaObject;
  } catch (error) {
    logVerbose(
      `[orval/effect] Failed to resolve $ref "${$ref}":`,
      error instanceof Error ? error.message : error,
    );
    return;
  }
}

export const dereference = (
  schema: OpenApiSchemaObject | OpenApiReferenceObject,
  context: ContextSpec,
): OpenApiSchemaObject => {
  const refName = '$ref' in schema ? schema.$ref : undefined;
  if (refName && context.parents?.includes(refName)) {
    return {};
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

  const resolvedContext = childContext;

  return Object.entries(resolvedSchema).reduce<Record<string, unknown>>(
    (acc, [key, value]) => {
      if (key === 'properties' && isObject(value)) {
        acc[key] = Object.entries(value).reduce<
          Record<string, OpenApiSchemaObject>
        >((props, [propKey, propSchema]) => {
          props[propKey] = dereference(
            propSchema as OpenApiSchemaObject | OpenApiReferenceObject,
            resolvedContext,
          );
          return props;
        }, {});
      } else if (key === 'default' || key === 'example' || key === 'examples') {
        acc[key] = value;
      } else {
        acc[key] = dereferenceScalar(value, resolvedContext);
      }
      return acc;
    },
    {},
  ) as OpenApiSchemaObject;
};

export const generateFormDataEffectSchema = (
  schema: OpenApiSchemaObject,
  context: ContextSpec,
  name: string,
  strict: boolean,
  encoding?: Record<string, { contentType?: string }>,
): EffectValidationSchemaDefinition => {
  const propertyOverrides: Record<string, EffectValidationSchemaDefinition> =
    {};

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

  return generateEffectValidationSchemaDefinition(
    schema,
    context,
    name,
    strict,
    {
      required: true,
      propertyOverrides:
        Object.keys(propertyOverrides).length > 0
          ? propertyOverrides
          : undefined,
    },
  );
};

const parseBodyAndResponse = ({
  data,
  context,
  name,
  strict,
  generate,
  parseType,
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
  parseType: 'body' | 'response';
}): {
  input: EffectValidationSchemaDefinition;
  isArray: boolean;
  rules?: { min?: number; max?: number };
} => {
  if (!data || !generate) {
    return { input: { functions: [], consts: [] }, isArray: false };
  }

  const resolvedRef = resolveRef(data, context).schema as
    | OpenApiResponseObject
    | OpenApiRequestBodyObject;

  const jsonMedia = resolvedRef.content?.['application/json'];
  const formDataMedia = resolvedRef.content?.['multipart/form-data'];
  const [contentType, mediaType] = jsonMedia
    ? (['application/json', jsonMedia] as const)
    : formDataMedia
      ? (['multipart/form-data', formDataMedia] as const)
      : [undefined, undefined];

  const schema = mediaType?.schema;
  if (!schema) {
    return { input: { functions: [], consts: [] }, isArray: false };
  }

  const encoding = mediaType.encoding;
  const resolvedJsonSchema = dereference(schema, context);

  if (resolvedJsonSchema.items) {
    const min =
      resolvedJsonSchema.minimum ??
      resolvedJsonSchema.minLength ??
      resolvedJsonSchema.minItems;
    const max =
      resolvedJsonSchema.maximum ??
      resolvedJsonSchema.maxLength ??
      resolvedJsonSchema.maxItems;

    return {
      input: generateEffectValidationSchemaDefinition(
        parseType === 'body'
          ? removeReadOnlyProperties(
              resolvedJsonSchema.items as OpenApiSchemaObject,
            )
          : (resolvedJsonSchema.items as OpenApiSchemaObject),
        context,
        name,
        strict,
        { required: true },
      ),
      isArray: true,
      rules: {
        ...(min === undefined ? {} : { min }),
        ...(max === undefined ? {} : { max }),
      },
    };
  }

  const effectiveSchema =
    parseType === 'body'
      ? removeReadOnlyProperties(resolvedJsonSchema)
      : resolvedJsonSchema;

  const isFormData = contentType === 'multipart/form-data';

  return {
    input: isFormData
      ? generateFormDataEffectSchema(
          effectiveSchema,
          context,
          name,
          strict,
          encoding,
        )
      : generateEffectValidationSchemaDefinition(
          effectiveSchema,
          context,
          name,
          strict,
          { required: true },
        ),
    isArray: false,
  };
};

const getSingleResponse = (
  responses:
    | Record<string, OpenApiResponseObject | OpenApiReferenceObject | undefined>
    | undefined,
) => {
  if (!responses) return;
  return responses['200'] ?? responses['2XX'] ?? responses['2xx'];
};

/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

export const parseParameters = ({
  data,
  context,
  operationName,
  strict,
  generate,
}: {
  data: (OpenApiParameterObject | OpenApiReferenceObject)[] | undefined;
  context: ContextSpec;
  operationName: string;
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
}): {
  headers: EffectValidationSchemaDefinition;
  queryParams: EffectValidationSchemaDefinition;
  params: EffectValidationSchemaDefinition;
} => {
  if (!data) {
    return {
      headers: { functions: [], consts: [] },
      queryParams: { functions: [], consts: [] },
      params: { functions: [], consts: [] },
    };
  }

  const initialDefinitionsByParameters: Record<
    'headers' | 'queryParams' | 'params',
    Record<string, EffectValidationSchemaDefinition>
  > = { headers: {}, queryParams: {}, params: {} };

  const defs = data.reduce((acc, val) => {
    const { schema: parameter }: { schema: OpenApiParameterObject } =
      resolveRef(val, context);

    if (!parameter.schema) return acc;
    if (!parameter.in || !parameter.name) return acc;

    const resolvedSchema = dereference(parameter.schema, context);
    resolvedSchema.description = parameter.description;

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

    const definition = generateEffectValidationSchemaDefinition(
      resolvedSchema,
      context,
      camel(`${operationName}-${parameter.in}-${parameter.name}`),
      mapStrict[parameter.in],
      { required: parameter.required },
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

  const toStruct = (
    props: Record<string, EffectValidationSchemaDefinition>,
    isStrict: boolean,
  ): EffectValidationSchemaDefinition => {
    if (Object.keys(props).length === 0) {
      return { functions: [], consts: [] };
    }
    return {
      functions: [[isStrict ? 'strictObject' : 'object', props]],
      consts: [],
    };
  };

  return {
    headers: toStruct(defs.headers, strict.header),
    queryParams: toStruct(defs.queryParams, strict.query),
    params: toStruct(defs.params, strict.param),
  };
};

const generateEffectRoute = (
  { operationName, verb, override }: GeneratorVerbOptions,
  { pathRoute, context }: GeneratorOptions,
) => {
  const spec = context.spec.paths?.[pathRoute];

  if (spec == undefined) {
    throw new Error(`No such path ${pathRoute} in ${context.projectName}`);
  }

  const parameters = [
    ...(spec.parameters ?? []),
    ...(spec[verb]?.parameters ?? []),
  ];
  const effectOptions = override.effect;

  const parsedParameters = parseParameters({
    data: parameters,
    context,
    operationName,
    strict: effectOptions.strict,
    generate: effectOptions.generate,
  });

  const requestBody = spec[verb]?.requestBody;
  const parsedBody = parseBodyAndResponse({
    data: requestBody,
    context,
    name: camel(`${operationName}-body`),
    strict: effectOptions.strict.body,
    generate: effectOptions.generate.body,
    parseType: 'body',
  });

  const responses = (
    effectOptions.generateEachHttpStatus
      ? Object.entries(spec[verb]?.responses ?? {})
      : [['', getSingleResponse(spec[verb]?.responses)]]
  ) as [string, OpenApiResponseObject | OpenApiReferenceObject][];
  const parsedResponses = responses.map(([code, response]) =>
    parseBodyAndResponse({
      data: response,
      context,
      name: camel(`${operationName}-${code}-response`),
      strict: effectOptions.strict.response,
      generate: effectOptions.generate.response,
      parseType: 'response',
    }),
  );

  const pascalOperationName = pascal(operationName);
  const useBrandedTypes = effectOptions.useBrandedTypes;
  const brand = (name: string) => (useBrandedTypes ? name : undefined);

  const inputParams = parseEffectValidationSchemaDefinition(
    parsedParameters.params,
    context,
    effectOptions.strict.param,
    brand(`${pascalOperationName}Params`),
  );
  const inputQueryParams = parseEffectValidationSchemaDefinition(
    parsedParameters.queryParams,
    context,
    effectOptions.strict.query,
    brand(`${pascalOperationName}QueryParams`),
  );
  const inputHeaders = parseEffectValidationSchemaDefinition(
    parsedParameters.headers,
    context,
    effectOptions.strict.header,
    brand(`${pascalOperationName}Header`),
  );
  const inputBody = parseEffectValidationSchemaDefinition(
    parsedBody.input,
    context,
    effectOptions.strict.body,
    brand(`${pascalOperationName}Body`),
  );
  const inputResponses = parsedResponses.map((parsedResponse, idx) =>
    parseEffectValidationSchemaDefinition(
      parsedResponse.input,
      context,
      effectOptions.strict.response,
      brand(pascal(`${operationName}-${responses[idx][0]}-response`)),
    ),
  );

  if (
    !inputParams.effect &&
    !inputQueryParams.effect &&
    !inputHeaders.effect &&
    !inputBody.effect &&
    !inputResponses.some((r) => r.effect)
  ) {
    return { implementation: '', mutators: [] };
  }

  return {
    implementation: [
      ...(inputParams.consts ? [inputParams.consts] : []),
      ...(inputParams.effect
        ? [`export const ${pascalOperationName}Params = ${inputParams.effect}`]
        : []),
      ...(inputQueryParams.consts ? [inputQueryParams.consts] : []),
      ...(inputQueryParams.effect
        ? [
            `export const ${pascalOperationName}QueryParams = ${inputQueryParams.effect}`,
          ]
        : []),
      ...(inputHeaders.consts ? [inputHeaders.consts] : []),
      ...(inputHeaders.effect
        ? [`export const ${pascalOperationName}Header = ${inputHeaders.effect}`]
        : []),
      ...(inputBody.consts ? [inputBody.consts] : []),
      ...(inputBody.effect
        ? [
            parsedBody.isArray
              ? `export const ${pascalOperationName}BodyItem = ${inputBody.effect}
export const ${pascalOperationName}Body = S.Array(${pascalOperationName}BodyItem)${
                  parsedBody.rules?.min
                    ? `.pipe(S.minItems(${parsedBody.rules.min}))`
                    : ''
                }${
                  parsedBody.rules?.max
                    ? `.pipe(S.maxItems(${parsedBody.rules.max}))`
                    : ''
                }`
              : `export const ${pascalOperationName}Body = ${inputBody.effect}`,
          ]
        : []),
      ...inputResponses.flatMap((inputResponse, index) => {
        const operationResponse = pascal(
          `${operationName}-${responses[index][0]}-response`,
        );
        return [
          ...(inputResponse.consts ? [inputResponse.consts] : []),
          ...(inputResponse.effect
            ? [
                parsedResponses[index].isArray
                  ? `export const ${operationResponse}Item = ${inputResponse.effect}
export const ${operationResponse} = S.Array(${operationResponse}Item)${
                      parsedResponses[index].rules?.min
                        ? `.pipe(S.minItems(${parsedResponses[index].rules.min}))`
                        : ''
                    }${
                      parsedResponses[index].rules?.max
                        ? `.pipe(S.maxItems(${parsedResponses[index].rules.max}))`
                        : ''
                    }`
                  : `export const ${operationResponse} = ${inputResponse.effect}`,
              ]
            : []),
        ];
      }),
    ].join('\n\n'),
    mutators: [],
  };
};

export const generateEffect: ClientBuilder = (verbOptions, options) => {
  const { implementation, mutators } = generateEffectRoute(
    verbOptions,
    options,
  );

  return {
    implementation: implementation ? `${implementation}\n\n` : '',
    imports: [],
    mutators,
  };
};

const effectClientBuilder: ClientGeneratorsBuilder = {
  client: generateEffect,
  dependencies: getEffectDependencies,
};

export const builder = () => () => effectClientBuilder;

export default builder;
