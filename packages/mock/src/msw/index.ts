import {
  generateDependencyImports,
  GenerateMockImports,
  GeneratorDependency,
  GeneratorOptions,
  GeneratorVerbOptions,
  isFunction,
  pascal,
} from '@orval/core';
import { getRouteMSW, overrideVarName } from '../faker/getters';
import { getMockDefinition, getMockOptionsDataOverride } from './mocks';
import { getDelay } from '../delay';

const getMSWDependencies = (locale?: string): GeneratorDependency[] => [
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
    dependency: locale ? `@faker-js/faker/locale/${locale}` : '@faker-js/faker',
  },
];

export const generateMSWImports: GenerateMockImports = ({
  implementation,
  imports,
  specsName,
  hasSchemaDir,
  isAllowSyntheticDefaultImports,
  options,
}) => {
  return generateDependencyImports(
    implementation,
    [...getMSWDependencies(options?.locale), ...imports],
    specsName,
    hasSchemaDir,
    isAllowSyntheticDefaultImports,
  );
};

export const generateMSW = (
  { operationId, response, verb, tags }: GeneratorVerbOptions,
  { pathRoute, override, context, mock }: GeneratorOptions,
) => {
  const { definitions, definition, imports } = getMockDefinition({
    operationId,
    tags,
    response,
    override,
    context,
    mockOptions: !isFunction(mock) ? mock : undefined,
  });

  const route = getRouteMSW(
    pathRoute,
    override?.mock?.baseUrl ?? (!isFunction(mock) ? mock?.baseUrl : undefined),
  );
  const mockData = getMockOptionsDataOverride(operationId, override);

  let value = '';

  if (mockData) {
    value = mockData;
  } else if (definitions.length > 1) {
    value = `faker.helpers.arrayElement(${definition})`;
  } else if (definitions[0]) {
    value = definitions[0];
  }

  const isResponseOverridable = value.includes(overrideVarName);
  const isTextPlain = response.contentTypes.includes('text/plain');
  const isReturnHttpResponse = value && value !== 'undefined';

  const returnType = response.definition.success;
  const functionName = `get${pascal(operationId)}Mock`;
  const handlerName = `get${pascal(operationId)}MockHandler`;

  const includeReturnTypeImports =
    isReturnHttpResponse && !isTextPlain
      ? [...imports, { name: returnType, values: true }]
      : imports;

  const handlerImplementation = `
export const ${handlerName} = (${isReturnHttpResponse && !isTextPlain ? `overrideResponse?: ${returnType}` : ''}) => {
  return http.${verb}('${route}', async () => {
    await delay(${getDelay(override, !isFunction(mock) ? mock : undefined)});
    return new HttpResponse(${
      isReturnHttpResponse
        ? isTextPlain
          ? `${functionName}()`
          : `JSON.stringify(overrideResponse ? overrideResponse : ${functionName}())`
        : null
    },
      {
        status: 200,
        headers: {
          'Content-Type': '${isTextPlain ? 'text/plain' : 'application/json'}',
        }
      }
    )
  })
}\n`;

  return {
    implementation: {
      function: isReturnHttpResponse
        ? `export const ${functionName} = (${isResponseOverridable ? `overrideResponse: any = {}` : ''}): ${returnType} => (${value})\n\n`
        : '',
      handlerName: handlerName,
      handler: handlerImplementation,
    },
    imports: includeReturnTypeImports,
  };
};
