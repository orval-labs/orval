import {
  type ContextSpec,
  getFormatTypeConfig,
  isObject,
  type OpenApiNonBooleanSchemaObject,
  type OpenApiReferenceObject,
  type OpenApiSchemaObject,
  unsupportedError,
} from '@orval/core';

/** The place of a schema: where it is used, then the chain down to it. */
export const joinPath = (path: string, segment: string): string =>
  `${path} > ${segment}`;

export const isUnsupportedError = (context: ContextSpec): boolean =>
  // oxlint-disable-next-line typescript/no-unnecessary-condition
  context.output?.override?.zod?.unsupported === 'error';

/** The context with `unsupported` back to its default, which reports nothing. */
export const withoutUnsupportedError = (context: ContextSpec): ContextSpec =>
  isUnsupportedError(context)
    ? {
        ...context,
        output: {
          ...context.output,
          override: {
            ...context.output.override,
            zod: { ...context.output.override.zod, unsupported: 'warn' },
          },
        },
      }
    : context;

/**
 * Fails in `unsupported: 'error'` mode. The default mode generates the schema
 * as before and says nothing, as it did not warn about these cases.
 */
export const reportUnsupported = (
  context: ContextSpec,
  message: string,
  path: string,
  hint?: string,
): void => {
  if (isUnsupportedError(context)) {
    throw unsupportedError('zod', message, path, hint);
  }
};

// Keywords that constrain a value but have no zod counterpart here.
// `dependentRequired` is handled apart, as it is only rendered on objects with
// properties.
const IGNORED_KEYWORDS = [
  'not',
  'if',
  'then',
  'else',
  'patternProperties',
  'propertyNames',
  'dependentSchemas',
  'dependencies',
  'unevaluatedProperties',
  'unevaluatedItems',
  'contains',
  'minContains',
  'maxContains',
  'uniqueItems',
  'minProperties',
  'maxProperties',
  'additionalItems',
  'contentSchema',
] as const;

// Keywords that apply to a single type and need that type to be rendered.
const TYPED_CONSTRAINTS = [
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minLength',
  'maxLength',
  'pattern',
  'minItems',
  'maxItems',
  'items',
  'prefixItems',
] as const;

const COMPOSITION_KEYS = ['allOf', 'oneOf', 'anyOf'] as const;

const isEmptyObject = (value: unknown): boolean =>
  isObject(value) && Object.keys(value).length === 0;

// Values that constrain nothing: `false`, `0`, `true` where it allows all, and
// an empty schema map. An empty `not` is rendered as `never`, and `not: false`
// rejects nothing.
const isNoOp = (key: string, value: unknown): boolean =>
  (key === 'uniqueItems' && value === false) ||
  (key === 'not' && value === false) ||
  ((key === 'minProperties' || key === 'minContains') && value === 0) ||
  ((key === 'unevaluatedProperties' ||
    key === 'unevaluatedItems' ||
    key === 'additionalItems' ||
    key === 'propertyNames') &&
    (value === true || isEmptyObject(value))) ||
  ((key === 'patternProperties' ||
    key === 'dependentSchemas' ||
    key === 'dependencies' ||
    key === 'not') &&
    isEmptyObject(value));

const hasDefinedProperties = (schema: OpenApiNonBooleanSchemaObject): boolean =>
  isObject(schema.properties) && Object.keys(schema.properties).length > 0;

/** Reports each keyword that the schema sets and zod does not validate. */
export const reportIgnoredKeywords = (
  schema: OpenApiNonBooleanSchemaObject,
  context: ContextSpec,
  path: string,
): void => {
  if (!isUnsupportedError(context)) return;
  const record: Record<string, unknown> = schema;
  for (const key of IGNORED_KEYWORDS) {
    if (record[key] === undefined || isNoOp(key, record[key])) continue;
    // `if` constrains only through `then` or `else`, and those only with `if`.
    if (
      key === 'if' &&
      record.then === undefined &&
      record.else === undefined
    ) {
      continue;
    }
    if ((key === 'then' || key === 'else') && record.if === undefined) continue;
    reportUnsupported(context, `\`${key}\` is not validated.`, path);
  }
  // The refinement is only built for an object that declares properties and
  // is not composed.
  const isComposedBy = (key: (typeof COMPOSITION_KEYS)[number]): boolean => {
    const members: unknown = schema[key];
    return Array.isArray(members) && members.length > 0;
  };
  const composed = COMPOSITION_KEYS.some(isComposedBy);
  if (
    isObject(record.dependentRequired) &&
    Object.keys(record.dependentRequired).length > 0 &&
    (!hasDefinedProperties(schema) || composed)
  ) {
    reportUnsupported(context, '`dependentRequired` is not validated.', path);
  }
  // Only the first composition keyword of a schema is rendered.
  const [first, ...dropped] = COMPOSITION_KEYS.filter(isComposedBy);
  for (const key of dropped) {
    reportUnsupported(
      context,
      `\`${key}\` next to \`${first}\` is not validated.`,
      path,
    );
  }
  // A draft-07 tuple renders as an array of unknown.
  if (Array.isArray(record.items)) {
    reportUnsupported(context, '`items` as a list is not validated.', path);
  }
  // A `const` object or array renders as the plain type.
  if (isObject(schema.const) || Array.isArray(schema.const)) {
    reportUnsupported(
      context,
      'An object or array `const` is not validated.',
      path,
    );
  }
};

