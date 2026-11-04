import type {
  OpenApiDocument,
  OpenApiNonBooleanSchemaObject,
} from '../../types';
import type { DereferenceOptions } from './types';

/**
 * An expansion of one `$ref`, with the refs it met and which of them were
 * already being expanded by the ancestors when it was computed.
 */
export interface CachedExpansion {
  value: OpenApiNonBooleanSchemaObject;
  refs: ReadonlySet<string>;
  cutByAncestors: readonly string[];
}

type ExpansionCache = Map<string, CachedExpansion[]>;

// Keyed by document and options identity so entries die with the document and
// consumers with different options never share results.
const caches = new WeakMap<
  OpenApiDocument,
  WeakMap<DereferenceOptions, ExpansionCache>
>();

const cachesByOptions = (
  spec: OpenApiDocument,
): WeakMap<DereferenceOptions, ExpansionCache> => {
  const existing = caches.get(spec);
  if (existing) return existing;
  const created = new WeakMap<DereferenceOptions, ExpansionCache>();
  caches.set(spec, created);
  return created;
};

const getExpansionCache = (
  spec: OpenApiDocument,
  options: DereferenceOptions,
): ExpansionCache => {
  const byOptions = cachesByOptions(spec);
  const existing = byOptions.get(options);
  if (existing) return existing;
  const created: ExpansionCache = new Map();
  byOptions.set(options, created);
  return created;
};

/** The refs among `refs` that the ancestor chain is already expanding. */
export const ancestorsAmong = (
  refs: ReadonlySet<string>,
  parents: readonly string[],
): string[] => parents.filter((parent) => refs.has(parent));

const sameRefs = (left: readonly string[], right: readonly string[]) =>
  left.every((ref) => right.includes(ref)) &&
  right.every((ref) => left.includes(ref));

/** A cached expansion of `ref` whose cuts match what `parents` would cut. */
export const findExpansion = (
  spec: OpenApiDocument,
  options: DereferenceOptions,
  ref: string,
  parents: readonly string[],
): CachedExpansion | undefined =>
  getExpansionCache(spec, options)
    .get(ref)
    ?.find((entry) =>
      sameRefs(ancestorsAmong(entry.refs, parents), entry.cutByAncestors),
    );

export const storeExpansion = (
  spec: OpenApiDocument,
  options: DereferenceOptions,
  ref: string,
  entry: CachedExpansion,
): void => {
  const cache = getExpansionCache(spec, options);
  const entries = cache.get(ref);
  if (entries) entries.push(entry);
  else cache.set(ref, [entry]);
};
