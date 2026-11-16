import {
  allocateDerivedNames,
  type ContextSpec,
  nodesOnCycles,
  orderByDependencies,
  relaxWriteOnly,
  resolveIsEffectV4,
  toComponentRef,
} from '@orval/core';

import {
  dereference,
  type EffectValidationSchemaDefinition,
  generateEffectValidationSchemaDefinition,
  parseEffectValidationSchemaDefinition,
} from '.';
import { startRun, warnOnce } from './logger';
import { createRefPolicy } from './ref-policy';
import {
  collectRefNames,
  getComponentNames,
  isSchemasOutput,
  reusableSchemasOption,
} from './refs';
import { renderEffectType } from './render-type';

// A hoisted constant (`<Name>Min`) shares the module with the components.
export const assertNoNameClash = (
  consts: string,
  component: string,
  componentNames: ReadonlySet<string>,
  context: ContextSpec,
): void => {
  const clash = [...consts.matchAll(/^export const ([\w$]+)/gm)]
    .map((match) => match[1])
    .find((name) => componentNames.has(name));
  if (clash !== undefined) {
    throw new Error(
      `[orval/effect] ${reusableSchemasOption(context)}: the constant "${clash}" generated for ${component} has the name of a component. Rename one in the OpenAPI source.`,
    );
  }
};

