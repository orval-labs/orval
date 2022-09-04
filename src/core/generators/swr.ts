import { VERBS_WITH_BODY } from '../../constants';
import { Verbs } from '../../types';
import {
  ClientBuilder,
  ClientDependenciesBuilder,
  ClientFooterBuilder,
  ClientHeaderBuilder,
  ClientTitleBuilder,
  GeneratorDependency,
  GeneratorImport,
  GeneratorMutator,
  GeneratorOptions,
  GeneratorVerbOptions,
} from '../../types/generator';
import {
  GetterParams,
  GetterProps,
  GetterPropType,
  GetterResponse,
} from '../../types/getters';
import { camel, pascal } from '../../utils/case';
import { stringify, toObjectString } from '../../utils/string';
import { isSyntheticDefaultImportsAllow } from '../../utils/tsconfig';
import { generateVerbImports } from './imports';
import {
  generateFormDataAndUrlEncodedFunction,
  generateMutatorConfig,
  generateMutatorRequestOptions,
  generateOptions,
} from './options';

const AXIOS_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      {
        name: 'axios',
        default: true,
        values: true,
        syntheticDefaultImport: true,
      },
      { name: 'AxiosRequestConfig' },
      { name: 'AxiosResponse' },
      { name: 'AxiosError' },
    ],
    dependency: 'axios',
  },
];

const SWR_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      { name: 'useSwr', values: true, default: true },
      { name: 'SWRConfiguration' },
      { name: 'Key' },
    ],
    dependency: 'swr',
  },
];

export const getSwrDependencies: ClientDependenciesBuilder = (
  hasGlobalMutator: boolean,
) => [...(!hasGlobalMutator ? AXIOS_DEPENDENCIES : []), ...SWR_DEPENDENCIES];

const generateSwrRequestFunction = (
  {
    headers,
    queryParams,
    operationName,
    response,
    mutator,
    body,
    props,
    verb,
    formData,
    formUrlEncoded,
    override,
  }: GeneratorVerbOptions,
  { route, context }: GeneratorOptions,
) => {
  const isRequestOptions = override?.requestOptions !== false;
  const isFormData = override?.formData !== false;
  const isFormUrlEncoded = override?.formUrlEncoded !== false;
  const isExactOptionalPropertyTypes =
    !!context.tsconfig?.compilerOptions?.exactOptionalPropertyTypes;
  const isBodyVerb = VERBS_WITH_BODY.includes(verb);
  const isSyntheticDefaultImportsAllowed = isSyntheticDefaultImportsAllow(
    context.tsconfig,
  );

  const bodyForm = generateFormDataAndUrlEncodedFunction({
    formData,
    formUrlEncoded,
    body,
    isFormData,
    isFormUrlEncoded,
  });

  if (mutator) {
    const mutatorConfig = generateMutatorConfig({
      route,
      body,
      headers,
      queryParams,
      response,
      verb,
      isFormData,
      isFormUrlEncoded,
      hasSignal: false,
      isBodyVerb,
      isExactOptionalPropertyTypes,
    });

    const propsImplementation =
      mutator?.bodyTypeName && body.definition
        ? toObjectString(props, 'implementation').replace(
            new RegExp(`(\\w*):\\s?${body.definition}`),
            `$1: ${mutator.bodyTypeName}<${body.definition}>`,
          )
        : toObjectString(props, 'implementation');

    const requestOptions = isRequestOptions
      ? generateMutatorRequestOptions(
          override?.requestOptions,
          mutator.hasSecondArg,
        )
      : '';

    return `export const ${operationName} = (\n    ${propsImplementation}\n ${
      isRequestOptions && mutator.hasSecondArg
        ? `options?: SecondParameter<typeof ${mutator.name}>`
        : ''
    }) => {${bodyForm}
      return ${mutator.name}<${response.definition.success || 'unknown'}>(
      ${mutatorConfig},
      ${requestOptions});
    }
  `;
  }

  const options = generateOptions({
    route,
    body,
    headers,
    queryParams,
    response,
    verb,
    requestOptions: override?.requestOptions,
    isFormData,
    isFormUrlEncoded,
    isExactOptionalPropertyTypes,
    hasSignal: false,
  });

  return `export const ${operationName} = (\n    ${toObjectString(
    props,
    'implementation',
  )} ${
    isRequestOptions ? `options?: AxiosRequestConfig\n` : ''
  } ): Promise<AxiosResponse<${
    response.definition.success || 'unknown'
  }>> => {${bodyForm}
    return axios${
      !isSyntheticDefaultImportsAllowed ? '.default' : ''
    }.${verb}(${options});
  }
`;
};

const generateSwrArguments = ({
  operationName,
  mutator,
  isRequestOptions,
}: {
  operationName: string;
  mutator?: GeneratorMutator;
  isRequestOptions: boolean;
}) => {
  const definition = `SWRConfiguration<Awaited<ReturnType<typeof ${operationName}>>, TError> & { swrKey?: Key, enabled?: boolean }`;

  if (!isRequestOptions) {
    return `swrOptions?: ${definition}`;
  }

  return `options?: { swr?:${definition}, ${
    !mutator
      ? `axios?: AxiosRequestConfig`
      : mutator?.hasSecondArg
      ? `request?: SecondParameter<typeof ${mutator.name}>`
      : ''
  } }\n`;
};

