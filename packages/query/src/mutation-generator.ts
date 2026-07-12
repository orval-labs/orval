import {
  camel,
  generateMutator,
  type GeneratorImport,
  type GeneratorMutator,
  type GeneratorOptions,
  type GeneratorVerbOptions,
  GetterPropType,
  getFullRoute,
  getRoute,
  getRouteAsArray,
  type InvalidateTarget,
  type InvalidateTargetParam,
  isString,
  type NormalizedOutputOptions,
  type OpenApiServerObject,
  type OutputHttpClient,
  pascal,
  type Verbs,
} from '@orval/core';

import {
  getHooksOptionImplementation,
  getMutationRequestArgs,
  getQueryErrorType,
} from './client';
import type { FrameworkAdapter } from './framework-adapter';
import { getQueryKeyVerbPrefix } from './query-generator';
import { getQueryOptionsDefinition } from './query-options';

interface NormalizedTarget {
  query: string;
  params?: InvalidateTargetParam[] | Record<string, InvalidateTargetParam>;
  invalidateMode: 'invalidate' | 'reset';
  file?: string;
}

const normalizeInvalidateMode = (
  invalidateMode: string | undefined,
): NormalizedTarget['invalidateMode'] =>
  invalidateMode === 'reset' ? 'reset' : 'invalidate';

const normalizeTarget = (target: InvalidateTarget): NormalizedTarget =>
  isString(target)
    ? { query: target, invalidateMode: 'invalidate' }
    : {
        ...target,
        invalidateMode: normalizeInvalidateMode(target.invalidateMode),
      };

const serializeTarget = (target: NormalizedTarget): string =>
  JSON.stringify({
    query: target.query,
    params: target.params ?? [],
    invalidateMode: target.invalidateMode,
    file: target.file ?? '',
  });

const HTTP_METHODS = [
  'get',
  'post',
  'put',
  'delete',
  'patch',
  'options',
  'head',
  'trace',
];

const MUTATION_OPERATION_LOCAL_NAMES = new Set([
  'backupQueryClient',
  'context',
  'customOptions',
  'data',
  'fetchOptions',
  'http',
  'mutationFn',
  'mutationKey',
  'mutationOptions',
  'onMutateResult',
  'onSuccess',
  'options',
  'props',
  'queryClient',
  'variables',
]);

const getMutationOperationReferenceName = (
  operationName: string,
  localNames: ReadonlySet<string>,
): string => {
  if (!localNames.has(operationName)) {
    return operationName;
  }

  let candidate = camel(`${operationName}-request-fn`);
  let index = 2;
  while (localNames.has(candidate)) {
    candidate = camel(`${operationName}-request-fn-${index}`);
    index += 1;
  }

  return candidate;
};

interface OperationRouteInfo {
  route: string;
  /** HTTP method (lowercase) — needed to mirror the verb prefix that
   * `getQueryKeyVerbPrefix` adds to non-GET cache keys. */
  method: string;
  /** true when the route has path params that lack a default value */
  hasRequiredPathParams: boolean;
}

interface SpecPathItem {
  parameters?: SpecParameter[];
  [method: string]: unknown;
}

interface SpecOperation {
  operationId?: string;
  parameters?: SpecParameter[];
}

interface SpecParameter {
  in?: string;
  default?: unknown;
  schema?: { default?: unknown };
}

/**
 * Look up an operation's route and path-parameter metadata from the OpenAPI
 * spec. Matches against both the raw `operationId` and its camelCase form
 * so that renamed/overridden operations are still found.
 */
const findOperationInfo = (
  spec: Record<string, unknown> | undefined,
  operationName: string,
): OperationRouteInfo | undefined => {
  const paths = spec?.paths;
  if (!paths || typeof paths !== 'object') return undefined;

  for (const [routePath, rawPathItem] of Object.entries(
    paths as Record<string, unknown>,
  )) {
    if (!rawPathItem || typeof rawPathItem !== 'object') continue;
    const pathItem = rawPathItem as SpecPathItem;

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method] as SpecOperation | undefined;
      const opId = operation?.operationId;
      if (!opId) continue;
      // Match both raw operationId and its camelCase generated name
      if (opId !== operationName && camel(opId) !== operationName) continue;

      if (!routePath.includes('{')) {
        return { route: routePath, method, hasRequiredPathParams: false };
      }

      // Collect path parameters from both path-level and operation-level
      const pathParams = [
        ...(Array.isArray(pathItem.parameters) ? pathItem.parameters : []),
        ...(Array.isArray(operation.parameters) ? operation.parameters : []),
      ].filter((p) => p.in === 'path');

      const hasRequiredPathParams = pathParams.some(
        (p) => p.schema?.default === undefined && p.default === undefined,
      );

      return { route: routePath, method, hasRequiredPathParams };
    }
  }
  return undefined;
};

