import { OutputClient } from '../../types';
import { GeneratorOptions, GeneratorVerbsOptions } from '../../types/generator';
import {
  generateAngular,
  generateAngularFooter,
  generateAngularHeader,
  generateAngularImports,
  generateAngularTitle,
} from './angular';
import { generateAngularMock } from './angular.mock';
import {
  generateAxios,
  generateAxiosFooter,
  generateAxiosHeader,
  generateAxiosImports,
  generateAxiosTitle,
} from './axios';
import { generateAxiosMock } from './axios.mock';

const DEFAULT_CLIENT = OutputClient.AXIOS;

const GENERATOR_CLIENT = {
  [OutputClient.AXIOS]: {
    client: generateAxios,
    mock: generateAxiosMock,
    header: generateAxiosHeader,
    imports: generateAxiosImports,
    footer: generateAxiosFooter,
    title: generateAxiosTitle,
  },
  [OutputClient.ANGULAR]: {
    client: generateAngular,
    mock: generateAngularMock,
    header: generateAngularHeader,
    imports: generateAngularImports,
    footer: generateAngularFooter,
    title: generateAngularTitle,
  },
};
export const generateClientImports = (
  outputClient: OutputClient = DEFAULT_CLIENT,
) => {
  return GENERATOR_CLIENT[outputClient].imports();
};

export const generateClientHeader = (
  outputClient: OutputClient = DEFAULT_CLIENT,
  title: string,
) => {
  return GENERATOR_CLIENT[outputClient].header(title);
};

export const generateClientFooter = (
  outputClient: OutputClient = DEFAULT_CLIENT,
) => {
  return GENERATOR_CLIENT[outputClient].footer();
};

export const generateClientTitle = (
  outputClient: OutputClient = DEFAULT_CLIENT,
  title: string,
) => {
  return GENERATOR_CLIENT[outputClient].title(title);
};

export const generateClient = (
  outputClient: OutputClient = DEFAULT_CLIENT,
  verbsOptions: GeneratorVerbsOptions,
  options: GeneratorOptions,
) => {
  return verbsOptions.reduce((acc, verbOption) => {
    const generator = GENERATOR_CLIENT[outputClient];
    const client = generator.client(verbOption, options);
    const mock = generator.mock(verbOption, options.specs);

    return {
      ...acc,
      [verbOption.operationId]: {
        definition: client.definition,
        implementation: client.implementation,
        imports: client.imports,
        implementationMocks: mock.implementation,
        importsMocks: mock.imports,
        tags: verbOption.tags,
      },
    };
  }, {});
};
