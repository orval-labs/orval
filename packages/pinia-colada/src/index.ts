import axios from '@orval/axios';
import {
  type ClientBuilder,
  type ClientGeneratorsBuilder,
  type GeneratorDependency,
  type NormalizedOutputOptions,
  OutputHttpClient,
  pascal,
} from '@orval/core';
import fetch from '@orval/fetch';

const dependencies: GeneratorDependency[] = [
  {
    dependency: '@pinia/colada',
    exports: [
      { name: 'useQuery', values: true, alias: 'useColadaQuery' },
      { name: 'useMutation', values: true, alias: 'useColadaMutation' },
      { name: 'DefineQueryOptions' },
      { name: 'UseMutationOptions' },
    ],
  },
  {
    dependency: 'vue',
    exports: [
      { name: 'toValue', values: true, alias: 'toColadaValue' },
      { name: 'MaybeRefOrGetter' },
    ],
  },
];

/** Generate native Colada options/composables around the existing HTTP clients. */
export const builder =
  ({ output }: { output: NormalizedOutputOptions }) =>
  () => {
    const isFetch = output.httpClient === OutputHttpClient.FETCH;
    if (!isFetch && output.httpClient !== OutputHttpClient.AXIOS) {
      throw new Error(
        'pinia-colada supports the fetch and axios HTTP clients.',
      );
    }
    const transport = isFetch ? fetch()() : axios()();

    const client: ClientBuilder = async (
      verb,
      options,
      outputClient,
      normalized,
    ) => {
      if (verb.mutator?.isHook) {
        throw new Error(
          'pinia-colada requires a plain function mutator, not a hook mutator.',
        );
      }
      const requestVerb = isFetch
        ? {
            ...verb,
            override: {
              ...verb.override,
              fetch: { ...verb.override.fetch, forceSuccessResponse: true },
            },
          }
        : verb;
      const generated = await transport.client(
        requestVerb,
        options,
        outputClient,
        normalized,
      );
      const name = verb.operationName;
      const title = pascal(name);
      const data = `Awaited<ReturnType<typeof ${name}>>`;
      const names = new Set([name, ...verb.props.map((prop) => prop.name)]);
      const local = (candidate: string) => {
        while (names.has(candidate)) candidate += '_';
        names.add(candidate);
        return candidate;
      };
      const config = local('coladaOptions');
      const signal = local('coladaSignal');
      const variables = local('coladaVariables');
      const request = local('coladaRequest');
      const hasRequestOptions =
        verb.override.requestOptions !== false &&
        (!verb.mutator || verb.mutator.hasSecondArg || isFetch);
      const requiredRequest = hasRequestOptions && output.optionsParamRequired;
      const optionalConfig = requiredRequest ? '' : '?';
      const requestOption = hasRequestOptions
        ? `request${optionalConfig}: Parameters<typeof ${name}>[${verb.props.length}];`
        : '';
      const args = verb.props.map((prop) => prop.name);
      const typeAt = (index: number) => `Parameters<typeof ${name}>[${index}]`;
      const plain = verb.props.map(
        (prop, index) =>
          `${prop.name}${prop.required ? '' : '?'}: ${typeAt(index)}`,
      );
      const reactive = verb.props.map(
        (prop, index) =>
          `${prop.name}${prop.required ? '' : '?'}: MaybeRefOrGetter<${typeAt(index)}>`,
      );
      const withRequiredConfig = (parameters: string[]) =>
        requiredRequest
          ? parameters.map((parameter) => parameter.replace('?:', ':'))
          : parameters;
      const query = verb.verb === 'get' || verb.verb === 'head';
      let wrapper: string;

      if (query) {
        const key = `get${title}QueryKey`;
        const getOptions = `get${title}QueryOptions`;
        const generic = `<TError = globalThis.Error, TInitial extends ${data} | undefined = undefined>`;
        const optionType = `DefineQueryOptions<${data}, TError, TInitial>`;
        const configType = `{ query?: Partial<Omit<${optionType}, 'query'>>; ${requestOption} }`;
        const requestArgs = [
          ...args,
          ...(hasRequestOptions
            ? [`{ ...${config}?.request, signal: ${signal} }`]
            : []),
        ];
        wrapper = `
export const ${key} = (${plain.join(', ')}) => [${[
          JSON.stringify(verb.verb),
          JSON.stringify(options.route),
          ...args.map((arg) => `${arg} ?? null`),
        ].join(', ')}] as const;

export function ${getOptions}${generic}(${[...withRequiredConfig(plain), `${config}${optionalConfig}: ${configType}`].join(', ')}): ${optionType} {
  const ${request} = ${name};
  return {
    key: ${key}(${args.join(', ')}),
    ...${config}?.query,
    query: (${hasRequestOptions ? `{ signal: ${signal} }` : ''}) => ${request}(${requestArgs.join(', ')}),
  };
}

export function use${title}${generic}(${[...withRequiredConfig(reactive), `${config}${optionalConfig}: MaybeRefOrGetter<${configType}>`].join(', ')}) {
  return useColadaQuery(() => ${getOptions}(${[
    ...args.map((arg) => `toColadaValue(${arg})`),
    `toColadaValue(${config})`,
  ].join(', ')}));
}
`;
      } else {
        const varsType = `${title}MutationVariables`;
        const props = verb.props.map(
          (prop, index) =>
            `${prop.name}${prop.required ? '' : '?'}: ${typeAt(index)}`,
        );
        const generic =
          '<TError = globalThis.Error, TContext extends Record<string, unknown> = Record<string, never>>';
        const optionType = `UseMutationOptions<${data}, ${varsType}, TError, TContext>`;
        const configType = `{ mutation?: Omit<${optionType}, 'mutation'>; ${requestOption} }`;
        const requestArgs = [
          ...args.map((arg) => `${variables}.${arg}`),
          ...(hasRequestOptions
            ? [`${config}${requiredRequest ? '.' : '?.'}request`]
            : []),
        ];
        wrapper = `
export type ${varsType} = ${props.length ? `{ ${props.join('; ')} }` : 'void'};

export function get${title}MutationOptions${generic}(${config}${optionalConfig}: ${configType}): ${optionType} {
  const ${request} = ${name};
  return {
    ...${config}?.mutation,
    mutation: (${props.length ? `${variables}: ${varsType}` : ''}) => ${request}(${requestArgs.join(', ')}),
  };
}

export function use${title}${generic}(${config}${optionalConfig}: ${configType}) {
  return useColadaMutation(get${title}MutationOptions(${config}));
}
`;
      }
      return {
        ...generated,
        implementation: generated.implementation + wrapper,
      };
    };

    return {
      ...transport,
      client,
      dependencies: (...args) => [
        ...(transport.dependencies?.(...args) ?? []),
        ...dependencies,
      ],
    } satisfies ClientGeneratorsBuilder;
  };

export default builder;