/** Reports constraints that need a `type` the schema does not render. */
export const reportUncheckedConstraints = (
  schema: OpenApiNonBooleanSchemaObject,
  context: ContextSpec,
  path: string,
): void => {
  if (!isUnsupportedError(context)) return;
  const record: Record<string, unknown> = schema;
  // An enum or a const already limits the values.
  if (schema.enum !== undefined || 'const' in schema) return;
  const keys = TYPED_CONSTRAINTS.filter((key) => record[key] !== undefined);
  if (keys.length > 0) {
    reportUnsupported(
      context,
      `${keys.map((key) => `\`${key}\``).join(', ')} without a \`type\` is not validated.`,
      path,
    );
  }
};

// Formats checked only by the number type they sit on.
const NUMERIC_FORMATS = new Set(['int32', 'int64', 'float', 'double']);

const hasType = (type: unknown, names: readonly string[]): boolean => {
  const types: unknown[] = Array.isArray(type) ? type : [type];
  return types.some((item) => typeof item === 'string' && names.includes(item));
};

/**
 * Reports a `format` the schema does not check. A format mapped by
 * `formatType`, or next to an `enum` or `const`, is left to them.
 */
export const reportUncheckedFormat = (
  schema: OpenApiNonBooleanSchemaObject,
  context: ContextSpec,
  path: string,
  stringFormats: ReadonlySet<string>,
): void => {
  if (!isUnsupportedError(context)) return;
  const { format } = schema;
  // A composition renders its members, not the string checks of its parent.
  const composed = COMPOSITION_KEYS.some((key) => {
    const members: unknown = schema[key];
    return Array.isArray(members) && members.length > 0;
  });
  if (
    typeof format !== 'string' ||
    // String formats are checked only on a string, and a binary string
    // renders as a file.
    ((stringFormats.has(format) || format === 'binary') &&
      hasType(schema.type, ['string']) &&
      !composed) ||
    (NUMERIC_FORMATS.has(format) &&
      hasType(schema.type, ['integer', 'number'])) ||
    getFormatTypeConfig(format, context.output.override) !== undefined ||
    schema.enum !== undefined ||
    'const' in schema
  ) {
    return;
  }
  reportUnsupported(context, `\`format: ${format}\` is not validated.`, path);
};

/** Reports a `contentEncoding`, which zod renders as a plain string. */
export const reportUncheckedEncoding = (
  schema: OpenApiNonBooleanSchemaObject,
  context: ContextSpec,
  path: string,
): void => {
  const encoding: unknown = schema.contentEncoding;
  if (typeof encoding !== 'string' || schema.enum !== undefined) return;
  if ('const' in schema) return;
  reportUnsupported(
    context,
    `\`contentEncoding: ${encoding}\` is not validated.`,
    path,
  );
};

// The values an alternative can take, as far as plain types and literals tell.
type Domain = { type: string } | { literal: unknown };

const DISTINCT_TYPES = new Set([
  'string',
  'number',
  'integer',
  'boolean',
  'object',
  'array',
]);

const domainsOf = (
  schema: OpenApiNonBooleanSchemaObject | undefined,
): Domain[] | undefined => {
  if (!schema) return undefined;
  if (acceptsNothing(schema)) return [];
  if (schema.allOf || schema.oneOf || schema.anyOf) return undefined;
  // A nullable literal list renders with `.nullable()`, so it takes null too.
  const withNull = (domains: Domain[]): Domain[] =>
    acceptsNull(schema) ? [...domains, { type: 'null' }] : domains;
  if ('const' in schema) return withNull([{ literal: schema.const }]);
  if (Array.isArray(schema.enum)) {
    return withNull(schema.enum.map((literal: unknown) => ({ literal })));
  }
  const types = (
    Array.isArray(schema.type) ? schema.type : [schema.type]
  ).filter((type) => type !== 'null');
  if (types.length === 0) return undefined;
  const known = types.every(
    (type) => type !== undefined && DISTINCT_TYPES.has(type),
  );
  if (!known) return undefined;
  const domains = types.map((type): Domain => ({ type: String(type) }));
  return acceptsNull(schema) ? [...domains, { type: 'null' }] : domains;
};

// `false`, or `not` of a schema that accepts everything: no value matches.
// Matches the empty-object test the generator renders as `never`.
const acceptsNothing = (schema: OpenApiNonBooleanSchemaObject): boolean =>
  isObject(schema.not) && Object.keys(schema.not).length === 0;

