import { camel } from 'case';
import { VERBS_WITH_BODY } from '../../constants';
import { Verbs } from '../../types';
import {
  GeneratorOptions,
  GeneratorSchema,
  GeneratorVerbOptions,
} from '../../types/generator';
import { GetterBody, GetterResponse } from '../../types/getters';

const generateBodyProps = (body: GetterBody, verb: Verbs) => {
  if (!VERBS_WITH_BODY.includes(verb)) {
    return '';
  }

  if (body.isBlob) {
    return '\n      formData,';
  }

  return `\n      ${body.implementation || 'undefined'},`;
};

const generateQueryParamsProps = (
  response: GetterResponse,
  queryParams?: GeneratorSchema,
) => {
  if (!queryParams && !response.isBlob) {
    return '';
  }

  let value = '\n      {';

  if (queryParams) {
    value += '\n        params,';
  }

  if (response.isBlob) {
    value += `\n        responseType: 'blob',`;
  }

  value += '\n      },';

  return value;
};

const generateAxiosProps = ({
  route,
  body,
  queryParams,
  response,
  verb,
}: {
  route: string;
  body: GetterBody;
  queryParams?: GeneratorSchema;
  response: GetterResponse;
  verb: Verbs;
}) => {
  return `\n      \`${route}\`,${generateBodyProps(
    body,
    verb,
  )}${generateQueryParamsProps(response, queryParams)}\n    `;
};

const generateAxiosDefinition = ({
  props,
  definitionName,
  response,
  summary,
}: GeneratorVerbOptions) => {
  let value = '';

  if (summary) {
    value += `\n  // ${summary}`;
  }

  value += `\n  ${definitionName}(\n    ${props.definition}\n  ): AxiosPromise<${response.definition}>;`;

  return value;
};

const generateFormData = (body: GetterBody) => {
  if (!body.isBlob) {
    return '';
  }

  return `const formData = new FormData(); formData.append('file', ${camel(
    body.implementation,
  )});`;
};

const generateAxiosImplementation = (
  {
    queryParams,
    definitionName,
    response,
    mutator,
    body,
    props,
    verb,
  }: GeneratorVerbOptions,
  { route }: GeneratorOptions,
) => {
  const axiosProps = generateAxiosProps({
    route,
    body,
    queryParams,
    response,
    verb,
  });

  return `  ${definitionName}(\n    ${
    props.implementation
  }\n  ): AxiosPromise<${response.definition}> {${mutator}${generateFormData(
    body,
  )}
    return axios.${verb}(${mutator ? `...mutator(${axiosProps})` : axiosProps});
  },
`;
};

const generateImports = ({
  response,
  body,
  queryParams,
}: GeneratorVerbOptions) => [
  ...response.imports,
  ...body.imports,
  ...(queryParams ? [queryParams.name] : []),
];

export const generateAxiosHeader = (title: string) => ({
  definition: `export interface ${title} {`,
  implementation: `export const get${title} = (axios: AxiosInstance): ${title} => ({\n`,
});

export const generateAxios = (
  verbOptions: GeneratorVerbOptions,
  options: GeneratorOptions,
) => {
  const imports = generateImports(verbOptions);
  const definition = generateAxiosDefinition(verbOptions);
  const implementation = generateAxiosImplementation(verbOptions, options);

  return { definition, implementation, imports };
};
