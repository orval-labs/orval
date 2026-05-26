import type { OpenAPIV3_1 } from '@scalar/openapi-types';
import { conventionName, type NamingConvention } from '@orval/core';
import type {
  ContextSpec,
  OpenApiSchemaObject,
  ZodCoerceType,
} from '@orval/core';
import {
  generateZodValidationSchemaDefinition,
  parseZodValidationSchemaDefinition,
} from '@orval/zod';

const lastRefSegment = (ref: string): string => {
  const segments = ref.split('/');
  return segments[segments.length - 1] ?? '';
};

/**
 * Convert a single `#/components/schemas/X` ref into the export name we will
 * emit for it: the last `$ref` segment with `namingConvention` applied.
 */
export const resolveSchemaName = (
  ref: string,
  namingConvention: NamingConvention,
): string => conventionName(lastRefSegment(ref), namingConvention);

// JavaScript identifier (loose): start with letter/_/$, continue with word chars.
// Reusable schema names are emitted as `export const <name> = ...`, so they
// must be valid identifiers regardless of naming convention.
const JS_IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * Resolve names for a set of refs, throwing on conflicts or on names that
 * aren't valid JS identifiers (e.g. `kebab-case` produces dashes). The mapping
 * is the single source of truth for cross-schema references — the generator,
 * the orchestrator's graph, and the sentinel rewriter all consult it.
 */
export const resolveSchemaNames = (
  refs: readonly string[],
  namingConvention: NamingConvention,
): Map<string, string> => {
  const resolved = new Map<string, string>();
  const reverse = new Map<string, string>();

  for (const ref of refs) {
    const name = resolveSchemaName(ref, namingConvention);
    if (!JS_IDENTIFIER_PATTERN.test(name)) {
      throw new Error(
        `[orval/zod] generateReusableSchemas: ref ${ref} converts to "${name}" ` +
          `under namingConvention=${namingConvention}, which is not a valid JS ` +
          `identifier. Use camelCase, PascalCase, or snake_case for the project's ` +
          `namingConvention when this flag is enabled.`,
      );
    }
    const previous = reverse.get(name);
    if (previous !== undefined && previous !== ref) {
      throw new Error(
        `[orval/zod] generateReusableSchemas: refs ${previous} and ${ref} ` +
          `both convert to "${name}" under namingConvention=${namingConvention}. ` +
          `Rename one in the OpenAPI source or change the convention.`,
      );
    }
    resolved.set(ref, name);
    reverse.set(name, ref);
  }

  return resolved;
};

const COMPONENT_SCHEMAS_PREFIX = '#/components/schemas/';

const isComponentSchemaRef = (ref: unknown): ref is string =>
  typeof ref === 'string' && ref.startsWith(COMPONENT_SCHEMAS_PREFIX);

/**
 * Walk a value (object or array) and accumulate every component-schema `$ref`
 * found anywhere in the subtree. Pure spec traversal — does NOT invoke the
 * Zod generator.
 */
const collectRefsInValue = (value: unknown, refs: Set<string>): void => {
  if (value === null || typeof value !== 'object') {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectRefsInValue(item, refs);
    }
    return;
  }
  const record = value as Record<string, unknown>;
  if (isComponentSchemaRef(record.$ref)) {
    refs.add(record.$ref);
    // Do not descend through a $ref; the BFS will follow it via components/schemas.
    return;
  }
  for (const key of Object.keys(record)) {
    collectRefsInValue(record[key], refs);
  }
};

/**
 * Returns the set of component-schema refs reachable from `spec.paths`,
 * following refs transitively through `spec.components.schemas`.
 */
