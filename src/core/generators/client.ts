import { OutputClient } from '../../types';
import { GeneratorOptions, GeneratorVerbsOptions } from '../../types/generator';
import { pascal } from '../../utils/case';
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
import { generateMSW } from './msw';

const DEFAULT_CLIENT = OutputClient.AXIOS;

const GENERATOR_CLIENT = {
  [OutputClient.AXIOS]: {
    client: generateAxios,
    mock: generateAxiosMock,
    msw: generateMSW,
    header: generateAxiosHeader,
    imports: generateAxiosImports,
    footer: generateAxiosFooter,
    title: generateAxiosTitle,
  },
  [OutputClient.ANGULAR]: {
    client: generateAngular,
    mock: generateAngularMock,
    msw: generateMSW,
    header: generateAngularHeader,
    imports: generateAngularImports,
    footer: generateAngularFooter,
    title: generateAngularTitle,
  },
};
export const generateClientImports = (
  outputClient: OutputClient = DEFAULT_CLIENT,
) => {
  return {
    ...GENERATOR_CLIENT[outputClient].imports(),
    implementationMSW: `import { rest } from 'msw'
    import faker from 'faker'\n`,
  };
};

export const generateClientHeader = (
  outputClient: OutputClient = DEFAULT_CLIENT,
  title: string,
) => {
  return {
    ...GENERATOR_CLIENT[outputClient].header(title),
    implementationMSW: `export const get${pascal(title)}MSW = () => [\n`,
  };
};

export const generateClientFooter = (
  outputClient: OutputClient = DEFAULT_CLIENT,
) => {
  return {
    ...GENERATOR_CLIENT[outputClient].footer(),
    implementationMSW: `]\n`,
  };
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
    const mock = generator.mock(verbOption, options);
    const msw = generator.msw(verbOption, options);

    return {
      ...acc,
      [verbOption.operationId]: {
        definition: client.definition,
        implementation: client.implementation,
        imports: client.imports,
        implementationMocks: mock.implementation,
        implementationMSW: msw,
        importsMocks: mock.imports,
        tags: verbOption.tags,
      },
    };
  }, {});
};
