import {
  camel,
  type ClientBuilder,
  type ClientDependenciesBuilder,
  type ClientExtraFilesBuilder,
  type ClientFooterBuilder,
  type ClientHeaderBuilder,
  type ContextSpec,
  conventionName,
  escapeRegExp,
  generateDependencyImports,
  generateFormDataAndUrlEncodedFunction,
  generateMutatorImports,
  type GeneratorDependency,
  type GeneratorImport,
  type GeneratorVerbOptions,
  getAngularFilteredParamsCallExpression,
  getAngularFilteredParamsHelperBody,
  getFileInfo,
  getFullRoute,
  GetterPropType,
  isObject,
  isSyntheticDefaultImportsAllow,
  jsDoc,
  kebab,
  type NormalizedOutputOptions,
  type OpenApiInfoObject,
  OutputMode,
  pascal,
  type ResReqTypesValue,
  toObjectString,
  upath,
} from '@orval/core';

import {
  ANGULAR_HTTP_CLIENT_DEPENDENCIES,
  ANGULAR_HTTP_RESOURCE_DEPENDENCIES,
} from './constants';
import {
  buildAcceptHelpers,
  generateHttpClientImplementation,
  getAcceptHelperName,
  getHttpClientReturnTypes,
  getUniqueContentTypes,
  type HttpClientGeneratorContext,
  resetHttpClientReturnTypes,
} from './http-client';
import {
  buildServiceClassOpen,
  type ClientOverride,
  createReturnTypesRegistry,
  createRouteRegistry,
  getDefaultSuccessType,
  getSchemaOutputTypeRef,
  isMutationVerb,
  isPrimitiveType,
  isRetrievalVerb,
  isZodSchemaOutput,
} from './utils';

/**
 * Reads the per-operation angular client override from the orval config.
 *
 * Mirrors the pattern used by `@orval/query` for `operationQueryOptions`:
 * ```ts
 * override: {
 *   operations: {
 *     myPostSearch: { angular: { retrievalClient: 'httpResource' } },
 *   }
 * }
 * ```
 */
interface AngularOperationOverride {
  readonly client?: ClientOverride;
  readonly httpResource?: AngularHttpResourceOptionsConfig;
}

interface AngularHttpResourceOptionsConfig {
  defaultValue?: unknown;
  debugName?: string;
  injector?: string;
  equal?: string;
}

const isAngularHttpResourceOptions = (
  value: unknown,
): value is AngularHttpResourceOptionsConfig =>
  value === undefined ||
  (isObject(value) &&
    (value.defaultValue === undefined ||
      typeof value.defaultValue === 'string' ||
      typeof value.defaultValue === 'number' ||
      typeof value.defaultValue === 'boolean' ||
      value.defaultValue === null ||
      Array.isArray(value.defaultValue) ||
      isObject(value.defaultValue)) &&
    (value.debugName === undefined || typeof value.debugName === 'string') &&
    (value.injector === undefined || typeof value.injector === 'string') &&
    (value.equal === undefined || typeof value.equal === 'string'));

const isAngularOperationOverride = (
  value: unknown,
): value is AngularOperationOverride =>
  value !== undefined &&
  typeof value === 'object' &&
  value !== null &&
  (!('client' in value) ||
    value.client === 'httpClient' ||
    value.client === 'httpResource' ||
    value.client === 'both') &&
  (!('httpResource' in value) ||
    isAngularHttpResourceOptions(value.httpResource));

const getClientOverride = (
  verbOption: GeneratorVerbOptions,
): ClientOverride | undefined => {
  const angular =
    verbOption.override.operations[verbOption.operationId]?.angular;

  return isAngularOperationOverride(angular) ? angular.client : undefined;
};

/**
 * Resolves the effective `httpResource` option override for an operation.
 *
 * Operation-level configuration takes precedence over the global
 * `override.angular.httpResource` block while still inheriting unspecified
 * values from the global configuration.
 *
 * @returns The merged resource options for the operation, or `undefined` when no override exists.
 */
const getHttpResourceOverride = (
  verbOption: GeneratorVerbOptions,
  output: NormalizedOutputOptions,
): AngularHttpResourceOptionsConfig | undefined => {
  const operationAngular =
    verbOption.override.operations[verbOption.operationId]?.angular;
  const operationOverride = isAngularOperationOverride(operationAngular)
    ? operationAngular.httpResource
    : undefined;
  const angularOverride = output.override.angular as unknown;
  const globalOverride =
    isObject(angularOverride) &&
    'httpResource' in angularOverride &&
    isAngularHttpResourceOptions(angularOverride.httpResource)
      ? angularOverride.httpResource
      : undefined;

  if (globalOverride === undefined) return operationOverride;
  if (operationOverride === undefined) return globalOverride;

  return {
    ...globalOverride,
    ...operationOverride,
  };
};

// NOTE: Module-level singletons — reset() is called by the header builder
// (generateAngularHttpResourceHeader) at the start of each generation pass.
const resourceReturnTypesRegistry = createReturnTypesRegistry();

/** @internal Exported for testing only */
export const routeRegistry = createRouteRegistry();

const getRelevantVerbOptions = (
  verbOptions: Record<string, GeneratorVerbOptions>,
  tag?: string,
): GeneratorVerbOptions[] =>
  tag
    ? Object.values(verbOptions).filter((verbOption) =>
        verbOption.tags.some((currentTag) => camel(currentTag) === camel(tag)),
      )
    : Object.values(verbOptions);

const getVerbOptionsRecord = (
  verbOptions: readonly GeneratorVerbOptions[],
): Record<string, GeneratorVerbOptions> =>
  Object.fromEntries(
    verbOptions.map((verbOption) => [verbOption.operationId, verbOption]),
  );

const getPrimaryTag = (verbOption: GeneratorVerbOptions): string =>
  kebab(verbOption.tags[0] ?? 'default');

const hasRetrievalOperations = (
  verbOptions: Record<string, GeneratorVerbOptions>,
): boolean =>
  Object.values(verbOptions).some((verbOption) =>
    isRetrievalVerb(
      verbOption.verb,
      verbOption.operationName,
      getClientOverride(verbOption),
    ),
  );

const getHeader = (
  option: false | ((info: OpenApiInfoObject) => string | string[]),
  info: OpenApiInfoObject | undefined,
): string => {
  if (!option || !info) {
    return '';
  }

  const header = option(info);

  return Array.isArray(header) ? jsDoc({ description: header }) : header;
};