export const collectReachableComponentRefs = (
  spec: OpenAPIV3_1.Document,
): Set<string> => {
  const reachable = new Set<string>();
  const queue: string[] = [];

  const initial = new Set<string>();
  collectRefsInValue(spec.paths, initial);
  for (const ref of initial) {
    reachable.add(ref);
    queue.push(ref);
  }

  const componentSchemas = (spec.components?.schemas ?? {}) as Record<
    string,
    unknown
  >;
  while (queue.length > 0) {
    const currentRef = queue.shift() as string;
    const schemaName = currentRef.slice(COMPONENT_SCHEMAS_PREFIX.length);
    const targetSchema = componentSchemas[schemaName];
    if (targetSchema === undefined) continue;

    const innerRefs = new Set<string>();
    collectRefsInValue(targetSchema, innerRefs);
    for (const innerRef of innerRefs) {
      if (!reachable.has(innerRef)) {
        reachable.add(innerRef);
        queue.push(innerRef);
      }
    }
  }

  return reachable;
};

export interface ReusableSchemaEntry {
  ref: string;
  name: string;
  zod: string;
  consts: string;
  usedRefs: Set<string>;
}

export interface GenerateReusableSchemaSetOptions {
  strict: boolean;
  isZodV4: boolean;
  coerce?: boolean | ZodCoerceType[];
}

/**
 * For each component-schema ref, run the Zod generator + parser with
 * `useReusableSchemas: true`. The resulting `zod` strings contain
 * `__REF_<name>__` sentinels at every site that references another schema;
 * the SCC step (Task 10) decides whether each sentinel becomes a direct
 * identifier or a `z.lazy(() => Name)` wrapper.
 */
export const generateReusableSchemaSet = (
  refs: readonly string[],
  context: ContextSpec,
  options: GenerateReusableSchemaSetOptions,
): ReusableSchemaEntry[] => {
  const componentSchemas = (context.spec.components?.schemas ?? {}) as Record<
    string,
    OpenApiSchemaObject
  >;

  const entries: ReusableSchemaEntry[] = [];

  for (const ref of refs) {
    const schemaName = ref.slice('#/components/schemas/'.length);
    const schema = componentSchemas[schemaName];
    if (schema === undefined) continue;

    const name = resolveSchemaName(ref, context.output.namingConvention);

    const definition = generateZodValidationSchemaDefinition(
      schema,
      context,
      name,
      options.strict,
      options.isZodV4,
      { required: true, useReusableSchemas: true },
    );

    const parsed = parseZodValidationSchemaDefinition(
      definition,
      context,
      options.coerce ?? false,
      options.strict,
      options.isZodV4,
    );

    entries.push({
      ref,
      name,
      zod: parsed.zod,
      consts: parsed.consts,
      usedRefs: parsed.usedRefs,
    });
  }

  return entries;
};

type Graph = ReadonlyMap<string, ReadonlySet<string>>;

const edgeKey = (from: string, to: string): string => `${from}->${to}`;

/**
 * Tarjan's SCC. Returns SCCs as arrays of node ids, in reverse topological
 * order (deepest SCC first). Self-loops form their own size-1 SCC; non-cyclic
 * nodes are size-1 SCCs without a self-loop.
 */
const tarjan = (graph: Graph): string[][] => {
  let index = 0;
  const stack: string[] = [];
  const onStack = new Set<string>();
  const indices = new Map<string, number>();
  const lowlinks = new Map<string, number>();
  const sccs: string[][] = [];

  const strongconnect = (v: string): void => {
    indices.set(v, index);
    lowlinks.set(v, index);
    index += 1;
    stack.push(v);
    onStack.add(v);

    const neighbors = graph.get(v) ?? new Set<string>();
    for (const w of neighbors) {
      if (!indices.has(w)) {
        strongconnect(w);
        lowlinks.set(v, Math.min(lowlinks.get(v)!, lowlinks.get(w)!));
      } else if (onStack.has(w)) {
        lowlinks.set(v, Math.min(lowlinks.get(v)!, indices.get(w)!));
      }
    }

    if (lowlinks.get(v) === indices.get(v)) {
      const scc: string[] = [];
      let w: string | undefined;
      do {
        w = stack.pop();
        if (w === undefined) break;
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);
      sccs.push(scc);
    }
  };

  for (const node of graph.keys()) {
    if (!indices.has(node)) {
      strongconnect(node);
    }
  }

  return sccs;
};