const isNullOnly = (schema: OpenApiNonBooleanSchemaObject): boolean =>
  !acceptsNothing(schema) &&
  (schema.type === 'null' ||
    (Array.isArray(schema.type) &&
      schema.type.length > 0 &&
      schema.type.every((type) => type === 'null')));

const acceptsNull = (schema: OpenApiNonBooleanSchemaObject): boolean =>
  !acceptsNothing(schema) &&
  ((Array.isArray(schema.type) && schema.type.includes('null')) ||
    (schema as { nullable?: unknown }).nullable === true ||
    ('const' in schema && schema.const === null) ||
    (Array.isArray(schema.enum) && schema.enum.includes(null)));

const jsonTypeOf = (value: unknown): string =>
  Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;

const isOfType = (value: unknown, type: string): boolean => {
  const actual = jsonTypeOf(value);
  return type === 'integer'
    ? Number.isInteger(value)
    : type === 'number'
      ? actual === 'number'
      : actual === type;
};

const overlaps = (a: Domain, b: Domain): boolean => {
  if ('literal' in a && 'literal' in b) {
    return JSON.stringify(a.literal) === JSON.stringify(b.literal);
  }
  if ('literal' in a) return isOfType(a.literal, (b as { type: string }).type);
  if ('literal' in b) return isOfType(b.literal, a.type);
  const numeric = new Set(['number', 'integer']);
  return a.type === b.type || (numeric.has(a.type) && numeric.has(b.type));
};

/**
 * Whether no value can match two of the alternatives, so a union reads as
 * `oneOf`. Without a discriminator, only plain types and literals can be
 * told apart. A null-only alternative overlaps only one that accepts null.
 */
export const areExclusive = (
  members: (OpenApiNonBooleanSchemaObject | undefined)[],
): boolean => {
  const present = members.filter((member) => !(member && isNullOnly(member)));
  const nulls = members.length - present.length;
  // A `null` alternative also matches one that is nullable or of unknown type.
  if (
    nulls > 1 ||
    (nulls === 1 &&
      present.some(
        (member) =>
          !member || acceptsNull(member) || domainsOf(member) === undefined,
      ))
  ) {
    return false;
  }
  if (present.length <= 1) return true;
  const domains = present.map(domainsOf);
  return domains.every(
    (list, index) =>
      list !== undefined &&
      domains
        .slice(index + 1)
        .every(
          (other) =>
            other !== undefined &&
            !list.some((a) => other.some((b) => overlaps(a, b))),
        ),
  );
};

type ResolveMember = (
  schema: OpenApiSchemaObject | OpenApiReferenceObject,
) => OpenApiNonBooleanSchemaObject | undefined;

const literalsOf = (
  schema: OpenApiNonBooleanSchemaObject | undefined,
): string[] | undefined => {
  if (!schema) return undefined;
  if ('const' in schema) return [JSON.stringify(schema.const)];
  return Array.isArray(schema.enum)
    ? schema.enum.map((value: unknown) => JSON.stringify(value))
    : undefined;
};

// The values a member allows for the discriminator: those its own property
// and every `allOf` member that declares the property allow.
const discriminatorValues = (
  member: OpenApiNonBooleanSchemaObject | undefined,
  name: string,
  resolve: ResolveMember,
): string[] | undefined => {
  if (!member) return undefined;
  const lists = [member, ...(member.allOf ?? []).map(resolve)]
    .map((source) => {
      const property = source?.properties?.[name];
      return property === undefined ? undefined : literalsOf(resolve(property));
    })
    .filter((list): list is string[] => list !== undefined);
  if (lists.length === 0) return undefined;
  const [first, ...rest] = lists;
  return first.filter((value) =>
    rest.every((values) => values.includes(value)),
  );
};

/**
 * Whether the alternatives of a `oneOf` with a discriminator allow distinct
 * values for it, so no value matches two of them.
 */
export const haveDistinctDiscriminators = (
  members: (OpenApiSchemaObject | OpenApiReferenceObject)[],
  name: string,
  resolve: ResolveMember,
): boolean => {
  const resolved = members.map(resolve);
  // Discriminator values do not tell apart a `null` that two members accept.
  const nullable = resolved.filter(
    (member) => member && (isNullOnly(member) || acceptsNull(member)),
  );
  if (nullable.length > 1) return false;
  // A lone null-only member never matches an object, so only the others need
  // distinct values.
  const values = resolved
    .filter((member) => !(member && isNullOnly(member)))
    .map((member) => discriminatorValues(member, name, resolve));
  return values.every(
    (list, index) =>
      list !== undefined &&
      list.length > 0 &&
      values
        .slice(index + 1)
        .every(
          (other) =>
            other !== undefined && !list.some((value) => other.includes(value)),
        ),
  );
};
