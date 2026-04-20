import type {
  InputFiltersOptions,
  NormalizedInputOptions,
  OpenApiDocument,
  OpenApiOperationObject,
  OpenApiPathItemObject,
} from '../types';

export function filteredVerbs(
  verbs: OpenApiPathItemObject,
  filters: NormalizedInputOptions['filters'],
) {
  if (filters?.tags === undefined) {
    return Object.entries(verbs);
  }

  const filterTags = filters.tags;
  const filterMode = filters.mode ?? 'include';

  return Object.entries(verbs).filter(
    ([, operation]: [string, OpenApiOperationObject]) => {
      // Bridge assertion: operation.tags is `any` due to AnyOtherAttribute
      const operationTags = (operation.tags ?? []) as string[];

      const isMatch = operationTags.some((tag) =>
        filterTags.some((filterTag) =>
          filterTag instanceof RegExp ? filterTag.test(tag) : filterTag === tag,
        ),
      );

      return filterMode === 'exclude' ? !isMatch : isMatch;
    },
  );
}

function findRefs(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap((item) => findRefs(item));

  const obj = value as Record<string, unknown>;

  if (typeof obj.$ref === 'string') return [obj.$ref];

  return Object.values(obj).flatMap((val) => findRefs(val));
}

function getSchemaNames(refs: string[], schemaNames: string[]): string[] {
  return refs
    .map((ref) => ref.split('/').at(-1) ?? '')
    .filter((name) => schemaNames.includes(name));
}

function resolveReferencedSchemas(
  refs: string[],
  spec: OpenApiDocument,
  resolved: string[],
): string[] {
  const specSchemas = spec.components?.schemas ?? {};
  const schemaNames = Object.keys(specSchemas);
  const newNames = getSchemaNames(refs, schemaNames).filter(
    (name) => !resolved.includes(name),
  );

  if (newNames.length === 0) return resolved;

  const nextRefs = newNames.flatMap((name) => findRefs(specSchemas[name]));

  return resolveReferencedSchemas(nextRefs, spec, [...resolved, ...newNames]);
}

export const collectReferencedSchemas = (
  spec: OpenApiDocument,
  tags: (string | RegExp)[],
  mode: InputFiltersOptions['mode'],
): string[] => {
  const filters = { tags, mode };
  const operations = Object.values(spec.paths ?? {}).flatMap((pathItem) =>
    pathItem
      ? filteredVerbs(pathItem, filters).map(
          ([, operation]) => operation as unknown,
        )
      : [],
  );
  const refs = operations.flatMap((op) => findRefs(op));

  return resolveReferencedSchemas(refs, spec, []);
};
