import type { MutationInvalidatesConfig } from '../types';
import { isString } from './assertion';
import { camel } from './case';

/** The query key function name an `invalidates` target resolves to. */
const queryKeyFnNameFor = (operationName: string) =>
  camel(`get-${operationName}-query-key`);

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
 *   name, which makes `GetNotes` and `getNotes` the same reference.
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
      const name = isString(target) ? target : target.query;
      if (!byQueryKeyFn.has(queryKeyFnNameFor(name))) {
        report('invalidates', name);
      }
    }
  }

  return warnings;
};
