import {
  assertSafeNumericConstraint,
  type ContextSpec,
  getEnumMembers,
  getRequiredKeys,
  isBoolean,
  isObject,
  isOctetStreamContentType,
  isSchemaNullable,
  isString,
  jsStringLiteralEscape,
  type OpenApiNonBooleanSchemaObject,
  type OpenApiSchemaObject,
  toJsLiteral,
} from '@orval/core';

import { warnOnce } from './logger';

/**
 * Typed intermediate tree: `generateValibotValidationSchemaDefinition` builds
 * it from a schema and `renderValibot` turns it into source. Only kinds the
 * renderer knows are emitted, so nothing taken from the document can pick a
 * `v.*` function.
 */

type ObjectMode = 'object' | 'strictObject' | 'looseObject';

// Object entries are a list, not a record, so a key such as `__proto__` or
// `constructor` is just data.
export interface ValibotEntry {
  key: string;
  value: ValibotNode;
}

export interface ObjectSchema {
  kind: 'object';
  mode: ObjectMode;
  entries: ValibotEntry[];
}

interface ObjectWithRestSchema {
  kind: 'objectWithRest';
  entries: ValibotEntry[];
  rest: ValibotNode;
}

interface VariantSchema {
  kind: 'variant';
  key: string;
  options: ValibotNode[];
}

export type ValibotSchema =
  | {
      kind:
        | 'never'
        | 'unknown'
        | 'string'
        | 'number'
        | 'boolean'
        | 'null'
        | 'file';
    }
  // `value` and `values` are JavaScript source of the literals.
  | { kind: 'literal'; value: string }
  | { kind: 'picklist'; values: string[] }
  | { kind: 'array'; item: ValibotNode }
  | { kind: 'record'; value: ValibotNode }
  | ObjectSchema
  | ObjectWithRestSchema
  | { kind: 'union' | 'intersect'; members: ValibotNode[] }
  | VariantSchema;

type FlagActionKind =
  | 'integer'
  | 'isoDate'
  | 'isoTimestamp'
  | 'email'
  | 'url'
  | 'uuid'
  | 'ipv4'
  | 'ipv6'
  | 'base64';

type ValueActionKind =
  | 'minValue'
  | 'gtValue'
  | 'maxValue'
  | 'ltValue'
  | 'multipleOf'
  | 'minLength'
  | 'maxLength'
  | 'minCodePoints'
  | 'maxCodePoints';

// Actions that go into `v.pipe`.
export type ValibotAction =
  | { kind: FlagActionKind }
  | { kind: ValueActionKind; value: string }
  | { kind: 'regex'; pattern: string }
  | { kind: 'describe'; text: string }
  | { kind: 'toDate' };

export interface ValibotNode {
  schema: ValibotSchema;
  actions: ValibotAction[];
  nullable: boolean;
  optional: boolean;
  defaultValue?: string;
}

const plainNode = (schema: ValibotSchema): ValibotNode => ({
  schema,
  actions: [],
  nullable: false,
  optional: false,
});

type SchemaType =
  | 'integer'
  | 'number'
  | 'string'
  | 'boolean'
  | 'object'
  | 'null'
  | 'array';

const SCHEMA_TYPES: ReadonlySet<unknown> = new Set<SchemaType>([
  'integer',
  'number',
  'string',
  'boolean',
  'object',
  'null',
  'array',
]);

const isSchemaType = (value: unknown): value is SchemaType =>
  SCHEMA_TYPES.has(value);

const isNonBoolean = (
  schema: OpenApiSchemaObject | undefined,
): schema is OpenApiNonBooleanSchemaObject => isObject(schema);

// Types of a multi-type schema other than `null`, which is the nullable flag.
const getMultiTypes = (
  schema: OpenApiNonBooleanSchemaObject,
): Exclude<SchemaType, 'null'>[] =>
  Array.isArray(schema.type)
    ? schema.type.filter(
        (t): t is Exclude<SchemaType, 'null'> =>
          t !== 'null' && isSchemaType(t),
      )
    : [];

const resolveType = (
  schema: OpenApiNonBooleanSchemaObject,
): SchemaType | 'unknown' => {
  const { type } = schema;
  if (Array.isArray(type)) {
    const types = getMultiTypes(schema);
    if (types.length > 0) return types[0];
    return type.includes('null') ? 'null' : 'unknown';
  }
  return isSchemaType(type) ? type : 'unknown';
};

const FORMATS = new Map<string, FlagActionKind>([
  ['email', 'email'],
  ['uri', 'url'],
  ['uuid', 'uuid'],
  ['ipv4', 'ipv4'],
  ['ipv6', 'ipv6'],
  ['byte', 'base64'],
]);

