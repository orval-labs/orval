import type {
  ContextSpec,
  GeneratorMutator,
  OpenApiSchemaObject,
  ZodCoerceType,
  ZodVariantOption,
} from '@orval/core';
import { buildDynamicScope, getRefInfo } from '@orval/core';
import {
  generateZodValidationSchemaDefinition,
  parseZodValidationSchemaDefinition,
} from '@orval/zod';
import type { OpenAPIV3_1 } from '@scalar/openapi-types';

/**
 * Resolve the export identifier for a `#/components/schemas/X` ref. We reuse
 * `@orval/core`'s `getRefInfo(...).name` (`pascal` + sanitize + component
 * suffix) so reusable zod schema exports match the operation wrappers and the
 * TS model types exactly. `namingConvention` deliberately does NOT influence
 * the identifier — it governs file names only, consistent with the rest of
 * orval. The same call powers the generator's `namedRef` emission, so the
 * definition name and every reference stay in sync.
 */
export const resolveSchemaName = (ref: string, context: ContextSpec): string =>
  getRefInfo(ref, context).name;

/**
 * Resolve names for a set of refs, throwing on conflicts (two distinct refs
 * collapsing to the same identifier). The mapping is the single source of
 * truth for cross-schema references — the generator, the orchestrator's graph,
 * and the sentinel rewriter all consult it.
 */
