import {
  generateDependencyImports,
  GenerateMockImports,
  GeneratorDependency,
  GeneratorOptions,
  GeneratorVerbOptions,
  NormalizedOverrideOutput,
  pascal,
} from '@orval/core';
import { getRouteMSW } from './getters';
import { getMockDefinition, getMockOptionsDataOverride } from './mocks';

const MSW_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      { name: 'http', values: true },
      { name: 'HttpResponse', values: true },
      { name: 'delay', values: true },
    ],
    dependency: 'msw',
  },
  {
    exports: [{ name: 'faker', values: true }],
    dependency: '@faker-js/faker',
  },
];

export const generateMSWImports: GenerateMockImports = ({
  implementation,
  imports,
  specsName,
  hasSchemaDir,
  isAllowSyntheticDefaultImports,
}) => {
  return generateDependencyImports(
    implementation,
    [...MSW_DEPENDENCIES, ...imports],
    specsName,
    hasSchemaDir,
    isAllowSyntheticDefaultImports,
  );
};

const getDelay = (override?: NormalizedOverrideOutput): number => {
  const overrideDelay = override?.mock?.delay;
  switch (typeof overrideDelay) {
    case 'function':
      return overrideDelay();
    case 'number':
      return overrideDelay;
    default:
      return 1000;
  }
};

export const generateMSW = (
  { operationId, response, verb, tags }: GeneratorVerbOptions,
  { pathRoute, override, context }: GeneratorOptions,
) => {
  const { definitions, definition, imports } = getMockDefinition({
    operationId,
    tags,
    response,
    override,
    context,
  });

  const route = getRouteMSW(pathRoute, override?.mock?.baseUrl);
  const mockData = getMockOptionsDataOverride(operationId, override);

  let value = '';

  if (mockData) {
    value = mockData;
  } else if (definitions.length > 1) {
    value = `faker.helpers.arrayElement(${definition})`;
  } else if (definitions[0]) {
    value = definitions[0];
  }

  const isTextPlain = response.contentTypes.includes('text/plain');

  const functionName = `get${pascal(operationId)}Mock`;

  return {
    implementation: {
      function:
        value && value !== 'undefined'
          ? `export const ${functionName} = () => (${value})\n\n`
          : '',
      handler: `http.${verb}('${route}', async () => {
        await delay(${getDelay(override)});
        return new HttpResponse(${
          value && value !== 'undefined'
            ? isTextPlain
              ? `${functionName}()`
              : `JSON.stringify(${functionName}())`
            : null
        },
          { 
            status: 200,
            headers: {
              'Content-Type': '${
                isTextPlain ? 'text/plain' : 'application/json'
              }',
            }
          }
        )
      }),`,
    },
    imports,
  };
};