const generateSwrImplementation = ({
  operationName,
  swrKeyFnName,
  swrProperties,
  swrKeyProperties,
  params,
  mutator,
  isRequestOptions,
  response,
  swrOptions,
  props,
}: {
  isRequestOptions: boolean;
  operationName: string;
  swrKeyFnName: string;
  swrProperties: string;
  swrKeyProperties: string;
  params: GetterParams;
  props: GetterProps;
  response: GetterResponse;
  mutator?: GeneratorMutator;
  swrOptions: { options?: any };
}) => {
  const swrProps = toObjectString(props, 'implementation');
  const httpFunctionProps = swrProperties;

  const swrKeyImplementation = `const isEnabled = swrOptions?.enabled !== false${
    params.length
      ? ` && !!(${params.map(({ name }) => name).join(' && ')})`
      : ''
  }
    const swrKey = swrOptions?.swrKey ?? (() => isEnabled ? ${swrKeyFnName}(${swrKeyProperties}) : null);`;

  let errorType = `AxiosError<${response.definition.errors || 'unknown'}>`;

  if (mutator) {
    errorType = mutator.hasErrorType
      ? `ErrorType<${response.definition.errors || 'unknown'}>`
      : response.definition.errors || 'unknown';
  }

  return `
export type ${pascal(
    operationName,
  )}QueryResult = NonNullable<Awaited<ReturnType<typeof ${operationName}>>>
export type ${pascal(operationName)}QueryError = ${errorType}

export const ${camel(
    `use-${operationName}`,
  )} = <TError = ${errorType}>(\n ${swrProps} ${generateSwrArguments({
    operationName,
    mutator,
    isRequestOptions,
  })}\n  ) => {

  ${
    isRequestOptions
      ? `const {swr: swrOptions${
          !mutator
            ? `, axios: axiosOptions`
            : mutator?.hasSecondArg
            ? ', request: requestOptions'
            : ''
        }} = options ?? {}`
      : ''
  }

  ${swrKeyImplementation}
  const swrFn = () => ${operationName}(${httpFunctionProps}${
    httpFunctionProps ? ', ' : ''
  }${
    isRequestOptions
      ? !mutator
        ? `axiosOptions`
        : mutator?.hasSecondArg
        ? 'requestOptions'
        : ''
      : ''
  });

  const query = useSwr<Awaited<ReturnType<typeof swrFn>>, TError>(swrKey, swrFn, ${
    swrOptions.options
      ? `{
    ${stringify(swrOptions.options)?.slice(1, -1)}
    ...swrOptions
  }`
      : 'swrOptions'
  })

  return {
    swrKey,
    ...query
  }
}\n`;
};

const generateSwrHook = (
  {
    queryParams,
    operationName,
    body,
    props,
    verb,
    params,
    override,
    mutator,
    response,
  }: GeneratorVerbOptions,
  { route }: GeneratorOptions,
) => {
  const isRequestOptions = override?.requestOptions !== false;

  if (verb !== Verbs.GET) {
    return '';
  }

  const swrProperties = props
    .map(({ name, type }) =>
      type === GetterPropType.BODY ? body.implementation : name,
    )
    .join(',');

  const swrKeyProperties = props
    .filter((prop) => prop.type !== GetterPropType.HEADER)
    .map(({ name, type }) =>
      type === GetterPropType.BODY ? body.implementation : name,
    )
    .join(',');

  const swrKeyFnName = camel(`get-${operationName}-key`);
  const queryKeyProps = toObjectString(
    props.filter((prop) => prop.type !== GetterPropType.HEADER),
    'implementation',
  );

  return `export const ${swrKeyFnName} = (${queryKeyProps}) => [\`${route}\`${
    queryParams ? ', ...(params ? [params]: [])' : ''
  }${body.implementation ? `, ${body.implementation}` : ''}];

    ${generateSwrImplementation({
      operationName,
      swrKeyFnName,
      swrProperties,
      swrKeyProperties,
      params,
      props,
      mutator,
      isRequestOptions,
      response,
      swrOptions: override.swr,
    })}
`;
};

export const generateSwrTitle: ClientTitleBuilder = () => '';

export const generateSwrHeader: ClientHeaderBuilder = ({
  isRequestOptions,
  isMutator,
  hasAwaitedType,
}) =>
  `
  ${
    !hasAwaitedType
      ? `type AwaitedInput<T> = PromiseLike<T> | T;\n
      type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;\n\n`
      : ''
  }
  ${
    isRequestOptions && isMutator
      ? `// eslint-disable-next-line
  type SecondParameter<T extends (...args: any) => any> = T extends (
  config: any,
  args: infer P,
) => any
  ? P
  : never;\n\n`
      : ''
  }`;

export const generateSwrFooter: ClientFooterBuilder = () => '';

export const generateSwr: ClientBuilder = (verbOptions, options) => {
  let imports = [] as GeneratorImport[];

    // GitHub #564 check if we want to exclude deprecated operations
    if (
      verbOptions.deprecated &&
      options.override.useDeprecatedOperations === false
    ) {
      return {
        implementation: ``,
        imports,
      };
    }
    imports = generateVerbImports(verbOptions);

  const functionImplementation = generateSwrRequestFunction(
    verbOptions,
    options,
  );
  const hookImplementation = generateSwrHook(verbOptions, options);

  return {
    implementation: `${functionImplementation}\n\n${hookImplementation}`,
    imports,
  };
};