const mergeDependencies = (
  deps: GeneratorDependency[],
): GeneratorDependency[] => {
  const merged = new Map<
    string,
    { exports: GeneratorImport[]; dependency: string }
  >();

  for (const dep of deps) {
    const existing = merged.get(dep.dependency);
    if (!existing) {
      merged.set(dep.dependency, {
        exports: [...dep.exports],
        dependency: dep.dependency,
      });
      continue;
    }

    for (const exp of dep.exports) {
      if (
        !existing.exports.some(
          (current) => current.name === exp.name && current.alias === exp.alias,
        )
      ) {
        existing.exports.push(exp);
      }
    }
  }

  return [...merged.values()];
};

const cloneDependencies = (
  deps: readonly GeneratorDependency[],
): GeneratorDependency[] =>
  deps.map((dep) => ({
    ...dep,
    exports: [...dep.exports],
  }));

/**
 * Returns the merged dependency list required when Angular `httpResource`
 * output coexists with Angular `HttpClient` service generation.
 *
 * This is used for pure `httpResource` mode as well as mixed generation paths
 * that still need Angular common HTTP symbols and service helpers.
 *
 * @returns The de-duplicated dependency descriptors for Angular resource generation.
 */
export const getAngularHttpResourceDependencies: ClientDependenciesBuilder =
  () =>
    mergeDependencies([
      ...ANGULAR_HTTP_CLIENT_DEPENDENCIES,
      ...ANGULAR_HTTP_RESOURCE_DEPENDENCIES,
    ]);

/**
 * Returns only the dependencies required by standalone generated resource
 * files, such as the sibling `*.resource.ts` output used in `both` mode.
 *
 * @returns The dependency descriptors required by resource-only files.
 */
export const getAngularHttpResourceOnlyDependencies: ClientDependenciesBuilder =
  () => cloneDependencies(ANGULAR_HTTP_RESOURCE_DEPENDENCIES);

const isResponseText = (
  contentType: string | undefined,
  dataType: string,
): boolean => {
  if (dataType === 'string') return true;
  if (!contentType) return false;
  return contentType.startsWith('text/') || contentType.includes('xml');
};

const isResponseArrayBuffer = (contentType: string | undefined): boolean => {
  if (!contentType) return false;
  return (
    contentType.includes('application/octet-stream') ||
    contentType.includes('application/pdf')
  );
};

const isResponseBlob = (
  contentType: string | undefined,
  isBlob: boolean,
): boolean => {
  if (isBlob) return true;
  if (!contentType) return false;
  return contentType.startsWith('image/') || contentType.includes('blob');
};

type HttpResourceFactoryName =
  | 'httpResource'
  | 'httpResource.text'
  | 'httpResource.arrayBuffer'
  | 'httpResource.blob';

const HTTP_RESOURCE_OPTIONS_TYPE_NAME = 'OrvalHttpResourceOptions';

const getHttpResourceFactory = (
  response: { readonly isBlob: boolean },
  contentType: string | undefined,
  dataType: string,
): HttpResourceFactoryName => {
  if (isResponseText(contentType, dataType)) return 'httpResource.text';
  if (isResponseBlob(contentType, response.isBlob)) return 'httpResource.blob';
  if (isResponseArrayBuffer(contentType)) return 'httpResource.arrayBuffer';
  return 'httpResource';
};

const getHttpResourceRawType = (factory: HttpResourceFactoryName): string => {
  switch (factory) {
    case 'httpResource.text': {
      return 'string';
    }
    case 'httpResource.arrayBuffer': {
      return 'ArrayBuffer';
    }
    case 'httpResource.blob': {
      return 'Blob';
    }
    default: {
      return 'unknown';
    }
  }
};

const getTypeWithoutDefault = (definition: string): string => {
  const match = /^([^:]+):\s*(.+)$/.exec(definition);
  if (!match) return definition;
  return match[2].replace(/\s*=\s*.*$/, '').trim();
};

const getDefaultValueFromImplementation = (
  implementation: string,
): string | undefined => {
  const match = /=\s*(.+)$/.exec(implementation);
  return match ? match[1].trim() : undefined;
};

interface SignalProp {
  readonly definition: string;
  readonly implementation: string;
}

const withSignal = (
  prop: GeneratorVerbOptions['props'][number],
  options: { readonly hasDefault?: boolean } = {},
): SignalProp => {
  const type = getTypeWithoutDefault(prop.definition);
  const derivedDefault =
    getDefaultValueFromImplementation(prop.implementation) !== undefined ||
    prop.default !== undefined;
  const hasDefault = options.hasDefault ?? derivedDefault;
  const nameMatch = /^([^:]+):/.exec(prop.definition);
  const namePart = nameMatch ? nameMatch[1] : prop.name;
  const hasOptionalMark = namePart.includes('?');
  const optional = prop.required && !hasDefault && !hasOptionalMark ? '' : '?';
  const definition = `${prop.name}${optional}: Signal<${type}>`;

  return {
    definition,
    implementation: definition,
  };
};

const buildSignalProps = (
  props: GeneratorVerbOptions['props'],
  params: GeneratorVerbOptions['params'],
): GeneratorVerbOptions['props'] => {
  const paramDefaults = new Map<string, boolean>();
  for (const param of params) {
    const hasDefault =
      getDefaultValueFromImplementation(param.implementation) !== undefined ||
      param.default !== undefined;
    paramDefaults.set(param.name, hasDefault);
  }

  return props.map((prop) => {
    switch (prop.type) {
      case GetterPropType.NAMED_PATH_PARAMS: {
        return {
          ...prop,
          name: 'pathParams',
          definition: `pathParams: Signal<${prop.schema.name}>`,
          implementation: `pathParams: Signal<${prop.schema.name}>`,
        };
      }
      case GetterPropType.PARAM:
      case GetterPropType.QUERY_PARAM:
      case GetterPropType.BODY:
      case GetterPropType.HEADER: {
        const hasDefault =
          prop.type === GetterPropType.PARAM
            ? (paramDefaults.get(prop.name) ?? false)
            : undefined;
        const signalProp = withSignal(prop, { hasDefault });
        return {
          ...prop,
          definition: signalProp.definition,
          implementation: signalProp.implementation,
        };
      }
      default: {
        return prop;
      }
    }
  });
};

