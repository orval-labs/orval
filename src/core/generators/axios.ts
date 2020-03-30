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
    return ', formData';
  }

  return `, ${body.implementation || 'undefined'}`;
};

const generateQueryParamsProps = (
  response: GetterResponse,
  queryParams?: GeneratorSchema,
) => {
  if (!queryParams && !response.isBlob) {
    return '';
  }

  let value = ',{';

  if (queryParams) {
    value += 'params';
  }

  if (queryParams && response.isBlob) {
    value += ',';
  }

  if (response.isBlob) {
    value += `responseType: 'blob',`;
  }

  value += '}';

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
  return `\`${route}\` ${generateBodyProps(
    body,
    verb,
  )} ${generateQueryParamsProps(response, queryParams)}`;
};

const generateAxiosDefinition = ({
  props,
  definitionName,
  response,
  summary,
}: GeneratorVerbOptions) => {
  let value = '';

  if (summary) {
    value += `\n// ${summary}`;
  }

  value += `\n${definitionName}(${props.definition}): AxiosPromise<${response.definition}>;`;

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
    transformer,
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

  return `  ${definitionName}(${props.implementation}): AxiosPromise<${
    response.definition
  }> {${transformer}${generateFormData(body)}
    return axios.${verb}(${
    transformer ? `...transformer(${axiosProps})` : axiosProps
  });
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