export const resolveSchemaNames = (
  refs: readonly string[],
  context: ContextSpec,
): Map<string, string> => {
  const resolved = new Map<string, string>();
  const reverse = new Map<string, string>();

  for (const ref of refs) {
    const name = resolveSchemaName(ref, context);
    const previous = reverse.get(name);
    if (previous !== undefined && previous !== ref) {
      throw new Error(
        `[orval/zod] generateReusableSchemas: refs ${previous} and ${ref} ` +
          `both resolve to the export name "${name}". ` +
          `Rename one in the OpenAPI source.`,
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
  }
  for (const key of Object.keys(record)) {
    if (key === '$ref') continue; // already added; don't descend into the string
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

  const componentSchemas = spec.components?.schemas ?? {};
  // Index-based queue iteration (not `shift()`) so the BFS is O(n) rather than
  // O(n²). The queue is append-only — we never need to reclaim the head slot.
  for (const currentRef of queue) {
    const schemaName = currentRef.slice(COMPONENT_SCHEMAS_PREFIX.length);
    const targetSchema = componentSchemas[schemaName];
    if (!targetSchema) continue;

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
  variant?: ZodVariantOption;
  /**
   * True when this schema references itself directly or transitively (its node
   * sits in a cycle: an SCC of size > 1, or a self-loop). Such a schema is
   * emitted as a recursive `const` that reads its own binding inside its
   * initializer, so the writer must give it an explicit type annotation
   * (`const X: zod.ZodType<X>`) to avoid TS7022. Set by
   * {@link rewriteReusableSchemas}; `undefined`/`false` for acyclic schemas.
   */
  isRecursive?: boolean;
}

export interface GenerateReusableSchemaSetOptions {
  strict: boolean;
  isZodV4: boolean;
  variant?: ZodVariantOption;
  coerce?: boolean | ZodCoerceType[];
  /** Emit `.meta({ id, ... })` on each schema (zod v4). See `ZodOptions.generateMeta`. */
  generateMeta?: boolean;
  /**
   * When set, the user's `override.zod.params` mutator is invoked for every
   * leaf validator inside each emitted component schema with a `'schema'`
   * location and an empty `operationId` (component schemas are shared across
   * operations). Consumers can branch on `ctx.location === 'schema'` to vary
   * the injected params for shared definitions.
   */
  paramsMutator?: GeneratorMutator;
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
  const componentSchemas = context.spec.components?.schemas ?? {};

  // Map convention-applied export name → source ref, so when a generated
  // schema references another component schema via its `usedRefs` name we
  // can find which `$ref` to add to the work queue.
  const nameToRef = new Map<string, string>();
  for (const schemaName of Object.keys(componentSchemas)) {
    const ref = `#/components/schemas/${schemaName}`;
    nameToRef.set(resolveSchemaName(ref, context), ref);
  }

  // Expand to the transitive closure of component-schema refs reachable from
  // the initial roots. Without this, a generated schema could emit a sentinel
  // for a ref that's not in our entries → the rewriter would render a bare
  // identifier with no corresponding `export const`. Iterate until stable.
  const queue = [...refs];
  const seen = new Set<string>(refs);
  const entries: ReusableSchemaEntry[] = [];

  for (const ref of queue) {
    const schemaName = ref.slice('#/components/schemas/'.length);
    const schema = componentSchemas[schemaName];
    if (!schema) continue;

    const name = resolveSchemaName(ref, context);
    const scopedContext: ContextSpec = {
      ...context,
      dynamicScope: buildDynamicScope(
        schemaName,
        schema as OpenApiSchemaObject,
        context,
      ),
    };

    const definition = generateZodValidationSchemaDefinition(
      schema,
      scopedContext,
      name,
      options.strict,
      options.isZodV4,
      {
        required: true,
        useReusableSchemas: true,
        emitMeta: options.generateMeta,
      },
    );

    const parsed = parseZodValidationSchemaDefinition(
      definition,
      scopedContext,
      options.coerce ?? false,
      options.strict,
      options.isZodV4,
      undefined,
      options.paramsMutator
        ? {
            mutator: options.paramsMutator,
            operationId: '',
            location: 'schema',
            schemaName: name,
          }
        : undefined,
      options.variant,
    );

    entries.push({
      ref,
      name,
      zod: parsed.zod,
      consts: parsed.consts,
      usedRefs: parsed.usedRefs,
      variant: options.variant,
    });

    for (const usedName of parsed.usedRefs) {
      const usedRef = nameToRef.get(usedName);
      if (usedRef !== undefined && !seen.has(usedRef)) {
        seen.add(usedRef);
        queue.push(usedRef);
      }
    }
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
interface TarjanResult {
  /**
   * SCCs in reverse topological order (deepest first). Within an SCC the
   * nodes are in REVERSE DFS finish order — emit in this order and every
   * non-lazy edge points to an already-emitted node, avoiding TDZ.
   */
  sccs: string[][];
  /** Back-edges discovered during DFS, keyed as "from->to". Plus self-loops. */
  lazyEdges: Set<string>;
}

const tarjan = (graph: Graph): TarjanResult => {
  let index = 0;
  const stack: string[] = [];
  const onStack = new Set<string>();
  const indices = new Map<string, number>();
  const lowlinks = new Map<string, number>();
  const sccs: string[][] = [];
  const lazyEdges = new Set<string>();

  const strongconnect = (v: string): void => {
    indices.set(v, index);
    lowlinks.set(v, index);
    index += 1;
    stack.push(v);
    onStack.add(v);

    const neighbors = graph.get(v) ?? new Set<string>();
    for (const w of neighbors) {
      if (v === w) {
        // Self-loop: always lazy.
        lazyEdges.add(edgeKey(v, w));
        continue;
      }
      if (!indices.has(w)) {
        strongconnect(w);
        lowlinks.set(v, Math.min(lowlinks.get(v) ?? -1, lowlinks.get(w) ?? -1));
      } else if (onStack.has(w)) {
        // Back-edge: w is an ancestor in the DFS tree. v and w belong to
        // the same SCC and the edge v→w closes a cycle — emit it lazy so
        // the runtime initializer doesn't read w in its TDZ.
        lazyEdges.add(edgeKey(v, w));
        lowlinks.set(v, Math.min(lowlinks.get(v) ?? -1, indices.get(w) ?? -1));
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

  return { sccs, lazyEdges };
};

/**
 * Returns the set of lazy-emission edge keys ("from->to") for `graph`. Back-edges
 * (edges from a node to an ancestor in the DFS tree) and self-loops are lazy.
 * Cross-SCC edges and tree/forward edges within an SCC are not lazy.
 */
export const computeLazyEdges = (graph: Graph): Set<string> =>
  tarjan(graph).lazyEdges;

const SENTINEL_PATTERN = /__REF_([A-Za-z_$][A-Za-z0-9_$]*)__/g;

/**
 * Replace every `__REF_<name>__` sentinel with the bare identifier. Use this
 * for schemas that sit at the top of the dependency graph (operation params,
 * bodies, responses) — they can never participate in a cycle with the
 * component schemas they reference, so every ref is a direct (non-lazy) one.
 */
export const rewriteSentinelsToDirect = (zod: string): string =>
  zod.replaceAll(SENTINEL_PATTERN, (_match, refName: string) => refName);

/**
 * Replace every `__REF_<name>__` sentinel with either the bare identifier or
 * `zod.lazy(() => <name>)` based on whether the edge closes a cycle, then
 * reorder entries so that every non-lazy reference is emitted AFTER its
 * target. This avoids TDZ errors at module load.
 *
 * Entries that sit in a cycle (SCC of size > 1, or a self-loop) are flagged
 * `isRecursive`. Their generated `const` reads its own binding inside the
 * initializer (through the `zod.lazy` wrapper), which TypeScript rejects with
 * TS7022 ("'X' implicitly has type 'any' ... referenced directly or indirectly
 * in its own initializer") unless the `const` carries an explicit type
 * annotation. The writer (`write-zod-specs`) supplies that annotation —
 * `const X: zod.ZodType<X>` — backed by a generated TS type, which both
 * silences TS7022 and preserves full `z.infer` typing through the recursion.
 *
 * Both the lazy classification and the emit order come from a single Tarjan
 * run, guaranteeing they agree: a non-lazy edge u→v means v is visited (and
 * popped) before u in DFS, so v appears earlier in the SCC array → emitted
 * before u → safe.
 */
export const rewriteReusableSchemas = (
  entries: readonly ReusableSchemaEntry[],
): ReusableSchemaEntry[] => {
  const graph = new Map<string, Set<string>>(
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

  const { sccs, lazyEdges } = tarjan(graph);

  // A node is recursive iff it sits in a cycle: either an SCC with more than
  // one member (mutual recursion), or a single-node SCC that has a self-loop.
  const recursiveNames = new Set<string>();
  for (const scc of sccs) {
    if (scc.length > 1) {
      for (const name of scc) recursiveNames.add(name);
    } else if (lazyEdges.has(edgeKey(scc[0], scc[0]))) {
      recursiveNames.add(scc[0]);
    }
  }

  const rewritten = new Map(
    entries.map((entry) => {
      const newZod = entry.zod.replaceAll(
        SENTINEL_PATTERN,
        (_match, refName: string) => {
          const isLazy = lazyEdges.has(edgeKey(entry.name, refName));
          return isLazy
            ? `${entry.variant === 'mini' ? '/*#__PURE__*/ ' : ''}zod.lazy(() => ${refName})`
            : refName;
        },
      );
      return [
        entry.name,
        { ...entry, zod: newZod, isRecursive: recursiveNames.has(entry.name) },
      ] as const;
    }),
  );

  // Tarjan returns SCCs in reverse topological order (deepest first) and
  // within each SCC the nodes are popped in REVERSE DFS-finish order — i.e.
  // descendants first, SCC root last. That's exactly the order we want to
  // emit: every non-lazy edge points to an already-emitted node.
  const out: ReusableSchemaEntry[] = [];
  for (const scc of sccs) {
    for (const name of scc) {
      const entry = rewritten.get(name);
      if (entry !== undefined) out.push(entry);
    }
  }
  return out;
};
