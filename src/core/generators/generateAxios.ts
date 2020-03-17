import {camel} from 'case';
import {
  GeneratorOptions,
  GeneratorSchema,
  GeneratorVerbOptions
} from '../../types/generator';
import {GetterBody, GetterResponse} from '../../types/getters';

const generateAxiosProps = ({
  route,
  body,
  queryParams,
  response
}: {
  route: string;
  body: GetterBody;
  queryParams?: GeneratorSchema;
  response: GetterResponse;
}) => {
  return `\`${route}\` ${
    body.definition
      ? body.isBlob
        ? ', formData'
        : `, ${body.implementation}`
      : ''
  } ${
    queryParams || response.isBlob
      ? `,
      {
        ${queryParams ? 'params' : ''}${
          queryParams && response.isBlob ? ',' : ''
        }${response.isBlob ? `responseType: 'blob',` : ''}
      }`
      : ''
  }`;
};

const generateAxiosDefinition = (
  {props, definitionName, response}: GeneratorVerbOptions,
  {summary}: GeneratorOptions
) => {
  return `${summary ? '// ' + summary : ''}
  ${definitionName}(${props.definition}): AxiosPromise<${response.definition}>`;
};

const generateAxiosImplementation = (
  {
    queryParams,
    definitionName,
    response,
    transformer,
    body,
    props,
    verb
  }: GeneratorVerbOptions,
  {route}: GeneratorOptions
) => {
  const axiosProps = generateAxiosProps({route, body, queryParams, response});

  return `  ${definitionName}(${props.implementation}): AxiosPromise<${
    response.definition
  }> {${transformer}${
    body.isBlob
      ? `const formData = new FormData(); formData.append('file', ${camel(
          body.implementation
        )});`
      : ''
  }
    return axios.${verb}(${
    transformer ? `...transformer(${axiosProps})` : axiosProps
  });
  },
`;
};

const generateImports = ({
  response,
  body,
  queryParams
}: GeneratorVerbOptions) => [
  ...response.imports,
  ...body.imports,
  ...(queryParams ? [queryParams.name] : [])
];

export const generateAxiosHeader = (title: string) => ({
  definition: `export interface ${title} {`,
  implementation: `export const get${title} = (axios: AxiosInstance): ${title} => ({\n`
});

export const generateAxios = (
  verbOptions: GeneratorVerbOptions,
  options: GeneratorOptions
) => {
  const imports = generateImports(verbOptions);
  const definition = generateAxiosDefinition(verbOptions, options);
  const implementation = generateAxiosImplementation(verbOptions, options);

  return {definition, implementation, imports};
};
