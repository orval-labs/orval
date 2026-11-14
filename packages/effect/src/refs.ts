import {
  type ContextSpec,
  getComponentNames as getSharedComponentNames,
  getRef,
  isObject,
  isString,
  jsStringEscape,
  resolveComponentName as resolveSharedComponentName,
} from '@orval/core';

import type { EffectValidationSchemaDefinition } from '.';

type Definition = EffectValidationSchemaDefinition;

// Names the generated code reads, which a constant must not shadow.
const RESERVED_NAMES: ReadonlySet<string> = new Set([
  'Date',
  'RegExp',
  'File',
  'S',
  'Effect',
  'ReadonlyArray',
]);

const LEADING_IDENTIFIER = /^\s*([A-Za-z_$][\w$]*)/;

// The names a `formatType` schema reads: what it imports and the root of its
// expression.
const reservedByOverride = new WeakMap<object, ReadonlySet<string>>();

export const getReservedNames = (context: ContextSpec): ReadonlySet<string> => {
  const { override } = context.output;
  const known = reservedByOverride.get(override);
  if (known) return known;
  const reserved = new Set([
    ...RESERVED_NAMES,
    ...Object.values(override.formatType ?? {}).flatMap((config) =>
      [
        config?.effect?.schemaImport?.name,
        LEADING_IDENTIFIER.exec(config?.effect?.schema ?? '')?.[1],
      ].filter(isString),
    ),
  ]);
  reservedByOverride.set(override, reserved);
  return reserved;
};

const IDENTIFIER_PATH = /^[\w$]+(?:\.[\w$]+)*$/;

/** Whether an expression can be named after `typeof`. */
export const isIdentifierPath = (expression: string): boolean =>
  IDENTIFIER_PATH.test(expression);

export const isReusableSchemasEnabled = (context: ContextSpec): boolean =>
  context.output.override.effect.generateReusableSchemas;

/** The identifier a component's constant is declared and referenced by. */
const resolveComponentName = (ref: string, context: ContextSpec): string =>
  resolveSharedComponentName(ref, context, getReservedNames(context));

/** Constant names by component key. Throws when two components share one. */
export const getComponentNames = (
  context: ContextSpec,
): ReadonlyMap<string, string> =>
  getSharedComponentNames(context, {
    library: 'effect',
    reserved: getReservedNames(context),
  });

/**
 * The definition of a schema that stays a reference to its component: a `ref`
 * base, wrapped like any other schema. Undefined for every other schema.
 */
export const generateRefDefinition = (
  schema: Record<string, unknown>,
  context: ContextSpec,
  required: boolean,
): Definition | undefined => {
  const ref = getRef(schema);
  if (ref === undefined || !isReusableSchemasEnabled(context)) return;
  const functions: [string, unknown][] = [
    ['ref', resolveComponentName(ref, context)],
  ];
  if (!required) functions.push(['optional', undefined]);
  if (isString(schema.description)) {
    functions.push(['describe', `'${jsStringEscape(schema.description)}'`]);
  }
  return { functions, consts: [] };
};

export const isDefinition = (value: unknown): value is Definition =>
  isObject(value) && Array.isArray(value.functions);

export const membersOf = (arg: unknown): Definition[] =>
  Array.isArray(arg) ? arg.filter((item) => isDefinition(item)) : [];

export const fieldsOf = (arg: unknown): [string, Definition][] =>
  isObject(arg)
    ? Object.entries(arg).flatMap(([key, field]): [string, Definition][] =>
        isDefinition(field) ? [[key, field]] : [],
      )
    : [];

/**
 * Whether a definition accepts `null`: a union when one of its members does,
 * an intersection when all of them do.
 */
export const admitsNull = (definition: Definition): boolean =>
  definition.functions.some(
    ([fn, arg]) =>
      fn === 'null' ||
      fn === 'nullable' ||
      fn === 'nullish' ||
      ((fn === 'oneOf' || fn === 'anyOf') && membersOf(arg).some(admitsNull)) ||
      (fn === 'allOf' && membersOf(arg).every(admitsNull)),
  );

// The definitions a constructor holds: one, a list of members or fields.
const childrenOf = (arg: unknown): Definition[] =>
  isDefinition(arg)
    ? [arg]
    : [...membersOf(arg), ...fieldsOf(arg).map(([, field]) => field)];

/** The names of the components a definition references, each once. */
export const collectRefNames = (definition: Definition): Set<string> => {
  const names = new Set<string>();
  const walk = ({ functions }: Definition): void => {
    for (const [fn, arg] of functions) {
      if (fn === 'ref' && isString(arg)) names.add(arg);
      for (const child of childrenOf(arg)) walk(child);
    }
  };
  walk(definition);
  return names;
};