const applySignalRoute = (
  route: string,
  params: GeneratorVerbOptions['params'],
  useNamedParams: boolean,
): string => {
  let updatedRoute = route;
  for (const param of params) {
    const template = '${' + param.name + '}';
    const defaultValue = getDefaultValueFromImplementation(
      param.implementation,
    );
    let replacement: string;
    if (useNamedParams) {
      replacement =
        defaultValue === undefined
          ? '${pathParams().' + param.name + '}'
          : '${pathParams()?.' + param.name + ' ?? ' + defaultValue + '}';
    } else {
      replacement =
        defaultValue === undefined
          ? '${' + param.name + '()}'
          : '${' + param.name + '?.() ?? ' + defaultValue + '}';
    }
    updatedRoute = updatedRoute.replaceAll(template, replacement);
  }
  return updatedRoute;
};

interface ResourceRequest {
  readonly bodyForm: string;
  readonly request: string;
  readonly isUrlOnly: boolean;
}

const buildResourceRequest = (
  {
    verb,
    body,
    headers,
    queryParams,
    paramsSerializer,
    override,
    formData,
    formUrlEncoded,
  }: GeneratorVerbOptions,
  route: string,
): ResourceRequest => {
  const isFormData = !override.formData.disabled;
  const isFormUrlEncoded = override.formUrlEncoded !== false;

  const bodyForm = generateFormDataAndUrlEncodedFunction({
    formData,
    formUrlEncoded,
    body,
    isFormData,
    isFormUrlEncoded,
  });

  const hasFormData = isFormData && body.formData;
  const hasFormUrlEncoded = isFormUrlEncoded && body.formUrlEncoded;

  const bodyAccess = body.definition
    ? body.isOptional
      ? `${body.implementation}?.()`
      : `${body.implementation}()`
    : undefined;
  const bodyValue = hasFormData
    ? 'formData'
    : hasFormUrlEncoded
      ? 'formUrlEncoded'
      : bodyAccess;

  const paramsAccess = queryParams ? 'params?.()' : undefined;
  const headersAccess = headers ? 'headers?.()' : undefined;
  const filteredParamsValue = paramsAccess
    ? getAngularFilteredParamsCallExpression(
        `${paramsAccess} ?? {}`,
        queryParams?.requiredNullableKeys ?? [],
        !!paramsSerializer,
      )
    : undefined;
  const paramsValue = paramsAccess
    ? paramsSerializer
      ? `params?.() ? ${paramsSerializer.name}(${filteredParamsValue}) : undefined`
      : filteredParamsValue
    : undefined;

  const isGet = verb === 'get';
  const hasExtras = !isGet || !!bodyValue || !!paramsValue || !!headersAccess;
  const isUrlOnly = !hasExtras && !bodyForm;

  const requestLines = [
    `url: \`${route}\``,
    isGet ? undefined : `method: '${verb.toUpperCase()}'`,
    bodyValue ? `body: ${bodyValue}` : undefined,
    paramsValue ? `params: ${paramsValue}` : undefined,
    headersAccess ? `headers: ${headersAccess}` : undefined,
  ].filter(Boolean);

  const request = isUrlOnly
    ? `\`${route}\``
    : `({\n      ${requestLines.join(',\n      ')}\n    })`;

  return {
    bodyForm,
    request,
    isUrlOnly,
  };
};

const getHttpResourceResponseImports = (
  response: GeneratorVerbOptions['response'],
): GeneratorImport[] => {
  const successDefinition = response.definition.success;
  if (!successDefinition) return [];

  return response.imports.filter((imp) => {
    const name = imp.alias ?? imp.name;
    const pattern = new RegExp(String.raw`\b${escapeRegExp(name)}\b`, 'g');
    return pattern.test(successDefinition);
  });
};

const getHttpResourceVerbImports = (
  verbOptions: GeneratorVerbOptions,
  output: NormalizedOutputOptions,
): GeneratorImport[] => {
  const { response, body, queryParams, props, headers, params } = verbOptions;
  const responseImports = isZodSchemaOutput(output)
    ? [
        ...getHttpResourceResponseImports(response).map((imp) => ({
          ...imp,
          values: true,
        })),
        ...getHttpResourceResponseImports(response)
          .filter((imp) => !isPrimitiveType(imp.name))
          .map((imp) => ({ name: getSchemaOutputTypeRef(imp.name) })),
      ]
    : getHttpResourceResponseImports(response);

  return [
    ...responseImports,
    ...body.imports,
    ...props.flatMap((prop) =>
      prop.type === GetterPropType.NAMED_PATH_PARAMS
        ? [{ name: prop.schema.name }]
        : [],
    ),
    ...(queryParams ? [{ name: queryParams.schema.name }] : []),
    ...(headers ? [{ name: headers.schema.name }] : []),
    ...params.flatMap<GeneratorImport>(({ imports }) => imports),
    { name: 'map', values: true, importPath: 'rxjs' },
  ];
};

const getParseExpression = (
  response: {
    readonly imports: readonly { name: string; isZodSchema?: boolean }[];
    readonly definition: { readonly success?: string };
  },
  factory: HttpResourceFactoryName,
  output: NormalizedOutputOptions,
  responseTypeOverride?: string,
): string | undefined => {
  if (factory !== 'httpResource') return undefined;

  // Explicit isZodSchema flag on imports (forward-compatible)
  const zodSchema = response.imports.find((imp) => imp.isZodSchema);
  if (zodSchema) return `${zodSchema.name}.parse`;

  // Check if runtime validation is disabled
  if (!output.override.angular.runtimeValidation) return undefined;

  // Auto-detect: when schemas.type === 'zod', use the response type as the schema name
  if (!isZodSchemaOutput(output)) return undefined;

  const responseType = responseTypeOverride ?? response.definition.success;
  if (!responseType) return undefined;
  if (isPrimitiveType(responseType)) return undefined;

  // Verify a matching import exists (the response type name resolves to a zod schema)
  const hasMatchingImport = response.imports.some(
    (imp) => imp.name === responseType,
  );
  if (!hasMatchingImport) return undefined;

  return `${responseType}.parse`;
};

/**
 * Builds the literal option entries that Orval injects into generated
 * `httpResource()` calls.
 *
 * This merges user-supplied generator configuration such as `defaultValue` or
 * `debugName` with automatically derived runtime-validation hooks like
 * `parse: Schema.parse`.
 *
 * @returns The option entries plus metadata about whether a configured default value exists.
 */
