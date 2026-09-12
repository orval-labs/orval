import {
  type GeneratorVerbOptions,
  getAngularFilteredParamsHelperBody,
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

export const PRIMITIVE_TYPES = new Set(PRIMITIVE_TYPE_VALUES);

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
 * Indicates whether the configured schema output target is Zod-based.
 */
export const isZodSchemaOutput = (output: NormalizedOutputOptions): boolean =>
  isObject(output.schemas) && output.schemas.type === 'zod';

/**
 * Removes `null` and `undefined` from a value in a type-safe way.
 */
export const isDefined = <T>(v: T | null | undefined): v is T => v != undefined;

/**
 * Maps a schema type name to its Zod output-type reference (`${typeName}Output`).
 */
export const getSchemaOutputTypeRef = (typeName: string): string =>
  `${typeName}Output`;

/**
 * How a validated array response is composed from its element schema.
 *
 * An inline `type: array` response resolves to the definition `Item[]`, and
 * every gate gets to Zod runtime validation by comparing that definition to the
 * response import names verbatim. `Item[]` never equals `Item`, so the whole
 * validation branch was skipped while a `$ref` to a *named* array component
 * validated normally (#3718). The element carries the generated schema; the
 * array wrapper is composed at the use site.
 */
export interface ArrayResponseSchema {
  /** Element schema name, e.g. `Item` — the import to promote to a value. */
  elementName: string;
  /** Expression to call `.parse` on, e.g. `zod.array(Item)`. */
  schemaRef: string;
  /** Declared type of the parsed value, e.g. `ItemOutput[]`. */
  outputTypeRef: string;
}

/** A definition that is exactly one `[]` level over a bare identifier. */
const ARRAY_DEFINITION_PATTERN = /^([A-Za-z_$][\w$]*)\[]$/;

/**
 * Resolves the array-response shape described by {@link ArrayResponseSchema},
 * or `undefined` when the definition is not a validatable array.
 *
 * Deliberately narrow. A primitive element (`string[]`) has no generated schema
 * to compose from, and a nested array (`Item[][]`) is left alone rather than
 * guessed at — both keep their current unvalidated output.
 *
 * @param toValueRef Maps the element name to the identifier its schema value is
 *   bound to at the call site (`Error` is emitted as `ErrorSchema`).
 */
export const getArrayResponseSchema = (
  imports: readonly { name: string }[],
  definition: string | undefined,
  toValueRef: (typeName: string) => string = (typeName) => typeName,
): ArrayResponseSchema | undefined => {
  if (definition === undefined) return undefined;

  const elementName = ARRAY_DEFINITION_PATTERN.exec(definition)?.[1];
  if (elementName === undefined || isPrimitiveType(elementName)) {
    return undefined;
  }
  if (!imports.some((imp) => imp.name === elementName)) return undefined;

  return {
    elementName,
    schemaRef: `zod.array(${toValueRef(elementName)})`,
    outputTypeRef: `${getSchemaOutputTypeRef(elementName)}[]`,
  };
};

/**
 * Module specifier for the `zod` namespace import that composed array
 * expressions reference. Mini ships its constructors from a separate entry
 * point, and only the functional `zod.array(...)` form exists there — which is
 * why the composed expression is built that way rather than as `Item.array()`.
 */
export const getZodNamespaceImportSource = (
  output: NormalizedOutputOptions,
): string => (output.override.zod.variant === 'mini' ? 'zod/mini' : 'zod');

/** The namespace import a composed `zod.array(...)` expression requires. */
export const getZodNamespaceImport = (output: NormalizedOutputOptions) => ({
  name: 'zod',
  values: true,
  namespaceImport: true,
  importPath: getZodNamespaceImportSource(output),
});

/**
 * Converts an operation/tag title into the generated Angular service class name.
 */
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
  hasQueryParams,
  baseUrlFieldInitializer,
  hasObjectParams = false,
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

@Injectable(${provideInValue})
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
