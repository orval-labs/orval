import {
  type GeneratorVerbOptions,
  getAngularFilteredParamsHelperBody,
  getAngularObjectParamStrategies,
  getDefaultContentType,
  isBoolean,
  isObject,
  isOperationInTagBucket,
  type NormalizedOutputOptions,
  pascal,
  type ResReqTypesValue,
  sanitize,
  type Verbs,
} from '@orval/core';

import {
  HTTP_CLIENT_OBSERVE_OPTIONS_TEMPLATE,
  HTTP_CLIENT_OPTIONS_TEMPLATE,
  THIRD_PARAMETER_TEMPLATE,
} from './types';

export type ClientOverride = 'httpClient' | 'httpResource' | 'both';

const PRIMITIVE_TYPE_VALUES = [
  'string',
  'number',
  'boolean',
  'void',
  'unknown',
] as const;

export type PrimitiveType = (typeof PRIMITIVE_TYPE_VALUES)[number];

const PRIMITIVE_TYPE_LOOKUP = {
  string: true,
  number: true,
  boolean: true,
  void: true,
  unknown: true,
} as const satisfies Record<PrimitiveType, true>;

/**
 * Narrows a schema type string to the primitive set supported by the Angular
 * generators' query/header helpers.
 */
export const isPrimitiveType = (t: string | undefined): t is PrimitiveType =>
  t != undefined &&
  Object.prototype.hasOwnProperty.call(PRIMITIVE_TYPE_LOOKUP, t);

/**
 * Whether a content type is JSON, including `+json` suffixes such as
 * `application/problem+json` (`json` is a substring of both). Media type
 * names are case-insensitive (RFC 9110 §8.3.1), so `application/JSON` counts.
 */
export const isJsonContentType = (contentType: string): boolean =>
  contentType.toLowerCase().includes('json');

/**
 * Whether the emitted `accept` checks lowercase at runtime: only when the
 * operation declares a type or subtype with uppercase letters, so output for
 * lowercase specs stays unchanged. Parameters such as `charset=UTF-8` don't
 * count, because the checks never need them.
 */
const hasUppercaseMediaType = (contentTypes: string[]): boolean =>
  contentTypes.some((contentType) => {
    const baseType = contentType.split(';')[0];
    return baseType !== baseType.toLowerCase();
  });

/**
 * The expression the emitted `accept` checks test.
 */
export const getAcceptExpression = (contentTypes: string[]): string =>
  hasUppercaseMediaType(contentTypes) ? 'accept.toLowerCase()' : 'accept';

/**
 * The emitted `accept` check that routes to the JSON branch.
 */
export const buildAcceptJsonCondition = (contentTypes: string[]): string =>
  hasUppercaseMediaType(contentTypes)
    ? `accept.toLowerCase().includes('json')`
    : `accept.includes('json') || accept.includes('+json')`;

/**
 * The emitted `accept` check that routes to the text branch. It matches
 * `isTextContentType`, which types that branch.
 */
export const buildAcceptTextCondition = (contentTypes: string[]): string => {
  const accept = getAcceptExpression(contentTypes);
  return `${accept}.startsWith('text/') || ${accept}.includes('xml')`;
};

/**
 * Indicates whether the configured schema output target is Zod-based.
 */
export const isZodSchemaOutput = (output: NormalizedOutputOptions): boolean =>
  isObject(output.schemas) && output.schemas.type === 'zod';

/**
 * Maps a schema type name to its Zod output-type reference (`${typeName}Output`).
 */
export const getSchemaOutputTypeRef = (typeName: string): string =>
  `${typeName}Output`;

/**
 * Converts an operation/tag title into the generated Angular service class name.
 */
export const generateAngularTitle = (title: string) => {
  const sanTitle = sanitize(title);
  return `${pascal(sanTitle)}Service`;
};

/**
 * Whether a single operation has at least one gated object-serialization
 * strategy (issue #3705) to apply. Used to decide whether the shared
 * `filterParams` helper needs its object-serialization overload.
 */
export const hasGatedObjectQueryParamStrategies = (
  verbOption: GeneratorVerbOptions,
): boolean =>
  Object.keys(
    getAngularObjectParamStrategies({
      queryParams: verbOption.queryParams,
      paramsSerializer: verbOption.paramsSerializer,
      paramsFilter: verbOption.paramsFilter,
      queryObjectSerialization:
        verbOption.override.angular.queryObjectSerialization,
    }),
  ).length > 0;

/**
 * Builds the opening of an @Injectable Angular service class.
 * Shared between httpClient-only mode and the mutation section of httpResource mode.
 */
