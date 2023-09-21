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
    exports: [{ name: 'rest', values: true }],
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

  const responseType = response.contentTypes.includes('text/plain')
    ? 'text'
    : 'json';

  return {
    implementation: {
      function:
        value && value !== 'undefined'
          ? `export const get${pascal(operationId)}Mock = () => (${value})\n\n`
          : '',
      handler: `rest.${verb}('${route}', (_req, res, ctx) => {
        return res(
          ctx.delay(${getDelay(override)}),
          ctx.status(200, 'Mocked status'),${
            value && value !== 'undefined'
              ? `\nctx.${responseType}(get${pascal(operationId)}Mock()),`
              : ''
          }
        )
      }),`,
    },
    imports,
  };
};
