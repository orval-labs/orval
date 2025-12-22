import {
  type ClientMockGeneratorBuilder,
  generateDependencyImports,
  type GenerateMockImports,
  type GeneratorDependency,
  type GeneratorImport,
  type GeneratorOptions,
  type GeneratorVerbOptions,
  type GlobalMockOptions,
  isFunction,
  isObject,
  pascal,
  type ResReqTypesValue,
} from '@orval/core';

import { getDelay } from '../delay';
import { getRouteMSW, overrideVarName } from '../faker/getters';
import { getMockDefinition, getMockOptionsDataOverride } from './mocks';

function getMSWDependencies(
  options?: GlobalMockOptions,
): GeneratorDependency[] {
  const hasDelay = options?.delay !== false;
  const locale = options?.locale;

  const exports = [
    { name: 'http', values: true },
    { name: 'HttpResponse', values: true },
    { name: 'RequestHandlerOptions', values: false },
  ];

  if (hasDelay) {
    exports.push({ name: 'delay', values: true });
  }

  return [
    { exports, dependency: 'msw' },
    {
      exports: [{ name: 'faker', values: true }],
      dependency: locale
        ? `@faker-js/faker/locale/${locale}`
        : '@faker-js/faker',
    },
  ];
}

export const generateMSWImports: GenerateMockImports = ({
  implementation,
  imports,
  projectName,
  hasSchemaDir,
  isAllowSyntheticDefaultImports,
  options,
}) => {
  return generateDependencyImports(
    implementation,
    [...getMSWDependencies(options), ...imports],
    projectName,
    hasSchemaDir,
    isAllowSyntheticDefaultImports,
  );
};

function generateDefinition(
  name: string,
  route: string,
  getResponseMockFunctionNameBase: string,
  handlerNameBase: string,
  { operationId, response, verb, tags }: GeneratorVerbOptions,
  { override, context, mock }: GeneratorOptions,
  returnType: string,
  status: string,
  responseImports: GeneratorImport[],
  responses: ResReqTypesValue[],
  contentTypes: string[],
  splitMockImplementations: string[],
) {
  const oldSplitMockImplementations = [...splitMockImplementations];
  const { definitions, definition, imports } = getMockDefinition({
    operationId,
    tags,
    returnType,
    responses,
    imports: responseImports,
    override,
    context,
    mockOptions: isFunction(mock) ? undefined : mock,
    splitMockImplementations,
  });

  const mockData = getMockOptionsDataOverride(tags, operationId, override);

  let value = '';

  if (mockData) {
    value = mockData;
  } else if (definitions.length > 1) {
    value = `faker.helpers.arrayElement(${definition})`;
  } else if (definitions[0]) {
    value = definitions[0];
  }

  const isResponseOverridable = value.includes(overrideVarName);
  const isTextPlain = contentTypes.includes('text/plain');
  const isReturnHttpResponse = value && value !== 'undefined';

  const getResponseMockFunctionName = `${getResponseMockFunctionNameBase}${pascal(
    name,
  )}`;
  const handlerName = `${handlerNameBase}${pascal(name)}`;

  const addedSplitMockImplementations = splitMockImplementations.slice(
    oldSplitMockImplementations.length,
  );
  splitMockImplementations.push(...addedSplitMockImplementations);
  const mockImplementations =
    addedSplitMockImplementations.length > 0
      ? `${addedSplitMockImplementations.join('\n\n')}\n\n`
      : '';

  const mockImplementation = isReturnHttpResponse
    ? `${mockImplementations}export const ${getResponseMockFunctionName} = (${
        isResponseOverridable
          ? `overrideResponse: Partial< ${returnType} > = {}`
          : ''
      })${mockData ? '' : `: ${returnType}`} => (${value}) as ${returnType}\n\n`
    : mockImplementations;

  const delay = getDelay(override, isFunction(mock) ? undefined : mock);
  const infoParam = 'info';
  const overrideResponse = `overrideResponse !== undefined
    ? (typeof overrideResponse === "function" ? await overrideResponse(${infoParam}) : overrideResponse)
    : ${getResponseMockFunctionName}()`;
  const handlerImplementation = `
export const ${handlerName} = (overrideResponse?: ${returnType} | ((${infoParam}: Parameters<Parameters<typeof http.${verb}>[1]>[0]) => Promise<${returnType}> | ${returnType}), options?: RequestHandlerOptions) => {
  return http.${verb}('${route}', async (${infoParam}) => {${
    delay === false
      ? ''
      : `await delay(${isFunction(delay) ? `(${delay})()` : delay});`
  }
  ${isReturnHttpResponse ? '' : `if (typeof overrideResponse === 'function') {await overrideResponse(info); }`}
    return new HttpResponse(${
      isReturnHttpResponse
        ? isTextPlain
          ? overrideResponse
          : `JSON.stringify(${overrideResponse})`
        : null
    },
      { status: ${status === 'default' ? 200 : status.replace(/XX$/, '00')},
        ${
          isReturnHttpResponse
            ? `headers: { 'Content-Type': ${isTextPlain ? "'text/plain'" : "'application/json'"} }`
            : ''
        }
      })
  }, options)
}\n`;

  const includeResponseImports = isTextPlain
    ? imports
    : [
        ...imports,
        ...response.imports.filter((r) => {
          // Only include imports which are actually used in mock.
          const reg = new RegExp(String.raw`\b${r.name}\b`);
          return (
            reg.test(handlerImplementation) || reg.test(mockImplementation)
          );
        }),
      ];

  return {
    implementation: {
      function: mockImplementation,
      handlerName: handlerName,
      handler: handlerImplementation,
    },
    imports: includeResponseImports,
  };
}

