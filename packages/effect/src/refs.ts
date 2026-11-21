import {
  type ContextSpec,
  getComponentNames as getSharedComponentNames,
  getExportNames as getSharedExportNames,
  getRef,
  getSchemaLibrary,
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
    // The check of an integer in the schemas module reads it.
    ...(isSchemasOutput(context) ? ['Number'] : []),
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

/** Whether the schemas are written for `schemas: { type: 'effect' }`. */
export const isSchemasOutput = (context: ContextSpec): boolean =>
  getSchemaLibrary(context.output) === 'effect';

/** The option that turns reusable schemas on, as errors name it. */
export const reusableSchemasOption = (context: ContextSpec): string =>
  isSchemasOutput(context)
    ? 'schemas.type "effect"'
    : 'generateReusableSchemas';

export const isReusableSchemasEnabled = (context: ContextSpec): boolean =>
  context.output.override.effect.generateReusableSchemas ||
  isSchemasOutput(context);

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
    option: reusableSchemasOption(context),
  });

/** The names clients import each constant by, keyed by constant name. */
export const getExportNames = (
  context: ContextSpec,
): ReadonlyMap<string, string> =>
  getSharedExportNames(context, {
    library: 'effect',
    reserved: getReservedNames(context),
    option: reusableSchemasOption(context),
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

// A const name carries the position of its member, so definitions compare by
// the values behind their names.
const signatureOf = (definition: Definition): string => {
  const values = new Map<string, string>();
  return JSON.stringify(definition, (_, value: unknown) => {
    if (isDefinition(value)) {
      for (const chunk of value.consts) {
        const [, name, text] =
          /const (\S+) = ([\s\S]*?);?\s*$/.exec(chunk) ?? [];
        if (name && text) values.set(name, text);
      }
      return { functions: value.functions.filter(([fn]) => fn !== 'describe') };
    }
    // Field records compare by their fields, not the order they were declared in.
    if (isObject(value) && !Array.isArray(value)) {
      return Object.fromEntries(
        Object.entries(value).sort(([left], [right]) =>
          left < right ? -1 : left > right ? 1 : 0,
        ),
      );
    }
    return isString(value) ? (values.get(value) ?? value) : value;
  });
};

// The functions of a definition by name, without its description.
const kindsOf = ({ functions }: Definition): string[] =>
  functions.map(([fn]) => fn).filter((fn) => fn !== 'describe');

// A plain string that an enum or literal of strings replaces, wrapped the same
// way, loses nothing. A string with any check, or any other base, does.
const narrowsString = (earlier: Definition, later: Definition): boolean => {
  const [base, ...wrappers] = kindsOf(earlier);
  const [choice, ...laterWrappers] = kindsOf(later);
  return (
    base === 'string' &&
    (choice === 'enum' || choice === 'literal') &&
    wrappers.every((fn) => fn === 'optional') &&
    wrappers.join() === laterWrappers.join()
  );
};

/**
 * The keys that both sides of an allOf merge declare, where the later
 * definition differs from the earlier one, unless it is an enum or literal
 * that replaces a plain string.
 */
export const overlappingKeys = (
  earlier: ReadonlyMap<string, Definition>,
  later: ReadonlyMap<string, Definition>,
): string[] =>
  [...later].flatMap(([key, field]) => {
    const before = earlier.get(key);
    return before &&
      signatureOf(before) !== signatureOf(field) &&
      !narrowsString(before, field)
      ? [key]
      : [];
  });

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