/**
 * Extract the static route prefix before the first path parameter.
 * e.g. "/pets/{petId}" → "/pets/", "/pets" → "/pets"
 *
 * Returns `undefined` when the prefix contains no meaningful literal
 * segments (e.g. "/{tenantId}/pets") to avoid overly-broad invalidation.
 */
const getStaticRoutePrefix = (route: string): string | undefined => {
  const idx = route.indexOf('{');
  if (idx === -1) return route;
  const prefix = route.slice(0, idx);
  // Guard: a prefix like "/" has no stable literal segment and would
  // match every route-style query key – fall back to the zero-arg call.
  const hasLiteralSegment = prefix
    .split('/')
    .some((segment) => segment.length > 0);
  return hasLiteralSegment ? prefix : undefined;
};

export const getMutationOptionsUrl = (
  route: string,
  pathParamNames: Iterable<string>,
  pathRoute?: string,
): string => {
  const pathParams = new Set(pathParamNames);
  if (pathParams.size === 0) return route;

  const formatPathRoute = (value: string) =>
    value.replace(/\$\{([^}]+)\}/g, (match, expression: string) =>
      pathParams.has(expression) ? `{${expression}}` : match,
    );

  if (pathRoute) {
    if (route.endsWith(pathRoute)) {
      return `${route.slice(0, -pathRoute.length)}${formatPathRoute(
        pathRoute,
      )}`;
    }

    const routeWithoutLeadingSlash = pathRoute.startsWith('/')
      ? pathRoute.slice(1)
      : undefined;
    if (routeWithoutLeadingSlash && route.endsWith(routeWithoutLeadingSlash)) {
      return `${route.slice(
        0,
        -routeWithoutLeadingSlash.length,
      )}${formatPathRoute(routeWithoutLeadingSlash)}`;
    }
  }

  return pathRoute ? route : formatPathRoute(route);
};

const getMutationOptionsNamedPathParamName = (param: string) => {
  const trimmedParam = param.trim();
  if (!trimmedParam || trimmedParam.startsWith('...')) return undefined;

  const [name] = trimmedParam.split(/[=:]/);
  return name?.trim() || undefined;
};

export const getMutationOptionsPathParamNames = (
  props: GeneratorVerbOptions['props'],
) =>
  props.flatMap((prop) => {
    if (prop.type === GetterPropType.PARAM) return [prop.name];
    if (prop.type === GetterPropType.NAMED_PATH_PARAMS) {
      return prop.destructured
        .replace(/^\{\s*|\s*\}$/g, '')
        .split(',')
        .flatMap((param) => {
          const name = getMutationOptionsNamedPathParamName(param);
          return name ? [name] : [];
        });
    }
    return [];
  });

/**
 * Check whether the target invalidation needs to call the query key function.
 * Returns false when no params are specified and the route has required path
 * parameters (without defaults), meaning we should use predicate-based broad
 * invalidation instead of calling the function without the required arguments.
 */
const hasNonEmptyParams = (
  params:
    | InvalidateTargetParam[]
    | Record<string, InvalidateTargetParam>
    | undefined,
): params is
  | InvalidateTargetParam[]
  | Record<string, InvalidateTargetParam> => {
  if (!params) return false;
  if (Array.isArray(params)) return params.length > 0;
  return Object.keys(params).length > 0;
};

const needsQueryKeyFnCall = (
  target: NormalizedTarget,
  spec: Record<string, unknown> | undefined,
): boolean => {
  if (hasNonEmptyParams(target.params)) return true;
  const info = findOperationInfo(spec, target.query);
  if (info?.hasRequiredPathParams) return false;
  return true;
};

const generateParamArg = (param: InvalidateTargetParam): string => {
  if (!isString(param)) {
    return JSON.stringify(param.literal);
  }
  const parts = param.split('.');
  if (parts.length === 1) {
    return `variables.${param}`;
  }
  return `variables.${parts[0]}?.${parts.slice(1).join('?.')}`;
};

const generateParamArgs = (
  params: InvalidateTargetParam[] | Record<string, InvalidateTargetParam>,
): string => {
  if (Array.isArray(params)) {
    return params.map((v) => generateParamArg(v)).join(', ');
  }
  return Object.values(params)
    .map((v) => generateParamArg(v))
    .join(', ');
};

