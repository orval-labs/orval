import {
  allocateDerivedNames,
  type ContextSpec,
  nodesOnCycles,
  orderByDependencies,
  toComponentRef,
} from '@orval/core';

import {
  dereference,
  type EffectValidationSchemaDefinition,
  generateEffectValidationSchemaDefinition,
  parseEffectValidationSchemaDefinition,
} from '.';
import { resolveIsEffectV4 } from './compatible-v4';
import { startRun } from './logger';
import { createRefPolicy } from './ref-policy';
import { collectRefNames, getComponentNames } from './refs';
import { renderEffectType } from './render-type';

// A hoisted constant (`<Name>Min`) shares the module with the components.
export const assertNoNameClash = (
  consts: string,
  component: string,
  componentNames: ReadonlySet<string>,
): void => {
  const clash = [...consts.matchAll(/^export const ([\w$]+)/gm)]
    .map((match) => match[1])
    .find((name) => componentNames.has(name));
  if (clash !== undefined) {
    throw new Error(
      `[orval/effect] generateReusableSchemas: the constant "${clash}" generated for ${component} has the name of a component. Rename one in the OpenAPI source.`,
    );
  }
};

const cannotGenerate = (name: string, error: unknown): Error =>
  new Error(
    `[orval/effect] generateReusableSchemas: component ${name} cannot be generated: ${error instanceof Error ? error.message : String(error)}`,
    { cause: error },
  );

interface ComponentDefinitions {
  definitions: ReadonlyMap<string, EffectValidationSchemaDefinition>;
  // The components whose definition failed. Only an operation that reaches one
  // fails.
  failures: ReadonlyMap<string, Error>;
  // The components each one reads.
  graph: ReadonlyMap<string, ReadonlySet<string>>;
  // The names hoisted constants were allocated from, by component.
  registry: Readonly<Record<string, number>>;
}

const cache = new WeakMap<object, WeakMap<object, ComponentDefinitions>>();

// Component constants are shared by every operation, so they keep every
// property and follow the output-level options.
const generateDefinitions = (context: ContextSpec): ComponentDefinitions => {
  const names = getComponentNames(context);
  const policy = createRefPolicy({
    context,
    exactOptional: context.output.override.effect.exactOptional,
  });
  const schemas = context.spec.components?.schemas ?? {};
  const registry: Record<string, number> = {};
  const definitions = new Map<string, EffectValidationSchemaDefinition>();
  const failures = new Map<string, Error>();
  for (const [key, name] of names) {
    try {
      const resolved = dereference(
        schemas[key],
        { ...context, parents: [toComponentRef(key)] },
        policy,
      );
      definitions.set(
        name,
        generateEffectValidationSchemaDefinition(
          resolved,
          context,
          name,
          false,
          { required: true, constNameRegistry: registry },
        ),
      );
    } catch (error) {
      failures.set(name, cannotGenerate(name, error));
    }
  }
  const graph = new Map(
    [...definitions].map(([name, definition]) => [
      name,
      collectRefNames(definition),
    ]),
  );
  return { definitions, failures, graph, registry };
};

const getDefinitions = (context: ContextSpec): ComponentDefinitions => {
  const byOutput = cache.get(context.spec) ?? new WeakMap();
  cache.set(context.spec, byOutput);
  const known = byOutput.get(context.output) ?? generateDefinitions(context);
  byOutput.set(context.output, known);
  return known;
};

/**
 * A fresh constant name registry that already holds the names the component
 * constants hoist, so an operation never declares the same constant.
 */
export const seedConstNameRegistry = (
  context: ContextSpec,
): Record<string, number> => ({ ...getDefinitions(context).registry });

/**
 * One `export const` per component schema an operation reaches, dependencies
 * first, after the constants it hoists. A reference to a constant on a cycle
 * reads through `S.suspend`, typed with the type and encoded type declared for
 * it (`<Name>` and `<Name>Encoded`). Empty when no operation
 * reaches a component schema. Throws when one it reaches cannot be generated.
 */
export const generateEffectComponents = (
  context: ContextSpec,
  used: ReadonlySet<string>,
): string => {
  startRun(context.spec);
  const componentNames = new Set(getComponentNames(context).values());
  const { exactOptional, version } = context.output.override.effect;
  const isEffectV4 = resolveIsEffectV4(version, context.output.packageJson);
  const { definitions, failures, graph: all } = getDefinitions(context);
  // Only a component an operation reaches is rendered.
  const emitted = new Set<string>();
  const visit = (name: string): void => {
    const failure = failures.get(name);
    if (failure) throw failure;
    const reads = all.get(name);
    if (!reads || emitted.has(name)) return;
    emitted.add(name);
    for (const read of reads) visit(read);
  };
  for (const name of used) visit(name);
  const graph = new Map([...all].filter(([name]) => emitted.has(name)));
  const { order } = orderByDependencies(graph);
  // The declared types name each other, so no type reads a constant whose
  // type depends on it.
  const encodedNames = allocateDerivedNames(
    nodesOnCycles(graph),
    componentNames,
    'Encoded',
  );
  const renderComponent = (
    definition: EffectValidationSchemaDefinition,
    name: string,
    lazyRefs: ReadonlyMap<string, string>,
  ) => {
    try {
      return parseEffectValidationSchemaDefinition(
        definition,
        context,
        false,
        undefined,
        exactOptional,
        isEffectV4,
        lazyRefs,
      );
    } catch (error) {
      throw cannotGenerate(name, error);
    }
  };
  const typeOf = (
    definition: EffectValidationSchemaDefinition,
    direction: 'type' | 'encoded',
  ) =>
    renderEffectType(definition, {
      direction,
      exactOptional,
      isEffectV4,
      declared: encodedNames,
    });

  return order
    .flatMap((name) => {
      const definition = definitions.get(name);
      if (!definition) return [];
      const lazyRefs = new Map(
        [...(graph.get(name) ?? [])].flatMap((target) => {
          const encodedName = encodedNames.get(target);
          return encodedName === undefined
            ? []
            : [[target, encodedName] as const];
        }),
      );
      const { effect, consts } = renderComponent(definition, name, lazyRefs);
      assertNoNameClash(consts, `component ${name}`, componentNames);
      const encodedName = encodedNames.get(name);
      return [
        [
          consts,
          encodedName === undefined
            ? ''
            : [
                `export type ${name} = ${typeOf(definition, 'type')};`,
                `export type ${encodedName} = ${typeOf(definition, 'encoded')};`,
              ].join('\n'),
          `export const ${name} = ${effect || 'S.Unknown'}`,
        ]
          .filter(Boolean)
          .join('\n\n'),
      ];
    })
    .join('\n\n');
};
