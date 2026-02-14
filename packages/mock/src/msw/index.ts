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
  const isTextLikeContentType = (ct: string) =>
    ct.startsWith('text/') || ct === 'application/xml' || ct.endsWith('+xml');
  const isTypeExactlyString = (typeExpr: string) =>
    typeExpr.trim().replace(/^\(+|\)+$/g, '') === 'string';
  const isUnionContainingString = (typeExpr: string) =>
    typeExpr
      .split('|')
      .map((part) => part.trim().replace(/^\(+|\)+$/g, ''))
      .some((part) => part === 'string');
  const isBinaryLikeContentType = (ct: string) =>
    ct === 'application/octet-stream' ||
    ct === 'application/pdf' ||
    ct.startsWith('image/') ||
    ct.startsWith('audio/') ||
    ct.startsWith('video/') ||
    ct.startsWith('font/');

  const preferredContentType = isFunction(mock)
    ? undefined
    : (
        mock as { preferredContentType?: string } | undefined
      )?.preferredContentType?.toLowerCase();
  const preferredContentTypeMatch = preferredContentType
    ? contentTypes.find((ct) => ct.toLowerCase() === preferredContentType)
    : undefined;
  const contentTypesByPreference = preferredContentTypeMatch
    ? [preferredContentTypeMatch]
    : contentTypes;

  const isTextResponse = contentTypesByPreference.some((ct) =>
    isTextLikeContentType(ct),
  );
  const isBinaryResponse =
    returnType === 'Blob' ||
    contentTypesByPreference.some((ct) => isBinaryLikeContentType(ct));
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

  const mockReturnType = isBinaryResponse
    ? returnType.replaceAll(/\bBlob\b/g, 'ArrayBuffer')
    : returnType;

  const hasJsonContentType = contentTypesByPreference.some(
    (ct) => ct.includes('json') || ct.includes('+json'),
  );
  const hasStringReturnType =
    isTypeExactlyString(mockReturnType) ||
    isUnionContainingString(mockReturnType);
  const shouldPreferJsonResponse = hasJsonContentType && !hasStringReturnType;

  // When the return type is a union containing both string and structured types
  // (e.g. `string | Pet`) AND both text-like and JSON content types are available,
  // we need runtime branching to pick the correct HttpResponse helper based on
  // the actual resolved value type. Without this, objects could be JSON.stringify'd
  // and served under a text-like Content-Type (e.g. xml/html/plain), which is
  // semantically incorrect for structured JSON data.
  const needsRuntimeContentTypeSwitch =
    isTextResponse &&
    hasJsonContentType &&
    hasStringReturnType &&
    mockReturnType !== 'string';

  const mockImplementation = isReturnHttpResponse
    ? `${mockImplementations}export const ${getResponseMockFunctionName} = (${
        isResponseOverridable
          ? `overrideResponse: Partial< ${mockReturnType} > = {}`
          : ''
      })${mockData ? '' : `: ${mockReturnType}`} => (${value})\n\n`
    : mockImplementations;

  const delay = getDelay(override, isFunction(mock) ? undefined : mock);
  const infoParam = 'info';
  const resolvedResponseExpr = `overrideResponse !== undefined
    ? (typeof overrideResponse === "function" ? await overrideResponse(${infoParam}) : overrideResponse)
    : ${getResponseMockFunctionName}()`;

  const statusCode = status === 'default' ? 200 : status.replace(/XX$/, '00');

  // Determine the preferred non-JSON content type for binary responses
  const binaryContentType =
    (preferredContentTypeMatch &&
    isBinaryLikeContentType(preferredContentTypeMatch)
      ? preferredContentTypeMatch
      : contentTypes.find((ct) => isBinaryLikeContentType(ct))) ??
    'application/octet-stream';

  // Pick the most specific MSW response helper based on the first
  // text-like content type so the correct Content-Type header is set.
  // MSW provides HttpResponse.xml() for application/xml and +xml,
  // HttpResponse.html() for text/html, and HttpResponse.text() for
  // all other text/* types.
  const firstTextCt = contentTypesByPreference.find((ct) =>
    isTextLikeContentType(ct),
  );
  const textHelper =
    firstTextCt === 'application/xml' || firstTextCt?.endsWith('+xml')
      ? 'xml'
      : firstTextCt === 'text/html'
        ? 'html'
        : 'text';

  let responseBody: string;
  // Use a prelude to evaluate the override expression once into a temp variable
  // (the expression contains `await` so must not be duplicated)
  let responsePrelude = '';
  if (isBinaryResponse) {
    responsePrelude = `const binaryBody = ${resolvedResponseExpr};`;
  } else if (needsRuntimeContentTypeSwitch) {
    responsePrelude = `const resolvedBody = ${resolvedResponseExpr};`;
  } else if (isTextResponse && !shouldPreferJsonResponse) {
    responsePrelude = `const resolvedBody = ${resolvedResponseExpr};
    const textBody = typeof resolvedBody === 'string' ? resolvedBody : JSON.stringify(resolvedBody ?? null);`;
  }
  if (!isReturnHttpResponse) {
    responseBody = `new HttpResponse(null,
      { status: ${statusCode}
      })`;
  } else if (isBinaryResponse) {
    responseBody = `HttpResponse.arrayBuffer(
      binaryBody instanceof ArrayBuffer
        ? binaryBody
        : new ArrayBuffer(0),
      { status: ${statusCode},
        headers: { 'Content-Type': '${binaryContentType}' }
      })`;
  } else if (needsRuntimeContentTypeSwitch) {
    // Runtime branching: when the resolved value is a string, use the
    // appropriate text helper; otherwise fall back to HttpResponse.json()
    // so objects are never JSON.stringify'd under a text/xml Content-Type.
    responseBody = `typeof resolvedBody === 'string'
      ? HttpResponse.${textHelper}(resolvedBody, { status: ${statusCode} })
      : HttpResponse.json(resolvedBody, { status: ${statusCode} })`;
  } else if (isTextResponse && !shouldPreferJsonResponse) {
    responseBody = `HttpResponse.${textHelper}(textBody,
      { status: ${statusCode}
      })`;
  } else {
    responseBody = `HttpResponse.json(${resolvedResponseExpr},
      { status: ${statusCode}
      })`;
  }

  const infoType = `Parameters<Parameters<typeof http.${verb}>[1]>[0]`;

  const handlerImplementation = `
export const ${handlerName} = (overrideResponse?: ${mockReturnType} | ((${infoParam}: ${infoType}) => Promise<${mockReturnType}> | ${mockReturnType}), options?: RequestHandlerOptions) => {
  return http.${verb}('${route}', async (${infoParam}: ${infoType}) => {${
    delay === false
      ? ''
      : `await delay(${isFunction(delay) ? `(${String(delay)})()` : String(delay)});`
  }
  ${isReturnHttpResponse ? '' : `if (typeof overrideResponse === 'function') {await overrideResponse(info); }`}
  ${responsePrelude}
    return ${responseBody}
  }, options)
}\n`;

  const includeResponseImports = [
    ...imports,
    ...response.imports.filter((r) => {
      // Only include imports which are actually used in mock.
      const reg = new RegExp(String.raw`\b${r.name}\b`);
      return reg.test(handlerImplementation) || reg.test(mockImplementation);
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
