import type {
  InputFiltersOptions,
  NormalizedInputOptions,
  OpenApiDocument,
  OpenApiOperationObject,
  OpenApiPathItemObject,
} from '../types';

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

  if (typeof obj.$ref === 'string') return [obj.$ref];

  return Object.values(obj).flatMap((val) => findRefs(val));
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
