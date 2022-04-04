import { Verbs } from '../../types';
import {
  GeneratorDependency,
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
import { toObjectString } from '../../utils/string';
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

export const getSwrDependencies = (hasGlobalMutator: boolean) => [
  ...(!hasGlobalMutator ? AXIOS_DEPENDENCIES : []),
  ...SWR_DEPENDENCIES,
];

const generateSwrRequestFunction = (
  {
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
      queryParams,
      response,
      verb,
      isFormData,
      isFormUrlEncoded,
    });

    const requestOptions = isRequestOptions
      ? generateMutatorRequestOptions(
          override?.requestOptions,
          mutator.hasSecondArg,
        )
      : '';

    return `export const ${operationName} = (\n    ${toObjectString(
      props,
      'implementation',
    )}\n ${
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
    queryParams,
    response,
    verb,
    requestOptions: override?.requestOptions,
    isFormData,
    isFormUrlEncoded,
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
  const definition = `SWRConfiguration<AsyncReturnType<typeof ${operationName}>, TError> & {swrKey: Key}`;

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
  swrProps,
  swrKeyFnName,
  properties,
  params,
  mutator,
  isRequestOptions,
  response,
}: {
  isRequestOptions: boolean;
  operationName: string;
  swrProps: string;
  swrKeyFnName: string;
  properties: string;
  params: GetterParams;
  props: GetterProps;
  response: GetterResponse;
  mutator?: GeneratorMutator;
}) => {
  const httpFunctionProps = properties;

  const swrKeyImplementation = params.length
    ? `const isEnable = !!(${params.map(({ name }) => name).join(' && ')})
  const swrKey = swrOptions?.swrKey ?? (() => isEnable ? ${swrKeyFnName}(${properties}) : null);`
    : `const swrKey = swrOptions?.swrKey ?? (() => ${swrKeyFnName}(${properties}))`;

  let errorType = `AxiosError<${response.definition.errors || 'unknown'}>`;

  if (mutator) {
    errorType = mutator.hasErrorType
      ? `ErrorType<${response.definition.errors || 'unknown'}>`
      : response.definition.errors || 'unknown';
  }

  return `
export type ${pascal(
    operationName,
  )}QueryResult = NonNullable<AsyncReturnType<typeof ${operationName}>>
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
        }} = options || {}`
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

  const query = useSwr<AsyncReturnType<typeof swrFn>, TError>(swrKey, swrFn, swrOptions)

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

  const properties = props
    .map(({ name, type }) =>
      type === GetterPropType.BODY ? body.implementation : name,
    )
    .join(',');

  const swrKeyFnName = camel(`get-${operationName}-key`);
  const swrProps = toObjectString(props, 'implementation');

  return `export const ${swrKeyFnName} = (${swrProps}) => [\`${route}\`${
    queryParams ? ', ...(params ? [params]: [])' : ''
  }${body.implementation ? `, ${body.implementation}` : ''}];

    ${generateSwrImplementation({
      operationName,
      swrProps,
      swrKeyFnName,
      properties,
      params,
      props,
      mutator,
      isRequestOptions,
      response,
    })}
`;
};

export const generateSwrTitle = () => '';

export const generateSwrHeader = ({
  isRequestOptions,
  isMutator,
}: {
  isRequestOptions: boolean;
  isMutator: boolean;
}) => `// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AsyncReturnType<
T extends (...args: any) => Promise<any>
> = T extends (...args: any) => Promise<infer R> ? R : any;\n\n
${
  isRequestOptions && isMutator
    ? `// eslint-disable-next-line @typescript-eslint/no-explicit-any
  type SecondParameter<T extends (...args: any) => any> = T extends (
  config: any,
  args: infer P,
) => any
  ? P
  : never;\n\n`
    : ''
}`;

export const generateSwrFooter = () => '';

export const generateSwr = (
  verbOptions: GeneratorVerbOptions,
  options: GeneratorOptions,
) => {
  const imports = generateVerbImports(verbOptions);
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