/**
 * For each non-trivial SCC (size > 1 OR contains a self-loop), run a DFS
 * restricted to the SCC and mark back-edges as lazy. Returns the set of
 * lazy edge keys formatted as "from->to". Cross-SCC edges are never lazy.
 */
export const computeLazyEdges = (graph: Graph): Set<string> => {
  const lazy = new Set<string>();
  const sccs = tarjan(graph);

  for (const scc of sccs) {
    const sccSet = new Set(scc);
    const isSelfLoop =
      scc.length === 1 && (graph.get(scc[0])?.has(scc[0]) ?? false);
    const isNonTrivial = scc.length > 1 || isSelfLoop;
    if (!isNonTrivial) continue;

    if (isSelfLoop) {
      lazy.add(edgeKey(scc[0], scc[0]));
      continue;
    }

    const visited = new Set<string>();
    const stackSet = new Set<string>();

    const dfs = (node: string): void => {
      visited.add(node);
      stackSet.add(node);
      const neighbors = graph.get(node) ?? new Set<string>();
      for (const next of neighbors) {
        if (!sccSet.has(next)) continue;
        if (stackSet.has(next)) {
          lazy.add(edgeKey(node, next));
        } else if (!visited.has(next)) {
          dfs(next);
        }
      }
      stackSet.delete(node);
    };

    const start = [...scc].sort()[0];
    dfs(start);

    // Some nodes may not be reachable from `start` in the digraph; visit them too.
    for (const node of scc) {
      if (!visited.has(node)) dfs(node);
    }
  }

  return lazy;
};

const SENTINEL_PATTERN = /__REF_([A-Za-z_$][A-Za-z0-9_$]*)__/g;

/**
 * Topologically sort entries so that, within each SCC, the lex-smallest node
 * comes first. Across SCCs, dependencies come before dependents (reverse topo
 * order of SCCs from Tarjan).
 */
const topoSortEntries = (
  entries: readonly ReusableSchemaEntry[],
  graph: Graph,
): ReusableSchemaEntry[] => {
  const byName = new Map(entries.map((e) => [e.name, e] as const));
  const sccs = tarjan(graph); // already in reverse topo order
  const out: ReusableSchemaEntry[] = [];
  for (const scc of sccs) {
    const sorted = [...scc].sort();
    for (const name of sorted) {
      const entry = byName.get(name);
      if (entry !== undefined) out.push(entry);
    }
  }
  return out;
};

/**
 * Replace every `__REF_<name>__` sentinel with either the bare identifier or
 * `zod.lazy(() => <name>)` based on whether the edge closes a cycle. Returns
 * the entries reordered into reverse topological order so direct references
 * resolve via JS const hoisting in single-file output.
 */
export const rewriteReusableSchemas = (
  entries: readonly ReusableSchemaEntry[],
): ReusableSchemaEntry[] => {
  const graph: Map<string, Set<string>> = new Map(
    entries.map((e) => [e.name, new Set(e.usedRefs)] as const),
  );
  // Ensure all referenced names exist as nodes (even if no entry — guards against
  // forgotten roots; the renderer will still emit valid code, just with a dangling
  // ref the user can debug).
  for (const e of entries) {
    for (const ref of e.usedRefs) {
      if (!graph.has(ref)) graph.set(ref, new Set());
    }
  }

  const lazy = computeLazyEdges(graph);

  const rewritten = entries.map((entry) => {
    const newZod = entry.zod.replace(
      SENTINEL_PATTERN,
      (_match, refName: string) => {
        const isLazy = lazy.has(edgeKey(entry.name, refName));
        return isLazy ? `zod.lazy(() => ${refName})` : refName;
      },
    );
    return { ...entry, zod: newZod };
  });

  return topoSortEntries(rewritten, graph);
};
