import { GeneratorOptions, GeneratorVerbOptions } from '../../types/generator';
import { camel } from '../../utils/case';
import { generateFormData } from './formData';
import { generateOptions } from './options';

export const generateReactQueryImports = () => ({
  definition: ``,
  implementation: `import { useQuery, QueryConfig } from 'react-query';\n`,
  implementationMock: '',
});

const generateReactQueryImplementation = (
  {
    queryParams,
    definitionName,
    response,
    mutator,
    body,
    props,
    verb,
    params,
  }: GeneratorVerbOptions,
  { route }: GeneratorOptions,
) => {
  const options = generateOptions({
    route,
    body,
    queryParams,
    response,
    verb,
  });

  return `export const ${camel(`use-${definitionName}`)} = <TResult = ${
    response.definition
  }, TError = unknown>(\n    ${
    props.implementation
  }\n queryConfig?: QueryConfig<TResult, TError>\n  ) => {${mutator}${generateFormData(
    body,
  )}
    return useQuery<TResult, TError>(['${verb}', ${
    mutator ? `...mutator(${options})` : options
  }], ${
    params.length
      ? `{enabled: ${params
          .map(({ name }) => name)
          .join(' && ')}, ...queryConfig}`
      : 'queryConfig'
  } )
  }
`;
};

const generateImports = ({
  response,
  body,
  queryParams,
}: GeneratorVerbOptions) => [
  ...response.imports,
  ...body.imports,
  ...(queryParams ? [queryParams.schema.name] : []),
];

export const generateReactQueryTitle = (title: string) => {
  return {
    definition: ``,
    implementation: ``,
    implementationMock: ``,
  };
};

export const generateReactQueryHeader = (title: string) => {
  return {
    definition: ``,
    implementation: ``,
    implementationMock: ``,
  };
};

export const generateReactQueryFooter = () => {
  return {
    definition: '',
    implementation: '',
    implementationMock: '',
  };
};

export const generateReactQuery = (
  verbOptions: GeneratorVerbOptions,
  options: GeneratorOptions,
) => {
  const imports = generateImports(verbOptions);
  const implementation = generateReactQueryImplementation(verbOptions, options);

  return { definition: '', implementation, imports };
};