/**
 * Build the code-literal form of a static route prefix for use inside a
 * `.startsWith(...)` predicate. A prefix derived from a runtime `baseUrl`
 * contains a `${...}` interpolation, so it must be emitted as a template
 * literal; otherwise a plain single-quoted string is enough and keeps the
 * output byte-identical to the no-baseUrl case.
 */
const toPrefixLiteral = (prefix: string): string =>
  prefix.includes('${') ? `\`${prefix}\`` : `'${prefix}'`;

/**
 * Create a generateInvalidateCall function that has access to the OpenAPI spec
 * for intelligent route-based invalidation when params are not specified.
 */
const createGenerateInvalidateCall = (
  spec: Record<string, unknown> | undefined,
  shouldSplitQueryKey: boolean,
  useOperationIdAsQueryKey: boolean,
  baseUrl: NormalizedOutputOptions['baseUrl'],
  servers: OpenApiServerObject[] | undefined,
) => {
  return (target: NormalizedTarget): string => {
    const method =
      target.invalidateMode === 'reset' ? 'resetQueries' : 'invalidateQueries';
    const queryKeyFn = camel(`get-${target.query}-query-key`);

    if (hasNonEmptyParams(target.params)) {
      const args = generateParamArgs(target.params);
      return `    queryClient.${method}({ queryKey: ${queryKeyFn}(${args}) });`;
    }

    // No params specified – check if the target query has required path params
    const info = findOperationInfo(spec, target.query);

    if (info?.hasRequiredPathParams) {
      // Route has required path parameters (no defaults) – use broad
      // invalidation instead of calling the query key function without
      // the required arguments.
      const prefix = getStaticRoutePrefix(info.route);

      // When the prefix has no meaningful literal segments (e.g. route
      // starts with a path param like /{tenantId}/...), fall through to
      // the zero-arg call rather than generating an overly-broad match.
      if (prefix !== undefined) {
        // Issue #3534: the generated query keys are built from the full route
        // (`getFullRoute` prepends `baseUrl`), so the broad-invalidation
        // prefix must carry the same `baseUrl` – otherwise the predicate /
        // partial key never matches a baseUrl-prefixed cache key. `prefix`
        // has no path params, so `getFullRoute` just concatenates the base.
        const prefixWithBase = getFullRoute(getRoute(prefix), servers, baseUrl);
        // Mirror the verb prefix that `getQueryKeyVerbPrefix` injects into
        // non-GET Query keys; without this, the predicate / partial key
        // would never match a verb-prefixed cache key and the broad
        // invalidation would silently no-op. We share the helper from
        // `query-generator.ts` so both sites stay in sync.
        // `info.method` is narrowed by the spec walker to one of HTTP_METHODS
        // (a superset of `Verbs` that also includes `options`/`trace`); the
        // helper only branches on `Verbs.GET`, so the cast is safe for any
        // non-GET method.
        const verbPrefix = getQueryKeyVerbPrefix({
          verb: info.method as Verbs,
          useOperationIdAsQueryKey,
        });

        if (shouldSplitQueryKey) {
          // Split-key mode: query keys are arrays like ['pets', petId]
          // (or ['DELETE', 'pets', petId] for non-GET Query keys).
          // Use partial key matching with static route segments. Reuse
          // `getRouteAsArray` so baseUrl-derived segments are produced the
          // same way as the query key (e.g. a runtime baseUrl is emitted as
          // an unquoted expression, a static one as quoted literals).
          const segments = getRouteAsArray(prefixWithBase);
          const keyArr = verbPrefix
            ? `['${verbPrefix}', ${segments}]`
            : `[${segments}]`;
          return `    queryClient.${method}({ queryKey: ${keyArr} });`;
        }

        // Default mode: query keys are template strings like
        // ['/pets/${petId}'] (or ['DELETE', '/pets/${petId}'] for non-GET
        // Query keys). Use a predicate that knows where the route segment
        // lives in the tuple.
        const prefixLiteral = toPrefixLiteral(prefixWithBase);
        if (verbPrefix) {
          return `    queryClient.${method}({ predicate: (query) => query.queryKey[0] === '${verbPrefix}' && typeof query.queryKey[1] === 'string' && query.queryKey[1].startsWith(${prefixLiteral}) });`;
        }
        return `    queryClient.${method}({ predicate: (query) => typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith(${prefixLiteral}) });`;
      }
    }

    // No path params or route not found – call query key function without args
    return `    queryClient.${method}({ queryKey: ${queryKeyFn}() });`;
  };
};

export interface MutationHookContext {
  verbOptions: GeneratorVerbOptions;
  options: GeneratorOptions;
  isRequestOptions: boolean;
  httpClient: OutputHttpClient;
  doc: string;
  adapter: FrameworkAdapter;
}

