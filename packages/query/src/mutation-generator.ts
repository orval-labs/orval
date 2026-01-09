import {
  camel,
  generateMutator,
  type GeneratorMutator,
  type GeneratorOptions,
  type GeneratorVerbOptions,
  GetterPropType,
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

  const mutationOptionFnReturnType = getQueryOptionsDefinition({
    operationName,
    mutator,
    definitions,
    hasSvelteQueryV4,
    hasQueryV5,
    hasQueryV5WithInfiniteQueryOptionsError,
    isReturnType: true,
    isAngularClient: isAngular(outputClient),
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
    isAngularClient: isAngular(outputClient),
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

  const invalidatesConfig = query.mutationInvalidates?.[operationName];
  const hasInvalidation = invalidatesConfig?.length && isAngular(outputClient);

  const mutationOptionsFn = `export const ${mutationOptionsFnName} = <TError = ${errorType},
    TContext = unknown>(${mutationArguments}): ${mutationOptionFnReturnType} => {

${hooksOptionImplementation}
${isAngularHttp ? '  const http = inject(HttpClient);' : ''}
${hasInvalidation ? '  const queryClient = inject(QueryClient);' : ''}

      ${
        mutator?.isHook
          ? `const ${operationName} =  use${pascal(operationName)}Hook()`
          : ''
      }


      const mutationFn: MutationFunction<Awaited<ReturnType<${dataType}>>, ${
        definitions ? `{${definitions}}` : 'void'
      }> = (${properties ? 'props' : ''}) => {
          ${properties ? `const {${properties}} = props ?? {};` : ''}

          return  ${operationName}(${isAngularHttp ? 'http, ' : ''}${properties}${
            properties ? ',' : ''
          }${getMutationRequestArgs(isRequestOptions, httpClient, mutator)})
        }

${
  hasInvalidation
    ? `  const onSuccess = (data: Awaited<ReturnType<typeof ${operationName}>>, variables: ${definitions ? `{${definitions}}` : 'void'}, onMutateResult: TContext, context: MutationFunctionContext) => {
${invalidatesConfig.map((target: string) => `    queryClient.invalidateQueries({ queryKey: ${camel(`get-${target}-query-key`)}() });`).join('\n')}
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
    ? `      const ${mutationOptionsVarName} = ${mutationImplementation};

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