const buildHttpResourceOptionsLiteral = (
  verbOption: GeneratorVerbOptions,
  factory: HttpResourceFactoryName,
  output: NormalizedOutputOptions,
  responseTypeOverride?: string,
): { entries: string[]; hasDefaultValue: boolean } => {
  const override = getHttpResourceOverride(verbOption, output);
  const parseExpression = getParseExpression(
    verbOption.response,
    factory,
    output,
    responseTypeOverride,
  );

  const defaultValueLiteral =
    override?.defaultValue === undefined
      ? undefined
      : JSON.stringify(override.defaultValue);

  const optionEntries = [
    parseExpression ? `parse: ${parseExpression}` : undefined,
    defaultValueLiteral ? `defaultValue: ${defaultValueLiteral}` : undefined,
    override?.debugName === undefined
      ? undefined
      : `debugName: ${JSON.stringify(override.debugName)}`,
    override?.injector ? `injector: ${override.injector}` : undefined,
    override?.equal ? `equal: ${override.equal}` : undefined,
  ].filter((value): value is string => value !== undefined);

  return {
    entries: optionEntries,
    hasDefaultValue: defaultValueLiteral !== undefined,
  };
};

const appendArgument = (args: string, argument: string): string => {
  const normalizedArgs = args.trim().replace(/,\s*$/, '');

  return normalizedArgs.length > 0
    ? `${normalizedArgs},
  ${argument}`
    : argument;
};

const normalizeOptionalParametersForRequiredTrailingArg = (
  args: string,
): string =>
  args.replaceAll(/(\w+)\?:\s*([^,\n]+)(,?)/g, '$1: $2 | undefined$3');

const buildHttpResourceOptionsArgument = (
  valueType: string,
  rawType: string,
  options: { readonly requiresDefaultValue: boolean },
  omitParse = false,
): string => {
  const baseType = `${HTTP_RESOURCE_OPTIONS_TYPE_NAME}<${valueType}, ${rawType}${omitParse ? ', true' : ''}>`;
  return options.requiresDefaultValue
    ? `options: ${baseType} & { defaultValue: NoInfer<${valueType}> }`
    : `options?: ${baseType}`;
};

const buildHttpResourceOptionsExpression = (
  configuredEntries: readonly string[],
): string | undefined => {
  if (configuredEntries.length === 0) {
    return 'options';
  }

  return `{
    ...(options ?? {}),
    ${configuredEntries.join(',\n    ')}
  }`;
};

const buildHttpResourceFunctionSignatures = (
  resourceName: string,
  args: string,
  valueType: string,
  rawType: string,
  hasConfiguredDefaultValue: boolean,
  omitParse = false,
): string => {
  if (hasConfiguredDefaultValue) {
    return `export function ${resourceName}(${appendArgument(
      args,
      buildHttpResourceOptionsArgument(
        valueType,
        rawType,
        {
          requiresDefaultValue: false,
        },
        omitParse,
      ),
    )}): HttpResourceRef<${valueType}>`;
  }

  const overloadArgs = appendArgument(
    normalizeOptionalParametersForRequiredTrailingArg(args),
    buildHttpResourceOptionsArgument(
      valueType,
      rawType,
      {
        requiresDefaultValue: true,
      },
      omitParse,
    ),
  );
  const implementationArgs = appendArgument(
    args,
    buildHttpResourceOptionsArgument(
      valueType,
      rawType,
      {
        requiresDefaultValue: false,
      },
      omitParse,
    ),
  );

  return `export function ${resourceName}(${overloadArgs}): HttpResourceRef<${valueType}>;
export function ${resourceName}(${implementationArgs}): HttpResourceRef<${valueType} | undefined>`;
};

/**
 * Generates a single Angular `httpResource` helper function for an operation.
 *
 * The generated output handles signal-wrapped parameters, route interpolation,
 * request-body construction, content-type branching, runtime validation, and
 * optional mutator integration when the mutator is compatible with standalone
 * resource functions.
 *
 * @remarks
 * This function emits overloads when content negotiation or caller-supplied
 * `defaultValue` support requires multiple signatures.
 *
 * @returns A string containing the complete generated resource helper.
 */
