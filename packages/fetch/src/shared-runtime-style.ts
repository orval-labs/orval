import {
  assertSafeResponseStatusKey,
  camel,
  type ClientExtraFilesBuilder,
  type ClientFileBuilder,
  emitResponseValidation,
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
  makeRouteSafe,
  type NormalizedOutputOptions,
  type OpenApiInfoObject,
  OutputClient,
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

export const isSharedRuntimeStyle = (
  output: NormalizedOutputOptions | undefined,
) =>
  output?.override.fetch.runtimeImplementationStyle === 'shared' &&
  output.client === OutputClient.FETCH;

const usesClientConfig = (
  output: NormalizedOutputOptions,
  mutator: GeneratorVerbOptions['mutator'],
) => !!output.override.mutator && !!mutator && !mutator.isHook;

const getRuntimeImportPath = (
  importer: string,
  output: NormalizedOutputOptions,
  target: string,
) =>
  upath.getRelativeImportPath(importer, target) +
  getImportExtension(output.fileExtension, output.tsconfig);

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

  return [
    { name: 'execute', values: true, importPath: executePath },
    { name: 'serializeQuery', values: true, importPath: runtimePath },
    { name: 'CallOptions', importPath: runtimePath },
    ...(hasEnvelope ? [{ name: 'ResponseOf', importPath: runtimePath }] : []),
    ...(hasEnvelope && hasStream
      ? [{ name: 'Stream', importPath: runtimePath }]
      : []),
  ];
};

/**
 * The zod schema a verb's response is validated with, under the same rules as
 * the inline style: generated code parses it in `transform`, while a
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
    return {
      declarations: `export type ${resultType} = ResponseOf<${map}, ${headersType ?? 'Headers'}, ${successKeys.map(statusKeyLiteral).join(' | ')}>;\n`,
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

  const route = context.output.urlEncodeParameters
    ? makeRouteSafe(
        options.route,
        new Set(params.filter((p) => p.allowReserved).map((p) => p.name)),
        new Set(params.map((p) => p.name)),
      )
    : options.route;

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
  const serializeCall = paramsSerializer
    ? `${paramsSerializer.name}(params)`
    : `serializeQuery(params${meta.length > 0 ? `, { ${meta.join(', ')} }` : ''})`;

  // Same slot layout as the inline builder: a path-only builder stays byte-identical.
  const getUrlFnImplementation = `export const ${getUrlFnName} = (${getUrlFnProps}) => {\n

  ${queryParams ? `const stringifiedParams = ${serializeCall};` : ''}

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
    body,
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

  const transform = (() => {
    if (hasClientMutator || (!dateDeserializer && !validation)) {
      return undefined;
    }
    const converted = dateDeserializer
      ? `(${successStatusCondition('status')} ? ${dateDeserializer.name}(data as ${successType}) : data)`
      : 'data';
    if (!validation) return `(data, status) => ${converted}`;
    const validated = emitResponseValidation({
      schemaRef: validation.schemaRef,
      operationName,
      strategy: override.fetch.runtimeValidation.strategy,
      context: 'fetch-assign',
      inputExpression: converted,
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
      ? `(data, status) => status >= 200 && status < 300 ? ${validated} : ${converted}`
      : `(data${dateDeserializer ? ', status' : ''}) => ${validated}`;
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
          ...(transform ? [`transform: ${transform}`] : []),
          ...(forceSuccessResponse ? ['throwOnError: true'] : []),
          ...(includeHttpResponseReturnType ? [] : ['returnData: true']),
          ...(includeHttpResponseReturnType &&
          override.fetch.serializeResponseHeaders
            ? ['serializeHeaders: true']
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

  const fetchImplementation = `export const ${operationName} = (${toObjectString(props, 'implementation')} options?: CallOptions) =>
  execute<${resultType}>({
    ${executeArgs.join(',\n    ')},
  })${mutatorDateTransform};
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

  const mutator = Object.values(verbOptions).find(
    (verb) => verb.mutator,
  )?.mutator;
  if (output.override.mutator && mutator && !mutator.isHook) {
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
        }),
    });
  }

  return Promise.resolve(files);
};
