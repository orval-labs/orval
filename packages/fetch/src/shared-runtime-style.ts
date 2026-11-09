import {
  assertSafeResponseStatusKey,
  camel,
  type ClientExtraFilesBuilder,
  type ClientFileBuilder,
  emitResponseValidation,
  encodeRouteParameters,
  generateFormDataAndUrlEncodedFunction,
  generateRequestDateSerializer,
  generateVerbImports,
  type GeneratorClient,
  type GeneratorImport,
  type GeneratorOptions,
  type GeneratorVerbOptions,
  getFileInfo,
  getImportExtension,
  getImport,
  getArrayFormatParameters,
  getDeepObjectParameters,
  getDelimitedParameters,
  getArrayResponseSchema,
  getFormObjectParameters,
  getExplodeParameters,
  getOperationParameters,
  getQueryParamsEncoding,
  getResponseStatusCondition,
  getSchemaOutputTypeRef,
  getSchemaValueRef,
  getZodNamespaceImport,
  GetterPropType,
  hasSchemaImport,
  isFormDataContentType,
  isObject,
  isPrimitiveResponseSchema,
  isPrimitiveResponseType,
  jsDoc,
  jsStringLiteralEscape,
  type NormalizedOutputOptions,
  type OpenApiInfoObject,
  OutputClient,
  OutputHttpClient,
  rewriteImportsForResponseValidation,
  toObjectString,
  upath,
} from '@orval/core';

import pkg from '../package.json' with { type: 'json' };
import {
  getIsDatesTransformEnabled,
  getMutatorErrorResponses,
  getResponseDateDeserializer,
  isContentTypeNdJson,
  passesZodSchemaToMutator,
  wrapSchemaWithDateDeserializer,
} from './response-helpers';
import { clientConfigTemplate, RUNTIME_TEMPLATE } from './runtime';

const isContentTypeJson = (contentType: string) =>
  contentType.toLowerCase().includes('json');

/**
 * Whether the request functions use the shared runtime: the fetch client, and
 * the clients built on it with `httpClient: 'fetch'`. mcp is left out, as it
 * embeds the request functions in its own `http-client.ts`.
 */
export const isSharedRuntimeStyle = (
  output: NormalizedOutputOptions | undefined,
) =>
  output?.override.fetch.runtimeImplementationStyle === 'shared' &&
  output.client !== OutputClient.MCP &&
  (output.client === OutputClient.FETCH ||
    output.httpClient === OutputHttpClient.FETCH);

const usesClientConfig = (
  output: NormalizedOutputOptions,
  mutator: GeneratorVerbOptions['mutator'],
) => !!output.override.mutator && !!mutator && !mutator.isHook;

/**
 * Drops a mutator the shared runtime cannot route (a hook mutator, or one set
 * only per operation or tag) before a client built on fetch generates its
 * hooks, which would otherwise reference the mutator. The fetch client ignores
 * such a mutator the same way.
 */
export const normalizeSharedRuntimeVerbOptions = (
  verbOptions: GeneratorVerbOptions,
  output: NormalizedOutputOptions,
): GeneratorVerbOptions =>
  isSharedRuntimeStyle(output) &&
  verbOptions.mutator &&
  !usesClientConfig(output, verbOptions.mutator)
    ? { ...verbOptions, mutator: undefined }
    : verbOptions;

/**
 * Keeps default-export callbacks stable across operations and distinct from the
 * operation-local names that trigger the writer's direct mutator imports.
 */
const getSharedMutatorAlias = (output: NormalizedOutputOptions) =>
  `${output.override.mutator?.name ?? 'orval'}Fetcher`;

const getRuntimeImportPath = (
  importer: string,
  output: NormalizedOutputOptions,
  target: string,
) =>
  upath.getRelativeImportPath(importer, target) +
  getImportExtension(output.fileExtension, output.tsconfig);

