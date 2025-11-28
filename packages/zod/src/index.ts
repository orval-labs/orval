import {
  camel,
  type ClientBuilder,
  type ClientGeneratorsBuilder,
  type ContextSpecs,
  escape,
  generateMutator,
  type GeneratorDependency,
  type GeneratorMutator,
  type GeneratorOptions,
  type GeneratorVerbOptions,
  getNumberWord,
  getPropertySafe,
  getRefInfo,
  isBoolean,
  isObject,
  isString,
  jsStringEscape,
  pascal,
  resolveRef,
  stringify,
  type ZodCoerceType,
} from '@orval/core';
import {
  type ParameterObject,
  type PathItemObject,
  type ReferenceObject,
  type RequestBodyObject,
  type ResponseObject,
  type SchemaObject,
} from 'openapi3-ts/oas30';
import { type SchemaObject as SchemaObject31 } from 'openapi3-ts/oas31';
import { unique } from 'remeda';

import {
  getObjectFunctionName,
  getParameterFunctions,
  getZodDateFormat,
  getZodDateTimeFormat,
  getZodTimeFormat,
  isZodVersionV4,
} from './compatible-v4';

const ZOD_DEPENDENCIES: GeneratorDependency[] = [
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
    dependency: 'zod',
  },
];

export const getZodDependencies = () => ZOD_DEPENDENCIES;

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

