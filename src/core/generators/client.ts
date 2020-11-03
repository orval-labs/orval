import { OutputClient } from '../../types';
import {
  GeneratorClientExtra,
  GeneratorOperations,
  GeneratorOptions,
  GeneratorVerbsOptions,
} from '../../types/generator';
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
import {
  generateReactQuery,
  generateReactQueryFooter,
  generateReactQueryHeader,
  generateReactQueryImports,
  generateReactQueryTitle,
} from './react-query';

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
  [OutputClient.REACT_QUERY]: {
    client: generateReactQuery,
    mock: () => '',
    msw: generateMSW,
    header: generateReactQueryHeader,
    imports: generateReactQueryImports,
    footer: generateReactQueryFooter,
    title: generateReactQueryTitle,
  },
};
export const generateClientImports = (
  outputClient: OutputClient = DEFAULT_CLIENT,
): GeneratorClientExtra => {
  return {
    ...GENERATOR_CLIENT[outputClient].imports(),
    implementationMSW: `import { rest } from 'msw'
    import faker from 'faker'\n`,
  };
};

export const generateClientHeader = (
  outputClient: OutputClient = DEFAULT_CLIENT,
  title: string,
  customTitleFunc?: (title: string) => string,
): GeneratorClientExtra => {
  const titles = generateClientTitle(outputClient, title, customTitleFunc);
  return {
    ...GENERATOR_CLIENT[outputClient].header(titles),
    implementationMSW: `export const ${titles.implementationMSW} = () => [\n`,
  };
};

export const generateClientFooter = (
  outputClient: OutputClient = DEFAULT_CLIENT,
): GeneratorClientExtra => {
  return {
    ...GENERATOR_CLIENT[outputClient].footer(),
    implementationMSW: `]\n`,
  };
};

export const generateClientTitle = (
  outputClient: OutputClient = DEFAULT_CLIENT,
  title: string,
  customTitleFunc?: (title: string) => string,
) => {
  if (customTitleFunc) {
    const customTitle = customTitleFunc(title);
    return {
      ...GENERATOR_CLIENT[outputClient].title(customTitleFunc(title)),
      implementationMSW: `get${pascal(customTitle)}MSW`,
    };
  }
  return {
    ...GENERATOR_CLIENT[outputClient].title(title),
    implementationMSW: `get${pascal(title)}MSW`,
  };
};

export const generateClient = (
  outputClient: OutputClient = DEFAULT_CLIENT,
  verbsOptions: GeneratorVerbsOptions,
  options: GeneratorOptions,
): GeneratorOperations => {
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
        implementationMocks: mock,
        implementationMSW: msw.implementation,
        importsMocks: msw.imports,
        tags: verbOption.tags,
      },
    };
  }, {});
};