/** Imports the inferred mutator itself so endpoints can specialize its generics. */
export const getSharedRuntimeImports = (
  { mutator, override, response }: GeneratorVerbOptions,
  { context }: GeneratorOptions,
): GeneratorImport[] => {
  const { output } = context;
  const targetFile = getFileInfo(output.target, {
    extension: output.fileExtension,
  }).path;
  const runtimePath = getRuntimeImportPath(
    targetFile,
    output,
    output.override.fetch.runtimeOutputPath,
  );
  const executePath = usesClientConfig(output, mutator)
    ? getRuntimeImportPath(
        targetFile,
        output,
        output.override.fetch.clientConfigOutputPath,
      )
    : runtimePath;
  const hasEnvelope = override.fetch.includeHttpResponseReturnType;
  const hasStream = response.contentTypes.some(isContentTypeNdJson);
  const inferredMutator =
    mutator?.inferred && usesClientConfig(output, mutator);

  return [
    { name: 'execute', values: true, importPath: executePath },
    ...(inferredMutator
      ? [
          {
            name: getSharedMutatorAlias(output),
            values: true,
            importPath: executePath,
          },
        ]
      : []),
    { name: 'serializeQuery', values: true, importPath: runtimePath },
    {
      name: 'CallOptions',
      importPath: inferredMutator ? executePath : runtimePath,
    },
    ...(hasEnvelope ? [{ name: 'ResponseOf', importPath: runtimePath }] : []),
    ...(hasEnvelope && hasStream
      ? [{ name: 'Stream', importPath: runtimePath }]
      : []),
  ];
};

/**
 * The zod schema a verb's response is validated with, under the same rules as
 * the inline style: generated code parses it in `validateResponse`, while a
 * client-config mutator receives it as `schema:` (#4344) and keeps the input
 * type names. `imports` are the response imports rewritten so the schema is a
 * value import.
 */
const getResponseValidation = (
  { mutator, override, response }: GeneratorVerbOptions,
  { context }: GeneratorOptions,
) => {
  const responseType = response.definition.success;
  const hasClientMutator = usesClientConfig(context.output, mutator);
  if (
    !override.fetch.runtimeValidation.enabled ||
    !isObject(context.output.schemas) ||
    context.output.schemas.type !== 'zod' ||
    (hasClientMutator && !passesZodSchemaToMutator(mutator, context)) ||
    isPrimitiveResponseType(responseType) ||
    response.contentTypes.some(isContentTypeNdJson)
  ) {
    return undefined;
  }

  const arraySchema = hasSchemaImport(response.imports, responseType)
    ? undefined
    : getArrayResponseSchema(response.imports, responseType, getSchemaValueRef);
  if (!hasSchemaImport(response.imports, responseType) && !arraySchema) {
    return undefined;
  }

  return {
    schemaRef: arraySchema?.schemaRef ?? getSchemaValueRef(responseType),
    outputTypeRef: hasClientMutator
      ? undefined
      : (arraySchema?.outputTypeRef ?? getSchemaOutputTypeRef(responseType)),
    imports: rewriteImportsForResponseValidation(
      response.imports,
      arraySchema?.elementName ?? responseType,
      { includeOutputType: !hasClientMutator },
    ),
    composesZod: arraySchema !== undefined,
  };
};

// Exact codes stay numeric keys so `ResponseOf` can narrow on them; a
// wildcard is a quoted `WildcardKey` ('2XX').
const statusKeyLiteral = (key: string) => {
  if (key === 'default') return key;
  assertSafeResponseStatusKey(key);
  return /^\d+$/.test(key) ? key : `'${key.toUpperCase()}'`;
};

/**
 * The declared response type of a verb: a `ResponseOf` envelope alias, or
 * with `includeHttpResponseReturnType: false` the bare success type.
 */
