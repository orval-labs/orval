import {
  camel,
  generateMutator,
  type GeneratorMutator,
  type GeneratorOptions,
  type GeneratorVerbOptions,
  GetterPropType,
  type InvalidateTarget,
  OutputClient,
  type OutputClientFunc,
  OutputHttpClient,
  pascal,
} from '@orval/core';

import {
  getHooksOptionImplementation,
  getMutationRequestArgs,
  getQueryErrorType,
} from './client';
import { getFrameworkPrefix } from './query-generator';
import {
  generateQueryArguments,
  getQueryOptionsDefinition,
} from './query-options';
import { generateMutatorReturnType } from './return-types';
import { isAngular, isSolid } from './utils';

type NormalizedTarget = {
  query: string;
  params?: string[] | Record<string, string>;
};

const normalizeTarget = (target: InvalidateTarget): NormalizedTarget =>
  typeof target === 'string' ? { query: target } : target;

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
  outputClient: OutputClient | OutputClientFunc;
  hasQueryV5: boolean;
  hasQueryV5WithInfiniteQueryOptionsError: boolean;
  hasSvelteQueryV4: boolean;
  hasSvelteQueryV6: boolean;
  isRequestOptions: boolean;
  httpClient: OutputHttpClient;
  doc: string;
  isAngularHttp: boolean;
}

export const generateMutationHook = async ({
  verbOptions,
  options,
  outputClient,
  hasQueryV5,
  hasQueryV5WithInfiniteQueryOptionsError,
  hasSvelteQueryV4,
  hasSvelteQueryV6,
  isRequestOptions,
  httpClient,
  doc,
  isAngularHttp,
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

  const isAngularClient = isAngular(outputClient);

  const mutationOptionFnReturnType = getQueryOptionsDefinition({
    operationName,
    mutator,
    definitions,
    hasSvelteQueryV4,
    hasQueryV5,
    hasQueryV5WithInfiniteQueryOptionsError,
    isReturnType: true,
    isAngularClient,
  });

  const mutationArguments = generateQueryArguments({
    operationName,
    definitions,
    mutator,
    isRequestOptions,
    hasSvelteQueryV4,
    hasQueryV5,
    hasQueryV5WithInfiniteQueryOptionsError,
    httpClient,
    isAngularClient,
  });

  // Separate arguments for getMutationOptions function (includes http: HttpClient param for Angular)
  const mutationArgumentsForOptions = generateQueryArguments({
    operationName,
    definitions,
    mutator,
    isRequestOptions,
    hasSvelteQueryV4,
    hasQueryV5,
    hasQueryV5WithInfiniteQueryOptionsError,
    httpClient,
    isAngularClient,
    forQueryOptions: true,
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
  const hasInvalidation = uniqueInvalidates.length > 0 && isAngularClient;

  // For Angular, add http: HttpClient as FIRST param (required, before optional params)
  // This avoids TS1016 "required param cannot follow optional param"
  const httpFirstParam =
    isAngularHttp && (!mutator || mutator.hasSecondArg)
      ? 'http: HttpClient, '
      : '';

  // For Angular mutations with invalidation, add queryClient as second required param
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

          return  ${operationName}(${isAngularHttp && !mutator ? 'http, ' : ''}${properties}${
            properties ? ',' : ''
          }${getMutationRequestArgs(isRequestOptions, httpClient, mutator)})
        }

${
  hasInvalidation
    ? `  const onSuccess = (data: Awaited<ReturnType<typeof ${operationName}>>, variables: ${definitions ? `{${definitions}}` : 'void'}, onMutateResult: TContext, context: MutationFunctionContext) => {
${uniqueInvalidates.map((t) => generateInvalidateCall(t)).join('\n')}
    mutationOptions?.onSuccess?.(data, variables, onMutateResult, context);
  };`
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
        ? '{ mutationFn, onSuccess, ...mutationOptions }'
        : '{ mutationFn, ...mutationOptions }'
  }}`;

  const operationPrefix = getFrameworkPrefix(
    hasSvelteQueryV4,
    isAngular(outputClient),
    isSolid(outputClient),
  );
  const optionalQueryClientArgument =
    hasQueryV5 && !isAngular(outputClient) ? ', queryClient?: QueryClient' : '';

  const mutationImplementation = `${mutationOptionsFnName}(${
    isRequestOptions ? 'options' : 'mutationOptions'
  })`;

  const mutationOptionsVarName = camel(`${operationName}-mutation-options`);

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
    TContext = unknown>(${mutationArguments} ${optionalQueryClientArgument})${generateMutatorReturnType(
      {
        outputClient,
        dataType,
        variableType: definitions ? `{${definitions}}` : 'void',
      },
    )} => {
${
  isAngular(outputClient)
    ? isAngularHttp && (!mutator || mutator.hasSecondArg)
      ? `      const http = inject(HttpClient);${hasInvalidation ? '\n      const queryClient = inject(QueryClient);' : ''}
      const ${mutationOptionsVarName} = ${mutationOptionsFnName}(http${hasInvalidation ? ', queryClient' : ''}${isRequestOptions ? ', options' : ', mutationOptions'});

      return ${operationPrefix}Mutation(() => ${mutationOptionsVarName});`
      : `      const ${mutationOptionsVarName} = ${mutationImplementation};

      return ${operationPrefix}Mutation(() => ${mutationOptionsVarName});`
    : `      return ${operationPrefix}Mutation(${
        hasSvelteQueryV6
          ? `() => ({ ...${mutationImplementation}${optionalQueryClientArgument ? ', queryClient' : ''} })`
          : `${mutationImplementation}${optionalQueryClientArgument ? ', queryClient' : ''}`
      });`
}
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