// Marks the given keys as required in every object reachable through the
// composition constructors.
const requireFields = (
  node: ValibotNode,
  keys: ReadonlySet<string>,
): ValibotNode => {
  if (keys.size === 0) return node;
  const requireEntries = (entries: ValibotEntry[]): ValibotEntry[] =>
    entries.map(({ key, value }) => ({
      key,
      value: keys.has(key) ? { ...value, optional: false } : value,
    }));
  const requireMembers = (members: ValibotNode[]) =>
    members.map((member) => requireFields(member, keys));

  const { schema } = node;
  switch (schema.kind) {
    case 'object':
    case 'objectWithRest': {
      return {
        ...node,
        schema: { ...schema, entries: requireEntries(schema.entries) },
      };
    }
    case 'union':
    case 'intersect': {
      return {
        ...node,
        schema: { ...schema, members: requireMembers(schema.members) },
      };
    }
    case 'variant': {
      return {
        ...node,
        schema: { ...schema, options: requireMembers(schema.options) },
      };
    }
    default: {
      return node;
    }
  }
};

// Keys required by the schema and, through nested `allOf`, by its members.
const requiredKeysOf = (schema: OpenApiNonBooleanSchemaObject): string[] => [
  ...getRequiredKeys(schema, 'schema').filter(isString),
  ...(Array.isArray(schema.allOf) ? schema.allOf : []).flatMap((member) =>
    isNonBoolean(member) ? requiredKeysOf(member) : [],
  ),
];

// A node that is only its constructor: no checks, wrappers or default.
const isBareNode = (node: ValibotNode): boolean =>
  node.actions.length === 0 &&
  !node.nullable &&
  !node.optional &&
  node.defaultValue === undefined;

// `v.variant` needs every option to be a bare object whose discriminator is a
// literal or a picklist.
const toVariant = (
  members: ValibotNode[],
  key: string,
): ValibotNode | undefined => {
  const isVariantOption = ({ schema, ...rest }: ValibotNode) => {
    if (schema.kind !== 'object' || !isBareNode({ schema, ...rest })) {
      return false;
    }
    const entry = schema.entries.find((item) => item.key === key)?.value;
    return (
      entry !== undefined &&
      isBareNode(entry) &&
      (entry.schema.kind === 'literal' || entry.schema.kind === 'picklist')
    );
  };
  return members.every(isVariantOption)
    ? plainNode({ kind: 'variant', key, options: members })
    : undefined;
};

export interface SchemaRules {
  required?: boolean;
}

type ChildGenerator = (
  member: OpenApiSchemaObject | undefined,
  isRequired?: boolean,
) => ValibotNode;

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

  const entries = Object.keys(properties).map((key): ValibotEntry => ({
    key,
    value: child(properties[key], required.includes(key)),
  }));

  if (entries.length > 0) {
    if (typedAdditional) {
      return { kind: 'objectWithRest', entries, rest: child(typedAdditional) };
    }
    return {
      kind: 'object',
      mode: isOpen ? 'looseObject' : strict ? 'strictObject' : 'object',
      entries,
    };
  }
  if (typedAdditional) {
    return { kind: 'record', value: child(typedAdditional) };
  }
  return { kind: 'record', value: plainNode({ kind: 'unknown' }) };
};

const numberActions = (
  schema: OpenApiNonBooleanSchemaObject,
): ValibotAction[] => {
  const constraints = [
    ['minValue', schema.minimum, 'minimum'],
    ['gtValue', schema.exclusiveMinimum, 'exclusiveMinimum'],
    ['maxValue', schema.maximum, 'maximum'],
    ['ltValue', schema.exclusiveMaximum, 'exclusiveMaximum'],
    ['multipleOf', schema.multipleOf, 'multipleOf'],
  ] as const;
  return constraints.flatMap(([kind, value, label]): ValibotAction[] => {
    if (kind === 'multipleOf' && !Number.isInteger(value)) {
      // `v.multipleOf` uses `%`, which rejects valid decimals such as 19.99.
      if (value !== undefined) {
        assertSafeNumericConstraint(value, label);
        warnOnce(`Skipping non-integer multipleOf ${value}.`);
      }
      return [];
    }
    return value === undefined
      ? []
      : [{ kind, value: `${assertSafeNumericConstraint(value, label)}` }];
  });
};

