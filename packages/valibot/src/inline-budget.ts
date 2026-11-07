import { isObject } from '@orval/core';

import { isDataKey } from './schema-keys';

/** Schema nodes one top-level schema may inline before the expansion stops. */
export const MAX_INLINE_NODES = 250_000;

/** Counts the schema nodes an inlining produces, failing once past the limit. */
export interface InlineBudget {
  // `parents` are the `$ref`s being inlined, outermost first.
  spend: (parents: readonly string[] | undefined) => void;
}

interface InlineBudgetOptions {
  limit: number;
  // Where the schema is used, such as an operation and its request body.
  label: string;
  // Whether generating reusable schemas would shorten the expansion.
  suggestReusable: boolean;
}

interface InlineLimitErrorOptions extends InlineBudgetOptions {
  ref: string | undefined;
}

export const inlineLimitError = ({
  limit,
  label,
  suggestReusable,
  ref,
}: InlineLimitErrorOptions): Error =>
  new Error(
    `[orval/valibot] Inlining ${ref ? `"${ref}"` : 'the schema'} for ${label} produced more than ${limit} schema nodes.${
      suggestReusable
        ? ' Set override.valibot.generateReusableSchemas to true to generate one schema per component instead.'
        : ' Some of its references cannot be shared as component constants, such as those under readOnly or writeOnly properties or in form bodies.'
    }`,
  );

export const createInlineBudget = (
  options: InlineBudgetOptions,
): InlineBudget => {
  const spent = { count: 0 };
  return {
    spend: (parents) => {
      spent.count += 1;
      if (spent.count > options.limit) {
        throw inlineLimitError({ ...options, ref: parents?.[0] });
      }
    },
  };
};

// Sizes of the objects counted so far. Expansions share nested objects, also
// between calls, so each object is walked once.
const sizes = new WeakMap<object, number>();

const sizeOfValue = (value: unknown): number => {
  if (Array.isArray(value)) {
    let total = 0;
    for (const item of value) total += sizeOfValue(item);
    return total;
  }
  return isObject(value) ? sizeOfSchema(value) : 0;
};

// A boolean schema is a node of its own, unlike the boolean flags of a keyword.
const sizeOfProperty = (property: unknown): number =>
  typeof property === 'boolean' ? 1 : sizeOfValue(property);

const sizeOfSchema = (schema: Record<string, unknown>): number => {
  const known = sizes.get(schema);
  if (known !== undefined) return known;
  let size = 1;
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'properties' && isObject(value)) {
      // Property names are not keywords, whatever they are called.
      for (const property of Object.values(value)) {
        size += sizeOfProperty(property);
      }
    } else if (!isDataKey(key)) {
      size += sizeOfValue(value);
    }
  }
  sizes.set(schema, size);
  return size;
};

/** The schema nodes of an expansion as if written out in full. */
export const countInlineNodes = (expansion: object): number =>
  sizeOfValue(expansion);
