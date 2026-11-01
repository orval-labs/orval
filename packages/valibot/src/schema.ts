import {
  type ContextSpec,
  getEnumMembers,
  isBoolean,
  isObject,
  isSchemaNullable,
  isString,
  jsStringLiteralEscape,
  type OpenApiNonBooleanSchemaObject,
  type OpenApiSchemaObject,
  toJsLiteral,
} from '@orval/core';

import { generateComposition } from './composition';
import {
  numberActions,
  patternActions,
  sizeActions,
  stringBase,
} from './constraints';
import { warnOnce } from './logger';
import {
  type BaseSchema,
  type ChildGenerator,
  plainBase,
  plainNode,
  type ValibotAction,
  type ValibotEntry,
  type ValibotNode,
  type ValibotSchema,
} from './nodes';
import {
  getMultiTypes,
  hasProperties,
  isNonBoolean,
  type ResolvedType,
  resolveType,
  toCanonicalNullable,
  withoutOuterAnnotations,
} from './schema-type';

export interface SchemaRules {
  required?: boolean;
  // Form bodies are serialized as strings, so a binary field stays a string.
  urlEncoded?: boolean;
}

// A required key without a property gets the additional properties type.
const undeclaredEntries = (
  keys: string[],
  additional: OpenApiNonBooleanSchemaObject | undefined,
  child: ChildGenerator,
): ValibotEntry[] => {
  if (keys.length === 0) return [];
  const { default: _default, ...withoutDefault } = additional ?? {};
  const value = child(additional ? withoutDefault : undefined);
  return keys.map((key) => ({ key, value }));
};

const generateObject = (
  schema: OpenApiNonBooleanSchemaObject,
  child: ChildGenerator,
  strict: boolean,
): ValibotSchema => {
  const properties = isObject(schema.properties) ? schema.properties : {};
  const required = Array.isArray(schema.required) ? schema.required : [];
  const additional = schema.additionalProperties;
  const typedAdditional =
    isNonBoolean(additional) && Object.keys(additional).length > 0
      ? additional
      : undefined;
  const isOpen =
    additional === true ||
    (isNonBoolean(additional) && Object.keys(additional).length === 0);

  const requiredKeys = new Set(required);
  const declared = Object.keys(properties).map((key): ValibotEntry => ({
    key,
    value: child(properties[key], requiredKeys.has(key)),
  }));
  const undeclared = undeclaredEntries(
    [...requiredKeys].filter(
      (key) => isString(key) && !Object.hasOwn(properties, key),
    ),
    typedAdditional,
    child,
  );
  const entries = [...declared, ...undeclared];

  if (entries.length > 0) {
    if (typedAdditional) {
      return { kind: 'objectWithRest', entries, rest: child(typedAdditional) };
    }
    const isDictionary = declared.length === 0 && additional !== false;
    return {
      kind: 'object',
      mode:
        isOpen || isDictionary
          ? 'looseObject'
          : strict
            ? 'strictObject'
            : 'object',
      entries,
    };
  }
  if (typedAdditional) {
    return { kind: 'record', value: child(typedAdditional) };
  }
  if (additional === false) {
    return {
      kind: 'object',
      mode: strict ? 'strictObject' : 'object',
      entries: [],
    };
  }
  return { kind: 'record', value: plainNode({ kind: 'unknown' }) };
};

const generateConst = (value: unknown): BaseSchema | undefined => {
  if (value === null) return plainBase({ kind: 'null' });
  return isString(value) || typeof value === 'number' || isBoolean(value)
    ? plainBase({ kind: 'literal', value: toJsLiteral(value) })
    : undefined;
};

const hasStructuredMember = (values: unknown): boolean =>
  Array.isArray(values) &&
  values.some((value) => isObject(value) || Array.isArray(value));