const sizeActions = (
  kind: 'string' | 'array',
  schema: OpenApiNonBooleanSchemaObject,
): ValibotAction[] => {
  const [min, max] =
    kind === 'array'
      ? [schema.minItems, schema.maxItems]
      : [schema.minLength, schema.maxLength];
  // JSON Schema counts code points, `v.minLength` counts UTF-16 units.
  const [minKind, maxKind] =
    kind === 'array'
      ? (['minLength', 'maxLength'] as const)
      : (['minCodePoints', 'maxCodePoints'] as const);
  const actions: ValibotAction[] = [];
  if (min !== undefined) {
    actions.push({
      // A minimum of 0 or 1 reads the same in code units and code points.
      kind: kind === 'string' && Number(min) <= 1 ? 'minLength' : minKind,
      value: `${assertSafeNumericConstraint(min, 'minLength/minItems')}`,
    });
  }
  if (max !== undefined) {
    actions.push({
      kind: maxKind,
      value: `${assertSafeNumericConstraint(max, 'maxLength/maxItems')}`,
    });
  }
  return actions;
};

const patternActions = (pattern: string): ValibotAction[] => {
  // `\p{...}` only means a Unicode property with the `u` flag.
  const flags = /(^|[^\\])(?:\\\\)*\\[pPu]\{/.test(pattern) ? 'u' : '';
  // A pattern JavaScript cannot compile (`(?i)`, `\A`, ...) would throw
  // when the generated module loads, so it is skipped instead.
  try {
    new RegExp(pattern, flags);
    return [
      {
        kind: 'regex',
        pattern: `new RegExp('${jsStringLiteralEscape(pattern)}'${flags ? `, '${flags}'` : ''})`,
      },
    ];
  } catch {
    warnOnce(`Skipping pattern that is not a JavaScript RegExp: ${pattern}`);
    return [];
  }
};

interface BaseSchema {
  schema: ValibotSchema;
  actions: ValibotAction[];
}

const stringBase = (schema: OpenApiNonBooleanSchemaObject): BaseSchema => {
  if (
    schema.format === 'binary' ||
    (isOctetStreamContentType(schema.contentMediaType) &&
      !schema.contentEncoding)
  ) {
    return { schema: { kind: 'file' }, actions: [] };
  }
  const actions: ValibotAction[] = [];
  if (schema.format === 'date') actions.push({ kind: 'isoDate' });
  if (schema.format === 'date-time') actions.push({ kind: 'isoTimestamp' });
  const format =
    FORMATS.get(schema.format ?? '') ??
    (schema.contentEncoding === 'base64' ? 'base64' : undefined);
  if (format) actions.push({ kind: format });
  return { schema: { kind: 'string' }, actions };
};

export const generateValibotValidationSchemaDefinition = (
  schemaInput: OpenApiSchemaObject | undefined,
  context: ContextSpec,
  strict: boolean,
  rules?: SchemaRules,
): ValibotNode => {
  const required = rules?.required ?? false;

  if (!isNonBoolean(schemaInput)) {
    return {
      ...plainNode({ kind: schemaInput === false ? 'never' : 'unknown' }),
      optional: !required,
    };
  }

  const schema = schemaInput;
  const type = resolveType(schema);
  const hasNullMember = [
    ...(Array.isArray(schema.oneOf) ? schema.oneOf : []),
    ...(Array.isArray(schema.anyOf) ? schema.anyOf : []),
  ].some((member) => isNonBoolean(member) && member.type === 'null');
  const nullable =
    isSchemaNullable(schema) && type !== 'null' && !hasNullMember;
  const hasDefault = schema.default !== undefined;
  const child: ChildGenerator = (member, isRequired = true) =>
    generateValibotValidationSchemaDefinition(member, context, strict, {
      required: isRequired,
    });

  const constValue = schema.const;
  const separators = (['allOf', 'oneOf', 'anyOf'] as const).filter(
    (key) => Array.isArray(schema[key]) && schema[key].length > 0,
  );
  const separator = separators.at(0);
  // `default` and `description` belong to the outer schema only.
  const { default: _default, description: _description, ...bare } = schema;
  const {
    allOf: _allOf,
    oneOf: _oneOf,
    anyOf: _anyOf,
    ...withoutMembers
  } = bare;
  const onlyComposition = (
    key: 'allOf' | 'oneOf' | 'anyOf',
    rest: OpenApiNonBooleanSchemaObject,
  ): OpenApiNonBooleanSchemaObject =>
    key === 'allOf'
      ? { ...rest, allOf: schema.allOf }
      : key === 'oneOf'
        ? { ...rest, oneOf: schema.oneOf }
        : { ...rest, anyOf: schema.anyOf };

  const generateBase = (): BaseSchema => {
    if (
      constValue === null ||
      isString(constValue) ||
      typeof constValue === 'number' ||
      isBoolean(constValue)
    ) {
      return {
        schema:
          constValue === null
            ? { kind: 'null' }
            : { kind: 'literal', value: toJsLiteral(constValue) },
        actions: [],
      };
    }

    if (separators.length > 1) {
      // Several composition keywords all apply, so they are intersected.
      return {
        schema: {
          kind: 'intersect',
          members: separators.map((key, index) =>
            child(onlyComposition(key, index === 0 ? withoutMembers : {})),
          ),
        },
        actions: [],
      };
    }

    if (separator) {
      let members = (schema[separator] ?? []).map((member) => child(member));
      // An instance of an allOf satisfies every member, so a key required by
      // the parent or any member is required wherever it is declared.
      const keys = new Set(requiredKeysOf(schema));

      const hasOwnProperties =
        isObject(schema.properties) &&
        Object.keys(schema.properties).length > 0;
      const ownSchema: OpenApiSchemaObject = {
        properties: schema.properties,
        required: schema.required,
        additionalProperties: schema.additionalProperties,
        type: 'object',
      };
      const ownProperties = hasOwnProperties
        ? requireFields(child(ownSchema), keys)
        : undefined;
      members = members.map((member) => requireFields(member, keys));

      const discriminator = schema.discriminator?.propertyName;
      const variant =
        separator !== 'allOf' && !ownProperties && isString(discriminator)
          ? toVariant(members, discriminator)
          : undefined;

      if (variant) return { schema: variant.schema, actions: [] };
      if (separator === 'allOf') {
        return {
          schema: {
            kind: 'intersect',
            members: ownProperties ? [...members, ownProperties] : members,
          },
          actions: [],
        };
      }
      const union: ValibotSchema = { kind: 'union', members };
      return {
        schema: ownProperties
          ? {
              kind: 'intersect',
              members: [plainNode(union), ownProperties],
            }
          : union,
        actions: [],
      };
    }

    if (getMultiTypes(schema).length > 1) {
      return {
        schema: {
          kind: 'union',
          members: getMultiTypes(schema).map((t) =>
            child({ ...bare, type: t }),
          ),
        },
        actions: [],
      };
    }

    if (schema.enum && type !== 'array' && type !== 'null') {
      // `getEnumMembers` dedupes and drops non-primitive members: the document
      // is untrusted and an array or object member must never reach the output.
      const values = getEnumMembers(schema)
        .map((member) => member.value)
        .filter((value) => value !== null);
      if (values.length === 0) {
        return {
          schema: { kind: nullable ? 'null' : 'never' },
          actions: [],
        };
      }
      if (values.length === 1) {
        return {
          schema: { kind: 'literal', value: toJsLiteral(values[0]) },
          actions: [],
        };
      }
      if (
        values.every((value) => isString(value) || typeof value === 'number')
      ) {
        return {
          schema: {
            kind: 'picklist',
            values: values.map((value) => toJsLiteral(value)),
          },
          actions: [],
        };
      }
      return {
        schema: {
          kind: 'union',
          members: values.map((value) =>
            plainNode({ kind: 'literal', value: toJsLiteral(value) }),
          ),
        },
        actions: [],
      };
    }

    switch (type) {
      case 'array': {
        if ('prefixItems' in schema) {
          warnOnce(
            '`prefixItems` is not supported yet, the tuple is validated as an array of unknown.',
          );
          return {
            schema: { kind: 'array', item: child(undefined) },
            actions: [],
          };
        }
        return {
          schema: { kind: 'array', item: child(schema.items) },
          actions: [],
        };
      }
      case 'null': {
        return { schema: { kind: 'null' }, actions: [] };
      }
      case 'string': {
        return stringBase(schema);
      }
      case 'number':
      case 'integer': {
        return {
          schema: { kind: 'number' },
          actions: type === 'integer' ? [{ kind: 'integer' }] : [],
        };
      }
      case 'boolean': {
        return { schema: { kind: 'boolean' }, actions: [] };
      }
      case 'object': {
        return { schema: generateObject(schema, child, strict), actions: [] };
      }
      default: {
        // Untyped schemas with `properties` are objects.
        return {
          schema:
            isObject(schema.properties) &&
            Object.keys(schema.properties).length > 0
              ? generateObject(schema, child, strict)
              : { kind: 'unknown' },
          actions: [],
        };
      }
    }
  };

  const base = generateBase();
  const kind = base.schema.kind;
  const isDateString =
    kind === 'string' && ['date', 'date-time'].includes(schema.format ?? '');

  const actions: ValibotAction[] = [
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

  return {
    schema: base.schema,
    actions,
    nullable,
    optional: !hasDefault && !required,
    defaultValue: hasDefault ? toJsLiteral(schema.default) : undefined,
  };
};
