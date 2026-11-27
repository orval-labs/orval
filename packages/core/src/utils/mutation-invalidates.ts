import {
  type GeneratorVerbOptions,
  type GetterParam,
  type InvalidateTarget,
  type MutationInvalidatesConfig,
  type MutationInvalidatesContext,
  type MutationInvalidatesFn,
  type MutationInvalidatesOperation,
  type MutationInvalidatesOption,
  type MutationInvalidatesQuery,
  type MutationInvalidatesRule,
  type NormalizedOutputOptions,
  OutputMode,
} from '../types';
import { isFunction, isString } from './assertion';
import { camel } from './case';
import { getOperationTagKey } from './tags';
import { getModuleImportExtension } from './tsconfig';

/** The query key function name an `invalidates` target resolves to. */
const queryKeyFnNameFor = (operationName: string) =>
  camel(`get-${operationName}-query-key`);

/**
 * The query key function name of an operation's infinite variant, shared by
 * its infinite and suspense-infinite queries. An `invalidates` target spelled
 * `<operation>Infinite` (or `<operation>_infinite`) folds to this same name, so
 * it is a working reference. See #4215.
 */
const infiniteQueryKeyFnNameFor = (operationName: string) =>
  camel(`get-${operationName}-infinite-query-key`);

/**
 * `mutationInvalidates` names operations as plain strings, and a name that
 * matches nothing is not an error anywhere downstream — the rule is simply
 * never applied, so the configured invalidation silently never runs. These
 * warnings close that gap. See #4166.
 *
 * The two fields do not resolve names the same way, and this mirrors each one
 * rather than inventing a third rule:
 *
 * - `onMutations` is compared with `===` against the generated operation name,
 *   so the raw `operationId` casing of the document (`PostNotes`) never
 *   matches `postNotes` and the whole rule is dead.
 * - `invalidates` is folded through `camel()` to build the query key function
 *   name, which makes `GetNotes` and `getNotes` the same reference. The
 *   infinite variant's key function (`getNotesInfinite`) resolves as well.
 *
 * A target with a `file` is imported from another module (typically another
 * output), so it cannot be checked against this output's operations and is
 * skipped. See #4341.
 *
 * Only existence is checked. A target that exists but was generated as a
 * mutation rather than a query emits a call to a `getXxxQueryKey` that was
 * never declared, which fails the consumer's build loudly; telling that apart
 * here would mean re-deriving the query package's notion of a query.
 */
export const getUnknownMutationInvalidatesWarnings = ({
  mutationInvalidates,
  operationNames,
}: {
  mutationInvalidates: MutationInvalidatesConfig | undefined;
  /** Generated operation names for this output, after any filtering. */
  operationNames: readonly string[];
}): string[] => {
  if (!mutationInvalidates?.length) return [];

  const generated = new Set(operationNames);
  // Keyed the way the emitted query key function name is built, so every
  // spelling that resolves to one function collapses to a single entry.
  const byQueryKeyFn = new Map(
    operationNames.map((name) => [queryKeyFnNameFor(name), name]),
  );
  // Every query key function an `invalidates` target can resolve to. Kept apart
  // from `byQueryKeyFn` so an `onMutations` suggestion only ever names a real
  // operation, never its infinite variant.
  const queryKeyFns = new Set([
    ...byQueryKeyFn.keys(),
    ...operationNames.map((name) => infiniteQueryKeyFnNameFor(name)),
  ]);

  const warnings: string[] = [];
  const reported = new Set<string>();

  const report = (field: 'onMutations' | 'invalidates', name: string) => {
    const key = `${field}:${name}`;
    if (reported.has(key)) return;
    reported.add(key);

    // A name that differs only in casing is the mistake this warning exists
    // for, so point at it. Nothing fuzzier is attempted: a wrong suggestion
    // costs more than none, and the message already names the bad value.
    const suggestion = byQueryKeyFn.get(queryKeyFnNameFor(name));

    warnings.push(
      `mutationInvalidates references an unknown operation '${name}' in ` +
        `${field}. No operation with that name is generated for this output, ` +
        `so the rule is ignored` +
        (suggestion && suggestion !== name
          ? ` — did you mean '${suggestion}'?`
          : '.'),
    );
  };

  for (const rule of mutationInvalidates) {
    for (const name of rule.onMutations) {
      if (!generated.has(name)) report('onMutations', name);
    }

    for (const target of rule.invalidates) {
      if (!isString(target) && target.file) continue;

      const name = isString(target) ? target : target.query;
      if (!queryKeyFns.has(queryKeyFnNameFor(name))) {
        report('invalidates', name);
      }
    }
  }

  return warnings;
};

type InvalidatesVerbOptions = Pick<
  GeneratorVerbOptions,
  'verb' | 'pathRoute' | 'tags' | 'operationId' | 'operationName'
