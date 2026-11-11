import {
  type ContextSpec,
  nodesOnCycles,
  type OpenApiSchemaObject,
  orderByDependencies,
  relaxWriteOnly,
  toComponentRef,
} from '@orval/core';

import { dereference } from './dereference';
import type { ValibotNode } from './nodes';
import { createRefPolicy, getComponentModes } from './ref-policy';
import { collectRefNames, isSchemasOutput, resolveComponentName } from './refs';
import { renderValibot } from './render';
import { hasReadonlyPipe, renderValibotType } from './render-type';
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
  return generateValibotValidationSchemaDefinition(
    isSchemasOutput(context) ? relaxWriteOnly(resolved, context) : resolved,
    context,
    strict,
    { required: true },
  );
};

// The input type of each constant on a cycle: `<Name>Input`, numbered when
// a component or an earlier input type already has that name.
const allocateInputTypeNames = (
  onCycles: ReadonlySet<string>,
  componentNames: ReadonlySet<string>,
): Map<string, string> => {
  const taken = new Set(componentNames);
  const names = new Map<string, string>();
  for (const name of onCycles) {
    let inputName = `${name}Input`;
    for (let count = 2; taken.has(inputName); count++) {
      inputName = `${name}Input${count}`;
    }
    taken.add(inputName);
    names.set(name, inputName);
  }
  return names;
};

export interface ComponentTypeNames {
  output: string;
  input: string;
}

export interface ValibotComponentConst {
  /** The identifier the constant is declared as. */
  name: string;
  expression: string;
  /**
   * The output and input types a constant on a cycle declares, which its
   * `v.lazy` getters are typed with.
   */
  types?: {
    outputName: string;
    output: string;
    inputName: string;
    input: string;
  };
}

/**
 * One constant per component schema. A constant comes after every constant it
 * reads; a reference that closes a cycle reads through `v.lazy`, typed with the
 * input and output types declared for every constant on a cycle. By default
 * the output type has the name of the constant and the input type is
 * `<Name>Input`; `typeNamesOf` names them otherwise.
 */
export const generateValibotComponentConsts = (
  context: ContextSpec,
  typeNamesOf?: (name: string) => ComponentTypeNames,
): ValibotComponentConst[] => {
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
  // The declared types name each other, so no type reads a constant whose
  // type depends on it.
  const onCycles = nodesOnCycles(graph);
  const typeNames: ReadonlyMap<string, ComponentTypeNames> = typeNamesOf
    ? new Map([...onCycles].map((name) => [name, typeNamesOf(name)] as const))
    : new Map(
        [...allocateInputTypeNames(onCycles, new Set(nodes.keys()))].map(
          ([name, input]) => [name, { output: name, input }] as const,
        ),
      );
  const declared = new Map(
    [...typeNames].map(([name, { input }]) => [name, input] as const),
  );
  const outputNames = new Map(
    [...typeNames].map(([name, { output }]) => [name, output] as const),
  );
  const { exactOptional } = context.output.override.valibot;

  // The constants each one reads directly, not through `v.lazy`, that are a
  // pipe holding `v.readonly()`. Dependencies come first in `order`.
  const readonlyConsts = new Set<string>();
  const readonlyRefsOf = (name: string) => {
    const lazy = cyclicEdges.get(name);
    return new Set([...readonlyConsts].filter((target) => !lazy?.has(target)));
  };
  for (const name of order) {
    const node = nodes.get(name);
    if (node && hasReadonlyPipe(node, readonlyRefsOf(name))) {
      readonlyConsts.add(name);
    }
  }

  const typeOf = (
    name: string,
    node: ValibotNode,
    direction: 'output' | 'input',
  ) =>
    renderValibotType(node, {
      direction,
      exactOptional,
      declared,
      outputNames,
      readonlyRefs: readonlyRefsOf(name),
    });

  return order.flatMap((name) => {
    const node = nodes.get(name);
    if (!node) return [];
    const own = typeNames.get(name);
    const lazyRefs = new Map(
      [...(cyclicEdges.get(name) ?? [])].flatMap((target) => {
        const input = declared.get(target);
        return input === undefined ? [] : [[target, input] as const];
      }),
    );
    return [
      {
        name,
        expression: renderValibot(node, {
          exactOptional,
          lazyRefs,
          outputNames,
        }),
        ...(own === undefined
          ? {}
          : {
              types: {
                outputName: own.output,
                output: typeOf(name, node, 'output'),
                inputName: own.input,
                input: typeOf(name, node, 'input'),
              },
            }),
      },
    ];
  });
};

/**
 * One `export const` per component schema, dependencies first, each constant
 * on a cycle after its output and input types. Empty when the document has no
 * component schemas.
 */
export const generateValibotComponents = (context: ContextSpec): string =>
  generateValibotComponentConsts(context)
    .map(({ name, expression, types }) =>
      [
        ...(types === undefined
          ? []
          : [
              `export type ${types.outputName} = ${types.output};`,
              `export type ${types.inputName} = ${types.input};`,
            ]),
        `export const ${name} = ${expression}`,
      ].join('\n\n'),
    )
    .join('\n\n');