export const buildServiceClassOpen = ({
  title,
  isRequestOptions,
  isMutator,
  isGlobalMutator,
  provideIn,
  hasQueryParams,
  baseUrlFieldInitializer,
  hasObjectParams = false,
  acceptHelpers,
}: {
  title: string;
  isRequestOptions: boolean;
  isMutator: boolean;
  isGlobalMutator: boolean;
  provideIn: string | boolean | undefined;
  hasQueryParams: boolean;
  /**
   * When set, injected as an additional `private readonly baseUrl = ...;`
   * class field — used by `httpResource`-mode mutation-service classes to
   * pick up the same base-URL DI token as their sibling `HttpClient` output.
   */
  baseUrlFieldInitializer?: string;
  /**
   * Whether the emitted helper needs the object-serialization overload
   * (issue #3705). Only meaningful when `hasQueryParams` is `true`.
   */
  hasObjectParams?: boolean;
  /** Emitted verbatim before the class; callers add their own trailing blank line. */
  acceptHelpers?: string;
}): string => {
  const provideInValue = provideIn
    ? `{ providedIn: '${isBoolean(provideIn) ? 'root' : provideIn}' }`
    : '';

  return `
${
  isRequestOptions && !isGlobalMutator
    ? `${HTTP_CLIENT_OPTIONS_TEMPLATE}

${HTTP_CLIENT_OBSERVE_OPTIONS_TEMPLATE}

${hasQueryParams ? getAngularFilteredParamsHelperBody({ hasObjectParams }) : ''}`
    : ''
}

${isRequestOptions && isMutator ? THIRD_PARAMETER_TEMPLATE : ''}

${acceptHelpers ?? ''}@Injectable(${provideInValue})
export class ${title} {
  private readonly http = inject(HttpClient);
${baseUrlFieldInitializer ? `  ${baseUrlFieldInitializer}\n` : ''}`;
};

/**
 * Registry that maps operationName → full route (with baseUrl).
 *
 * Populated during client builder calls (which receive the full route via
 * GeneratorOptions.route) and read during header/footer builder calls
 * (which only receive verbOptions without routes).
 *
 * This avoids monkey-patching verbOptions with a non-standard `fullRoute` property.
 */
export const createRouteRegistry = () => {
  const routes = new Map<string, string>();

  return {
    reset() {
      routes.clear();
    },
    set(operationName: string, route: string) {
      routes.set(operationName, route);
    },
    get(operationName: string, fallback: string): string {
      return routes.get(operationName) ?? fallback;
    },
  };
};
/**
 * Returns only the operations that belong to the current tag output.
 *
 * Tag matching is delegated to {@link isOperationInTagBucket}, the single source
 * of truth for tag-bucket identity. Untagged operations resolve to the implicit
 * `default` bucket, matching how the core writer routes them in
 * `tags` / `tags-split` mode.
 */
export const getRelevantVerbOptionsForTag = (
  verbOptions: Record<string, GeneratorVerbOptions>,
  tag?: string,
): GeneratorVerbOptions[] => {
  const allVerbOptions = Object.values(verbOptions);
  // Only an absent tag means "no filter"; an empty/whitespace tag is a real
  // bucket key that `isOperationInTagBucket` normalises to `default`, matching
  // the core writer instead of silently matching every operation.
  if (tag == null) return allVerbOptions;

  return allVerbOptions.filter((verbOption) =>
    isOperationInTagBucket(verbOption, tag),
  );
};

/**
 * Determines whether an operation should be generated as an `httpResource()`
 * (retrieval) or as an `HttpClient` method in a service class (mutation).
 *
 * Resolution order:
 * 1. **Per-operation override** — `override.operations.<operationId>.angular.client`
 *    in the orval config. `httpResource` forces retrieval, `httpClient` forces mutation.
 * 2. **HTTP verb** — absent a per-operation override, `GET` is treated as a retrieval.
 * 3. **Name heuristic** — For `POST`, if the operationName starts with a
 *    retrieval-like prefix (search, list, find, query, get, fetch, lookup)
 *    it is treated as a retrieval. This handles common patterns like
 *    `POST /search` or `POST /graphql` with query-style operation names.
 *
 * If the heuristic misclassifies an operation, users can override it
 * per-operation in their orval config:
 *
 * ```ts
 * override: {
 *   operations: {
 *     myPostSearch: { angular: { retrievalClient: 'httpResource' } },
 *     getOrCreateUser: { angular: { retrievalClient: 'httpClient' } },
 *   }
 * }
 * ```
 */
export function isRetrievalVerb(
  verb: Verbs,
  operationName?: string,
  clientOverride?: ClientOverride,
): boolean {
  // Per-operation override takes precedence
  if (clientOverride === 'httpResource') return true;
  if (clientOverride === 'httpClient') return false;

  // Absent a per-operation override, safe retrieval verbs stay in httpResource.
  if (verb === 'get' || verb === 'query') return true;

  // POST with a retrieval-like operation name
  if (verb === 'post' && operationName) {
    const lower = operationName.toLowerCase();
    return /^(search|list|find|query|get|fetch|lookup|filter)/.test(lower);
  }
  return false;
}

export function isMutationVerb(
  verb: Verbs,
  operationName?: string,
  clientOverride?: ClientOverride,
): boolean {
  return !isRetrievalVerb(verb, operationName, clientOverride);
}

/**
 * Selects the preferred success payload type for Angular `httpResource`
 * generation, favouring JSON responses and otherwise falling back to the
 * generator's default content-type rules.
 */
export function getDefaultSuccessType(
  successTypes: ResReqTypesValue[],
  fallback: string,
) {
  const uniqueContentTypes = [
    ...new Set(successTypes.map((t) => t.contentType).filter(Boolean)),
  ];
  const jsonContentType = uniqueContentTypes.find((contentType) =>
    isJsonContentType(contentType),
  );
  const defaultContentType =
    jsonContentType ??
    (uniqueContentTypes.length > 1
      ? getDefaultContentType(uniqueContentTypes)
      : (uniqueContentTypes[0] ?? 'application/json'));
  const defaultType = successTypes.find(
    (t) => t.contentType === defaultContentType,
  );

  return {
    contentType: defaultContentType,
    value: defaultType?.value ?? fallback,
  };
}
