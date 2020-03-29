import {GeneratorOptions, GeneratorVerbsOptions} from '../../types/generator';
import {generateAxios, generateAxiosHeader} from './axios';

export const generateClientHeader = (title: string) => {
  return {
    ...generateAxiosHeader(title),
    implementationMock: `export const get${title}Mock = (): ${title} => ({\n`
  };
};

export const generateClientFooter = () => {
  return {definition: '\n};', implementation: '});', implementationMock: '})'};
};

export const generateClient = (
  verbsOptions: GeneratorVerbsOptions,
  options: GeneratorOptions
) => {
  return verbsOptions.reduce(
    (acc, verbOption) => {
      const {definition, implementation, imports} = generateAxios(
        verbOption,
        options
      );
      acc.definition += definition;
      acc.implementation += implementation;
      acc.imports = [...acc.imports, ...imports];
      return acc;
    },
    {
      definition: '',
      implementation: '',
      imports: [] as string[]
    }
  );
};