export const generateMutationHook = async ({
  verbOptions,
  options,
  isRequestOptions,
  httpClient,
  doc,
  adapter,
}: MutationHookContext): Promise<{
  implementation: string;
  mutators: GeneratorMutator[] | undefined;
  imports: GeneratorImport[];
}> => {
  const {
    operationName,
    body,
    props,
    mutator,
    response,
    operationId,
    route: pathRoute,
    override,
  } = verbOptions;
  const { route, context, output } = options;
  const query = override.query;

  const mutationOptionsMutator = query.mutationOptions
    ? await generateMutator({
        output,
        mutator: query.mutationOptions,
        name: `${operationName}MutationOptions`,
        workspace: context.workspace,
        tsconfig: context.output.tsconfig,
      })
    : undefined;

  const bodyOptionalMark = body.isOptional ? '?' : '';
  const definitions = props
    .map(({ definition, type }) =>
      type === GetterPropType.BODY
        ? mutator?.bodyTypeName
          ? `data${bodyOptionalMark}: ${mutator.bodyTypeName}<${body.definition}>`
          : `data${bodyOptionalMark}: ${body.definition}`
        : definition,
    )
    .join(';');

  const properties = props
    .map(({ name, type }) => (type === GetterPropType.BODY ? 'data' : name))
    .join(',');

  const operationLocalNames = new Set(MUTATION_OPERATION_LOCAL_NAMES);
  for (const { name, type } of props) {
    operationLocalNames.add(type === GetterPropType.BODY ? 'data' : name);
  }

  const errorType = getQueryErrorType(
    operationName,
    response,
    httpClient,
    mutator,
    override.fetch.forceSuccessResponse,
  );

  const operationReferenceName = getMutationOperationReferenceName(
    operationName,
    operationLocalNames,
  );
  const dataType = mutator?.isHook
    ? `ReturnType<typeof use${pascal(operationName)}Hook>`
    : `typeof ${operationReferenceName}`;
  const operationTypeReferenceName = mutator?.isHook
    ? operationName
    : operationReferenceName;

  const mutationOptionFnReturnType = getQueryOptionsDefinition({
    operationName: operationTypeReferenceName,
    mutator,
    definitions,
    prefix: adapter.getQueryOptionsDefinitionPrefix(),
    hasQueryV5: adapter.hasQueryV5,
    hasQueryV5WithInfiniteQueryOptionsError:
      adapter.hasQueryV5WithInfiniteQueryOptionsError,
    isReturnType: true,
    adapter,
  });

  const invalidatesConfig = (query.mutationInvalidates ?? [])
    .filter((rule) => rule.onMutations.includes(operationName))
    .flatMap((rule) => rule.invalidates)
    .map((t) => normalizeTarget(t));
  const seenTargets = new Set<string>();
  const uniqueInvalidates = invalidatesConfig.filter((target) => {
    const key = serializeTarget(target);
    if (seenTargets.has(key)) return false;
    seenTargets.add(key);
    return true;
  });

  const hasInvalidation =
    uniqueInvalidates.length > 0 && adapter.supportsMutationInvalidation();

  const useRuntimeFetcher = override.fetch.useRuntimeFetcher;

  const mutationArguments = adapter.generateQueryArguments({
    operationName: operationTypeReferenceName,
    definitions,
    mutator,
    isRequestOptions,
    httpClient,
    hasInvalidation,
    useRuntimeFetcher,
  });

  // Separate arguments for getMutationOptions function (includes http: HttpClient param for Angular)
  const mutationArgumentsForOptions = adapter.generateQueryArguments({
    operationName: operationTypeReferenceName,
    definitions,
    mutator,
    isRequestOptions,
    httpClient,
    forQueryOptions: true,
    hasInvalidation,
    useRuntimeFetcher,
  });

  const mutationOptionsFnName = camel(
    mutationOptionsMutator || mutator?.isHook
      ? `use-${operationName}-mutationOptions`
      : `get-${operationName}-mutationOptions`,
  );

  const hooksOptionImplementation = getHooksOptionImplementation(
    isRequestOptions,
    httpClient,
    camel(operationName),
    mutator,
    useRuntimeFetcher,
  );

  // For Angular, add http: HttpClient as FIRST param (required, before optional params)
  // This avoids TS1016 "required param cannot follow optional param"
  const httpFirstParam = adapter.getHttpFirstParam(mutator);

  // For Angular/React mutations with invalidation, add queryClient as second required param
  const queryClientParam = hasInvalidation ? 'queryClient: QueryClient, ' : '';

  const mutationOptionsFn = `export const ${mutationOptionsFnName} = <TError = ${errorType},
    TContext = unknown>(${httpFirstParam}${queryClientParam}${mutationArgumentsForOptions}): ${mutationOptionFnReturnType} => {

${hooksOptionImplementation}

      ${
        mutator?.isHook
          ? `const ${operationReferenceName} =  use${pascal(operationName)}Hook()`
          : ''
      }


      const mutationFn: MutationFunction<Awaited<ReturnType<${dataType}>>, ${
        definitions ? `{${definitions}}` : 'void'
      }> = (${properties ? 'props' : ''}) => {
          ${properties ? `const {${properties}} = props ?? {};` : ''}

          return  ${operationReferenceName}(${adapter.getMutationHttpPrefix(mutator)}${properties}${
            properties ? ',' : ''
          }${getMutationRequestArgs(isRequestOptions, httpClient, mutator, useRuntimeFetcher)})
        }

${
  hasInvalidation
    ? adapter.generateMutationOnSuccess({
        operationName,
        definitions,
        isRequestOptions,
        generateInvalidateCall: createGenerateInvalidateCall(
          context.spec,
          !!query.shouldSplitQueryKey,
          !!query.useOperationIdAsQueryKey,
          // `options.output` is the target file path (a string); the
          // normalized output – and thus `baseUrl` – lives on `context.output`.
          context.output.baseUrl,
          context.spec.servers,
        ),
        uniqueInvalidates,
      })
    : ''
}

        ${
          mutationOptionsMutator
            ? `const customOptions = ${
                mutationOptionsMutator.name
              }({...mutationOptions, mutationFn}${
                mutationOptionsMutator.hasSecondArg
                  ? `, { url: \`${getMutationOptionsUrl(
                      route,
                      getMutationOptionsPathParamNames(props),
                      pathRoute,
                    )}\` }`
                  : ''
              }${
                mutationOptionsMutator.hasThirdArg
                  ? `, { operationId: '${operationId}', operationName: '${operationName}' }`
                  : ''
              });`
            : ''
        }


  return  ${
    mutationOptionsMutator
      ? 'customOptions'
      : hasInvalidation
        ? '{ ...mutationOptions, mutationFn, onSuccess }'
        : '{ mutationFn, ...mutationOptions }'
  }}`;

  const operationPrefix = adapter.hookPrefix;

  const optionalQueryClientArgument =
    adapter.getOptionalQueryClientArgument(hasInvalidation);

  const mutationImplementation = adapter.generateMutationImplementation({
    mutationOptionsFnName,
    hasInvalidation,
    isRequestOptions,
  });

  const mutationOptionsVarName = camel(`${operationName}-mutation-options`);

  const mutationReturnType = adapter.getMutationReturnType({
    dataType,
    variableType: definitions ? `{${definitions}}` : 'void',
  });

  const mutationHookBody = adapter.generateMutationHookBody({
    operationPrefix,
    mutationOptionsFnName,
    mutationImplementation,
    mutationOptionsVarName,
    isRequestOptions,
    mutator,
    hasInvalidation,
    optionalQueryClientArgument,
  });

  const operationReferenceDeclaration =
    !mutator?.isHook && operationReferenceName !== operationName
      ? `const ${operationReferenceName} = ${operationName};`
      : '';

  const implementation = `
${operationReferenceDeclaration}
${mutationOptionsFn}

    export type ${pascal(
      operationName,
    )}MutationResult = NonNullable<Awaited<ReturnType<${dataType}>>>
    ${
      body.definition
        ? `export type ${pascal(operationName)}MutationBody = ${
            mutator?.bodyTypeName
              ? `${mutator.bodyTypeName}<${body.definition}>`
              : body.definition
          }${body.isOptional ? ' | undefined' : ''}`
        : ''
    }
    export type ${pascal(operationName)}MutationError = ${errorType}

    ${doc}export const ${camel(
      `${operationPrefix}-${operationName}`,
    )} = <TError = ${errorType},
    TContext = unknown>(${mutationArguments} ${optionalQueryClientArgument})${mutationReturnType} => {
${mutationHookBody}
    }
    `;

  const mutators = mutationOptionsMutator
    ? [mutationOptionsMutator]
    : undefined;

  const imports: GeneratorImport[] = hasInvalidation
    ? uniqueInvalidates
        .filter((i) => !!i.file && needsQueryKeyFnCall(i, context.spec))
        .map<GeneratorImport>((i) => ({
          name: camel(`get-${i.query}-query-key`),
          importPath: i.file,
          values: true,
        }))
    : [];

  return {
    implementation,
    mutators,
    imports,
  };
};