const getResponseTypes = (
  { override, response, typeName }: GeneratorVerbOptions,
  outputTypeRef: string | undefined,
) => {
  const isNdJson = response.contentTypes.some(isContentTypeNdJson);
  if (!override.fetch.includeHttpResponseReturnType) {
    return {
      declarations: '',
      resultType:
        outputTypeRef ?? (isNdJson ? 'Response' : response.definition.success),
    };
  }

  const allResponses = [...response.types.success, ...response.types.errors];
  const entries = new Map<string, string[]>();
  for (const { key, value, contentType } of allResponses) {
    // A validated body is parsed, so it is typed as the schema's output.
    const isValidated =
      outputTypeRef !== undefined &&
      response.types.success.some((success) => success.key === key) &&
      value === response.definition.success &&
      (contentType === '' || isContentTypeJson(contentType));
    const dataType = isContentTypeNdJson(contentType)
      ? `Stream<${value || 'unknown'}>`
      : isValidated
        ? outputTypeRef
        : value || 'unknown';
    const dataTypes = entries.get(key) ?? [];
    if (!dataTypes.includes(dataType)) dataTypes.push(dataType);
    entries.set(key, dataTypes);
  }
  if (entries.size === 0) entries.set('default', ['unknown']);

  const members = [...entries.entries()].map(
    ([key, dataTypes]) => `${statusKeyLiteral(key)}: ${dataTypes.join(' | ')}`,
  );
  const map = `{ ${members.join('; ')} }`;
  const headersType = override.fetch.serializeResponseHeaders
    ? 'Record<string, string>'
    : undefined;

  const successKeys = [
    ...new Set(response.types.success.map(({ key }) => key)),
  ];
  if (override.fetch.forceSuccessResponse && successKeys.length > 0) {
    const resultType = `${typeName}ResponseSuccess`;
    const responseOf = (keys: string[]) =>
      `ResponseOf<${map}, ${headersType ?? 'Headers'}, ${keys.map(statusKeyLiteral).join(' | ')}>`;
    // The query clients type a mutator's error with it (`ErrorType<…>`).
    const errorKeys = [...new Set(response.types.errors.map(({ key }) => key))];
    const errorDeclaration =
      override.fetch.includeHttpErrorResponse && errorKeys.length > 0
        ? `export type ${typeName}ResponseError = ${responseOf(errorKeys)};\n`
        : '';
    return {
      declarations: `export type ${resultType} = ${responseOf(successKeys)};\n${errorDeclaration}`,
      resultType,
    };
  }

  const resultType = `${typeName}Response`;
  return {
    declarations: `export type ${resultType} = ResponseOf<${map}${headersType ? `, ${headersType}` : ''}>;\n`,
    resultType,
  };
};

const getResponseType = ({
  response,
}: GeneratorVerbOptions): string | undefined => {
  if (response.contentTypes.some(isContentTypeNdJson)) return 'stream';
  if (response.isBlob) return 'blob';
  if (response.definition.success === 'void') return 'void';

  const contentTypes = [...response.types.success, ...response.types.errors]
    .map((type) => type.contentType)
    .filter(Boolean);
  const hasJson = contentTypes.some(isContentTypeJson);
  const hasNonJson = contentTypes.some((type) => !isContentTypeJson(type));
  if (hasJson && hasNonJson) return 'auto';
  if (hasNonJson) return 'text';
  return undefined;
};

/**
 * Emits an operation using shared request preparation. Inferred mutators receive
 * a concrete response type here rather than an unconstrained executor generic.
 */