> & { params: readonly Pick<GetterParam, 'name'>[] };

const toInvalidatesOperation = ({
  operationId,
  operationName,
  verb,
  pathRoute,
  params,
  tags,
}: InvalidatesVerbOptions): MutationInvalidatesOperation => ({
  operationId,
  operationName,
  verb,
  path: pathRoute,
  pathParams: params.map(({ name }) => name),
  tags: [...tags],
});

export type MutationInvalidatesOperationKind =
  | 'mutation'
  | { plainKey: boolean; infiniteKey: boolean }
  | undefined;

export const getMutationInvalidatesContext = <T extends InvalidatesVerbOptions>(
  verbOptions: readonly T[],
  kindOf: (verbOption: T) => MutationInvalidatesOperationKind,
): MutationInvalidatesContext => {
  const mutations: MutationInvalidatesOperation[] = [];
  const queries: MutationInvalidatesQuery[] = [];

  for (const verbOption of verbOptions) {
    const kind = kindOf(verbOption);
    if (kind === 'mutation') {
      mutations.push(toInvalidatesOperation(verbOption));
    } else if (kind) {
      const { operationName } = verbOption;
      queries.push({
        ...toInvalidatesOperation(verbOption),
        queryKeys: [
          ...(kind.plainKey ? [operationName] : []),
          ...(kind.infiniteKey ? [`${operationName}Infinite`] : []),
        ],
      });
    }
  }

  return { mutations, queries };
};

const copyContext = ({
  mutations,
  queries,
}: MutationInvalidatesContext): MutationInvalidatesContext => {
  const copy = <T extends MutationInvalidatesOperation>(operation: T): T => ({
    ...operation,
    pathParams: [...operation.pathParams],
    tags: [...operation.tags],
  });
  return {
    mutations: mutations.map(copy),
    queries: queries.map((query) => ({
      ...copy(query),
      queryKeys: [...query.queryKeys],
    })),
  };
};

const isTargetParam = (param: unknown) =>
  isString(param) ||
  (typeof param === 'object' &&
    param !== null &&
    isString((param as { literal?: unknown }).literal));

const isInvalidateTarget = (target: unknown) => {
  if (isString(target)) return true;
  if (typeof target !== 'object' || target === null) return false;

  const { query, params, file, invalidateMode } = target as Record<
    string,
    unknown
  >;
  const paramsValid =
    params === undefined ||
    (Array.isArray(params) && params.every((param) => isTargetParam(param))) ||
    (typeof params === 'object' &&
      params !== null &&
      !Array.isArray(params) &&
      Object.values(params).every((param) => isTargetParam(param)));
  return (
    isString(query) &&
    paramsValid &&
    (file === undefined || isString(file)) &&
    (invalidateMode === undefined ||
      invalidateMode === 'invalidate' ||
      invalidateMode === 'reset')
  );
};

const assertRules: (
  rules: unknown,
) => asserts rules is MutationInvalidatesConfig = (rules) => {
  if (rules instanceof Promise) {
    throw new TypeError(
      'mutationInvalidates function must be synchronous, got a Promise',
    );
  }
  if (!Array.isArray(rules)) {
    throw new TypeError(
      'mutationInvalidates function must return an array of rules, got ' +
        (rules === null ? 'null' : typeof rules),
    );
  }
  for (const [index, rule] of rules.entries()) {
    const { onMutations, invalidates } = (rule ?? {}) as Partial<
      Record<keyof MutationInvalidatesRule, unknown>
    >;
    if (
      !Array.isArray(onMutations) ||
      !onMutations.every((name) => isString(name)) ||
      !Array.isArray(invalidates) ||
      !invalidates.every((target) => isInvalidateTarget(target))
    ) {
      throw new TypeError(
        `mutationInvalidates function returned an invalid rule at index ${index}: ` +
          'expected { onMutations: string[], invalidates: (string | ' +
          '{ query: string, params?: array or record of string | { literal: string }, ' +
          "invalidateMode?: 'invalidate' | 'reset', file?: string })[] }",
      );
    }
  }
};

const combinedLevels = new WeakMap<
  MutationInvalidatesFn,
  readonly MutationInvalidatesOption[]
>();

/** Combines override levels the way `mergeDeep` concatenates two arrays. */
export const combineMutationInvalidates = (
  levels: readonly (MutationInvalidatesOption | undefined)[],
): MutationInvalidatesOption | undefined => {
  const defined = levels.filter((level) => level !== undefined);
  if (defined.length <= 1) return defined[0];
  if (!defined.some((level) => isFunction(level))) {
    return defined.flatMap((level) => level as MutationInvalidatesConfig);
  }

  const combined: MutationInvalidatesFn = (context) =>
    defined.flatMap(
      (level) => resolveMutationInvalidates(level, context) ?? [],
    );
  combinedLevels.set(combined, defined);
  return combined;
};