export function generateMSW(
  generatorVerbOptions: GeneratorVerbOptions,
  generatorOptions: GeneratorOptions,
): ClientMockGeneratorBuilder {
  const { pathRoute, override, mock } = generatorOptions;
  const { operationId, response } = generatorVerbOptions;

  const route = getRouteMSW(
    pathRoute,
    override.mock?.baseUrl ?? (isFunction(mock) ? undefined : mock?.baseUrl),
  );

  const handlerName = `get${pascal(operationId)}MockHandler`;
  const getResponseMockFunctionName = `get${pascal(operationId)}ResponseMock`;

  const splitMockImplementations: string[] = [];

  const baseDefinition = generateDefinition(
    '',
    route,
    getResponseMockFunctionName,
    handlerName,
    generatorVerbOptions,
    generatorOptions,
    response.definition.success,
    response.types.success[0]?.key ?? '200',
    response.imports,
    response.types.success,
    response.contentTypes,
    splitMockImplementations,
  );

  const mockImplementations = [baseDefinition.implementation.function];
  const handlerImplementations = [baseDefinition.implementation.handler];
  const imports = [...baseDefinition.imports];

  if (
    generatorOptions.mock &&
    isObject(generatorOptions.mock) &&
    generatorOptions.mock.generateEachHttpStatus
  ) {
    for (const statusResponse of [
      ...response.types.success,
      ...response.types.errors,
    ]) {
      const definition = generateDefinition(
        statusResponse.key,
        route,
        getResponseMockFunctionName,
        handlerName,
        generatorVerbOptions,
        generatorOptions,
        statusResponse.value,
        statusResponse.key,
        response.imports,
        [statusResponse],
        [statusResponse.contentType],
        splitMockImplementations,
      );
      mockImplementations.push(definition.implementation.function);
      handlerImplementations.push(definition.implementation.handler);
      imports.push(...definition.imports);
    }
  }

  return {
    implementation: {
      function: mockImplementations.join('\n'),
      handlerName: handlerName,
      handler: handlerImplementations.join('\n'),
    },
    imports: imports,
  };
}
