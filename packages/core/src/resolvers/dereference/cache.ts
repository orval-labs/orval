import type {
  OpenApiDocument,
  OpenApiNonBooleanSchemaObject,
} from '../../types';
import type { DereferenceOptions, RefSet } from './types';

/**
 * An expansion of one `$ref`, with the refs it met and which of them were
 * already being expanded by the ancestors when it was computed.
 */
export interface CachedExpansion {
  value: OpenApiNonBooleanSchemaObject;
  refs: RefSet;
  cut: readonly number[];
  cutSet: RefSet;
}

// Variants of one ref differ by which of its refs the ancestors cut, so a
// densely connected graph can produce one per ancestor set. Past this many a
// ref is expanded again instead of stored, which keeps lookups cheap.
export const MAX_VARIANTS_PER_REF = 8;

/** Expansions per ref, plus the ids the refs of this document are numbered with. */
export interface ExpansionCache {
  entries: Map<string, CachedExpansion[]>;
  ids: Map<string, number>;
  singles: RefSet[];
}

export const createExpansionCache = (): ExpansionCache => ({
  entries: new Map(),
  ids: new Map(),
  singles: [],
});

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

export const getExpansionCache = (
  spec: OpenApiDocument,
  options: DereferenceOptions,
): ExpansionCache => {
  const byOptions = cachesByOptions(spec);
  const existing = byOptions.get(options);
  if (existing) return existing;
  const created = createExpansionCache();
  byOptions.set(options, created);
  return created;
};

export const NO_REFS: RefSet = new Uint32Array(0);

const internRef = (cache: ExpansionCache, ref: string): number => {
  const existing = cache.ids.get(ref);
  if (existing !== undefined) return existing;
  const id = cache.ids.size;
  cache.ids.set(ref, id);
  return id;
};

const hasId = (refs: RefSet, id: number): boolean =>
  ((refs[id >>> 5] ?? 0) & (1 << (id & 31))) !== 0;

/** The set holding only `ref`; shared, so it must not be mutated. */
export const singleRef = (cache: ExpansionCache, ref: string): RefSet => {
  const id = internRef(cache, ref);
  const existing = cache.singles[id] as RefSet | undefined;
  if (existing) return existing;
  const created = new Uint32Array((id >>> 5) + 1);
  created[id >>> 5] = 1 << (id & 31);
  cache.singles[id] = created;
  return created;
};

/**
 * The union of all parts plus `ownRef`. Returns a part itself when nothing is
 * added to it. `cost` receives the number of words written.
 */
export const unionRefs = (
  cache: ExpansionCache,
  parts: readonly RefSet[],
  ownRef: string | undefined,
  cost: (words: number) => void,
): RefSet => {
  const ownId = ownRef === undefined ? -1 : internRef(cache, ownRef);
  let widest: RefSet = NO_REFS;
  let nonEmpty = 0;
  for (const part of parts) {
    if (part.length === 0) continue;
    nonEmpty++;
    if (part.length > widest.length) widest = part;
  }
  if (nonEmpty === 0)
    return ownRef === undefined ? NO_REFS : singleRef(cache, ownRef);
  if (nonEmpty === 1 && (ownId === -1 || hasId(widest, ownId))) return widest;

  const length = Math.max(widest.length, (ownId >>> 5) + 1);
  const merged = new Uint32Array(length);
  for (const part of parts) {
    for (let word = 0; word < part.length; word++) merged[word] |= part[word];
  }
  if (ownId !== -1) merged[ownId >>> 5] |= 1 << (ownId & 31);
  cost(length * nonEmpty);
  return merged;
};

/** Ids of the parents the cache has seen; others are in no expansion. */
const knownIds = (
  cache: ExpansionCache,
  parents: readonly string[],
): number[] => {
  const found: number[] = [];
  for (const parent of parents) {
    const id = cache.ids.get(parent);
    if (id !== undefined) found.push(id);
  }
  return found;
};

const toSet = (ids: readonly number[]): RefSet => {
  const set = new Uint32Array(
    ids.length === 0 ? 0 : (Math.max(...ids) >>> 5) + 1,
  );
  for (const id of ids) set[id >>> 5] |= 1 << (id & 31);
  return set;
};

/** A cached expansion of `ref` whose cuts match what `parents` would cut. */
export const findExpansion = (
  cache: ExpansionCache,
  ref: string,
  parents: readonly string[],
): CachedExpansion | undefined => {
  const entries = cache.entries.get(ref);
  if (!entries) return undefined;
  const parentIds = knownIds(cache, parents);
  let parentSet: RefSet | undefined;
  return entries.find((entry) => {
    // Every ancestor the expansion met must have been cut back then...
    for (const id of parentIds) {
      if (hasId(entry.refs, id) && !hasId(entry.cutSet, id)) return false;
    }
    // ...and every ancestor cut back then must still be one.
    parentSet ??= toSet(parentIds);
    const present = parentSet;
    return entry.cut.every((id) => hasId(present, id));
  });
};

export const storeExpansion = (
  cache: ExpansionCache,
  ref: string,
  value: OpenApiNonBooleanSchemaObject,
  refs: RefSet,
  parents: readonly string[],
): void => {
  const entries = cache.entries.get(ref);
  if (entries && entries.length >= MAX_VARIANTS_PER_REF) return;
  const cut = [
    ...new Set(knownIds(cache, parents).filter((id) => hasId(refs, id))),
  ];
  const entry: CachedExpansion = { value, refs, cut, cutSet: toSet(cut) };
  if (entries) entries.push(entry);
  else cache.entries.set(ref, [entry]);
};
