import {
  type ContextSpec,
  type OpenApiSchemaObject,
  orderByDependencies,
} from '@orval/core';

import { dereference } from './dereference';
import type { ValibotNode } from './nodes';
import { createRefPolicy, getComponentModes } from './ref-policy';
import {
  collectRefNames,
  collectUnguardedRefNames,
  cutUnguardedRefs,
  resolveComponentName,
  toComponentRef,
} from './refs';
import { renderValibot } from './render';
import { generateValibotValidationSchemaDefinition } from './schema';

const namesCache = new WeakMap<object, ReadonlyMap<string, string>>();

const getComponents = (
  context: ContextSpec,
): Record<string, OpenApiSchemaObject> =>
  context.spec.components?.schemas ?? {};

const resolveNames = (context: ContextSpec): Map<string, string> => {
  const names = new Map<string, string>();
  const owners = new Map<string, string>();
  for (const key of Object.keys(getComponents(context))) {
    const ref = toComponentRef(key);
    const name = resolveComponentName(ref, context);
    const owner = owners.get(name);
    if (owner !== undefined) {
      throw new Error(
        `[orval/valibot] generateReusableSchemas: refs ${owner} and ${ref} both resolve to the export name "${name}". Rename one in the OpenAPI source.`,
      );
    }
    owners.set(name, ref);
    names.set(key, name);
  }
  return names;
};

/** Constant names by component key. Throws when two components share one. */
export const getComponentNames = (
  context: ContextSpec,
): ReadonlyMap<string, string> => {
  const cached = namesCache.get(context.spec);
  if (cached) return cached;
  const names = resolveNames(context);
  namesCache.set(context.spec, names);
  return names;
};

const generateComponent = (
  key: string,
  schema: OpenApiSchemaObject,
  context: ContextSpec,
): ValibotNode => {
  // Component constants are shared by every operation, so they keep every
  // property and follow the output-level options.
  const { strict, exactOptional } = getComponentModes(context);
  const resolved = dereference(
    schema,
    { ...context, parents: [toComponentRef(key)] },
    createRefPolicy({ context, strict, exactOptional }),
  );
  return generateValibotValidationSchemaDefinition(resolved, context, strict, {
    required: true,
  });
};

// A cycle with no property, item or value in it would recurse forever, so the
// reference that closes it is validated as `unknown`.
const cutUnguardedCycles = (
  nodes: ReadonlyMap<string, ValibotNode>,
): Map<string, ValibotNode> => {
  const unguarded = new Map(
    [...nodes].map(
      ([name, node]) => [name, collectUnguardedRefNames(node)] as const,
    ),
  );
  const { cyclicEdges } = orderByDependencies(unguarded);
  return new Map(
    [...nodes].map(([name, node]) => {
      const cuts = cyclicEdges.get(name);
      return [name, cuts ? cutUnguardedRefs(node, cuts) : node] as const;
    }),
  );
};

/**
 * One `export const` per component schema, dependencies first. A reference
 * that closes a cycle reads through `v.lazy`.
 */
export const generateValibotComponents = (context: ContextSpec): string => {
  const names = getComponentNames(context);
  const nodes = cutUnguardedCycles(
    new Map(
      Object.entries(getComponents(context)).flatMap(([key, schema]) => {
        const name = names.get(key);
        return name === undefined
          ? []
          : [[name, generateComponent(key, schema, context)] as const];
      }),
    ),
  );
  const graph = new Map(
    [...nodes].map(([name, node]) => [name, collectRefNames(node)] as const),
  );
  const { order, cyclicEdges } = orderByDependencies(graph);
  const { exactOptional } = context.output.override.valibot;

  return order
    .flatMap((name) => {
      const node = nodes.get(name);
      return node
        ? [
            `export const ${name} = ${renderValibot(node, {
              exactOptional,
              lazyRefs: cyclicEdges.get(name),
            })}`,
          ]
        : [];
    })
    .join('\n\n');
};
