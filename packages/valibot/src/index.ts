import {
  assertSafeNumericConstraint,
  type ClientBuilder,
  type ClientGeneratorsBuilder,
  type ContextSpec,
  type GeneratorDependency,
  type GeneratorOptions,
  type GeneratorVerbOptions,
  getEnumMembers,
  getRequiredKeys,
  isBoolean,
  isObject,
  isOctetStreamContentType,
  isSchemaNullable,
  isString,
  jsStringLiteralEscape,
  type OpenApiNonBooleanSchemaObject,
  type OpenApiParameterObject,
  type OpenApiReferenceObject,
  type OpenApiRequestBodyObject,
  type OpenApiResponseObject,
  type OpenApiSchemaObject,
  pascal,
  resolveRef,
  toJsLiteral,
  toObjectSchema,
} from '@orval/core';

import { logger } from './logger';

// A namespace import lets a bundler drop every `v.*` that is unused.
const VALIBOT_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      {
        default: false,
        name: 'v',
        syntheticDefaultImport: false,
        namespaceImport: true,
        values: true,
      },
    ],
    dependency: 'valibot',
  },
];

export const getValibotDependencies = (): GeneratorDependency[] =>
  VALIBOT_DEPENDENCIES;

type Fn = [string, unknown];

/**
 * Intermediate definition: an ordered list of `[name, argument]` pairs that
 * `renderValibot` turns into source. Only names the renderer knows are
 * emitted, so nothing taken from the document can pick a `v.*` function.
 */
export interface ValibotValidationSchemaDefinition {
  functions: Fn[];
}

type Definition = ValibotValidationSchemaDefinition;

// Object entries are pairs, not a record, so a key such as `__proto__` or
// `constructor` is just data.
type Entries = [string, Definition][];

const OBJECT_KINDS = new Set(['object', 'strictObject', 'looseObject']);
const MEMBER_KINDS = new Set(['oneOf', 'anyOf', 'allOf']);

const possibleSchemaTypes = new Set([
  'integer',
  'number',
  'string',
  'boolean',
  'object',
  'null',
  'array',
]);

const resolveType = (schema: OpenApiNonBooleanSchemaObject): string => {
  const { type } = schema;
  if (Array.isArray(type)) {
    const types = type.filter(
      (t) => t !== 'null' && possibleSchemaTypes.has(t),
    );
    if (types.length > 0) return types[0];
    return type.includes('null') ? 'null' : 'unknown';
  }
  return isString(type) && possibleSchemaTypes.has(type) ? type : 'unknown';
};

// Types of a multi-type schema other than `null`, which is the nullable flag.
const getMultiTypes = (schema: OpenApiNonBooleanSchemaObject): string[] =>
  Array.isArray(schema.type)
    ? schema.type.filter((t) => t !== 'null' && possibleSchemaTypes.has(t))
    : [];

const FORMATS = new Map([
  ['email', 'email'],
  ['uri', 'url'],
  ['uuid', 'uuid'],
  ['ipv4', 'ipv4'],
  ['ipv6', 'ipv6'],
  ['byte', 'base64'],
]);

const requireField = (field: Definition): Definition => ({
  functions: field.functions.filter(([fn]) => fn !== 'optional'),
});

// Marks the given keys as required in every object reachable through the
// composition constructors.
const requireFields = (
  definition: Definition,
  keys: ReadonlySet<string>,
): Definition => {
  if (keys.size === 0) return definition;
  const requireEntries = (entries: Entries): Entries =>
    entries.map(([key, field]) => [
      key,
      keys.has(key) ? requireField(field) : field,
    ]);
  const requireMembers = (members: Definition[]) =>
    members.map((member) => requireFields(member, keys));

  return {
    functions: definition.functions.map(([fn, arg]): Fn => {
      if (OBJECT_KINDS.has(fn)) return [fn, requireEntries(arg as Entries)];
      if (fn === 'objectWithRest') {
        const { entries, rest } = arg as { entries: Entries; rest: Definition };
        return [fn, { entries: requireEntries(entries), rest }];
      }
      if (MEMBER_KINDS.has(fn))
        return [fn, requireMembers(arg as Definition[])];
      if (fn === 'variant') {
        const { key, options } = arg as { key: string; options: Definition[] };
        return [fn, { key, options: requireMembers(options) }];
      }
      return [fn, arg];
    }),
  };
};

