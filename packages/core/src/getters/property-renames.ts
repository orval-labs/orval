import { resolveRef } from '../resolvers';
import type {
  ContextSpec,
  NamingConvention,
  NormalizedOutputOptions,
  OpenApiReferenceObject,
  OpenApiSchemaObject,
} from '../types';
import { conventionName, isInlineSchema } from '../utils';
import { getPropertyNameCollisionKeys } from './keys';

/** The convention `override.namingConvention.properties` renames keys with. */
export const getPropertyNamingConvention = (
  output: NormalizedOutputOptions,
): NamingConvention | undefined =>
  // Outputs built by hand, as in write-zod-specs.test.ts, can omit it.
  // oxlint-disable-next-line typescript/no-unnecessary-condition
  output.override.namingConvention?.properties;

/**
 * The keys of one object that `convention` renames, with their converted
 * names. Keys that would collide after conversion keep their original name,
 * as they do in the TypeScript models (#2381). The Zod rename transform and
 * `schemaRenamesKeys` both call this, so they agree on which keys change.
 */
export const getRenamedPropertyKeys = (
  keys: string[],
  convention: NamingConvention,
): { from: string; to: string }[] => {
  const convert = (key: string) => conventionName(key, convention);
  const collisionKeys = getPropertyNameCollisionKeys(keys, convert);
  return keys
    .filter((key) => !collisionKeys.has(key))
    .map((key) => ({ from: key, to: convert(key) }))
    .filter(({ from, to }) => from !== to);
};

/**
 * Whether `namingConvention.properties` renames any object key in a schema,
 * nested refs included. The Zod schema for it then renames those keys when
 * it parses, so the parsed value no longer has the wire keys. A ref that
 * does not resolve counts as renaming.
 */
export const schemaRenamesKeys = (
  schema: OpenApiSchemaObject | OpenApiReferenceObject | undefined,
  context: ContextSpec,
): boolean => {
  const convention = getPropertyNamingConvention(context.output);
  return convention
    ? walkRenames(schema, convention, context, new Set())
    : false;
};

const walkRenames = (
  schema: OpenApiSchemaObject | OpenApiReferenceObject | undefined,
  convention: NamingConvention,
  context: ContextSpec,
  seen: Set<object>,
): boolean => {
  if (typeof schema !== 'object' || seen.has(schema)) return false;
  seen.add(schema);

  if (!isInlineSchema(schema)) {
    let resolved: OpenApiSchemaObject;
    try {
      resolved = resolveRef<OpenApiSchemaObject>(schema, context).schema;
    } catch {
      return true;
    }
    return walkRenames(resolved, convention, context, seen);
  }

  const keys = Object.keys(schema.properties ?? {});
  if (getRenamedPropertyKeys(keys, convention).length > 0) return true;

  const children = [
    ...Object.values(schema.properties ?? {}),
    schema.items,
    ...(schema.prefixItems ?? []),
    ...(schema.allOf ?? []),
    ...(schema.oneOf ?? []),
    ...(schema.anyOf ?? []),
    schema.additionalProperties,
  ];
  return children.some((child) =>
    walkRenames(child, convention, context, seen),
  );
};
