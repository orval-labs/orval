import {
  camel,
  generateMutator,
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

type NormalizedTarget = {
  query: string;
  params?: string[] | Record<string, string>;
};

const normalizeTarget = (target: InvalidateTarget): NormalizedTarget =>
  isString(target) ? { query: target } : target;

const serializeTarget = (target: NormalizedTarget): string =>
  JSON.stringify({ query: target.query, params: target.params ?? [] });

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

const generateInvalidateCall = (target: NormalizedTarget): string => {
  const queryKeyFn = camel(`get-${target.query}-query-key`);
  const args = target.params ? generateParamArgs(target.params) : '';
  return `    queryClient.invalidateQueries({ queryKey: ${queryKeyFn}(${args}) });`;
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
        generateInvalidateCall,
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

  return {
    implementation,
    mutators,
  };
};