// Keys required by the schema and, through nested `allOf`, by its members.
const requiredKeysOf = (schema: OpenApiNonBooleanSchemaObject): string[] => [
  ...(getRequiredKeys(schema, 'schema') as string[]),
  ...(Array.isArray(schema.allOf) ? schema.allOf : []).flatMap((member) =>
    isObject(member)
      ? requiredKeysOf(member as OpenApiNonBooleanSchemaObject)
      : [],
  ),
];

// `v.variant` needs every option to be a bare object whose discriminator is a
// literal or a picklist.
const toVariant = (
  members: Definition[],
  key: string,
): Definition | undefined => {
  const isVariantOption = (member: Definition) => {
    const [only] = member.functions;
    if (member.functions.length !== 1 || !OBJECT_KINDS.has(only[0])) {
      return false;
    }
    const entry = (only[1] as Entries).find(([name]) => name === key)?.[1];
    return (
      entry?.functions.length === 1 &&
      (entry.functions[0][0] === 'literal' ||
        entry.functions[0][0] === 'picklist')
    );
  };
  return members.every(isVariantOption)
    ? { functions: [['variant', { key, options: members }]] }
    : undefined;
};

const warned = new Set<string>();
const warnOnce = (message: string) => {
  if (warned.has(message)) return;
  warned.add(message);
  logger.warn(message);
};

interface Rules {
  required?: boolean;
}

