import type {
  ContextSpec,
  InputFiltersOptions,
  NormalizedInputOptions,
  OpenApiDocument,
  OpenApiOperationObject,
  OpenApiPathItemObject,
} from '../types';
import { isReference } from '../utils/assertion';
import { resolveRef } from '../resolvers/ref';
import { isString } from 'remeda';

const COMPONENT_TYPES = [
  'schemas',
  'responses',
  'parameters',
  'requestBodies',
] as const;

type ComponentType = (typeof COMPONENT_TYPES)[number];

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

  const refs: string[] = [];
  if (typeof obj.$ref === 'string') {
    refs.push(obj.$ref);
  }
  return refs.concat(Object.values(obj).flatMap((val) => findRefs(val)));
}

function parseComponentRef(
  ref: string,
): { type: ComponentType; name: string } | undefined {
  const parts = ref.split('/');

  if (parts[0] !== '#' || parts[1] !== 'components' || parts.length < 4) {
    return undefined;
  }

  const type = parts[2];
  const name = parts[3];

  if (!COMPONENT_TYPES.includes(type as ComponentType)) {
    return undefined;
  }

  return { type: type as ComponentType, name };
}

function getComponentNames(
  refs: string[],
  spec: OpenApiDocument,
): { type: ComponentType; name: string }[] {
  return refs
    .map((ref) => parseComponentRef(ref))
    .filter(
      (parsed): parsed is { type: ComponentType; name: string } =>
        !!parsed && !!spec.components?.[parsed.type]?.[parsed.name],
    );
}

function resolveReferencedComponents(
  refs: string[],
  spec: OpenApiDocument,
  resolved: Record<ComponentType, string[]>,
): Record<ComponentType, string[]> {
  const newComponents = getComponentNames(refs, spec).filter(
    ({ type, name }) => !resolved[type].includes(name),
  );

  if (newComponents.length === 0) return resolved;

  const nextResolved: Record<ComponentType, string[]> = {
    schemas: [...resolved.schemas],
    responses: [...resolved.responses],
    parameters: [...resolved.parameters],
    requestBodies: [...resolved.requestBodies],
  };

  for (const { type, name } of newComponents) {
    nextResolved[type].push(name);
  }

  const nextRefs = newComponents.flatMap(({ type, name }) =>
    findRefs(spec.components?.[type]?.[name]),
  );

  return resolveReferencedComponents(nextRefs, spec, nextResolved);
}

export const collectReferencedComponents = (
  spec: OpenApiDocument,
  tags: (string | RegExp)[],
  mode: InputFiltersOptions['mode'],
): Record<ComponentType, string[]> => {
  const filters = { tags, mode };
  const refs = Object.values(spec.paths ?? {})
    .filter((pathItem): pathItem is OpenApiPathItemObject => !!pathItem)
    .flatMap((pathItem) => {
      const verbs = filteredVerbs(pathItem, filters);
      return [
        ...verbs.flatMap(([, operation]) => findRefs(operation)),
        ...findRefs(pathItem.parameters),
      ];
    });

  return resolveReferencedComponents(refs, spec, {
    schemas: [],
    responses: [],
    parameters: [],
    requestBodies: [],
  });
};

/**
 * Prune operations that do not reference any of the kept schemas, so only
 * artifacts related to the requested schemas are generated (#3689).
 *
 * An operation is kept when at least one of its (transitively resolved)
 * component references points at a schema matching the include/exclude
 * filters. Operations without any schema references cannot be attributed to
 * the filter and are kept as-is.
 */
export function filterPathsBySchemas(
  spec: OpenApiDocument,
  schemas: NonNullable<InputFiltersOptions['schemas']>,
  mode: InputFiltersOptions['mode'] = 'include',
): OpenApiDocument {
  const keepSchemaName = (name: string): boolean => {
    const isMatch = schemas.some((filter) => {
      if (isString(filter)) return filter === name;
      // Reset lastIndex so stateful flags (`g`, `y`) cannot leak between
      // operations and wrongly reject a schema that matches.
      filter.lastIndex = 0;
      return filter.test(name);
    });
    return mode === 'exclude' ? !isMatch : isMatch;
  };

  const schemasOfRefs = (
    refs: string[],
    visited: Set<string> = new Set(),
  ): { type: ComponentType; name: string }[] => {
    const components = getComponentNames(refs, spec).filter(
      ({ type, name }) => !visited.has(`${type}/${name}`),
    );
    components.forEach(({ type, name }) => visited.add(`${type}/${name}`));

    return components.flatMap(({ type, name }) => {
      if (type === 'schemas') return [{ type, name }];
      // Resolve transitive schema references through other component
      // sections (responses, requestBodies, parameters).
      return schemasOfRefs(
        findRefs(spec.components?.[type]?.[name]),
        new Set(visited),
      );
    });
  };

  return {
    ...spec,
    paths: Object.fromEntries(
      Object.entries(spec.paths ?? {})
        .map(([pathRoute, pathItem]) => {
          if (!pathItem || typeof pathItem !== 'object') {
            return [pathRoute, pathItem] as const;
          }

          const resolvedPathItem = isReference(pathItem)
            ? resolveRef<OpenApiPathItemObject>(pathItem, {
                spec,
              } as unknown as ContextSpec).schema
            : pathItem;

          const httpMethods = new Set([
            'get',
            'put',
            'post',
            'delete',
            'options',
            'head',
            'patch',
            'trace',
          ]);

          const keptVerbs: Record<string, unknown> = {};
          const pathMetadata: Record<string, unknown> = {};
          for (const [key, operation] of Object.entries(resolvedPathItem)) {
            if (!httpMethods.has(key.toLowerCase())) {
              // Path-item metadata (summary, description, parameters,
              // servers, ...) is preserved as-is.
              pathMetadata[key] = operation;
              continue;
            }
            if (
              !operation ||
              typeof operation !== 'object' ||
              isReference(operation)
            ) {
              keptVerbs[key] = operation;
              continue;
            }
            const referencedSchemas = schemasOfRefs([
              ...findRefs(operation),
              ...findRefs(resolvedPathItem.parameters),
            ])
              .filter((c) => c.type === 'schemas')
              .map((c) => c.name);
            if (
              referencedSchemas.length === 0 ||
              referencedSchemas.some(keepSchemaName)
            ) {
              keptVerbs[key] = operation;
            }
          }

          if (Object.keys(keptVerbs).length === 0) {
            return [pathRoute, undefined] as const;
          }

          return [pathRoute, { ...pathMetadata, ...keptVerbs }] as const;
        })
        .filter((entry): entry is [string, OpenApiPathItemObject] =>
          Boolean(entry[1]),
        ),
    ),
  };
}