const buildHttpResourceFunction = (
  verbOption: GeneratorVerbOptions,
  route: string,
  output: NormalizedOutputOptions,
): string => {
  const { operationName, response, props, params, mutator } = verbOption;

  const dataType = response.definition.success || 'unknown';
  const omitParse = isZodSchemaOutput(output);
  const responseSchemaImports = getHttpResourceResponseImports(response);
  const hasResponseSchemaImport = responseSchemaImports.some(
    (imp) => imp.name === dataType,
  );
  const resourceName = `${operationName}Resource`;
  const parsedDataType =
    omitParse &&
    output.override.angular.runtimeValidation &&
    !isPrimitiveType(dataType) &&
    hasResponseSchemaImport
      ? getSchemaOutputTypeRef(dataType)
      : dataType;
  const successTypes = response.types.success;
  const overallReturnType =
    successTypes.length <= 1
      ? parsedDataType
      : [
          ...new Set(
            successTypes.map((type) =>
              getHttpResourceGeneratedResponseType(
                type.value,
                type.contentType,
                responseSchemaImports,
                output,
              ),
            ),
          ),
        ].join(' | ') || parsedDataType;
  resourceReturnTypesRegistry.set(
    operationName,
    `export type ${pascal(
      operationName,
    )}ResourceResult = NonNullable<${overallReturnType}>`,
  );
  const uniqueContentTypes = getUniqueContentTypes(successTypes);
  const defaultSuccess = getDefaultSuccessType(successTypes, dataType);
  const jsonContentType = successTypes.find((type) =>
    type.contentType.includes('json'),
  )?.contentType;
  const preferredContentType = jsonContentType ?? defaultSuccess.contentType;
  const resourceFactory = getHttpResourceFactory(
    response,
    preferredContentType,
    dataType,
  );

  const hasNamedParams = props.some(
    (prop) => prop.type === GetterPropType.NAMED_PATH_PARAMS,
  );
  const signalRoute = applySignalRoute(route, params, hasNamedParams);

  const signalProps = buildSignalProps(props, params);
  const args = toObjectString(signalProps, 'implementation');

  const { bodyForm, request, isUrlOnly } = buildResourceRequest(
    verbOption,
    signalRoute,
  );

  if (uniqueContentTypes.length > 1) {
    const defaultContentType = jsonContentType ?? defaultSuccess.contentType;
    const acceptTypeName = getAcceptHelperName(operationName);
    const requiredProps = signalProps.filter(
      (_, index) => props[index]?.required && !props[index]?.default,
    );
    const optionalProps = signalProps.filter(
      (_, index) => !props[index]?.required || props[index]?.default,
    );
    const requiredPart = requiredProps
      .map((prop) => prop.implementation)
      .join(',\n    ');
    const optionalPart = optionalProps
      .map((prop) => prop.implementation)
      .join(',\n    ');
    const getBranchReturnType = (type: ResReqTypesValue) =>
      getHttpResourceGeneratedResponseType(
        type.value,
        type.contentType,
        responseSchemaImports,
        output,
      );
    const unionReturnType = [
      ...new Set(
        successTypes
          .filter((type) => type.contentType)
          .map((type) => getBranchReturnType(type)),
      ),
    ].join(' | ');
    const getBranchRawType = (type: ResReqTypesValue): string =>
      getHttpResourceRawType(
        getHttpResourceFactory(response, type.contentType, type.value),
      );
    // Per-branch options types (one per distinct content-type branch).
    // Deduped so text-like content types (text/plain, application/xml) that
    // share the same factory don't produce duplicate union members.
    const branchOptionsTypes = [
      ...new Set(
        successTypes
          .filter((type) => type.contentType)
          .map((type) =>
            buildBranchOptionsType(
              getBranchReturnType(type),
              getBranchRawType(type),
              omitParse,
            ),
          ),
      ),
    ];
    // The implementation signature accepts the union of branch option types.
    // This keeps each overload's narrow `options` assignable to the
    // implementation signature (required for TS overload compatibility) while
    // preventing mismatched `defaultValue`/`parse` across content types.
    const implementationOptionsType = branchOptionsTypes.join(' | ');
    // Per-accept overloads pin `options` to the branch-specific value/raw
    // types so `defaultValue` / `parse` type-check against the actual content
    // type — e.g. passing a `string` default to the `application/json`
    // overload is now a type error.
    const branchOverloads = successTypes
      .filter((type) => type.contentType)
      .map((type) => {
        const returnType = getBranchReturnType(type);
        const overloadArgs = [
          requiredPart,
          `accept: '${type.contentType}'`,
          optionalPart,
          `options?: ${buildBranchOptionsType(returnType, getBranchRawType(type), omitParse)}`,
        ]
          .filter(Boolean)
          .join(',\n    ');

        return `export function ${resourceName}(${overloadArgs}): HttpResourceRef<${returnType} | undefined>;`;
      })
      .join('\n');
    const implementationArgsWithDefault = [
      requiredPart,
      `accept: ${acceptTypeName} = '${defaultContentType}'`,
      optionalPart,
      `options?: ${implementationOptionsType}`,
    ]
      .filter(Boolean)
      .join(',\n    ');

    const getBranchOptions = (type?: ResReqTypesValue) => {
      if (!type) {
        return `options as ${buildBranchOptionsType(unionReturnType, 'unknown', omitParse)}`;
      }

      const factory = getHttpResourceFactory(
        response,
        type.contentType,
        type.value,
      );
      const branchOptions = buildHttpResourceOptionsLiteral(
        verbOption,
        factory,
        output,
        type.value,
      );
      const branchOptionsExpression = buildHttpResourceOptionsExpression(
        branchOptions.entries,
      );

      return `${branchOptionsExpression ?? 'options'} as unknown as ${buildBranchOptionsType(
        getBranchReturnType(type),
        getHttpResourceRawType(factory),
        omitParse,
      )}`;
    };

    const jsonType = successTypes.find(
      (type) =>
        type.contentType.includes('json') || type.contentType.includes('+json'),
    );
    const textType = successTypes.find((type) =>
      isResponseText(type.contentType, type.value),
    );
    const arrayBufferType = successTypes.find((type) =>
      isResponseArrayBuffer(type.contentType),
    );
    const blobType = successTypes.find((type) =>
      isResponseBlob(type.contentType, response.isBlob),
    );

    // Fallback path for unknown accept values must match the branch the
    // default `accept` argument targets — pick the success type whose content
    // type is `defaultContentType`, then fall back to the remaining branches
    // in the same priority order as the runtime dispatch above.
    const fallbackType =
      successTypes.find((type) => type.contentType === defaultContentType) ??
      jsonType ??
      textType ??
      arrayBufferType ??
      blobType;

    const buildFallbackReturn = (type: ResReqTypesValue): string => {
      const factory = getHttpResourceFactory(
        response,
        type.contentType,
        type.value,
      );
      const returnType =
        factory === 'httpResource'
          ? getBranchReturnType(type)
          : getHttpResourceRawType(factory);
      return `return ${factory}<${returnType}>(() => ({
      ...normalizedRequest,
      headers,
    }), ${getBranchOptions(type)});`;
    };

    const fallbackReturn = fallbackType
      ? buildFallbackReturn(fallbackType)
      : `return httpResource<${parsedDataType}>(() => ({
      ...normalizedRequest,
      headers,
    }), ${getBranchOptions()});`;

    // Default-accept overload (when `accept` is omitted): narrow `options` to
    // the branch the runtime falls back to, so callers that skip `accept`
    // still get branch-specific typing instead of the broad options union.
    const defaultOverloadOptionsType = fallbackType
      ? buildBranchOptionsType(
          getBranchReturnType(fallbackType),
          getBranchRawType(fallbackType),
          omitParse,
        )
      : implementationOptionsType;
    const defaultOverloadReturnType = fallbackType
      ? getBranchReturnType(fallbackType)
      : unionReturnType;
    const defaultOverloadArgs = [
      requiredPart,
      optionalPart,
      `options?: ${defaultOverloadOptionsType}`,
    ]
      .filter(Boolean)
      .join(',\n    ');

    const normalizeRequest = isUrlOnly
      ? `const normalizedRequest: HttpResourceRequest = { url: request };`
      : `const normalizedRequest: HttpResourceRequest = request;`;

    return `/**
 * @experimental httpResource is experimental (Angular v19.2+)
 */
${branchOverloads}
export function ${resourceName}(
    ${defaultOverloadArgs}
  ): HttpResourceRef<${defaultOverloadReturnType} | undefined>;
export function ${resourceName}(
    ${implementationArgsWithDefault}
): HttpResourceRef<${unionReturnType} | undefined> {
  ${bodyForm ? `${bodyForm};` : ''}
  const request = ${request};
  ${normalizeRequest}
  const headers = normalizedRequest.headers instanceof HttpHeaders
    ? normalizedRequest.headers.set('Accept', accept)
    : { ...(normalizedRequest.headers ?? {}), Accept: accept };

  if (accept.includes('json') || accept.includes('+json')) {
    return httpResource<${jsonType ? getBranchReturnType(jsonType) : parsedDataType}>(() => ({
      ...normalizedRequest,
      headers,
    }), ${getBranchOptions(jsonType)});
  }

  if (accept.startsWith('text/') || accept.includes('xml')) {
    return httpResource.text<string>(() => ({
      ...normalizedRequest,
      headers,
    }), ${getBranchOptions(textType)});
  }

  ${
    arrayBufferType
      ? `if (accept.includes('octet-stream') || accept.includes('pdf')) {
    return httpResource.arrayBuffer<ArrayBuffer>(() => ({
      ...normalizedRequest,
      headers,
    }), ${getBranchOptions(arrayBufferType)});
  }

  `
      : ''
  }${fallbackReturn}
}
`;
  }

  const resourceOptions = buildHttpResourceOptionsLiteral(
    verbOption,
    resourceFactory,
    output,
  );
  const rawType = getHttpResourceRawType(resourceFactory);
  const resourceValueType = resourceOptions.hasDefaultValue
    ? parsedDataType
    : `${parsedDataType} | undefined`;
  const functionSignatures = buildHttpResourceFunctionSignatures(
    resourceName,
    args,
    parsedDataType,
    rawType,
    resourceOptions.hasDefaultValue,
    omitParse,
  );
  const implementationArgs = appendArgument(
    args,
    buildHttpResourceOptionsArgument(
      parsedDataType,
      rawType,
      {
        requiresDefaultValue: false,
      },
      omitParse,
    ),
  );
  const optionsExpression = buildHttpResourceOptionsExpression(
    resourceOptions.entries,
  );
  const resourceCallOptions = optionsExpression ? `, ${optionsExpression}` : '';

  // HttpClient-style mutators expect (config, httpClient) — incompatible with
  // standalone httpResource functions which have no HttpClient instance.
  // Only apply mutators that accept a single argument (request config only).
  const isResourceCompatibleMutator =
    mutator !== undefined && !mutator.hasSecondArg;
  const returnExpression = isResourceCompatibleMutator
    ? `${mutator.name}(request)`
    : 'request';

  if (isUrlOnly && !isResourceCompatibleMutator) {
    return `/**
 * @experimental httpResource is experimental (Angular v19.2+)
 */
${functionSignatures};
export function ${resourceName}(${implementationArgs}): HttpResourceRef<${resourceValueType}> {
  return ${resourceFactory}<${parsedDataType}>(() => ${request}${resourceCallOptions});
}
`;
  }

  return `/**
 * @experimental httpResource is experimental (Angular v19.2+)
 */
${functionSignatures};
export function ${resourceName}(${implementationArgs}): HttpResourceRef<${resourceValueType}> {
  return ${resourceFactory}<${parsedDataType}>(() => {
    ${bodyForm ? `${bodyForm};` : ''}
    const request = ${request};
    return ${returnExpression};
  }${resourceCallOptions});
}
`;
};

