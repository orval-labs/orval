import { GeneratorOptions, GeneratorVerbsOptions } from '../../types/generator';
import { generateAxios, generateAxiosHeader } from './axios';
import { generateMock } from './mocks';

export const generateClientHeader = (title: string) => {
  return {
    ...generateAxiosHeader(title),
    implementationMock: `export const get${title}Mock = (): ${title} => ({\n`,
  };
};

export const generateClientFooter = () => {
  return {
    definition: '\n}\n',
    implementation: '});\n',
    implementationMock: '})\n',
  };
};

export const generateClient = (
  verbsOptions: GeneratorVerbsOptions,
  options: GeneratorOptions,
) => {
  return verbsOptions.reduce((acc, verbOption) => {
    const axios = generateAxios(verbOption, options);
    const mock = generateMock(verbOption, options.specs, options.override);

    return {
      ...acc,
      [verbOption.operationId]: {
        definition: axios.definition,
        implementation: axios.implementation,
        imports: axios.imports,
        implementationMocks: mock.implementation,
        importsMocks: mock.imports,
        tags: verbOption.tags,
      },
    };
  }, {});
};
