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
} from './schema-type';

export interface SchemaRules {
  required?: boolean;
}

// A required key without a property is kept, with the type of the additional
// properties as in a record. A default cannot apply to it.
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
    // Without properties the object is a dictionary, so it keeps its keys.
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

// The schema of a single type, with the checks the type implies.
const generateByType = (
  schema: OpenApiNonBooleanSchemaObject,
  type: ResolvedType,
  child: ChildGenerator,
  strict: boolean,
): BaseSchema => {
  switch (type) {
    case 'array': {
      return generateArray(schema, child);
    }
    case 'null': {
      return plainBase({ kind: 'null' });
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
      return plainBase({ kind: 'boolean' });
    }
    case 'object': {
      return plainBase(generateObject(schema, child, strict));
    }
    default: {
      // Untyped schemas with `properties` are objects.
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
): BaseSchema => {
  const constant = generateConst(schema.const);
  if (constant) return constant;

  const composition = generateComposition(schema, child);
  if (composition) return composition;

  const type = resolveType(schema);
  const types = getMultiTypes(schema);
  if (types.length > 1) {
    // `default` and `description` belong to the outer schema only.
    const { default: _default, description: _description, ...bare } = schema;
    return plainBase({
      kind: 'union',
      members: types.map((t) => child({ ...bare, type: t })),
    });
  }

  if (schema.enum && type !== 'array' && type !== 'null') {
    return generateEnum(schema, nullable);
  }
  return generateByType(schema, type, child, strict);
};

// The checks and wrappers a schema adds on top of its base.
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

// `null` is a member of the type or of a union, so it is not added again.
const isNullable = (schema: OpenApiNonBooleanSchemaObject): boolean => {
  const hasNullMember = [
    ...(Array.isArray(schema.oneOf) ? schema.oneOf : []),
    ...(Array.isArray(schema.anyOf) ? schema.anyOf : []),
  ].some((member) => isNonBoolean(member) && member.type === 'null');
  return (
    isSchemaNullable(schema) && resolveType(schema) !== 'null' && !hasNullMember
  );
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
  const nullable = isNullable(schema);
  const hasDefault = schema.default !== undefined;
  const child: ChildGenerator = (member, isRequired = true) =>
    generateValibotValidationSchemaDefinition(member, context, strict, {
      required: isRequired,
    });

  const base = generateBase(schema, child, strict, nullable);

  return {
    schema: base.schema,
    actions: generateActions(schema, base, context),
    nullable,
    optional: !hasDefault && !required,
    defaultValue: hasDefault ? toJsLiteral(schema.default) : undefined,
  };
};