const buildHttpResourceOptionsUtilities = (omitParse: boolean): string => `
export type ${HTTP_RESOURCE_OPTIONS_TYPE_NAME}<TValue, TRaw = unknown, TOmitParse extends boolean = ${omitParse}> = TOmitParse extends true
  ? Omit<HttpResourceOptions<TValue, TRaw>, 'parse'>
  : HttpResourceOptions<TValue, TRaw>;
`;

const getContentTypeReturnType = (
  contentType: string | undefined,
  value: string,
): string => {
  if (!contentType) return value;
  if (contentType.includes('json') || contentType.includes('+json')) {
    return value;
  }
  if (contentType.startsWith('text/') || contentType.includes('xml')) {
    return 'string';
  }
  if (isResponseArrayBuffer(contentType)) {
    return 'ArrayBuffer';
  }
  return 'Blob';
};

const getHttpResourceGeneratedResponseType = (
  value: string,
  contentType: string | undefined,
  responseImports: readonly { name: string }[],
  output: NormalizedOutputOptions,
): string => {
  if (
    isZodSchemaOutput(output) &&
    output.override.angular.runtimeValidation &&
    !!contentType &&
    (contentType.includes('json') || contentType.includes('+json')) &&
    !isPrimitiveType(value) &&
    responseImports.some((imp) => imp.name === value)
  ) {
    return getSchemaOutputTypeRef(value);
  }

  return getContentTypeReturnType(contentType, value);
};

const buildBranchOptionsType = (
  valueType: string,
  rawType: string,
  omitParse: boolean,
) =>
  `${HTTP_RESOURCE_OPTIONS_TYPE_NAME}<${valueType}, ${rawType}${omitParse ? ', true' : ''}>`;

const buildResourceStateUtilities = (): string => `
/**
 * Utility type for httpResource results with status tracking.
 * Inspired by @angular-architects/ngrx-toolkit withResource pattern.
 *
 * Uses \`globalThis.Error\` to avoid collision with API model types named \`Error\`.
 */
export interface ResourceState<T> {
  readonly value: Signal<T | undefined>;
  readonly status: Signal<ResourceStatus>;
  readonly error: Signal<globalThis.Error | undefined>;
  readonly isLoading: Signal<boolean>;
  readonly hasValue: () => boolean;
  readonly reload: () => boolean;
}

/**
 * Wraps an HttpResourceRef to expose a consistent ResourceState interface.
 * Useful when integrating with NgRx SignalStore via withResource().
 */
export function toResourceState<T>(ref: HttpResourceRef<T>): ResourceState<T> {
  return {
    value: ref.value,
    status: ref.status,
    error: ref.error,
    isLoading: ref.isLoading,
    hasValue: () => ref.hasValue(),
    reload: () => ref.reload(),
  };
}
`;

