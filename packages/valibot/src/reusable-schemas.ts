import {
  type ContextSpec,
  type OpenApiSchemaObject,
  orderByDependencies,
} from '@orval/core';

import { dereference } from './dereference';
import type { ValibotNode } from './nodes';
import { createRefPolicy, getComponentModes } from './ref-policy';
import { collectRefNames, resolveComponentName, toComponentRef } from './refs';
import { renderValibot } from './render';
import { generateValibotValidationSchemaDefinition } from './schema';

// Names depend on the spec and on the component naming options, so a spec
// reused with other options gets its own entry.
const namesCache = new WeakMap<
  object,
  Map<string, ReadonlyMap<string, string>>
>();

const namingSignature = (context: ContextSpec): string => {
  const { prefix, suffix } = context.output.override.components.schemas;
  return JSON.stringify([prefix, suffix]);
};

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
  const bySignature =
    namesCache.get(context.spec) ??
    new Map<string, ReadonlyMap<string, string>>();
  namesCache.set(context.spec, bySignature);
  const signature = namingSignature(context);
  const cached = bySignature.get(signature);
  if (cached) return cached;
  const names = resolveNames(context);
  bySignature.set(signature, names);
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

/**
 * One `export const` per component schema, dependencies first. A reference
 * that closes a cycle reads through `v.lazy`.
 */
export const generateValibotComponents = (context: ContextSpec): string => {
  const names = getComponentNames(context);
  const nodes = new Map(
    Object.entries(getComponents(context)).flatMap(([key, schema]) => {
      const name = names.get(key);
      return name === undefined
        ? []
        : [[name, generateComponent(key, schema, context)] as const];
    }),
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