const generateEnum = (
  schema: OpenApiNonBooleanSchemaObject,
  nullable: boolean,
): BaseSchema => {
  // `getEnumMembers` dedupes and drops non-primitive members: the document
  // is untrusted and an array or object member must never reach the output.
  const values = getEnumMembers(schema)
    .map((member) => member.value)
    .filter((value) => value !== null);
  if (values.length === 0) {
    return plainBase({ kind: nullable ? 'null' : 'never' });
  }
  if (values.length === 1) {
    return plainBase({ kind: 'literal', value: toJsLiteral(values[0]) });
  }
  if (values.every((value) => isString(value) || typeof value === 'number')) {
    return plainBase({
      kind: 'picklist',
      values: values.map((value) => toJsLiteral(value)),
    });
  }
  return plainBase({
    kind: 'union',
    members: values.map((value) =>
      plainNode({ kind: 'literal', value: toJsLiteral(value) }),
    ),
  });
};

const generateArray = (
  schema: OpenApiNonBooleanSchemaObject,
  child: ChildGenerator,
): BaseSchema => {
  if ('prefixItems' in schema) {
    warnOnce(
      '`prefixItems` is not supported yet, the tuple is validated as an array of unknown.',
    );
    return plainBase({ kind: 'array', item: child(undefined) });
  }
  return plainBase({ kind: 'array', item: child(schema.items) });
};

const generateByType = (
  schema: OpenApiNonBooleanSchemaObject,
  type: ResolvedType,
  child: ChildGenerator,
  strict: boolean,
  urlEncoded: boolean,
): BaseSchema => {
  switch (type) {
    case 'array': {
      return generateArray(schema, child);
    }
    case 'null': {
      return plainBase({ kind: 'null' });
    }
    case 'string': {
      return stringBase(schema, urlEncoded);
    }
    case 'number':
    case 'integer': {
      return {
        schema: { kind: 'number' },
        actions: type === 'integer' ? [{ kind: 'integer' }] : [],
      };
    }
    case 'boolean': {
      return plainBase({ kind: 'boolean' });
    }
    case 'object': {
      return plainBase(generateObject(schema, child, strict));
    }
    default: {
      return plainBase(
        hasProperties(schema)
          ? generateObject(schema, child, strict)
          : { kind: 'unknown' },
      );
    }
  }
};

const generateBase = (
  schema: OpenApiNonBooleanSchemaObject,
  child: ChildGenerator,
  strict: boolean,
  nullable: boolean,
  urlEncoded: boolean,
): BaseSchema => {
  const constant = generateConst(schema.const);
  if (constant) return constant;
  if (schema.const !== undefined) {
    warnOnce(
      '`const` with an object or array value is not supported, it is not validated.',
    );
  }

  const composition = generateComposition(schema, child);
  if (composition) return composition;

  const type = resolveType(schema);
  const types = getMultiTypes(schema);
  if (types.length > 1) {
    const bare = withoutOuterAnnotations(schema);
    return plainBase({
      kind: 'union',
      members: types.map((t) => child({ ...bare, type: t })),
    });
  }

  if (hasStructuredMember(schema.enum)) {
    warnOnce('`enum` with object or array members is not validated.');
  } else if (schema.enum && type !== 'array' && type !== 'null') {
    return generateEnum(schema, nullable);
  }
  return generateByType(schema, type, child, strict, urlEncoded);
};

const generateActions = (
  schema: OpenApiNonBooleanSchemaObject,
  base: BaseSchema,
  context: ContextSpec,
): ValibotAction[] => {
  const { kind } = base.schema;
  const isDateString =
    kind === 'string' && ['date', 'date-time'].includes(schema.format ?? '');
  return [
    ...base.actions,
    ...(kind === 'number' ? numberActions(schema) : []),
    ...(kind === 'string' || kind === 'array' ? sizeActions(kind, schema) : []),
    ...(kind === 'string' && isString(schema.pattern)
      ? patternActions(schema.pattern)
      : []),
    // The transform runs after every check, which expect the string.
    ...(isDateString && context.output.override.useDates
      ? [{ kind: 'toDate' } as const]
      : []),
    ...(isString(schema.description) && schema.description
      ? [
          {
            kind: 'describe',
            text: `'${jsStringLiteralEscape(schema.description)}'`,
          } as const,
        ]
      : []),
  ];
};