/**
 * Generates the header section for Angular `httpResource` output.
 *
 * @remarks
 * Resource functions are emitted in the header phase because their final shape
 * depends on the full set of operations in scope, including generated `Accept`
 * helpers and any shared mutation service methods.
 *
 * @returns The generated header, resource helpers, optional mutation service class, and resource result aliases.
 */
export const generateHttpResourceHeader: ClientHeaderBuilder = ({
  title,
  isRequestOptions,
  isMutator,
  isGlobalMutator,
  provideIn,
  output,
  verbOptions,
  tag,
}) => {
  resetHttpClientReturnTypes();
  resourceReturnTypesRegistry.reset();

  // When the output is emitted per-tag (modes: `tags`, `tags-split`) each file
  // must only reference operations that belong to the current tag — otherwise
  // the shared header duplicates helpers across every tag file and pulls in
  // type names the file-local `imports` filter never sees, producing missing
  // schema imports in the generated output.
  const relevantVerbOptions = getRelevantVerbOptions(verbOptions, tag);

  const retrievals = relevantVerbOptions.filter((verbOption) =>
    isRetrievalVerb(
      verbOption.verb,
      verbOption.operationName,
      getClientOverride(verbOption),
    ),
  );
  const hasResourceQueryParams = retrievals.some(
    (verbOption) => !!verbOption.queryParams,
  );
  const filterParamsHelper = hasResourceQueryParams
    ? `\n${getAngularFilteredParamsHelperBody()}\n`
    : '';
  const resources = retrievals
    .map((verbOption) => {
      const fullRoute = routeRegistry.get(
        verbOption.operationName,
        verbOption.route,
      );
      return buildHttpResourceFunction(verbOption, fullRoute, output);
    })
    .join('\n');
  const resourceTypes = resourceReturnTypesRegistry.getFooter(
    retrievals.map((verbOption) => verbOption.operationName),
  );

  const mutations = relevantVerbOptions.filter((verbOption) =>
    isMutationVerb(
      verbOption.verb,
      verbOption.operationName,
      getClientOverride(verbOption),
    ),
  );
  const acceptHelpers = buildAcceptHelpers(
    [...retrievals, ...mutations],
    output,
  );
  const hasMutationQueryParams = mutations.some(
    (verbOption) => !!verbOption.queryParams,
  );

  const mutationImplementation = mutations
    .map((verbOption) => {
      const fullRoute = routeRegistry.get(
        verbOption.operationName,
        verbOption.route,
      );
      const generatorOptions: HttpClientGeneratorContext = {
        route: fullRoute,
        context: { output },
      };

      return generateHttpClientImplementation(verbOption, generatorOptions);
    })
    .join('\n');

  const classImplementation = mutationImplementation
    ? `
${buildServiceClassOpen({
  title,
  isRequestOptions,
  isMutator,
  isGlobalMutator,
  provideIn,
  hasQueryParams: hasMutationQueryParams && !hasResourceQueryParams,
})}
${mutationImplementation}
};
`
    : '';

  return `${buildHttpResourceOptionsUtilities(isZodSchemaOutput(output))}${filterParamsHelper}${acceptHelpers ? `${acceptHelpers}\n\n` : ''}${resources}${classImplementation}${resourceTypes ? `\n${resourceTypes}\n` : ''}`;
};

/**
 * Generates the footer for Angular `httpResource` output.
 *
 * The footer appends any registered `ClientResult` aliases coming from shared
 * `HttpClient` mutation methods and the resource-state helper utilities emitted
 * for generated Angular resources.
 *
 * @returns The footer text for the generated Angular resource file.
 */
export const generateHttpResourceFooter: ClientFooterBuilder = ({
  operationNames,
}) => {
  const clientTypes = getHttpClientReturnTypes(operationNames);
  const utilities = buildResourceStateUtilities();

  return `${clientTypes ? `${clientTypes}\n` : ''}${utilities}`;
};

/**
 * Per-operation builder used during Angular `httpResource` generation.
 *
 * Unlike the `HttpClient` builder, the actual implementation body is emitted in
 * the header phase after all operations are known. This function mainly records
 * the resolved route and returns the imports required by the current operation.
 *
 * @returns An empty implementation plus the imports required by the operation.
 */
export const generateHttpResourceClient: ClientBuilder = (
  verbOptions,
  options,
) => {
  routeRegistry.set(verbOptions.operationName, options.route);
  const imports = getHttpResourceVerbImports(
    verbOptions,
    options.context.output,
  );

  return { implementation: '\n', imports };
};

const buildHttpResourceFile = (
  verbOptions: Record<string, GeneratorVerbOptions>,
  output: NormalizedOutputOptions,
  context: ContextSpec,
) => {
  resourceReturnTypesRegistry.reset();

  const retrievals = Object.values(verbOptions).filter((verbOption) =>
    isRetrievalVerb(
      verbOption.verb,
      verbOption.operationName,
      getClientOverride(verbOption),
    ),
  );

  const hasResourceQueryParams = retrievals.some(
    (verbOption) => !!verbOption.queryParams,
  );
  const filterParamsHelper = hasResourceQueryParams
    ? `\n${getAngularFilteredParamsHelperBody()}\n`
    : '';

  const resources = retrievals
    .map((verbOption) => {
      const fullRoute = getFullRoute(
        verbOption.route,
        context.spec.servers,
        output.baseUrl,
      );
      return buildHttpResourceFunction(verbOption, fullRoute, output);
    })
    .join('\n');

  const resourceTypes = resourceReturnTypesRegistry.getFooter(
    Object.values(verbOptions).map((verbOption) => verbOption.operationName),
  );
  const utilities = buildResourceStateUtilities();
  const acceptHelpers = buildAcceptHelpers(retrievals, output);

  return `${buildHttpResourceOptionsUtilities(isZodSchemaOutput(output))}${filterParamsHelper}${acceptHelpers ? `${acceptHelpers}\n\n` : ''}${resources}\n${resourceTypes ? `${resourceTypes}\n` : ''}${utilities}`;
};

