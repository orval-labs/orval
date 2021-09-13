import { Verbs } from '../../types';
import {
  GeneratorDependency,
  GeneratorMutator,
  GeneratorOptions,
  GeneratorVerbOptions,
} from '../../types/generator';
import {
  GetterBody,
  GetterParams,
  GetterProps,
  GetterPropType,
  GetterResponse,
} from '../../types/getters';
import { camel } from '../../utils/case';
import { toObjectString } from '../../utils/string';
import { generateVerbImports } from './imports';
import {
  generateMutatorConfig,
  generateMutatorRequestOptions,
  generateOptions,
} from './options';

const AXIOS_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      { name: 'axios', default: true, values: true },
      { name: 'AxiosRequestConfig' },
      { name: 'AxiosResponse' },
    ],
    dependency: 'axios',
  },
];

const SWR_DEPENDENCIES: GeneratorDependency[] = [
  ...AXIOS_DEPENDENCIES,
  {
    exports: [
      { name: 'useSwr', values: true, default: true },
      { name: 'SWRConfiguration' },
      { name: 'Key' },
    ],
    dependency: 'swr',
  },
];

export const getSwrDependencies = () => SWR_DEPENDENCIES;

const generateSwrFormDataFunction = ({
  isFormData,
  formData,
  body,
}: {
  body: GetterBody;
  formData: GeneratorMutator | undefined;
  isFormData: boolean;
}) => {
  if (!isFormData) {
    return '';
  }

  if (formData && body.formData) {
    return `const formData = ${formData.name}(${body.implementation})`;
  }

  return body.formData;
};

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
    override,
  }: GeneratorVerbOptions,
  { route }: GeneratorOptions,
) => {
  const isRequestOptions = override?.requestOptions !== false;
  const isFormData = override?.formData !== false;

  const formDataImplementation = generateSwrFormDataFunction({
    isFormData,
    formData,
    body,
  });

  if (mutator) {
    const mutatorConfig = generateMutatorConfig({
      route,
      body,
      queryParams,
      response,
      verb,
      isFormData,
    });

    const isMutatorHasSecondArg = mutator.mutatorFn.length > 1;
    const requestOptions = isRequestOptions
      ? generateMutatorRequestOptions(
          override?.requestOptions,
          isMutatorHasSecondArg,
        )
      : '';

    return `export const ${operationName} = (\n    ${toObjectString(
      props,
      'implementation',
    )}\n ${
      isRequestOptions && isMutatorHasSecondArg
        ? `options?: SecondParameter<typeof ${mutator.name}>`
        : ''
    }) => {${formDataImplementation}
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
  });

  return `export const ${operationName} = (\n    ${toObjectString(
    props,
    'implementation',
  )} ${
    isRequestOptions ? `options?: AxiosRequestConfig\n` : ''
  } ): Promise<AxiosResponse<${
    response.definition.success || 'unknown'
  }>> => {${formDataImplementation}
    return axios.${verb}(${options});
  }
`;
};

const generateSwrArguments = ({
  operationName,
  mutator,
  isRequestOptions,
  isMutatorHasSecondArg,
}: {
  operationName: string;
  mutator?: GeneratorMutator;
  isRequestOptions: boolean;
  isMutatorHasSecondArg: boolean;
}) => {
  const definition = `SWRConfiguration<AsyncReturnType<typeof ${operationName}>, TError> & {swrKey: Key}`;

  if (!isRequestOptions) {
    return `swrOptions?: ${definition}`;
  }

  return `options?: { swr?:${definition}, ${
    !mutator
      ? `axios?: AxiosRequestConfig`
      : isMutatorHasSecondArg
      ? `request?: SecondParameter<typeof ${mutator.name}>`
      : ''
  }}\n`;
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

  const isMutatorHasSecondArg = !!mutator && mutator.mutatorFn.length > 1;
  const swrKeyImplementation = params.length
    ? `const isEnable = !!(${params.map(({ name }) => name).join(' && ')})
  const swrKey = swrOptions?.swrKey ?? (() => isEnable ? ${swrKeyFnName}(${properties}) : null);`
    : `const swrKey = swrOptions?.swrKey ?? (() => ${swrKeyFnName}(${properties}))`;

  return `
export const ${camel(`use-${operationName}`)} = <TError = ${
    response.definition.errors || 'unknown'
  }>(\n ${swrProps} ${generateSwrArguments({
    operationName,
    mutator,
    isRequestOptions,
    isMutatorHasSecondArg,
  })}\n  ) => {

  ${
    isRequestOptions
      ? `const {swr: swrOptions${
          !mutator
            ? `, axios: axiosOptions`
            : isMutatorHasSecondArg
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
        : isMutatorHasSecondArg
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
}) => `type AsyncReturnType<
T extends (...args: any) => Promise<any>
> = T extends (...args: any) => Promise<infer R> ? R : any;\n\n
${
  isRequestOptions && isMutator
    ? `type SecondParameter<T extends (...args: any) => any> = T extends (
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