const cannotGenerate = (
  name: string,
  error: unknown,
  context: ContextSpec,
): Error =>
  new Error(
    `[orval/effect] ${reusableSchemasOption(context)}: component ${name} cannot be generated: ${error instanceof Error ? error.message : String(error)}`,
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
          isSchemasOutput(context)
            ? relaxWriteOnly(resolved, context)
            : resolved,
          context,
          name,
          false,
          { required: true, constNameRegistry: registry },
        ),
      );
    } catch (error) {
      failures.set(name, cannotGenerate(name, error, context));
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

interface ComponentTypeNames {
  type: string;
  encoded: string;
}

export interface EffectComponentConst {
  /** The identifier the constant is declared as. */
  name: string;
  /** The constants it hoists. */
  consts: string;
  expression: string;
  /**
   * The type and encoded type a constant on a cycle declares, which its
   * `S.suspend` getters are typed with.
   */
  types?: {
    typeName: string;
    type: string;
    encodedName: string;
    encoded: string;
  };
  /**
   * The constant the getters of a constant on a cycle read, when the caller
   * declares the expression under that name and `name` wraps it.
   */
  base?: string;
}

interface ComponentConstsOptions {
  /**
   * The components to render, with the ones they read. Every component when
   * left out.
   */
  used?: ReadonlySet<string>;
  /**
   * The components that must be generated. Another component that cannot be,
   * and each component that reads it, is left out with a warning. Left out,
   * any component that cannot be generated stops the run.
   */
  required?: ReadonlySet<string>;
  /**
   * Names the types of a constant on a cycle. The type has the name of the
   * constant and the encoded type is `<Name>Encoded` by default.
   */
  typeNamesOf?: (name: string) => ComponentTypeNames;
  /** Names the constant the getters of a constant on a cycle read. */
  baseOf?: (name: string) => string;
}

// The components that read one of `names`, directly or through others, with
// them.
const withReaders = (
  graph: ReadonlyMap<string, ReadonlySet<string>>,
  names: Iterable<string>,
): Set<string> => {
  const found = new Set(names);
  for (let grew = true; grew;) {
    grew = false;
    for (const [name, reads] of graph) {
      if (!found.has(name) && [...reads].some((read) => found.has(read))) {
        found.add(name);
        grew = true;
      }
    }
  }
  return found;
};

// Leaves out each component that cannot be generated and each that reads one,
// and says so.
const leaveOut = (
  failures: ReadonlyMap<string, Error>,
  graph: ReadonlyMap<string, ReadonlySet<string>>,
): Set<string> => {
  if (failures.size === 0) return new Set();
  const left = withReaders(graph, failures.keys());
  for (const name of left) {
    const failure = failures.get(name);
    warnOnce(
      failure
        ? `${failure.message} (left out of the schemas module)`
        : `[orval/effect] component ${name} reads a component that cannot be generated, so it is left out of the schemas module.`,
    );
  }
  return left;
};

/**
 * One constant per component schema an operation reaches, or per component
 * when `used` is left out, dependencies first, after the constants it hoists.
 * A reference to a constant on a cycle reads through `S.suspend`, typed with
 * the type and encoded type declared for it. Throws when a component that must
 * be generated cannot be.
 */
export const generateEffectComponentConsts = (
  context: ContextSpec,
  { used, required, typeNamesOf, baseOf }: ComponentConstsOptions = {},
): EffectComponentConst[] => {
  startRun(context.spec);
  const componentNames = new Set(getComponentNames(context).values());
  const { exactOptional, version } = context.output.override.effect;
  const isEffectV4 = resolveIsEffectV4(version, context.output.packageJson);
  const { definitions, failures, graph: all } = getDefinitions(context);
  const reach = (roots: Iterable<string>): Set<string> => {
    const reached = new Set<string>();
    const visit = (name: string): void => {
      if (reached.has(name)) return;
      reached.add(name);
      for (const read of all.get(name) ?? []) visit(read);
    };
    for (const root of roots) visit(root);
    return reached;
  };
  const reached = reach(used ?? componentNames);
  const mandatory = required ? reach(required) : reached;
  for (const name of reached) {
    const failure = failures.get(name);
    if (failure && mandatory.has(name)) throw failure;
  }
  const unsupported = new Map(
    [...reached].flatMap((name) => {
      const failure = failures.get(name);
      return failure ? [[name, failure] as const] : [];
    }),
  );
  const left = leaveOut(unsupported, all);
  const graph = new Map(
    [...all].filter(([name]) => reached.has(name) && !left.has(name)),
  );
  const { order } = orderByDependencies(graph);
  // The declared types name each other, so no type reads a constant whose
  // type depends on it.
  const onCycles = nodesOnCycles(graph);
  const typeNames: ReadonlyMap<string, ComponentTypeNames> = typeNamesOf
    ? new Map([...onCycles].map((name) => [name, typeNamesOf(name)] as const))
    : new Map(
        [...allocateDerivedNames(onCycles, componentNames, 'Encoded')].map(
          ([name, encoded]) => [name, { type: name, encoded }] as const,
        ),
      );
  const encodedNames = new Map(
    [...typeNames].map(([name, { encoded }]) => [name, encoded] as const),
  );
  const declaredTypes = new Map(
    [...typeNames].map(([name, { type }]) => [name, type] as const),
  );
  const bases = new Map(
    baseOf ? [...onCycles].map((name) => [name, baseOf(name)] as const) : [],
  );
  const render = (
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
        declaredTypes,
        bases,
      );
    } catch (error) {
      return cannotGenerate(name, error, context);
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
      mergesMembers: isEffectV4 || isSchemasOutput(context),
      declared: encodedNames,
      declaredTypes,
    });

  const failedToRender = new Map<string, Error>();
  const consts = order.flatMap((name): EffectComponentConst[] => {
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
    const rendered = render(definition, name, lazyRefs);
    if (rendered instanceof Error) {
      if (mandatory.has(name)) throw rendered;
      failedToRender.set(name, rendered);
      return [];
    }
    const { effect, consts } = rendered;
    assertNoNameClash(consts, `component ${name}`, componentNames, context);
    const own = typeNames.get(name);
    const base = bases.get(name);
    return [
      {
        name,
        consts,
        expression: effect || 'S.Unknown',
        ...(base === undefined ? {} : { base }),
        ...(own === undefined
          ? {}
          : {
              types: {
                typeName: own.type,
                type: typeOf(definition, 'type'),
                encodedName: own.encoded,
                encoded: typeOf(definition, 'encoded'),
              },
            }),
      },
    ];
  });
  const dropped = leaveOut(failedToRender, graph);
  return consts.filter(({ name }) => !dropped.has(name));
};

/**
 * One `export const` per component schema an operation reaches, dependencies
 * first, after the constants it hoists. A constant on a cycle comes after the
 * type and encoded type declared for it (`<Name>` and `<Name>Encoded`). Empty
 * when no operation reaches a component schema.
 */
export const generateEffectComponents = (
  context: ContextSpec,
  used: ReadonlySet<string>,
): string =>
  generateEffectComponentConsts(context, { used })
    .map(({ name, consts, expression, types }) =>
      [
        consts,
        types === undefined
          ? ''
          : [
              `export type ${types.typeName} = ${types.type};`,
              `export type ${types.encodedName} = ${types.encoded};`,
            ].join('\n'),
        `export const ${name} = ${expression}`,
      ]
        .filter(Boolean)
        .join('\n\n'),
    )
    .join('\n\n');