const buildSchemaImportDependencies = (
  output: NormalizedOutputOptions,
  imports: GeneratorImport[],
  relativeSchemasPath: string,
) => {
  const isZod = isZodSchemaOutput(output);
  const uniqueImports = [
    ...new Map(imports.map((imp) => [imp.name, imp])).values(),
  ];

  if (!output.schemas) {
    return [
      {
        exports: isZod
          ? uniqueImports.map((imp) => ({ ...imp, values: true }))
          : uniqueImports,
        dependency: relativeSchemasPath,
      },
    ];
  }

  if (!output.indexFiles) {
    return [...uniqueImports].map((imp) => {
      const baseName = imp.schemaName ?? imp.name;
      const name = conventionName(baseName, output.namingConvention);
      const suffix = isZod ? '.zod' : '';
      const importExtension = output.fileExtension.replace(/\.ts$/, '');
      return {
        exports: isZod ? [{ ...imp, values: true }] : [imp],
        dependency: upath.joinSafe(
          relativeSchemasPath,
          `${name}${suffix}${importExtension}`,
        ),
      };
    });
  }

  if (isZod) {
    return [
      {
        exports: uniqueImports.map((imp) => ({ ...imp, values: true })),
        dependency: relativeSchemasPath,
      },
    ];
  }

  return [
    {
      exports: uniqueImports,
      dependency: relativeSchemasPath,
    },
  ];
};

const getHttpResourceExtraFilePath = (
  output: NormalizedOutputOptions,
  tag?: string,
): string => {
  const { extension, dirname, filename } = getFileInfo(output.target, {
    extension: output.fileExtension,
  });

  switch (output.mode) {
    case OutputMode.TAGS: {
      const normalizedTag = kebab(tag ?? 'default');
      return upath.joinSafe(dirname, `${normalizedTag}.resource${extension}`);
    }
    case OutputMode.TAGS_SPLIT: {
      const normalizedTag = kebab(tag ?? 'default');
      return upath.joinSafe(
        dirname,
        normalizedTag,
        `${normalizedTag}.resource${extension}`,
      );
    }
    default: {
      return upath.joinSafe(dirname, `${filename}.resource${extension}`);
    }
  }
};

const getHttpResourceRelativeSchemasPath = (
  output: NormalizedOutputOptions,
  outputPath: string,
): string => {
  const schemasPath =
    typeof output.schemas === 'string' ? output.schemas : output.schemas?.path;

  if (schemasPath) {
    return upath.getRelativeImportPath(
      outputPath,
      getFileInfo(schemasPath).dirname,
    );
  }

  const { dirname, filename, extension } = getFileInfo(output.target, {
    extension: output.fileExtension,
  });
  return upath.getRelativeImportPath(
    outputPath,
    upath.joinSafe(dirname, `${filename}.schemas${extension}`),
    output.fileExtension !== '.ts',
  );
};

const buildHttpResourceExtraFile = (
  verbOptions: Record<string, GeneratorVerbOptions>,
  outputPath: string,
  output: NormalizedOutputOptions,
  context: ContextSpec,
  header: string,
) => {
  const implementation = buildHttpResourceFile(verbOptions, output, context);
  const schemaImports = buildSchemaImportDependencies(
    output,
    Object.values(verbOptions)
      .filter((verbOption) =>
        isRetrievalVerb(
          verbOption.verb,
          verbOption.operationName,
          getClientOverride(verbOption),
        ),
      )
      .flatMap((verbOption) => getHttpResourceVerbImports(verbOption, output)),
    getHttpResourceRelativeSchemasPath(output, outputPath),
  );

  const dependencies = getAngularHttpResourceOnlyDependencies(false, false);
  const importImplementation = generateDependencyImports(
    implementation,
    [...schemaImports, ...dependencies],
    context.projectName,
    !!output.schemas,
    isSyntheticDefaultImportsAllow(output.tsconfig),
  );

  const mutators = Object.values(verbOptions)
    .filter((verbOption) =>
      isRetrievalVerb(
        verbOption.verb,
        verbOption.operationName,
        getClientOverride(verbOption),
      ),
    )
    .flatMap((verbOption) => {
      // Only include mutators that are compatible with httpResource (single-arg).
      // HttpClient mutators that require (config, httpClient) are skipped.
      const resourceMutator =
        verbOption.mutator && !verbOption.mutator.hasSecondArg
          ? verbOption.mutator
          : undefined;

      return [
        resourceMutator,
        verbOption.formData,
        verbOption.formUrlEncoded,
        verbOption.paramsSerializer,
      ].filter(
        (value): value is NonNullable<typeof value> => value !== undefined,
      );
    });

  const mutatorImports =
    mutators.length > 0
      ? generateMutatorImports({
          mutators,
          oneMore: output.mode === OutputMode.TAGS_SPLIT,
        })
      : '';

  return {
    content: `${header}${importImplementation}${mutatorImports}${implementation}`,
    path: outputPath,
  };
};

/**
 * Generates the extra sibling resource files used by Angular `both` mode.
 *
 * @remarks
 * The main generated file keeps the `HttpClient` service class while retrieval
 * resources are emitted into `*.resource.ts` so consumers can opt into both
 * access patterns without mixing the generated surfaces. In tag-based output
 * modes this emits one sibling resource file per generated tag file.
 *
 * @returns One or more extra file descriptors representing generated resource files.
 */
export const generateHttpResourceExtraFiles: ClientExtraFilesBuilder = (
  verbOptions,
  output,
  context,
) => {
  const header = getHeader(output.override.header, context.spec.info);

  if (!hasRetrievalOperations(verbOptions)) {
    return Promise.resolve([]);
  }

  if (
    output.mode === OutputMode.TAGS ||
    output.mode === OutputMode.TAGS_SPLIT
  ) {
    const groupedVerbOptions = new Map<
      string,
      Record<string, GeneratorVerbOptions>
    >();

    for (const verbOption of Object.values(verbOptions)) {
      const tag = getPrimaryTag(verbOption);
      const currentGroup = groupedVerbOptions.get(tag) ?? {};
      currentGroup[verbOption.operationId] = verbOption;
      groupedVerbOptions.set(tag, currentGroup);
    }

    return Promise.resolve(
      [...groupedVerbOptions.entries()]
        .filter(([, tagVerbOptions]) => hasRetrievalOperations(tagVerbOptions))
        .map(([tag, tagVerbOptions]) =>
          buildHttpResourceExtraFile(
            tagVerbOptions,
            getHttpResourceExtraFilePath(output, tag),
            output,
            context,
            header,
          ),
        ),
    );
  }

  return Promise.resolve([
    buildHttpResourceExtraFile(
      getVerbOptionsRecord(getRelevantVerbOptions(verbOptions)),
      getHttpResourceExtraFilePath(output),
      output,
      context,
      header,
    ),
  ]);
};

export { generateAngularTitle } from './utils';