export const createMutationInvalidatesResolver = (
  context: () => MutationInvalidatesContext,
) => {
  const cache = new Map<
    MutationInvalidatesOption,
    MutationInvalidatesConfig | undefined
  >();

  const resolve = (
    option: MutationInvalidatesOption | undefined,
  ): MutationInvalidatesConfig | undefined => {
    if (!option) return undefined;
    if (cache.has(option)) return cache.get(option);

    if (!isFunction(option)) return option;

    const levels = combinedLevels.get(option);
    const rules = levels
      ? levels.flatMap((level) => resolve(level) ?? [])
      : resolveMutationInvalidates(option, context());
    cache.set(option, rules);
    return rules;
  };

  return resolve;
};

export const resolveMutationInvalidates = (
  option: MutationInvalidatesOption | undefined,
  context: MutationInvalidatesContext,
): MutationInvalidatesConfig | undefined => {
  if (!isFunction(option)) return option;

  const rules: unknown = option(copyContext(context));
  assertRules(rules);
  return rules;
};

/** Sets `file` for targets in another tag's file. Rules spanning several tags are split per tag. */
export const createMutationInvalidatesFileFiller = ({
  operations,
  output,
}: {
  operations: readonly Pick<
    MutationInvalidatesOperation,
    'operationName' | 'tags'
  >[];
  output: Pick<NormalizedOutputOptions, 'mode' | 'fileExtension' | 'tsconfig'>;
}): ((rules: MutationInvalidatesConfig) => MutationInvalidatesConfig) => {
  if (
    output.mode !== OutputMode.TAGS &&
    output.mode !== OutputMode.TAGS_SPLIT
  ) {
    return (rules) => rules;
  }

  // `tags-split` rebases `./<tag>` itself; `tags` writes the path as is.
  const importExtension =
    output.mode === OutputMode.TAGS
      ? getModuleImportExtension(output.fileExtension, output.tsconfig)
      : '';

  const tagByOperationName = new Map<string, string>();
  const tagByQueryKeyFn = new Map<string, string>();
  // Real operation names win over another operation's `Infinite` alias.
  for (const operation of operations) {
    const tag = getOperationTagKey(operation);
    tagByOperationName.set(operation.operationName, tag);
    tagByQueryKeyFn.set(
      infiniteQueryKeyFnNameFor(operation.operationName),
      tag,
    );
  }
  for (const operation of operations) {
    tagByQueryKeyFn.set(
      queryKeyFnNameFor(operation.operationName),
      getOperationTagKey(operation),
    );
  }

  const fillTarget = (
    target: InvalidateTarget,
    mutationTag: string,
  ): InvalidateTarget => {
    if (!isString(target) && target.file) return target;

    const query = isString(target) ? target : target.query;
    const queryTag = tagByQueryKeyFn.get(queryKeyFnNameFor(query));
    if (!queryTag || queryTag === mutationTag) return target;

    const file = `./${queryTag}${importExtension}`;
    return isString(target) ? { query, file } : { ...target, file };
  };

  const fillRule = (
    rule: MutationInvalidatesRule,
  ): MutationInvalidatesRule[] => {
    const mutationsByTag = new Map<string | undefined, string[]>();
    for (const name of rule.onMutations) {
      const tag = tagByOperationName.get(name);
      const names = mutationsByTag.get(tag);
      if (names) names.push(name);
      else mutationsByTag.set(tag, [name]);
    }

    return [...mutationsByTag].map(([tag, onMutations]) => ({
      onMutations,
      invalidates:
        tag === undefined
          ? rule.invalidates
          : rule.invalidates.map((target) => fillTarget(target, tag)),
    }));
  };

  const filledRules = new WeakMap<
    MutationInvalidatesRule,
    MutationInvalidatesRule[]
  >();
  const filledLists = new WeakMap<
    MutationInvalidatesConfig,
    MutationInvalidatesConfig
  >();

  return (rules) => {
    const cached = filledLists.get(rules);
    if (cached) return cached;

    const filled = rules.flatMap((rule) => {
      const known = filledRules.get(rule);
      if (known) return known;
      const result = fillRule(rule);
      filledRules.set(rule, result);
      return result;
    });
    filledLists.set(rules, filled);
    return filled;
  };
};

export const getMutationInvalidatesRules = (
  option: MutationInvalidatesOption | undefined,
): MutationInvalidatesConfig => {
  if (isFunction(option)) {
    throw new TypeError(
      'mutationInvalidates function was not resolved before generation',
    );
  }
  return option ?? [];
};