const isNullable = (schema: OpenApiNonBooleanSchemaObject): boolean => {
  const hasNullMember = [
    ...(Array.isArray(schema.oneOf) ? schema.oneOf : []),
    ...(Array.isArray(schema.anyOf) ? schema.anyOf : []),
  ].some((member) => isNonBoolean(member) && member.type === 'null');
  return (
    isSchemaNullable(schema) && resolveType(schema) !== 'null' && !hasNullMember
  );
};

// `v.null()` and a union holding it already accept null.
const acceptsNull = (schema: ValibotSchema): boolean =>
  schema.kind === 'null' ||
  (schema.kind === 'union' &&
    schema.members.some((member) => member.schema.kind === 'null'));

// `false` is `{ not: {} }`, which nothing satisfies.
const isNever = (schema: OpenApiSchemaObject | undefined): boolean =>
  schema === false ||
  (isNonBoolean(schema) &&
    isObject(schema.not) &&
    Object.keys(schema.not).length === 0);

const JSON_NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

// The only type, besides `null`, when it is a number.
const numberType = (
  schema: OpenApiNonBooleanSchemaObject,
): 'number' | 'integer' | undefined => {
  const types = Array.isArray(schema.type)
    ? getMultiTypes(schema)
    : [schema.type];
  const [type] = types;
  return types.length === 1 && (type === 'number' || type === 'integer')
    ? type
    : undefined;
};

// .NET writes a `double` default as a string such as `"NaN"`. A default the
// number schema rejects is left out, or every value without the key fails.
const generateDefault = (
  schema: OpenApiNonBooleanSchemaObject,
): string | undefined => {
  const value = schema.default;
  const type = numberType(schema);
  const isPlainNumber =
    type !== undefined &&
    schema.enum === undefined &&
    schema.const === undefined;
  if (!isPlainNumber || !(isString(value) || typeof value === 'number')) {
    return toJsLiteral(value);
  }
  const parsed =
    isString(value) && !JSON_NUMBER.test(value.trim())
      ? Number.NaN
      : Number(value);
  const fits =
    Number.isFinite(parsed) && (type === 'number' || Number.isInteger(parsed));
  if (fits) return String(parsed);
  warnOnce(
    `The default "${String(value)}" does not fit a ${type}, it is left out.`,
  );
  return undefined;
};

export const generateValibotValidationSchemaDefinition = (
  schemaInput: OpenApiSchemaObject | undefined,
  context: ContextSpec,
  strict: boolean,
  rules?: SchemaRules,
): ValibotNode => {
  const required = rules?.required ?? false;
  const urlEncoded = rules?.urlEncoded ?? false;

  const never = isNever(schemaInput);
  if (!isNonBoolean(schemaInput) || never) {
    return {
      ...plainNode({ kind: never ? 'never' : 'unknown' }),
      optional: !required,
    };
  }

  const schema = toCanonicalNullable(schemaInput);
  const nullable = isNullable(schema);
  const defaultValue =
    schema.default === undefined ? undefined : generateDefault(schema);
  const hasDefault = defaultValue !== undefined;
  const child: ChildGenerator = (member, isRequired = true) =>
    generateValibotValidationSchemaDefinition(member, context, strict, {
      required: isRequired,
      urlEncoded,
    });

  const base = generateBase(schema, child, strict, nullable, urlEncoded);

  return {
    schema: base.schema,
    actions: generateActions(schema, base, context),
    nullable: nullable && !acceptsNull(base.schema),
    optional: !hasDefault && !required,
    defaultValue,
  };
};
