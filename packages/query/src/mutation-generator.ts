import {
  camel,
  generateMutator,
  type GeneratorImport,
  type GeneratorMutator,
  type GeneratorOptions,
  type GeneratorVerbOptions,
  GetterPropType,
  type InvalidateTarget,
  isString,
  type OutputHttpClient,
  pascal,
} from '@orval/core';

import {
  getHooksOptionImplementation,
  getMutationRequestArgs,
  getQueryErrorType,
} from './client';
import type { FrameworkAdapter } from './framework-adapter';
import { getQueryOptionsDefinition } from './query-options';

interface NormalizedTarget {
  query: string;
  params?: string[] | Record<string, string>;
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

interface OperationRouteInfo {
  route: string;
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
        return { route: routePath, hasRequiredPathParams: false };
      }

      // Collect path parameters from both path-level and operation-level
      const pathParams = [
        ...(Array.isArray(pathItem.parameters) ? pathItem.parameters : []),
        ...(Array.isArray(operation.parameters) ? operation.parameters : []),
      ].filter((p) => p.in === 'path');

      const hasRequiredPathParams = pathParams.some(
        (p) => p.schema?.default === undefined && p.default === undefined,
      );

      return { route: routePath, hasRequiredPathParams };
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

/**
 * Check whether the target invalidation needs to call the query key function.
 * Returns false when no params are specified and the route has required path
 * parameters (without defaults), meaning we should use predicate-based broad
 * invalidation instead of calling the function without the required arguments.
 */
const hasNonEmptyParams = (
  params: string[] | Record<string, string> | undefined,
): params is string[] | Record<string, string> => {
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

const generateVariableRef = (varName: string): string => {
  const parts = varName.split('.');
  if (parts.length === 1) {
    return `variables.${varName}`;
  }
  return `variables.${parts[0]}?.${parts.slice(1).join('?.')}`;
};

const generateParamArgs = (
  params: string[] | Record<string, string>,
): string => {
  if (Array.isArray(params)) {
    return params.map((v) => generateVariableRef(v)).join(', ');
  }
  return Object.values(params)
    .map((v) => generateVariableRef(v))
    .join(', ');
};

/**
 * Create a generateInvalidateCall function that has access to the OpenAPI spec
 * for intelligent route-based invalidation when params are not specified.
 */
const createGenerateInvalidateCall = (
  spec: Record<string, unknown> | undefined,
  shouldSplitQueryKey: boolean,
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
        if (shouldSplitQueryKey) {
          // Split-key mode: query keys are arrays like ['pets', petId].
          // Use partial key matching with static route segments.
          const segments = prefix
            .split('/')
            .filter((s) => s !== '')
            .map((s) => `'${s}'`)
            .join(', ');
          return `    queryClient.${method}({ queryKey: [${segments}] });`;
        }

        // Default mode: query keys are template strings like ['/pets/${petId}'].
        // Use predicate with startsWith for broad matching.
        return `    queryClient.${method}({ predicate: (query) => typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith('${prefix}') });`;
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

  const definitions = props
    .map(({ definition, type }) =>
      type === GetterPropType.BODY
        ? mutator?.bodyTypeName
          ? `data: ${mutator.bodyTypeName}<${body.definition}>`
          : `data: ${body.definition}`
        : definition,
    )
    .join(';');

  const properties = props
    .map(({ name, type }) => (type === GetterPropType.BODY ? 'data' : name))
    .join(',');

  const errorType = getQueryErrorType(
    operationName,
    response,
    httpClient,
    mutator,
  );

  const dataType = mutator?.isHook
    ? `ReturnType<typeof use${pascal(operationName)}Hook>`
    : `typeof ${operationName}`;

  const mutationOptionFnReturnType = getQueryOptionsDefinition({
    operationName,
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

  const mutationArguments = adapter.generateQueryArguments({
    operationName,
    definitions,
    mutator,
    isRequestOptions,
    httpClient,
    hasInvalidation,
  });

  // Separate arguments for getMutationOptions function (includes http: HttpClient param for Angular)
  const mutationArgumentsForOptions = adapter.generateQueryArguments({
    operationName,
    definitions,
    mutator,
    isRequestOptions,
    httpClient,
    forQueryOptions: true,
    hasInvalidation,
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
          ? `const ${operationName} =  use${pascal(operationName)}Hook()`
          : ''
      }


      const mutationFn: MutationFunction<Awaited<ReturnType<${dataType}>>, ${
        definitions ? `{${definitions}}` : 'void'
      }> = (${properties ? 'props' : ''}) => {
          ${properties ? `const {${properties}} = props ?? {};` : ''}

          return  ${operationName}(${adapter.getMutationHttpPrefix(mutator)}${properties}${
            properties ? ',' : ''
          }${getMutationRequestArgs(isRequestOptions, httpClient, mutator)})
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
                  ? `, { url: \`${route.replaceAll('/${', '/{')}\` }`
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

  const implementation = `
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
          }`
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
