import { getRefInfo } from '../getters/ref';
import type { ContextSpec, OpenApiSchemaObject } from '../types';
import { toComponentRef } from './refs';

/** What names a library's constants: its own name and the globals they avoid. */
export interface ComponentNameOptions {
  library: string;
  // Globals the generated code calls, which a constant must not shadow.
  reserved: ReadonlySet<string>;
}

/** The identifier a component's constant is declared and referenced by. */
export const resolveComponentName = (
  ref: string,
  context: ContextSpec,
  reserved: ReadonlySet<string>,
): string => {
  const { name } = getRefInfo(ref, context);
  return reserved.has(name) ? `${name}Schema` : name;
};

// Names depend on the spec, the library and the component naming options, so
// a spec reused with other options gets its own entry.
const namesCache = new WeakMap<
  object,
  Map<string, ReadonlyMap<string, string>>
>();

const namingSignature = (
  context: ContextSpec,
  { library }: ComponentNameOptions,
): string => {
  const { prefix, suffix } = context.output.override.components.schemas;
  return JSON.stringify([library, prefix, suffix]);
};

const resolveNames = (
  context: ContextSpec,
  options: ComponentNameOptions,
): Map<string, string> => {
  const components: Record<string, OpenApiSchemaObject> =
    context.spec.components?.schemas ?? {};
  const names = new Map<string, string>();
  const owners = new Map<string, string>();
  for (const key of Object.keys(components)) {
    const ref = toComponentRef(key);
    const name = resolveComponentName(ref, context, options.reserved);
    const owner = owners.get(name);
    if (owner !== undefined) {
      throw new Error(
        `[orval/${options.library}] generateReusableSchemas: refs ${owner} and ${ref} both resolve to the export name "${name}". Rename one in the OpenAPI source.`,
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
  options: ComponentNameOptions,
): ReadonlyMap<string, string> => {
  const bySignature =
    namesCache.get(context.spec) ??
    new Map<string, ReadonlyMap<string, string>>();
  namesCache.set(context.spec, bySignature);
  const signature = namingSignature(context, options);
  const cached = bySignature.get(signature);
  if (cached) return cached;
  const names = resolveNames(context, options);
  bySignature.set(signature, names);
  return names;
};

const withSuffix = (baseName: string, attempt: number): string => {
  if (attempt === 0) return baseName;
  return attempt === 1
    ? `${baseName}Schema`
    : `${baseName}Schema${attempt - 1}`;
};

/** A name no component or earlier constant uses; it is added to `taken`. */
export const allocateConstName = (
  baseName: string,
  taken: Set<string>,
): string => {
  let attempt = 0;
  while (taken.has(withSuffix(baseName, attempt))) attempt += 1;
  const name = withSuffix(baseName, attempt);
  taken.add(name);
  return name;
};

/**
 * `<name><suffix>` for each name, numbered when a taken name or an earlier
 * derived one already has it.
 */
export const allocateDerivedNames = (
  names: Iterable<string>,
  taken: ReadonlySet<string>,
  suffix: string,
): Map<string, string> => {
  const used = new Set(taken);
  const derived = new Map<string, string>();
  for (const name of names) {
    let candidate = `${name}${suffix}`;
    for (let count = 2; used.has(candidate); count++) {
      candidate = `${name}${suffix}${count}`;
    }
    used.add(candidate);
    derived.set(name, candidate);
  }
  return derived;
};
