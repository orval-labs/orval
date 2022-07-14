import { VERBS_WITH_BODY } from '../../constants';
import {
  ClientFooterBuilder,
  GeneratorClient,
  GeneratorDependency,
  GeneratorOptions,
  GeneratorVerbOptions,
} from '../../types/generator';
import { pascal } from '../../utils/case';
import { sanitize, toObjectString } from '../../utils/string';
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
    ],
    dependency: 'axios',
  },
];

let returnTypesToWrite: Map<string, (title?: string) => string> = new Map();

export const getAxiosDependencies = (hasGlobalMutator: boolean) => [
  ...(!hasGlobalMutator ? AXIOS_DEPENDENCIES : []),
];

const generateAxiosImplementation = (
  {
    headers,
    queryParams,
    operationName,
    response,
    mutator,
    body,
    props,
    verb,
    override,
    formData,
    formUrlEncoded,
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
  const isBodyVerb = VERBS_WITH_BODY.includes(verb);

  if (mutator) {
    const isExactOptionalPropertyTypes =
      !!context.tsconfig?.compilerOptions?.exactOptionalPropertyTypes;

    const mutatorConfig = generateMutatorConfig({
      route,
      body,
      headers,
      queryParams,
      response,
      verb,
      isFormData,
      isFormUrlEncoded,
      isBodyVerb,
      hasSignal: true,
      isExactOptionalPropertyTypes,
    });

    const requestOptions = isRequestOptions
      ? generateMutatorRequestOptions(
          override?.requestOptions,
          mutator.hasSecondArg,
        )
      : '';

    returnTypesToWrite.set(
      operationName,
      (title?: string) =>
        `export type ${pascal(
          operationName,
        )}Result = NonNullable<Awaited<ReturnType<${
          title
            ? `ReturnType<typeof ${title}>['${operationName}']`
            : `typeof ${operationName}`
        }>>>`,
    );

    const propsImplementation =
      mutator.bodyTypeName && body.definition
        ? toObjectString(props, 'implementation').replace(
            new RegExp(`(\\w*):\\s?${body.definition}`),
            `$1: ${mutator.bodyTypeName}<${body.definition}>`,
          )
        : toObjectString(props, 'implementation');

    return `const ${operationName} = (\n    ${propsImplementation}\n ${
      isRequestOptions && mutator.hasSecondArg
        ? `options?: SecondParameter<typeof ${mutator.name}>,`
        : ''
    }${!isBodyVerb ? 'signal?: AbortSignal\n' : '\n'}) => {${bodyForm}
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
  });

  returnTypesToWrite.set(
    operationName,
    () =>
      `export type ${pascal(operationName)}Result = AxiosResponse<${
        response.definition.success || 'unknown'
      }>`,
  );

  return `const ${operationName} = <TData = AxiosResponse<${
    response.definition.success || 'unknown'
  }>>(\n    ${toObjectString(props, 'implementation')} ${
    isRequestOptions ? `options?: AxiosRequestConfig\n` : ''
  } ): Promise<TData> => {${bodyForm}
    return axios${
      !isSyntheticDefaultImportsAllowed ? '.default' : ''
    }.${verb}(${options});
  }
`;
};

export const generateAxiosTitle = (title: string) => {
  const sanTitle = sanitize(title);
  return `get${pascal(sanTitle)}`;
};

export const generateAxiosHeader = ({
  title,
  isRequestOptions,
  isMutator,
  noFunction,
}: {
  title: string;
  isRequestOptions: boolean;
  isMutator: boolean;
  noFunction?: boolean;
}) => `
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
}
  ${!noFunction ? `export const ${title} = () => {\n` : ''}`;

export const generateAxiosFooter: ClientFooterBuilder = ({
  operationNames,
  title,
  noFunction,
  hasMutator,
  hasAwaitedType,
}) => {
  const functionFooter = `return {${operationNames.join(',')}}};\n`;
  const returnTypesArr = operationNames
    .map((n) => {
      return returnTypesToWrite.has(n)
        ? returnTypesToWrite.get(n)?.(noFunction || !title ? undefined : title)
        : '';
    })
    .filter(Boolean);

  let returnTypes =
    hasMutator && !hasAwaitedType
      ? `\ntype AwaitedInput<T> = PromiseLike<T> | T;\n
    type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
\n`
      : '';

  if (returnTypesArr.length) {
    returnTypes += returnTypesArr.join('\n');
  }

  // quick fix to clear global state
  returnTypesToWrite = new Map();

  return noFunction ? returnTypes : functionFooter + returnTypes;
};

export const generateAxios = (
  verbOptions: GeneratorVerbOptions,
  options: GeneratorOptions,
): GeneratorClient => {
  const imports = generateVerbImports(verbOptions);
  const implementation = generateAxiosImplementation(verbOptions, options);

  return { implementation, imports };
};
