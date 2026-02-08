import {
  getDefaultContentType,
  isBoolean,
  pascal,
  type ResReqTypesValue,
  sanitize,
  type Verbs,
} from '@orval/core';

import {
  HTTP_CLIENT_OPTIONS_TEMPLATE,
  THIRD_PARAMETER_TEMPLATE,
} from './types';

export type ClientOverride = 'httpClient' | 'httpResource' | 'both';

export const generateAngularTitle = (title: string) => {
  const sanTitle = sanitize(title);
  return `${pascal(sanTitle)}Service`;
};

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
}: {
  title: string;
  isRequestOptions: boolean;
  isMutator: boolean;
  isGlobalMutator: boolean;
  provideIn: string | boolean | undefined;
}): string => {
  const provideInValue = provideIn
    ? `{ providedIn: '${isBoolean(provideIn) ? 'root' : provideIn}' }`
    : '';

  return `
${isRequestOptions && !isGlobalMutator ? HTTP_CLIENT_OPTIONS_TEMPLATE : ''}

${isRequestOptions && isMutator ? THIRD_PARAMETER_TEMPLATE : ''}

@Injectable(${provideInValue})
export class ${title} {
  private readonly http = inject(HttpClient);
`;
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

export const createReturnTypesRegistry = () => {
  const returnTypesToWrite = new Map<string, string>();

  return {
    reset() {
      returnTypesToWrite.clear();
    },
    set(operationName: string, typeDefinition: string) {
      returnTypesToWrite.set(operationName, typeDefinition);
    },
    getFooter(operationNames: string[]) {
      const collected: string[] = [];
      for (const operationName of operationNames) {
        const value = returnTypesToWrite.get(operationName);
        if (value) {
          collected.push(value);
        }
      }
      return collected.join('\n');
    },
  };
};

/**
 * Determines whether an operation should be generated as an `httpResource()`
 * (retrieval) or as an `HttpClient` method in a service class (mutation).
 *
 * Resolution order:
 * 1. **Per-operation override** — `override.operations.<operationId>.angular.client`
 *    in the orval config. `httpResource` forces retrieval, `httpClient` forces mutation.
 * 2. **HTTP verb** — `GET` is always a retrieval.
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
 *     myPostSearch: { angular: { client: 'httpResource' } },
 *     getOrCreateUser: { angular: { client: 'httpClient' } },
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

  // GET is always a retrieval
  if (verb === 'get') return true;

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

export function getDefaultSuccessType(
  successTypes: ResReqTypesValue[],
  fallback: string,
) {
  const uniqueContentTypes = [
    ...new Set(successTypes.map((t) => t.contentType).filter(Boolean)),
  ];
  const jsonContentType = uniqueContentTypes.find((contentType) =>
    contentType.includes('json'),
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
