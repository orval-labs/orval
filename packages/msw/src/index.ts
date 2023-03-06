import {
  generateDependencyImports,
  GenerateMockImports,
  GeneratorDependency,
  GeneratorOptions,
  GeneratorVerbOptions,
  pascal,
} from '@orval/core';
import { getRouteMSW } from './getters';
import { getMockDefinition, getMockOptionsDataOverride } from './mocks';
import { MockValue, serializeMockValue } from './types';

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

export const generateMSW = (
  { operationId, response, verb, tags }: GeneratorVerbOptions,
  { pathRoute, override, context }: GeneratorOptions,
) => {
  const { definitions, imports } = getMockDefinition({
    operationId,
    tags,
    response,
    override,
    context,
  });

  const route = getRouteMSW(pathRoute, override?.mock?.baseUrl);
  const mockData = getMockOptionsDataOverride(operationId, override);

  let value: MockValue | undefined = undefined;

  if (mockData) {
    value = mockData;
  } else if (definitions.length > 1) {
    value = {
      type: 'oneOf',
      value: definitions,
    };
  } else if (definitions[0]) {
    value = definitions[0];
  }

  const responseType = response.contentTypes.includes('text/plain')
    ? 'text'
    : 'json';

  console.log(operationId, value, definitions);

  return {
    implementation: {
      function: value
        ? `export const get${pascal(
            operationId,
          )}Mock = () => (${serializeMockValue(value)})\n\n`
        : '',
      handler: `rest.${verb}('${route}', (_req, res, ctx) => {
        return res(
          ctx.delay(${override?.mock?.delay ?? 1000}),
          ctx.status(200, 'Mocked status'),${
            value
              ? `\nctx.${responseType}(get${pascal(operationId)}Mock()),`
              : ''
          }
        )
      }),`,
    },
    imports,
  };
};
