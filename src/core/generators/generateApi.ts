import {pascal} from 'case';
import {OpenAPIObject, PathItemObject} from 'openapi3-ts';
import {MockOptions, OverrideOptions} from '../../types';
import {GeneratorApiResponse, GeneratorSchema} from '../../types/generator';
import {generalTypesFilter} from '../../utils/filters';
import {
  generateClient,
  generateClientFooter,
  generateClientHeader
} from './generateClient';
import {generateMocks} from './generateMocks';
import {generateVerbsOptions} from './generateVerbsOptions';

export const generateApi = (
  specs: OpenAPIObject,
  override?: OverrideOptions,
  mockOptions?: MockOptions
) => {
  return Object.entries(specs.paths).reduce<GeneratorApiResponse>(
    (acc, [pathRoute, verbs]: [string, PathItemObject], index, arr) => {
      const route = pathRoute.replace(/\{/g, '${');

      if (!index) {
        const header = generateClientHeader(pascal(specs.info.title));
        acc.definition += header.definition;
        acc.implementation += header.implementation;
        acc.implementationMocks += header.implementationMock;
      }

      const verbsOptions = generateVerbsOptions({
        verbs,
        override,
        route,
        components: specs.components
      });

      const schemas = verbsOptions.reduce<GeneratorSchema[]>(
        (acc, {queryParams}) => (queryParams ? [...acc, queryParams] : acc),
        []
      );

      const client = generateClient(verbsOptions, {
        route,
        summary: verbs.summary
      });

      if (mockOptions) {
        const mocks = generateMocks(verbsOptions, mockOptions, specs);
        acc.imports = [...acc.imports, ...mocks.imports];
        acc.implementationMocks += mocks.implementation;
      }

      acc.imports = [...acc.imports, ...client.imports];
      acc.definition += client.definition;
      acc.implementation += client.implementation;
      acc.schemas = [...acc.schemas, ...schemas];

      if (index === arr.length - 1) {
        const footer = generateClientFooter();
        acc.definition += footer.definition;
        acc.implementation += footer.implementation;
        acc.implementationMocks += footer.implementationMock;
        acc.imports = generalTypesFilter(acc.imports);
      }

      return acc;
    },
    {
      imports: [],
      definition: '',
      implementation: '',
      implementationMocks: '',
      schemas: []
    }
  );
};