export const generateValibotValidationSchemaDefinition = (
  schemaInput: OpenApiSchemaObject | undefined,
  context: ContextSpec,
  strict: boolean,
  rules?: Rules,
): Definition => {
  const required = rules?.required ?? false;

  if (!isObject(schemaInput)) {
    const functions: Fn[] = [
      [schemaInput === false ? 'never' : 'unknown', undefined],
    ];
    if (!required) functions.push(['optional', undefined]);
    return { functions };
  }

  const schema: OpenApiNonBooleanSchemaObject = schemaInput;
  const functions: Fn[] = [];
  const type = resolveType(schema);
  const hasNullMember = [
    ...(Array.isArray(schema.oneOf) ? schema.oneOf : []),
    ...(Array.isArray(schema.anyOf) ? schema.anyOf : []),
  ].some((member) => isObject(member) && member.type === 'null');
  const nullable =
    isSchemaNullable(schema) && type !== 'null' && !hasNullMember;
  const hasDefault = schema.default !== undefined;
  const child = (member: OpenApiSchemaObject | undefined, isRequired = true) =>
    generateValibotValidationSchemaDefinition(member, context, strict, {
      required: isRequired,
    });

  const constValue = schema.const as unknown;
  const separators = (['allOf', 'oneOf', 'anyOf'] as const).filter(
    (key) => Array.isArray(schema[key]) && schema[key].length > 0,
  );
  const separator = separators.at(0);
  // `default` and `description` belong to the outer schema only.
  const { default: _default, description: _description, ...bare } = schema;

  if (
    constValue === null ||
    isString(constValue) ||
    typeof constValue === 'number' ||
    isBoolean(constValue)
  ) {
    functions.push(
      constValue === null
        ? ['null', undefined]
        : ['literal', toJsLiteral(constValue)],
    );
  } else if (separators.length > 1) {
    // Several composition keywords all apply, so they are intersected.
    functions.push([
      'allOf',
      separators.map((key, index) =>
        child(
          (index === 0
            ? Object.fromEntries(
                Object.entries(bare).filter(
                  ([name]) =>
                    name === key || !separators.includes(name as never),
                ),
              )
            : { [key]: schema[key] }) as OpenApiSchemaObject,
        ),
      ),
    ]);
  } else if (separator) {
    let members = (schema[separator] as OpenApiSchemaObject[]).map((member) =>
      child(member),
    );
    // An instance of an allOf satisfies every member, so a key required by the
    // parent or any member is required wherever it is declared.
    const keys = new Set(requiredKeysOf(schema));

    const hasOwnProperties =
      isObject(schema.properties) && Object.keys(schema.properties).length > 0;
    const ownProperties = hasOwnProperties
      ? requireFields(
          child({
            properties: schema.properties,
            required: schema.required,
            additionalProperties: schema.additionalProperties,
            type: 'object',
          } as OpenApiSchemaObject),
          keys,
        )
      : undefined;
    members = members.map((member) => requireFields(member, keys));

    const discriminator = (
      schema.discriminator as { propertyName?: unknown } | undefined
    )?.propertyName;
    const variant =
      separator !== 'allOf' && !ownProperties && isString(discriminator)
        ? toVariant(members, discriminator)
        : undefined;

    if (variant) {
      functions.push(...variant.functions);
    } else if (separator === 'allOf') {
      functions.push([
        'allOf',
        ownProperties ? [...members, ownProperties] : members,
      ]);
    } else if (ownProperties) {
      functions.push([
        'allOf',
        [{ functions: [[separator, members]] }, ownProperties],
      ]);
    } else {
      functions.push([separator, members]);
    }
  } else if (getMultiTypes(schema).length > 1) {
    functions.push([
      'oneOf',
      getMultiTypes(schema).map((t) =>
        child({ ...bare, type: t } as OpenApiSchemaObject),
      ),
    ]);
  } else if (schema.enum && type !== 'array' && type !== 'null') {
    // `getEnumMembers` dedupes and drops non-primitive members: the document is
    // untrusted and an array or object member must never reach the output.
    const values = getEnumMembers(schema)
      .map((member) => member.value)
      .filter((value) => value !== null);
    if (values.length === 0) {
      functions.push([nullable ? 'null' : 'never', undefined]);
    } else if (values.length === 1) {
      functions.push(['literal', toJsLiteral(values[0])]);
    } else if (
      values.every((value) => isString(value) || typeof value === 'number')
    ) {
      functions.push([
        'picklist',
        `[${values.map((value) => toJsLiteral(value)).join(', ')}]`,
      ]);
    } else {
      functions.push([
        'oneOf',
        values.map((value) => ({
          functions: [['literal', toJsLiteral(value)]] as Fn[],
        })),
      ]);
    }
  } else {
    switch (type) {
      case 'array': {
        if ('prefixItems' in schema) {
          warnOnce(
            '`prefixItems` is not supported yet, the tuple is validated as an array of unknown.',
          );
          functions.push(['array', child(undefined)]);
        } else {
          functions.push(['array', child(schema.items as OpenApiSchemaObject)]);
        }
        break;
      }
      case 'null': {
        functions.push(['null', undefined]);
        break;
      }
      case 'string': {
        if (
          schema.format === 'binary' ||
          (isOctetStreamContentType(schema.contentMediaType) &&
            !schema.contentEncoding)
        ) {
          functions.push(['file', undefined]);
          break;
        }
        functions.push(['string', undefined]);
        if (schema.format === 'date') functions.push(['isoDate', undefined]);
        if (schema.format === 'date-time') {
          functions.push(['isoTimestamp', undefined]);
        }
        const format =
          FORMATS.get(schema.format ?? '') ??
          (schema.contentEncoding === 'base64' ? 'base64' : undefined);
        if (format) functions.push([format, undefined]);
        break;
      }
      case 'number':
      case 'integer': {
        functions.push(['number', undefined]);
        if (type === 'integer') functions.push(['integer', undefined]);
        break;
      }
      case 'boolean': {
        functions.push(['boolean', undefined]);
        break;
      }
      case 'object': {
        functions.push(...generateObject(schema, child, strict));
        break;
      }
      default: {
        // Untyped schemas with `properties` are objects.
        functions.push(
          ...(isObject(schema.properties) &&
          Object.keys(schema.properties).length > 0
            ? generateObject(schema, child, strict)
            : ([['unknown', undefined]] as Fn[])),
        );
      }
    }
  }

  const base = functions[0]?.[0];
  const isDateString =
    base === 'string' && ['date', 'date-time'].includes(schema.format ?? '');

  if (base === 'number') {
    const constraints = [
      ['minValue', schema.minimum, 'minimum'],
      ['gtValue', schema.exclusiveMinimum, 'exclusiveMinimum'],
      ['maxValue', schema.maximum, 'maximum'],
      ['ltValue', schema.exclusiveMaximum, 'exclusiveMaximum'],
      ['multipleOf', schema.multipleOf, 'multipleOf'],
    ] as const;
    for (const [fn, value, label] of constraints) {
      if (fn === 'multipleOf' && !Number.isInteger(value)) {
        // `v.multipleOf` uses `%`, which rejects valid decimals such as 19.99.
        if (value !== undefined) {
          assertSafeNumericConstraint(value, label);
          warnOnce(`Skipping non-integer multipleOf ${value}.`);
        }
      } else if (value !== undefined) {
        functions.push([fn, `${assertSafeNumericConstraint(value, label)}`]);
      }
    }
  }
  if (base === 'string' || base === 'array') {
    const [min, max] =
      base === 'array'
        ? [schema.minItems, schema.maxItems]
        : [schema.minLength, schema.maxLength];
    // JSON Schema counts code points, `v.minLength` counts UTF-16 units.
    const [minFn, maxFn] =
      base === 'array'
        ? ['minLength', 'maxLength']
        : ['minCodePoints', 'maxCodePoints'];
    if (min !== undefined) {
      functions.push([
        // A minimum of 0 or 1 reads the same in code units and code points.
        base === 'string' && Number(min) <= 1 ? 'minLength' : minFn,
        `${assertSafeNumericConstraint(min, 'minLength/minItems')}`,
      ]);
    }
    if (max !== undefined) {
      functions.push([
        maxFn,
        `${assertSafeNumericConstraint(max, 'maxLength/maxItems')}`,
      ]);
    }
  }
  if (base === 'string' && isString(schema.pattern)) {
    // `\p{...}` only means a Unicode property with the `u` flag.
    const flags = /(^|[^\\])(?:\\\\)*\\[pPu]\{/.test(schema.pattern) ? 'u' : '';
    // A pattern JavaScript cannot compile (`(?i)`, `\A`, ...) would throw
    // when the generated module loads, so it is skipped instead.
    try {
      new RegExp(schema.pattern, flags);
      functions.push([
        'regex',
        `new RegExp('${jsStringLiteralEscape(schema.pattern)}'${flags ? `, '${flags}'` : ''})`,
      ]);
    } catch {
      warnOnce(
        `Skipping pattern that is not a JavaScript RegExp: ${schema.pattern}`,
      );
    }
  }
  // The transform runs after every check, which expect the string.
  if (isDateString && context.output.override.useDates) {
    functions.push(['toDate', undefined]);
  }

  if (nullable) functions.push(['nullable', undefined]);
  if (hasDefault) {
    functions.push(['default', toJsLiteral(schema.default)]);
  } else if (!required) {
    functions.push(['optional', undefined]);
  }

  if (isString(schema.description) && schema.description) {
    functions.push([
      'describe',
      `'${jsStringLiteralEscape(schema.description)}'`,
    ]);
  }

  return { functions };
};

const generateObject = (
  schema: OpenApiNonBooleanSchemaObject,
  child: (
    member: OpenApiSchemaObject | undefined,
    isRequired?: boolean,
  ) => Definition,
  strict: boolean,
): Fn[] => {
  const properties = isObject(schema.properties) ? schema.properties : {};
  const required = Array.isArray(schema.required) ? schema.required : [];
  const additional = schema.additionalProperties;
  const typedAdditional =
    isObject(additional) && Object.keys(additional).length > 0
      ? (additional as OpenApiSchemaObject)
      : undefined;
  const isOpen =
    additional === true ||
    (isObject(additional) && Object.keys(additional).length === 0);

  const entries: Entries = Object.keys(properties).map((key) => [
    key,
    child(properties[key] as OpenApiSchemaObject, required.includes(key)),
  ]);

  if (entries.length > 0) {
    if (typedAdditional) {
      return [['objectWithRest', { entries, rest: child(typedAdditional) }]];
    }
    return [
      [isOpen ? 'looseObject' : strict ? 'strictObject' : 'object', entries],
    ];
  }
  if (typedAdditional) return [['record', child(typedAdditional)]];
  return [['record', { functions: [['unknown', undefined]] }]];
};

// Actions that go into `v.pipe`, with the argument they take.
const ACTIONS = new Set([
  'integer',
  'isoDate',
  'isoTimestamp',
  'email',
  'url',
  'uuid',
  'ipv4',
  'ipv6',
  'base64',
  'minValue',
  'gtValue',
  'maxValue',
  'ltValue',
  'multipleOf',
  'minLength',
  'maxLength',
  'regex',
]);

const SIMPLE_CONSTRUCTORS = new Set([
  'never',
  'unknown',
  'string',
  'number',
  'boolean',
  'null',
]);

const CONSTRUCTORS = new Set([
  ...SIMPLE_CONSTRUCTORS,
  'file',
  'literal',
  'picklist',
  'array',
  'record',
  'object',
  'strictObject',
  'looseObject',
  'objectWithRest',
  'oneOf',
  'anyOf',
  'allOf',
  'variant',
]);

// `v.toDate()` needs valibot 1.2; a transform keeps every 1.x release working.
const TO_DATE = 'v.transform((value) => new Date(value))';

const renderKey = (key: string) =>
  key === '__proto__'
    ? "['__proto__']"
    : /^[A-Za-z_$][\w$]*$/.test(key)
      ? key
      : toJsLiteral(key);

export interface RenderOptions {
  exactOptional?: boolean;
}

export const renderValibot = (
  input: Definition,
  { exactOptional = false }: RenderOptions = {},
): string => {
  const renderEntries = (entries: Entries) =>
    `{\n${entries.map(([key, field]) => `  ${renderKey(key)}: ${render(field, false, true)}`).join(',\n')}\n}`;

  const renderConstructor = (
    fn: string,
    arg: unknown,
    inIntersection: boolean,
  ): string => {
    if (SIMPLE_CONSTRUCTORS.has(fn)) return `v.${fn}()`;
    switch (fn) {
      case 'file': {
        return 'v.file()';
      }
      case 'literal': {
        return `v.literal(${arg as string})`;
      }
      case 'picklist': {
        return `v.picklist(${arg as string})`;
      }
      case 'array': {
        return `v.array(${render(arg as Definition)})`;
      }
      case 'record': {
        return `v.record(v.string(), ${render(arg as Definition)})`;
      }
      case 'object':
      case 'strictObject':
      case 'looseObject': {
        // A strict member of an intersection would reject its siblings' keys.
        const name = fn === 'strictObject' && inIntersection ? 'object' : fn;
        return `v.${name}(${renderEntries(arg as Entries)})`;
      }
      case 'objectWithRest': {
        const { entries, rest } = arg as { entries: Entries; rest: Definition };
        return `v.objectWithRest(${renderEntries(entries)}, ${render(rest)})`;
      }
      case 'oneOf':
      case 'anyOf': {
        const members = arg as Definition[];
        return members.length === 1
          ? render(members[0], inIntersection)
          : `v.union([${members.map((member) => render(member, inIntersection)).join(', ')}])`;
      }
      case 'allOf': {
        const members = arg as Definition[];
        return members.length === 1
          ? render(members[0], inIntersection)
          : `v.intersect([${members.map((member) => render(member, true)).join(', ')}])`;
      }
      case 'variant': {
        const { key, options } = arg as { key: string; options: Definition[] };
        return `v.variant(${toJsLiteral(key)}, [${options.map((option) => render(option, inIntersection)).join(', ')}])`;
      }
      default: {
        return 'v.unknown()';
      }
    }
  };

  const render = (
    definition: Definition,
    inIntersection = false,
    inEntry = false,
  ): string => {
    const optionalFn =
      exactOptional && inEntry ? 'v.exactOptional' : 'v.optional';
    let schema: string | undefined;
    const actions: string[] = [];
    let optional = false;
    let nullable = false;
    let defaultValue: string | undefined;

    for (const [fn, arg] of definition.functions) {
      if (CONSTRUCTORS.has(fn)) {
        schema ??= renderConstructor(fn, arg, inIntersection);
      } else if (fn === 'optional') {
        optional = true;
      } else if (fn === 'nullable') {
        nullable = true;
      } else if (fn === 'default') {
        defaultValue = arg as string;
      } else if (fn === 'describe') {
        actions.push(`v.description(${arg as string})`);
      } else if (fn === 'minCodePoints' || fn === 'maxCodePoints') {
        const op = fn === 'minCodePoints' ? '>=' : '<=';
        actions.push(
          `v.check((value) => [...value].length ${op} ${arg as string}, 'Invalid length')`,
        );
      } else if (fn === 'toDate') {
        // A transformed member would not merge with its siblings.
        if (!inIntersection) actions.push(TO_DATE);
      } else if (ACTIONS.has(fn)) {
        actions.push(`v.${fn}(${(arg as string | undefined) ?? ''})`);
      }
    }

    let out = schema ?? 'v.unknown()';
    if (actions.length > 0) out = `v.pipe(${out}, ${actions.join(', ')})`;
    if (nullable) out = `v.nullable(${out})`;
    if (defaultValue !== undefined)
      return `${optionalFn}(${out}, ${defaultValue})`;
    return optional ? `${optionalFn}(${out})` : out;
  };

  return render(input);
};

const tryResolveRefSchema = (
  $ref: string,
  context: ContextSpec,
): OpenApiSchemaObject | undefined => {
  try {
    return resolveRef({ $ref } as OpenApiReferenceObject, context)
      .schema as OpenApiSchemaObject;
  } catch (error) {
    logger.verbose(
      `Failed to resolve $ref "${$ref}": ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return;
  }
};

const dereferenceValue = (value: unknown, context: ContextSpec): unknown => {
  if (isObject(value)) {
    return dereference(
      value as OpenApiSchemaObject | OpenApiReferenceObject,
      context,
    );
  }
  return Array.isArray(value)
    ? value.map((item) => dereferenceValue(item, context))
    : value;
};

/**
 * Inlines every `$ref`. A circular `$ref` becomes an empty schema, which is
 * validated as `unknown`.
 */
export const dereference = (
  schema: OpenApiSchemaObject | OpenApiReferenceObject,
  context: ContextSpec,
): OpenApiNonBooleanSchemaObject => {
  if (!isObject(schema)) {
    return typeof schema === 'boolean' ? toObjectSchema(schema) : {};
  }

  const refName = typeof schema.$ref === 'string' ? schema.$ref : undefined;
  if (refName && context.parents?.includes(refName)) {
    warnOnce(`Circular $ref "${refName}" is validated as unknown.`);
    return {};
  }

  const resolvedContext: ContextSpec = {
    ...context,
    ...(refName
      ? { parents: [...(context.parents ?? []), refName] }
      : undefined),
  };

  const resolved: OpenApiSchemaObject | undefined = refName
    ? (() => {
        const referenced = tryResolveRefSchema(refName, context);
        if (!referenced || typeof referenced !== 'object') {
          return referenced && toObjectSchema(referenced);
        }
        const siblings = Object.fromEntries(
          Object.entries(schema as Record<string, unknown>).filter(
            ([key]) => key !== '$ref',
          ),
        );
        return { ...referenced, ...siblings } as OpenApiSchemaObject;
      })()
    : schema;

  if (!resolved || typeof resolved !== 'object') return {};

  return Object.fromEntries(
    Object.entries(resolved).map(([key, value]) => {
      if (key === 'properties' && isObject(value)) {
        return [
          key,
          Object.fromEntries(
            Object.entries(value).map(([name, property]) => [
              name,
              dereferenceValue(property, resolvedContext),
            ]),
          ),
        ];
      }
      return [
        key,
        key === 'default' || key === 'example' || key === 'examples'
          ? value
          : dereferenceValue(value, resolvedContext),
      ];
    }),
  ) as OpenApiNonBooleanSchemaObject;
};

// `+json` vendor types and form bodies validate as plain objects.
const MEDIA_TYPES = [
  /^application\/([^/;]+\+)?json$/,
  /^application\/x-www-form-urlencoded$/,
  /^multipart\/form-data$/,
];

const parseBodyAndResponse = ({
  data,
  context,
  strict,
  generate,
}: {
  data:
    | OpenApiResponseObject
    | OpenApiRequestBodyObject
    | OpenApiReferenceObject
    | undefined;
  context: ContextSpec;
  strict: boolean;
  generate: boolean;
}): Definition => {
  if (!data || !generate) return { functions: [] };

  const { content } = resolveRef(data, context).schema as
    | OpenApiResponseObject
    | OpenApiRequestBodyObject;

  const entries = Object.entries(content ?? {});
  const schema = MEDIA_TYPES.map((pattern) =>
    entries.find(([contentType]) =>
      pattern.test(contentType.split(';')[0].trim().toLowerCase()),
    ),
  ).find(Boolean)?.[1].schema;
  if (!schema) return { functions: [] };

  return generateValibotValidationSchemaDefinition(
    dereference(schema, context),
    context,
    strict,
    { required: true },
  );
};

// The first success response, the way the zod package picks it.
const getSingleResponse = (
  responses:
    | Record<string, OpenApiResponseObject | OpenApiReferenceObject | undefined>
    | undefined,
) =>
  responses?.['200'] ??
  responses?.['2XX'] ??
  responses?.['2xx'] ??
  Object.entries(responses ?? {}).find(
    ([code]) => code.startsWith('2') && code !== '204' && code !== '205',
  )?.[1];

type Locations<T> = Record<
  'param' | 'query' | 'header' | 'body' | 'response',
  T
>;

export const parseParameters = ({
  data,
  context,
  strict,
  generate,
}: {
  data: (OpenApiParameterObject | OpenApiReferenceObject)[] | undefined;
  context: ContextSpec;
  strict: Locations<boolean>;
  generate: Locations<boolean>;
}): { headers: Definition; queryParams: Definition; params: Definition } => {
  const locations = {
    path: { location: 'param', target: 'params' },
    query: { location: 'query', target: 'queryParams' },
    header: { location: 'header', target: 'headers' },
  } as const;
  const defs = {
    params: new Map<string, Definition>(),
    queryParams: new Map<string, Definition>(),
    headers: new Map<string, Definition>(),
  };

  for (const item of data ?? []) {
    const { schema: parameter } = resolveRef(item, context) as {
      schema: OpenApiParameterObject;
    };
    // oxlint-disable-next-line typescript/no-unnecessary-condition
    if (!('schema' in parameter) || !parameter.in || !parameter.name) continue;
    if (!Object.hasOwn(locations, parameter.in)) continue;

    const { location, target } =
      locations[parameter.in as keyof typeof locations];
    if (!generate[location]) continue;

    const resolvedSchema = dereference(
      typeof parameter.schema === 'boolean'
        ? toObjectSchema(parameter.schema)
        : parameter.schema,
      context,
    );

    defs[target].set(
      parameter.name,
      generateValibotValidationSchemaDefinition(
        {
          ...resolvedSchema,
          description: parameter.description ?? resolvedSchema.description,
        },
        context,
        strict[location],
        { required: parameter.required },
      ),
    );
  }

  const toObject = (
    props: Map<string, Definition>,
    isStrict: boolean,
  ): Definition =>
    props.size === 0
      ? { functions: [] }
      : { functions: [[isStrict ? 'strictObject' : 'object', [...props]]] };

  return {
    headers: toObject(defs.headers, strict.header),
    queryParams: toObject(defs.queryParams, strict.query),
    params: toObject(defs.params, strict.param),
  };
};

const generateValibotRoute = (
  { typeName, verb, override }: GeneratorVerbOptions,
  { pathRoute, context }: GeneratorOptions,
) => {
  const spec = context.spec.paths?.[pathRoute];
  if (spec == undefined) {
    throw new Error(`No such path ${pathRoute} in ${context.projectName}`);
  }

  const operation = verb === 'query' ? undefined : spec[verb];
  const options = override.valibot;

  const parameters = parseParameters({
    data: [...(spec.parameters ?? []), ...(operation?.parameters ?? [])],
    context,
    strict: options.strict,
    generate: options.generate,
  });

  const body = parseBodyAndResponse({
    data: operation?.requestBody,
    context,
    strict: options.strict.body,
    generate: options.generate.body,
  });

  const response = parseBodyAndResponse({
    data: getSingleResponse(operation?.responses),
    context,
    strict: options.strict.response,
    generate: options.generate.response,
  });

  const name = pascal(typeName);
  const implementation = [
    [`${name}Params`, parameters.params],
    [`${name}QueryParams`, parameters.queryParams],
    [`${name}Header`, parameters.headers],
    [`${name}Body`, body],
    [`${name}Response`, response],
  ]
    .flatMap(([constName, definition]) =>
      (definition as Definition).functions.length > 0
        ? [
            `export const ${constName as string} = ${renderValibot(definition as Definition, { exactOptional: options.exactOptional })}`,
          ]
        : [],
    )
    .join('\n\n');

  return { implementation, mutators: [] };
};

export const generateValibot: ClientBuilder = (verbOptions, options) => {
  const { implementation, mutators } = generateValibotRoute(
    verbOptions,
    options,
  );

  return {
    implementation: implementation ? `${implementation}\n\n` : '',
    imports: [],
    mutators,
  };
};

const valibotClientBuilder: ClientGeneratorsBuilder = {
  client: generateValibot,
  dependencies: getValibotDependencies,
};

export const builder = () => () => valibotClientBuilder;

export default builder;