const resolveZodType = (schema: SchemaObject | SchemaObject31) => {
  const schemaTypeValue = schema.type;

  // Handle array of types (OpenAPI 3.1+)
  if (Array.isArray(schemaTypeValue)) {
    // Filter out 'null' type as it's handled separately via nullable
    const nonNullTypes = schemaTypeValue
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
  const type = schemaTypeValue;

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

const constsUniqueCounter: Record<string, number> = {};

// https://github.com/colinhacks/zod#coercion-for-primitives
const COERCIBLE_TYPES = new Set([
  'string',
  'number',
  'boolean',
  'bigint',
  'date',
]);

export type ZodValidationSchemaDefinition = {
  functions: [string, any][];
  consts: string[];
};

const minAndMaxTypes = new Set(['number', 'string', 'array']);

const removeReadOnlyProperties = (schema: SchemaObject): SchemaObject => {
  if (schema.properties) {
    return {
      ...schema,
      properties: Object.entries(schema.properties).reduce<
        Record<string, SchemaObject>
      >((acc, [key, value]) => {
        if ('readOnly' in value && value.readOnly) return acc;
        acc[key] = value as SchemaObject;
        return acc;
      }, {}),
    };
  }
  if (schema.items && 'properties' in schema.items) {
    return {
      ...schema,
      items: removeReadOnlyProperties(schema.items as SchemaObject),
    };
  }
  return schema;
};

type DateTimeOptions = {
  offset?: boolean;
  local?: boolean;
  precision?: number;
};

type TimeOptions = {
  precision?: -1 | 0 | 1 | 2 | 3;
};

export const generateZodValidationSchemaDefinition = (
  schema: SchemaObject | SchemaObject31 | undefined,
  context: ContextSpecs,
  name: string,
  strict: boolean,
  isZodV4: boolean,
  rules?: {
    required?: boolean;
    dateTimeOptions?: DateTimeOptions;
    timeOptions?: TimeOptions;
  },
): ZodValidationSchemaDefinition => {
  if (!schema) return { functions: [], consts: [] };

  const consts: string[] = [];
  const constsCounter =
    typeof constsUniqueCounter[name] === 'number'
      ? constsUniqueCounter[name] + 1
      : 0;

  const constsCounterValue = constsCounter
    ? pascal(getNumberWord(constsCounter))
    : '';

  constsUniqueCounter[name] = constsCounter;

  const functions: [string, any][] = [];
  const type = resolveZodType(schema);
  const required = rules?.required ?? false;
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
    typeof exclusiveMinRaw === 'boolean' && exclusiveMinRaw
      ? min
      : exclusiveMinRaw;
  const exclusiveMax =
    typeof exclusiveMaxRaw === 'boolean' && exclusiveMaxRaw
      ? max
      : exclusiveMaxRaw;

  const multipleOf = schema.multipleOf;
  const matches = schema.pattern ?? undefined;

  // Check for allOf/oneOf/anyOf BEFORE processing by type
  // This ensures these constraints work with any base type (string, number, object, etc.)
  let skipSwitchStatement = false;
  if (schema.allOf || schema.oneOf || schema.anyOf) {
    const separator = schema.allOf ? 'allOf' : schema.oneOf ? 'oneOf' : 'anyOf';

    const schemas = (schema.allOf ?? schema.oneOf ?? schema.anyOf) as (
      | SchemaObject
      | ReferenceObject
    )[];

    // Use index-based naming to ensure uniqueness when processing multiple schemas
    // This prevents duplicate schema names when nullable refs are used
    const baseSchemas = schemas.map((schema, index) =>
      generateZodValidationSchemaDefinition(
        schema as SchemaObject,
        context,
        `${camel(name)}${pascal(getNumberWord(index + 1))}`,
        strict,
        isZodV4,
        {
          required: true,
        },
      ),
    );

    // Handle allOf with additional properties - merge additional properties into the last schema
    if (schema.allOf && schema.properties) {
      const additionalPropertiesSchema = {
        properties: schema.properties,
        required: schema.required,
        additionalProperties: schema.additionalProperties,
        type: schema.type,
      } as SchemaObject;

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
          },
        );

      baseSchemas.push(additionalPropertiesDefinition);
    }

    functions.push([separator, baseSchemas]);
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
      // openapi3-ts's SchemaObject defines default as 'any'
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      defaultValue = `new Date("${escape(schema.default)}")`;
    } else if (isObject(schema.default)) {
      const entries = Object.entries(schema.default)
        .map(([key, value]) => {
          if (isString(value)) {
            return `${key}: "${escape(value)}"`;
          }

          if (Array.isArray(value)) {
            const arrayItems = value.map((item) =>
              isString(item) ? `"${escape(item)}"` : `${item}`,
            );
            return `${key}: [${arrayItems.join(', ')}]`;
          }

          if (
            value === null ||
            value === undefined ||
            typeof value === 'number' ||
            typeof value === 'boolean'
          )
            return `${key}: ${value}`;
        })
        .join(', ');
      defaultValue = `{ ${entries} }`;
    } else {
      // openapi3-ts's SchemaObject defines default as 'any'
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const rawStringified = stringify(schema.default);
      defaultValue =
        rawStringified === undefined
          ? 'null'
          : rawStringified.replaceAll("'", '"');

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
  if (typeof type === 'object' && 'multiType' in type) {
    const types = type.multiType;
    functions.push([
      'oneOf',
      types.map((t) =>
        generateZodValidationSchemaDefinition(
          { ...schema, type: t },
          context,
          name,
          strict,
          isZodV4,
          { required: true },
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
          const schema31 = schema as SchemaObject31;

          if (schema31.prefixItems && schema31.prefixItems.length > 0) {
            functions.push([
              'tuple',
              schema31.prefixItems.map((item, idx) =>
                generateZodValidationSchemaDefinition(
                  dereference(item as SchemaObject | ReferenceObject, context),
                  context,
                  camel(`${name}-${idx}-item`),
                  isZodV4,
                  strict,
                  {
                    required: true,
                  },
                ),
              ),
            ]);

            if (
              schema.items &&
              (max ?? Number.POSITIVE_INFINITY) > schema31.prefixItems.length
            ) {
              // only add zod.rest() if number of tuple elements can exceed provided prefixItems:
              functions.push([
                'rest',
                generateZodValidationSchemaDefinition(
                  schema.items as SchemaObject | undefined,
                  context,
                  camel(`${name}-item`),
                  strict,
                  isZodV4,
                  {
                    required: true,
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
            schema.items as SchemaObject | undefined,
            context,
            camel(`${name}-item`),
            strict,
            isZodV4,
            {
              required: true,
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

        if (isZodV4) {
          if (
            ![
              'date',
              'time',
              'date-time',
              'email',
              'uri',
              'hostname',
              'uuid',
            ].includes(schema.format ?? '')
          ) {
            if ('const' in schema) {
              functions.push(['literal', `"${schema.const}"`]);
            } else {
              functions.push([type as string, undefined]);
            }
            break;
          }
        } else {
          if ('const' in schema) {
            functions.push(['literal', `"${schema.const}"`]);
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

        if (schema.format === 'uri' || schema.format === 'hostname') {
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
        if (schema.properties) {
          const objectType = getObjectFunctionName(isZodV4, strict);

          functions.push([
            objectType,
            Object.keys(schema.properties)
              .map((key) => ({
                [key]: generateZodValidationSchemaDefinition(
                  schema.properties?.[key] as
                    | SchemaObject
                    | SchemaObject31
                    | undefined,
                  context,
                  camel(`${name}-${key}`),
                  strict,
                  isZodV4,
                  {
                    required: schema.required?.includes(key),
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

        if (schema.additionalProperties) {
          functions.push([
            'additionalProperties',
            generateZodValidationSchemaDefinition(
              isBoolean(schema.additionalProperties)
                ? {}
                : (schema.additionalProperties as SchemaObject),
              context,
              name,
              strict,
              isZodV4,
              {
                required: true,
              },
            ),
          ]);

          break;
        }

        if (schema.enum) {
          break;
        }

        functions.push([type as string, undefined]);

        break;
      }
    }
  }

  if (minAndMaxTypes.has(type)) {
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

  if (matches) {
    const isStartWithSlash = matches.startsWith('/');
    const isEndWithSlash = matches.endsWith('/');

    const regexp = `new RegExp('${jsStringEscape(
      matches.slice(isStartWithSlash ? 1 : 0, isEndWithSlash ? -1 : undefined),
    )}')`;

    consts.push(
      `export const ${name}RegExp${constsCounterValue} = ${regexp};\n`,
    );
    functions.push(['regex', `${name}RegExp${constsCounterValue}`]);
  }

  if (schema.enum) {
    if (schema.enum.every((value) => isString(value))) {
      functions.push([
        'enum',
        `[${schema.enum.map((value) => `'${escape(value)}'`).join(', ')}]`,
      ]);
    } else {
      functions.push([
        'oneOf',
        schema.enum.map((value) => ({
          functions: [
            ['literal', isString(value) ? `'${escape(value)}'` : value],
          ],
          consts: [],
        })),
      ]);
    }
  }

  if (!required && schema.default !== undefined) {
    functions.push(['default', defaultVarName]);
  } else if (!required && nullable) {
    functions.push(['nullish', undefined]);
  } else if (nullable) {
    functions.push(['nullable', undefined]);
  } else if (!required) {
    functions.push(['optional', undefined]);
  }

  if (schema.description) {
    functions.push(['describe', `'${jsStringEscape(schema.description)}'`]);
  }

  return { functions, consts: unique(consts) };
};

export const parseZodValidationSchemaDefinition = (
  input: ZodValidationSchemaDefinition,
  context: ContextSpecs,
  coerceTypes: boolean | ZodCoerceType[] = false,
  strict: boolean,
  isZodV4: boolean,
  preprocess?: GeneratorMutator,
): { zod: string; consts: string } => {
  if (input.functions.length === 0) {
    return { zod: '', consts: '' };
  }

  let consts = '';

  const parseProperty = (property: [string, any]): string => {
    const [fn, args = ''] = property;

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
            if (
              objectArgs &&
              typeof objectArgs === 'object' &&
              !Array.isArray(objectArgs)
            ) {
              // Merge properties (later schemas override earlier ones)
              Object.assign(
                mergedProperties,
                objectArgs as Record<string, ZodValidationSchemaDefinition>,
              );
            }
          }
        }

        if (allConsts.length > 0) {
          consts += allConsts;
        }

        // Generate merged object
        const objectType = getObjectFunctionName(isZodV4, strict);
        const mergedObjectString = `zod.${objectType}({
${Object.entries(mergedProperties)
  .map(([key, schema]) => {
    const value = schema.functions.map((prop) => parseProperty(prop)).join('');
    consts += schema.consts.join('\n');
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
          .map((prop) => parseProperty(prop))
          .join('');
        const valueWithZod = `${value.startsWith('.') ? 'zod' : ''}${value}`;

        if (partSchema.consts.length > 0) {
          consts += partSchema.consts.join('\n');
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
      // Can't use zod.union() with a single item
      if (args.length === 1) {
        return args[0].functions
          .map((prop: any) => parseProperty(prop))
          .join('');
      }

      const union = args.map(
        ({
          functions,
          consts: argConsts,
        }: {
          functions: [string, any][];
          consts: string[];
        }) => {
          const value = functions.map((prop) => parseProperty(prop)).join('');
          const valueWithZod = `${value.startsWith('.') ? 'zod' : ''}${value}`;
          // consts are missing here
          consts += argConsts.join('\n');
          return valueWithZod;
        },
      );

      return `.union([${union}])`;
    }

    if (fn === 'additionalProperties') {
      const value = args.functions
        .map((prop: any) => parseProperty(prop))
        .join('');
      const valueWithZod = `${value.startsWith('.') ? 'zod' : ''}${value}`;
      consts += args.consts;
      return `zod.record(zod.string(), ${valueWithZod})`;
    }

    if (fn === 'object' || fn === 'strictObject') {
      const objectType = getObjectFunctionName(isZodV4, strict);

      return `zod.${objectType}({
${Object.entries(args)
  .map(([key, schema]) => {
    const value = (schema as ZodValidationSchemaDefinition).functions
      .map((prop) => parseProperty(prop))
      .join('');
    consts += (schema as ZodValidationSchemaDefinition).consts.join('\n');
    return `  "${key}": ${value.startsWith('.') ? 'zod' : ''}${value}`;
  })
  .join(',\n')}
})`;
    }
    if (fn === 'array') {
      const value = args.functions
        .map((prop: any) => parseProperty(prop))
        .join('');
      if (typeof args.consts === 'string') {
        consts += args.consts;
      } else if (Array.isArray(args.consts)) {
        consts += args.consts.join('\n');
      }
      return `.array(${value.startsWith('.') ? 'zod' : ''}${value})`;
    }

    if (fn === 'strict' && !isZodV4) {
      return '.strict()';
    }

    if (fn === 'tuple') {
      return `zod.tuple([${(args as ZodValidationSchemaDefinition[])
        .map((x) => {
          const value = x.functions.map((prop) => parseProperty(prop)).join('');
          return `${value.startsWith('.') ? 'zod' : ''}${value}`;
        })
        .join(',\n')}])`;
    }
    if (fn === 'rest') {
      return `.rest(zod${(args as ZodValidationSchemaDefinition).functions.map((prop) => parseProperty(prop))})`;
    }
    const shouldCoerceType =
      coerceTypes &&
      (Array.isArray(coerceTypes)
        ? coerceTypes.includes(fn as ZodCoerceType)
        : COERCIBLE_TYPES.has(fn));

    if (
      (fn !== 'date' && shouldCoerceType) ||
      (fn === 'date' && shouldCoerceType && context.output.override.useDates)
    ) {
      return `.coerce.${fn}(${args})`;
    }

    return `.${fn}(${args})`;
  };

  consts += input.consts.join('\n');

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
  return { zod, consts };
};

const dereferenceScalar = (value: any, context: ContextSpecs): unknown => {
  if (isObject(value)) {
    return dereference(value, context);
  } else if (Array.isArray(value)) {
    return value.map((item) => dereferenceScalar(item, context));
  } else {
    return value;
  }
};

const dereference = (
  schema: SchemaObject | ReferenceObject,
  context: ContextSpecs,
): SchemaObject => {
  const refName = '$ref' in schema ? schema.$ref : undefined;
  if (refName && context.parents?.includes(refName)) {
    return {};
  }

  const childContext: ContextSpecs = {
    ...context,
    ...(refName
      ? { parents: [...(context.parents ?? []), refName] }
      : undefined),
  };

  const { schema: resolvedSchema } = resolveRef<SchemaObject>(
    schema,
    childContext,
  );

  const resolvedSpecKey = refName
    ? getRefInfo(refName, context).specKey
    : undefined;

  const resolvedContext: ContextSpecs = {
    ...childContext,
    specKey: resolvedSpecKey ?? childContext.specKey,
  };

  return Object.entries(resolvedSchema).reduce<any>((acc, [key, value]) => {
    if (key === 'properties' && isObject(value)) {
      acc[key] = Object.entries(value).reduce<Record<string, SchemaObject>>(
        (props, [propKey, propSchema]) => {
          props[propKey] = dereference(
            propSchema as SchemaObject | ReferenceObject,
            resolvedContext,
          );
          return props;
        },
        {},
      );
    } else if (key === 'default' || key === 'example' || key === 'examples') {
      acc[key] = value;
    } else {
      acc[key] = dereferenceScalar(value, resolvedContext);
    }

    return acc;
  }, {});
};

const parseBodyAndResponse = ({
  data,
  context,
  name,
  strict,
  generate,
  isZodV4,
  parseType,
}: {
  data: ResponseObject | RequestBodyObject | ReferenceObject | undefined;
  context: ContextSpecs;
  name: string;
  strict: boolean;
  generate: boolean;
  isZodV4: boolean;
  parseType: 'body' | 'response';
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

  const resolvedRef = resolveRef<ResponseObject | RequestBodyObject>(
    data,
    context,
  ).schema;

  const schema =
    resolvedRef.content?.['application/json']?.schema ??
    resolvedRef.content?.['multipart/form-data']?.schema;

  if (!schema) {
    return {
      input: { functions: [], consts: [] },
      isArray: false,
    };
  }

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

    return {
      input: generateZodValidationSchemaDefinition(
        parseType === 'body'
          ? removeReadOnlyProperties(resolvedJsonSchema.items as SchemaObject)
          : (resolvedJsonSchema.items as SchemaObject),
        context,
        name,
        strict,
        isZodV4,
        {
          required: true,
        },
      ),
      isArray: true,
      rules: {
        ...(min === undefined ? {} : { min }),
        ...(max === undefined ? {} : { max }),
      },
    };
  }

  return {
    input: generateZodValidationSchemaDefinition(
      parseType === 'body'
        ? removeReadOnlyProperties(resolvedJsonSchema)
        : resolvedJsonSchema,
      context,
      name,
      strict,
      isZodV4,
      {
        required: true,
      },
    ),
    isArray: false,
  };
};

const parseParameters = ({
  data,
  context,
  operationName,
  isZodV4,
  strict,
  generate,
}: {
  data: (ParameterObject | ReferenceObject)[] | undefined;
  context: ContextSpecs;
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

  const defintionsByParameters = data.reduce<
    Record<
      'headers' | 'queryParams' | 'params',
      Record<string, { functions: [string, any][]; consts: string[] }>
    >
  >(
    (acc, val) => {
      const { schema: parameter } = resolveRef<ParameterObject>(val, context);

      if (!parameter.schema) {
        return acc;
      }

      const schema = dereference(parameter.schema, context);
      schema.description = parameter.description;

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

      const definition = generateZodValidationSchemaDefinition(
        schema,
        context,
        camel(`${operationName}-${parameter.in}-${parameter.name}`),
        getPropertySafe(mapStrict, parameter.in).value ?? false,
        isZodV4,
        {
          required: parameter.required,
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
    },
    {
      headers: {},
      queryParams: {},
      params: {},
    },
  );

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
  { operationName, verb, override }: GeneratorVerbOptions,
  { pathRoute, context, output }: GeneratorOptions,
) => {
  const isZodV4 =
    !!context.output.packageJson && isZodVersionV4(context.output.packageJson);
  const spec = context.specs[context.specKey].paths[pathRoute] as
    | PathItemObject
    | undefined;

  if (spec == undefined) {
    throw new Error(`No such path ${pathRoute} in ${context.specKey}`);
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
  });

  const responses = (
    context.output.override.zod.generateEachHttpStatus
      ? Object.entries(spec[verb]?.responses ?? {})
      : [['', spec[verb]?.responses[200]]]
  ) as [string, ResponseObject | ReferenceObject][];
  const parsedResponses = responses.map(([code, response]) =>
    parseBodyAndResponse({
      data: response,
      context,
      name: camel(`${operationName}-${code}-response`),
      strict: override.zod.strict.response,
      generate: override.zod.generate.response,
      isZodV4,
      parseType: 'response',
    }),
  );

  const preprocessParams = override.zod.preprocess?.param
    ? await generateMutator({
        output,
        mutator: override.zod.preprocess.response,
        name: `${operationName}PreprocessParams`,
        workspace: context.workspace,
        tsconfig: context.output.tsconfig,
      })
    : undefined;

  const inputParams = parseZodValidationSchemaDefinition(
    parsedParameters.params,
    context,
    override.zod.coerce.param,
    override.zod.strict.param,
    isZodV4,
    preprocessParams,
  );

  const preprocessQueryParams = override.zod.preprocess?.query
    ? await generateMutator({
        output,
        mutator: override.zod.preprocess.response,
        name: `${operationName}PreprocessQueryParams`,
        workspace: context.workspace,
        tsconfig: context.output.tsconfig,
      })
    : undefined;

  const inputQueryParams = parseZodValidationSchemaDefinition(
    parsedParameters.queryParams,
    context,
    override.zod.coerce.query,
    override.zod.strict.query,
    isZodV4,
    preprocessQueryParams,
  );

  const preprocessHeader = override.zod.preprocess?.header
    ? await generateMutator({
        output,
        mutator: override.zod.preprocess.response,
        name: `${operationName}PreprocessHeader`,
        workspace: context.workspace,
        tsconfig: context.output.tsconfig,
      })
    : undefined;

  const inputHeaders = parseZodValidationSchemaDefinition(
    parsedParameters.headers,
    context,
    override.zod.coerce.header,
    override.zod.strict.header,
    isZodV4,
    preprocessHeader,
  );

  const preprocessBody = override.zod.preprocess?.body
    ? await generateMutator({
        output,
        mutator: override.zod.preprocess.response,
        name: `${operationName}PreprocessBody`,
        workspace: context.workspace,
        tsconfig: context.output.tsconfig,
      })
    : undefined;

  const inputBody = parseZodValidationSchemaDefinition(
    parsedBody.input,
    context,
    override.zod.coerce.body,
    override.zod.strict.body,
    isZodV4,
    preprocessBody,
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

  const inputResponses = parsedResponses.map((parsedResponse) =>
    parseZodValidationSchemaDefinition(
      parsedResponse.input,
      context,
      override.zod.coerce.response,
      override.zod.strict.response,
      isZodV4,
      preprocessResponse,
    ),
  );

  if (
    !inputParams.zod &&
    !inputQueryParams.zod &&
    !inputHeaders.zod &&
    !inputBody.zod &&
    !inputResponses.some((inputResponse) => inputResponse.zod)
  ) {
    return {
      implemtation: '',
      mutators: [],
    };
  }

  return {
    implementation: [
      ...(inputParams.consts ? [inputParams.consts] : []),
      ...(inputParams.zod
        ? [`export const ${operationName}Params = ${inputParams.zod}`]
        : []),
      ...(inputQueryParams.consts ? [inputQueryParams.consts] : []),
      ...(inputQueryParams.zod
        ? [`export const ${operationName}QueryParams = ${inputQueryParams.zod}`]
        : []),
      ...(inputHeaders.consts ? [inputHeaders.consts] : []),
      ...(inputHeaders.zod
        ? [`export const ${operationName}Header = ${inputHeaders.zod}`]
        : []),
      ...(inputBody.consts ? [inputBody.consts] : []),
      ...(inputBody.zod
        ? [
            parsedBody.isArray
              ? `export const ${operationName}BodyItem = ${inputBody.zod}
export const ${operationName}Body = zod.array(${operationName}BodyItem)${
                  parsedBody.rules?.min ? `.min(${parsedBody.rules.min})` : ''
                }${
                  parsedBody.rules?.max ? `.max(${parsedBody.rules.max})` : ''
                }`
              : `export const ${operationName}Body = ${inputBody.zod}`,
          ]
        : []),
      ...inputResponses.flatMap((inputResponse, index) => {
        const operationResponse = camel(
          `${operationName}-${responses[index][0]}-response`,
        );
        return [
          ...(inputResponse.consts ? [inputResponse.consts] : []),
          ...(inputResponse.zod
            ? [
                parsedResponses[index].isArray
                  ? `export const ${operationResponse}Item = ${
                      inputResponse.zod
                    }
export const ${operationResponse} = zod.array(${operationResponse}Item)${
                      parsedResponses[index].rules?.min
                        ? `.min(${parsedResponses[index].rules.min})`
                        : ''
                    }${
                      parsedResponses[index].rules?.max
                        ? `.max(${parsedResponses[index].rules.max})`
                        : ''
                    }`
                  : `export const ${operationResponse} = ${inputResponse.zod}`,
              ]
            : []),
        ];
      }),
    ].join('\n\n'),
    mutators: preprocessResponse ? [preprocessResponse] : [],
  };
};

export const generateZod: ClientBuilder = async (verbOptions, options) => {
  const { implementation, mutators } = await generateZodRoute(
    verbOptions,
    options,
  );

  return {
    implementation: implementation ? `${implementation}\n\n` : '',
    imports: [],
    mutators,
  };
};

const zodClientBuilder: ClientGeneratorsBuilder = {
  client: generateZod,
  dependencies: getZodDependencies,
};

export const builder = () => () => zodClientBuilder;

export default builder;
