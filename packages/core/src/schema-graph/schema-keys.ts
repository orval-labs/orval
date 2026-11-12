import { isString } from '../utils/assertion';

/** The strings of a list, or none when the value is not a list. */
export const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item) => isString(item)) : [];

/** Keywords whose arrays hold the member schemas of a composition. */
export const COMPOSITION_KEYS = ['allOf', 'oneOf', 'anyOf'] as const;

/** Composition keywords whose members are alternatives. */
export const ALTERNATIVE_KEYS = ['oneOf', 'anyOf'] as const;

/** The members of a composition keyword, none when it is not a list. */
export const membersOf = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

/** The members of every composition keyword of a schema. */
export const compositionMembers = (
  schema: Record<string, unknown>,
): unknown[] => COMPOSITION_KEYS.flatMap((key) => membersOf(schema[key]));

export type CompositionKey = (typeof COMPOSITION_KEYS)[number];

export const isCompositionKey = (key: string): key is CompositionKey =>
  COMPOSITION_KEYS.some((candidate) => candidate === key);

// Keywords whose values are data, not schemas.
const DATA_KEYS: ReadonlySet<string> = new Set([
  'default',
  'example',
  'examples',
  'enum',
  'const',
]);

/** Whether a keyword holds literal data that must not be read as a schema. */
export const isDataKey = (key: string): boolean =>
  DATA_KEYS.has(key) || key.startsWith('x-');

// Siblings of a `$ref` that only describe it. Any other sibling changes what
// the schema accepts, which a shared constant cannot follow.
export const ANNOTATION_KEYS: ReadonlySet<string> = new Set([
  'description',
  'title',
  'summary',
  'example',
  'examples',
  'deprecated',
  'externalDocs',
]);

/** Whether a schema holds a `$ref` and annotations only. */
export const hasOnlyAnnotations = (schema: Record<string, unknown>): boolean =>
  Object.entries(schema).every(
    ([key, value]) =>
      key === '$ref' ||
      value === undefined ||
      ANNOTATION_KEYS.has(key) ||
      key.startsWith('x-'),
  );
