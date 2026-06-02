import {
  type ClientMockGeneratorBuilder,
  escapeRegExp,
  generateDependencyImports,
  type GenerateMockImports,
  type GeneratorDependency,
  type GeneratorImport,
  type GeneratorOptions,
  type GeneratorVerbOptions,
  type GlobalMockOptions,
  isFunction,
  isMswMock,
  isObject,
  pascal,
  type ResReqTypesValue,
} from '@orval/core';

import { getDelay } from '../delay';
import { getRouteMSW, overrideVarName } from '../faker/getters';
import {
  applyStrictMockReturnType,
  formatMockFactoryDeclaration,
  getMockFactorySignatureParts,
  getSchemaTypeNamesFromResponses,
  getSimpleSchemaReturnType,
  getStrictMockHelperTypeDeclarations,
  getStrictMockTypeDeclarations,
  isStrictMock,
} from '../mock-types';
import { getMockDefinition, getMockOptionsDataOverride } from './mocks';

function getMSWDependencies(
  options?: GlobalMockOptions,
): GeneratorDependency[] {
  const locale = options?.locale;

  const fakerDependency: GeneratorDependency = {
    exports: [{ name: 'faker', values: true }],
    dependency: locale ? `@faker-js/faker/locale/${locale}` : '@faker-js/faker',
  };

  const hasDelay =
    options && isMswMock(options) ? options.delay !== false : true;

  const exports = [
    { name: 'http', values: true },
    { name: 'HttpResponse', values: true },
    { name: 'RequestHandlerOptions', values: false },
  ];

  if (hasDelay) {
    exports.push({ name: 'delay', values: true });
  }

  return [{ exports, dependency: 'msw' }, fakerDependency];
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
    typeExpr.trim().replaceAll(/^\(+|\)+$/g, '') === 'string';
  const isUnionContainingString = (typeExpr: string) =>
    typeExpr
      .split('|')
      .map((part) => part.trim().replaceAll(/^\(+|\)+$/g, ''))
      .includes('string');
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
  // match preferredContentType against `responses` (not the wider `contentTypes` which mixes success and error MIMEs).
  const preferredContentTypeMatch = preferredContentType
    ? responses.find(
        (r) => r.contentType.toLowerCase() === preferredContentType,
      )?.contentType
    : undefined;
  const contentTypesByPreference = preferredContentTypeMatch
    ? [preferredContentTypeMatch]
    : contentTypes;
  const responsesByPreference = preferredContentTypeMatch
    ? responses.filter((r) => r.contentType === preferredContentTypeMatch)
    : responses;

  const hasTextLikeContentType = contentTypes.some((ct) =>
    isTextLikeContentType(ct),
  );
  const isExactlyStringReturnType = isTypeExactlyString(returnType);

  // Keep text helpers for exact string success return types whenever a text-like
  // media type is available in the declared content types. This prevents a
  // preferredContentType that matches an error media type from forcing
  // HttpResponse.json() for text/plain success responses.
  const isTextResponse =
    (isExactlyStringReturnType && hasTextLikeContentType) ||
    contentTypesByPreference.some((ct) => isTextLikeContentType(ct));
  const isSchemaBinary = (r: ResReqTypesValue) =>
    r.originalSchema?.format === 'binary' ||
    (r.originalSchema?.contentMediaType === 'application/octet-stream' &&
      !r.originalSchema.contentEncoding);
  const isBinaryResponse =
    contentTypesByPreference.some((ct) => isBinaryLikeContentType(ct)) ||
    responsesByPreference.some((r) => isSchemaBinary(r));
  // Bare ref names of schema-binary responses (include alias for collision-renamed imports).
  const binaryRefNames = responsesByPreference
    .filter((r) => isSchemaBinary(r))
    .flatMap((r) =>
      r.imports.flatMap((imp) =>
        imp.alias ? [imp.name, imp.alias] : [imp.name],
      ),
    );
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

  const binaryTypeRewriteRegex = new RegExp(
    String.raw`\b(?:${['Blob', ...binaryRefNames].map((n) => escapeRegExp(n)).join('|')})\b`,
    'g',
  );
  const mockReturnType = isBinaryResponse
    ? returnType.replaceAll(binaryTypeRewriteRegex, 'ArrayBuffer')
    : returnType;

  // Detect when the return type is a union containing void (e.g. "Resource | void"
  // from endpoints with both 200 JSON and 204 No Content responses). In this case
  // we need runtime branching so that void responses use `new HttpResponse(null)`
  // instead of `HttpResponse.json()` which does not accept void/undefined.
  const isVoidUnionType =
    mockReturnType !== 'void' &&
    mockReturnType.split('|').some((part) => part.trim() === 'void');
  const noContentStatusCode = isVoidUnionType
    ? (responses.find((r) => r.value === 'void')?.key ?? '204')
    : undefined;
  const nonVoidMockReturnType = isVoidUnionType
    ? mockReturnType
        .split('|')
        .filter((part) => part.trim() !== 'void')
        .join(' | ')
        .trim()
    : mockReturnType;

  const hasJsonContentType = contentTypesByPreference.some(
    (ct) => ct.includes('json') || ct.includes('+json'),
  );
  const hasStringReturnType =
    isTypeExactlyString(mockReturnType) ||
    isUnionContainingString(mockReturnType);
  const overrideResponseType = `Partial<Extract<${nonVoidMockReturnType}, object>>`;
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

  const mockOptionsFromOverride = override.mock;
  const strictMock = isStrictMock(mockOptionsFromOverride);
  const schemaTypeNames = strictMock
    ? getSchemaTypeNamesFromResponses(responses)
    : [];
  const strictMockReturnType = strictMock
    ? applyStrictMockReturnType(nonVoidMockReturnType, schemaTypeNames)
    : nonVoidMockReturnType;
  const strictTypeDeclarations = strictMock
    ? getStrictMockTypeDeclarations(schemaTypeNames)
    : '';
  const strictTypeBlock = strictTypeDeclarations
    ? `${strictTypeDeclarations}\n\n`
    : '';

  const simpleSchemaReturnType = strictMock
    ? getSimpleSchemaReturnType(nonVoidMockReturnType, schemaTypeNames)
    : undefined;

  let mockFactoryParam = '';
  let mockFactoryReturnType = nonVoidMockReturnType;
  let mockFactoryReturnCast = '';

  if (isResponseOverridable) {
    if (strictMock && simpleSchemaReturnType) {
      const signature = getMockFactorySignatureParts(
        simpleSchemaReturnType,
        mockOptionsFromOverride,
        {
          isOverridable: true,
          overrideType: overrideResponseType,
        },
      );
      mockFactoryParam = signature.param;
      mockFactoryReturnType = signature.returnType;
      mockFactoryReturnCast = signature.returnCast;
    } else {
      mockFactoryParam = `overrideResponse: ${overrideResponseType} = {}`;
      mockFactoryReturnType = strictMock
        ? strictMockReturnType
        : nonVoidMockReturnType;
    }
  } else if (strictMock) {
    mockFactoryReturnType = strictMockReturnType;
  }

  const mockImplementation = isReturnHttpResponse
    ? `${strictTypeBlock}${mockImplementations}${formatMockFactoryDeclaration(
        getResponseMockFunctionName,
        mockFactoryParam,
        mockFactoryReturnType,
        value,
        mockFactoryReturnCast,
        { omitReturnType: Boolean(mockData) },
      )}\n`
    : `${strictTypeBlock}${mockImplementations}`;

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
  const shouldIgnorePreferredForTextHelper =
    isExactlyStringReturnType &&
    !!preferredContentTypeMatch &&
    !isTextLikeContentType(preferredContentTypeMatch) &&
    hasTextLikeContentType;
  const firstTextCt = shouldIgnorePreferredForTextHelper
    ? contentTypes.find((ct) => isTextLikeContentType(ct))
    : contentTypesByPreference.find((ct) => isTextLikeContentType(ct));
  const textHelper =
    firstTextCt === 'application/xml' || firstTextCt?.endsWith('+xml')
      ? 'xml'
      : firstTextCt === 'text/html'
        ? 'html'
        : 'text';

  let responseBody: string;
  // Use a prelude to evaluate the override expression once into a temp variable
  // (the expression contains `await` so must not be duplicated). Only emit it
  // when we actually generate a `*ResponseMock()` helper — otherwise the
  // prelude would reference a function that doesn't exist (issue #3270).
  let responsePrelude = '';
  if (isReturnHttpResponse) {
    if (isBinaryResponse) {
      responsePrelude = `const binaryBody = ${resolvedResponseExpr};`;
    } else if (isVoidUnionType || needsRuntimeContentTypeSwitch) {
      responsePrelude = `const resolvedBody = ${resolvedResponseExpr};`;
    } else if (isTextResponse && !shouldPreferJsonResponse) {
      responsePrelude = `const resolvedBody = ${resolvedResponseExpr};
    const textBody = typeof resolvedBody === 'string' ? resolvedBody : JSON.stringify(resolvedBody ?? null);`;
    }
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
  } else if (isVoidUnionType) {
    // Runtime branching for void union types (e.g. 200 JSON + 204 No Content).
    // When the resolved body is undefined, return an empty response with the
    // no-content status code; otherwise use the appropriate response helper.
    let nonVoidBody: string;
    if (needsRuntimeContentTypeSwitch) {
      nonVoidBody = `typeof resolvedBody === 'string'
        ? HttpResponse.${textHelper}(resolvedBody, { status: ${statusCode} })
        : HttpResponse.json(resolvedBody, { status: ${statusCode} })`;
    } else if (isTextResponse && !shouldPreferJsonResponse) {
      nonVoidBody = `HttpResponse.${textHelper}(
        typeof resolvedBody === 'string' ? resolvedBody : JSON.stringify(resolvedBody ?? null),
        { status: ${statusCode} })`;
    } else {
      nonVoidBody = `HttpResponse.json(resolvedBody, { status: ${statusCode} })`;
    }
    responseBody = `resolvedBody === undefined
      ? new HttpResponse(null, { status: ${noContentStatusCode} })
      : ${nonVoidBody}`;
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
      // Only keep imports referenced in the mock. Aliased imports
      // (`Foo as __Foo`) reference the alias rather than the bare name, so
      // match against either. Mirrors `addDependency` in core/generators/imports.ts (#3269).
      const searchWords = [r.alias, r.name]
        .filter((p): p is string => Boolean(p?.length))
        .map((part) => escapeRegExp(part))
        .join('|');
      if (!searchWords) {
        return false;
      }
      const reg = new RegExp(String.raw`\b(${searchWords})\b`);
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

  const overrideBaseUrl =
    override.mock && 'baseUrl' in override.mock
      ? (override.mock as { baseUrl?: string }).baseUrl
      : undefined;
  const mockBaseUrl = mock && isMswMock(mock) ? mock.baseUrl : undefined;
  const route = getRouteMSW(pathRoute, overrideBaseUrl ?? mockBaseUrl);

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
      function:
        (isStrictMock(override.mock)
          ? `${getStrictMockHelperTypeDeclarations()}\n\n`
          : '') + mockImplementations.join('\n'),
      handlerName,
      handler: handlerImplementations.join('\n'),
    },
    imports: imports,
  };
}