export const generateSharedRequestFunction = (
  verbOptions: GeneratorVerbOptions,
  options: GeneratorOptions,
) => {
  const {
    body,
    doc,
    fetchReviver,
    formData,
    formUrlEncoded,
    headers,
    mutator,
    operationName,
    override,
    params,
    paramsSerializer,
    props,
    queryParams,
    response,
    verb,
  } = verbOptions;
  const { context, pathRoute } = options;

  const route = encodeRouteParameters(
    options.route,
    params,
    context.output.urlEncodeParameters,
  );

  const getUrlFnName = camel(`get-${operationName}-url`);
  const urlProps = props.filter(
    (prop) =>
      prop.type === GetterPropType.PARAM ||
      prop.type === GetterPropType.NAMED_PATH_PARAMS ||
      prop.type === GetterPropType.QUERY_PARAM,
  );
  const getUrlFnProps = toObjectString(urlProps, 'implementation');
  const getUrlFnProperties = urlProps
    .map((prop) =>
      prop.type === GetterPropType.NAMED_PATH_PARAMS
        ? prop.destructured
        : prop.name,
    )
    .join(',');

  const arrayFormat = override.fetch.arrayFormat;
  const parameters = getOperationParameters({ pathRoute, verb }, context);
  const names = (group: { name: string }[]) =>
    group.map((parameter) => parameter.name);
  const delimited = getDelimitedParameters(parameters, context);
  // A custom `paramsSerializer` owns the whole query string.
  const formObject = paramsSerializer
    ? []
    : getFormObjectParameters(queryParams, parameters, context, operationName);
  const meta = Object.entries({
    explode: names(getExplodeParameters(parameters, context, arrayFormat)),
    ...(arrayFormat
      ? {
          [arrayFormat]: names(
            getArrayFormatParameters(parameters, context, arrayFormat),
          ),
        }
      : {}),
    pipeDelimited: names(delimited.filter((p) => p.style === 'pipeDelimited')),
    spaceDelimited: names(
      delimited.filter((p) => p.style === 'spaceDelimited'),
    ),
    deepObject: names(getDeepObjectParameters(parameters)),
    flattenObject: formObject
      .filter(({ strategy }) => strategy === 'flatten')
      .map(({ key }) => key),
    commaObject: formObject
      .filter(({ strategy }) => strategy === 'comma')
      .map(({ key }) => key),
  })
    .filter(([, names]) => names.length > 0)
    .map(([key, names]) => `${key}: ${JSON.stringify(names)}`);
  const paramsEncoding = paramsSerializer
    ? undefined
    : getQueryParamsEncoding(queryParams, 'params');
  const serializeCall = paramsSerializer
    ? `${paramsSerializer.name}(params)`
    : `serializeQuery(${paramsEncoding ? 'encodedParams' : 'params'}${meta.length > 0 ? `, { ${meta.join(', ')} }` : ''})`;

  // Same slot layout as the inline builder: a path-only builder stays byte-identical.
  const getUrlFnImplementation = `export const ${getUrlFnName} = (${getUrlFnProps}) => {\n

  ${paramsEncoding ? `${paramsEncoding}\n` : ''}${queryParams ? `const stringifiedParams = ${serializeCall};` : ''}

  ${
    queryParams
      ? `return stringifiedParams.length > 0 ? \`${route}?\${stringifiedParams}\` : \`${route}\``
      : `return \`${route}\``
  }
}\n`;

  const isFormData = !override.formData.disabled && !!body.formData;
  const isFormUrlEncoded =
    override.formUrlEncoded !== false && !!body.formUrlEncoded;
  const encodeBodyName =
    isFormData || isFormUrlEncoded ? `${operationName}EncodeBody` : undefined;
  const encodeBodyImplementation = encodeBodyName
    ? `const ${encodeBodyName} = (${body.implementation}: ${body.definition}) => {
  ${generateFormDataAndUrlEncodedFunction({
    formData,
    formUrlEncoded,
    // The runtime calls this only for a body that is present.
    body: { ...body, isOptional: false },
    isFormData,
    isFormUrlEncoded,
  })}
  return ${isFormData ? 'formData' : 'formUrlEncoded'};
};\n\n`
    : '';

  const hasStream = response.contentTypes.some(isContentTypeNdJson);
  const acceptHeader =
    hasStream && response.contentTypes.length === 1
      ? `Accept: '${response.contentTypes[0]}'`
      : undefined;
  const headersArgument = headers
    ? acceptHeader
      ? `headers: { ${acceptHeader}, ...headers }`
      : 'headers'
    : acceptHeader
      ? `headers: { ${acceptHeader} }`
      : undefined;
  const responseType = getResponseType(verbOptions);

  // The runtime leaves multipart's Content-Type, boundary included, to the
  // browser, but recognizes only the lowercase spelling.
  const runtimeContentType = isFormDataContentType(body.contentType)
    ? 'multipart/form-data'
    : body.contentType;
  const hasClientMutator = usesClientConfig(context.output, mutator);
  const validation = getResponseValidation(verbOptions, options);
  const { declarations, resultType } = getResponseTypes(
    verbOptions,
    validation?.outputTypeRef,
  );
  const successType = response.definition.success;

  // Dates are converted before the response is validated, as inline does.
  const dateDeserializer = getResponseDateDeserializer(verbOptions, context);
  const requestSerializer = getIsDatesTransformEnabled(override, context)
    ? generateRequestDateSerializer({ operationName, body, context })
    : undefined;
  const successStatusCondition = (accessor: string) =>
    getResponseStatusCondition({
      key: response.types.success[0].key,
      declaredKeys: [...response.types.success, ...response.types.errors].map(
        ({ key }) => key,
      ),
      accessor,
    });

  // Like inline, dates are converted in a non-empty JSON body, before the
  // body is validated, and validation runs whenever the response is JSON.
  const deserializeResponseDates =
    !hasClientMutator && dateDeserializer
      ? `(data, status) => ${successStatusCondition('status')} ? ${dateDeserializer.name}(data as ${successType}) : data`
      : undefined;
  const validateResponse = (() => {
    if (hasClientMutator || !validation) return undefined;
    const validated = emitResponseValidation({
      schemaRef: validation.schemaRef,
      operationName,
      strategy: override.fetch.runtimeValidation.strategy,
      context: 'fetch-assign',
      inputExpression: 'data',
    });
    // A primitive schema would reject an error body, so only a 2xx one is
    // validated, as inline does.
    const validatesPrimitive = response.types.success.some(
      ({ value, schemas }) =>
        schemas.some(
          ({ name, schema }) =>
            name === value &&
            schema !== undefined &&
            isPrimitiveResponseSchema(schema),
        ),
    );
    return validatesPrimitive
      ? `(data, status) => status >= 200 && status < 300 ? ${validated} : data`
      : `(data) => ${validated}`;
  })();

  const mutatorSchemaRef =
    hasClientMutator && validation
      ? dateDeserializer
        ? wrapSchemaWithDateDeserializer(
            validation.schemaRef,
            dateDeserializer,
            successType,
            context,
          )
        : validation.schemaRef
      : undefined;
  const errorResponses = getMutatorErrorResponses(verbOptions, context);
  // Inline reads a download's error body as text: JSON-parsed when every
  // declared error type is JSON (or none is declared), by the Content-Type when
  // they are mixed, and raw otherwise.
  const errorContentTypes = response.types.errors
    .map(({ contentType }) => contentType)
    .filter(Boolean);
  const errorHasJson = errorContentTypes.some(isContentTypeJson);
  const errorHasNonJson = errorContentTypes.some(
    (contentType) => !isContentTypeJson(contentType),
  );
  const errorResponseType =
    responseType === 'blob' && override.fetch.forceSuccessResponse
      ? errorHasJson && errorHasNonJson
        ? 'auto'
        : errorHasNonJson
          ? 'text'
          : undefined
      : undefined;
  const { includeHttpResponseReturnType, forceSuccessResponse } =
    override.fetch;

  const bodyArgument = requestSerializer
    ? `${requestSerializer.name}(${body.implementation})`
    : body.implementation;
  const executeArgs = [
    `url: ${getUrlFnName}(${getUrlFnProperties})`,
    `method: '${verb.toUpperCase()}'`,
    ...(body.implementation ? [`body: ${bodyArgument}`] : []),
    ...(body.implementation && body.contentType
      ? [`contentType: '${jsStringLiteralEscape(runtimeContentType)}'`]
      : []),
    ...(headersArgument ? [headersArgument] : []),
    ...(responseType ? [`responseType: '${responseType}'`] : []),
    ...(encodeBodyName ? [`encodeBody: ${encodeBodyName}`] : []),
    // A client-config mutator issues the request itself, so it only gets the
    // schema and the error metadata.
    ...(hasClientMutator
      ? [
          ...(mutatorSchemaRef ? [`schema: ${mutatorSchemaRef}`] : []),
          ...(errorResponses
            ? [`errorResponses: ${JSON.stringify(errorResponses)}`]
            : []),
        ]
      : [
          ...(fetchReviver ? [`reviver: ${fetchReviver.name}`] : []),
          ...(deserializeResponseDates
            ? [`deserializeResponseDates: ${deserializeResponseDates}`]
            : []),
          ...(validateResponse
            ? [`validateResponse: ${validateResponse}`]
            : []),
          ...(forceSuccessResponse ? ['throwOnError: true'] : []),
          ...(errorResponseType
            ? [`errorResponseType: '${errorResponseType}'`]
            : []),
          ...(includeHttpResponseReturnType ? [] : ['returnData: true']),
          ...(includeHttpResponseReturnType &&
          override.fetch.serializeResponseHeaders
            ? ['serializeResponseHeaders: true']
            : []),
        ]),
    'options',
  ];

  // A client-config mutator returns the raw response, so its dates are
  // converted after it resolves, as inline does.
  const mutatorDateTransform =
    hasClientMutator && dateDeserializer
      ? includeHttpResponseReturnType
        ? `.then((res) => {
    if (${successStatusCondition('res.status')}) {
      res.data = ${dateDeserializer.name}(res.data as ${successType});
    }
    return res;
  })`
        : `.then(${dateDeserializer.name})`
      : '';

  // An inferred mutator is specialized per operation through the adapter's
  // fetcher argument instead of `execute`'s type argument.
  const inferredMutator = hasClientMutator && !!mutator?.inferred;
  const fetchImplementation = `export const ${operationName} = (${toObjectString(props, 'implementation')} options?: CallOptions) =>
  execute${inferredMutator ? '' : `<${resultType}>`}({
    ${executeArgs.join(',\n    ')},
  }${inferredMutator ? `, ${getSharedMutatorAlias(context.output)}<${resultType}>` : ''})${mutatorDateTransform};
