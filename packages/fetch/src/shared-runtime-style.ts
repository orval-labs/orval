import {
  assertSafeResponseStatusKey,
  camel,
  type ClientExtraFilesBuilder,
  type ClientFileBuilder,
  generateFormDataAndUrlEncodedFunction,
  generateVerbImports,
  type GeneratorClient,
  type GeneratorImport,
  type GeneratorOptions,
  type GeneratorVerbOptions,
  getFileInfo,
  getImportExtension,
  getImport,
  GetterPropType,
  jsDoc,
  makeRouteSafe,
  type NormalizedOutputOptions,
  type OpenApiInfoObject,
  OutputClient,
  toObjectString,
  upath,
} from '@orval/core';

import pkg from '../package.json' with { type: 'json' };
import {
  getArrayFormatParameters,
  getDeepObjectParameters,
  getExplodeParameters,
  getParameterObjects,
} from './query-params';
import { clientConfigTemplate, RUNTIME_TEMPLATE } from './runtime';

const isContentTypeNdJson = (contentType: string) =>
  contentType === 'application/nd-json' ||
  contentType === 'application/x-ndjson';

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
  { mutator, response }: GeneratorVerbOptions,
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
  const hasStream = response.contentTypes.some(isContentTypeNdJson);

  return [
    { name: 'execute', values: true, importPath: executePath },
    { name: 'serializeQuery', values: true, importPath: runtimePath },
    { name: 'CallOptions', importPath: runtimePath },
    { name: 'ResponseOf', importPath: runtimePath },
    ...(hasStream ? [{ name: 'Stream', importPath: runtimePath }] : []),
  ];
};

// Exact codes stay numeric keys so `ResponseOf` can narrow on them; a
// wildcard is a quoted `WildcardKey` ('2XX').
const statusKeyLiteral = (key: string) => {
  if (key === 'default') return key;
  assertSafeResponseStatusKey(key);
  return /^\d+$/.test(key) ? key : `'${key.toUpperCase()}'`;
};

const getResponseMap = ({ response, typeName }: GeneratorVerbOptions) => {
  const allResponses = [...response.types.success, ...response.types.errors];
  const entries = new Map<string, string[]>();
  for (const { key, value, contentType } of allResponses) {
    const dataType = isContentTypeNdJson(contentType)
      ? `Stream<${value || 'unknown'}>`
      : value || 'unknown';
    const dataTypes = entries.get(key) ?? [];
    if (!dataTypes.includes(dataType)) dataTypes.push(dataType);
    entries.set(key, dataTypes);
  }
  if (entries.size === 0) entries.set('default', ['unknown']);

  const members = [...entries.entries()].map(
    ([key, dataTypes]) => `${statusKeyLiteral(key)}: ${dataTypes.join(' | ')}`,
  );

  return `export type ${typeName}Response = ResponseOf<{ ${members.join('; ')} }>;\n`;
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
    formData,
    formUrlEncoded,
    headers,
    operationName,
    override,
    params,
    paramsSerializer,
    props,
    queryParams,
    response,
    typeName,
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

  const parameterObjects = getParameterObjects(
    { verb },
    { context, pathRoute },
  );
  const arrayFormat = override.fetch.arrayFormat;
  const names = (parameters: { name: string }[]) =>
    parameters.map((parameter) => parameter.name);
  const meta = Object.entries({
    explode: names(
      getExplodeParameters(parameterObjects, arrayFormat, context),
    ),
    ...(arrayFormat
      ? {
          [arrayFormat]: names(
            getArrayFormatParameters(parameterObjects, arrayFormat, context),
          ),
        }
      : {}),
    deepObject: names(getDeepObjectParameters(parameterObjects)),
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

  const executeArgs = [
    `url: ${getUrlFnName}(${getUrlFnProperties})`,
    `method: '${verb.toUpperCase()}'`,
    ...(body.implementation ? [`body: ${body.implementation}`] : []),
    ...(body.implementation && body.contentType
      ? [`contentType: '${body.contentType}'`]
      : []),
    ...(headersArgument ? [headersArgument] : []),
    ...(responseType ? [`responseType: '${responseType}'`] : []),
    ...(encodeBodyName ? [`encodeBody: ${encodeBodyName}`] : []),
    'options',
  ];

  const fetchImplementation = `export const ${operationName} = (${toObjectString(props, 'implementation')} options?: CallOptions) =>
  execute<${typeName}Response>({
    ${executeArgs.join(',\n    ')},
  });
`;

  return `${getResponseMap(verbOptions)}\n${getUrlFnImplementation}\n${encodeBodyImplementation}${doc}${fetchImplementation}\n`;
};

export const generateSharedClient = (
  verbOptions: GeneratorVerbOptions,
  options: GeneratorOptions,
): GeneratorClient => ({
  implementation: generateSharedRequestFunction(verbOptions, options),
  imports: [
    ...generateVerbImports(verbOptions),
    ...getSharedRuntimeImports(verbOptions, options),
  ],
  docComment: '',
});

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