`;

  const dateTransformImplementations = [dateDeserializer, requestSerializer]
    .filter((helper) => helper !== undefined)
    .map(({ implementation }) => `\n${implementation}`)
    .join('');

  return `${declarations}\n${getUrlFnImplementation}\n${encodeBodyImplementation}${doc}${fetchImplementation}\n${dateTransformImplementations}`;
};

export const generateSharedClient = (
  verbOptions: GeneratorVerbOptions,
  options: GeneratorOptions,
): GeneratorClient => {
  const validation = getResponseValidation(verbOptions, options);
  const importVerbOptions = validation
    ? {
        ...verbOptions,
        response: { ...verbOptions.response, imports: validation.imports },
      }
    : verbOptions;
  const composesZod =
    validation !== undefined &&
    (validation.composesZod ||
      (usesClientConfig(options.context.output, verbOptions.mutator) &&
        getResponseDateDeserializer(verbOptions, options.context) !==
          undefined));
  return {
    implementation: generateSharedRequestFunction(verbOptions, options),
    imports: [
      ...generateVerbImports(importVerbOptions),
      ...getSharedRuntimeImports(verbOptions, options),
      ...(composesZod
        ? [getZodNamespaceImport(options.context.output.override)]
        : []),
    ],
    docComment: '',
  };
};

/**
 * Emits the shared runtime and global-mutator adapter, rejecting conflicting
 * inference settings before endpoints can reference incompatible adapter types.
 */
export const generateFetchExtraFiles: ClientExtraFilesBuilder = (
  verbOptions,
  output,
  context,
) => {
  if (!isSharedRuntimeStyle(output)) return Promise.resolve([]);

  const getHeader = (
    option: false | ((info: OpenApiInfoObject) => string | string[]),
    info: OpenApiInfoObject | undefined,
  ) => {
    if (!option || !info) return '';
    const header = option(info);
    return Array.isArray(header) ? jsDoc({ description: header }) : header;
  };
  const header = getHeader(output.override.header, context.spec.info);
  const { runtimeOutputPath, clientConfigOutputPath } = output.override.fetch;

  const files: ClientFileBuilder[] = [
    {
      path: runtimeOutputPath,
      content: `// Generated by orval v${pkg.version} – shared fetch runtime\n${header}${RUNTIME_TEMPLATE}`,
    },
  ];

  const mutator = Object.values(verbOptions).find((verb) =>
    usesClientConfig(output, verb.mutator),
  )?.mutator;
  if (output.override.mutator && mutator && !mutator.isHook) {
    if (
      Object.values(verbOptions).some(
        ({ mutator: operationMutator }) =>
          usesClientConfig(output, operationMutator) &&
          !!operationMutator?.inferred !== !!mutator.inferred,
      )
    ) {
      throw new Error(
        'Shared fetch runtime requires consistent mutator inferred settings across operations.',
      );
    }
    const mutatorPath = getImport(
      clientConfigOutputPath,
      output.override.mutator,
      output.tsconfig,
    );
    files.push({
      path: clientConfigOutputPath,
      content:
        header +
        clientConfigTemplate({
          runtimeImportPath: getRuntimeImportPath(
            clientConfigOutputPath,
            output,
            runtimeOutputPath,
          ),
          mutatorImport: `import ${mutator.default ? mutator.name : `{ ${mutator.name} }`} from '${mutatorPath}';\n`,
          mutatorName: mutator.name,
          inferred: mutator.inferred,
          hasSecondArg: mutator.hasSecondArg,
          hasThirdArg: mutator.hasThirdArg,
          mutatorAlias: getSharedMutatorAlias(output),
        }),
    });
  }

  return Promise.resolve(files);
};
