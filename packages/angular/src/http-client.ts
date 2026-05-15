import {
  camel,
  type ClientBuilder,
  type ClientDependenciesBuilder,
  type ClientFooterBuilder,
  type ClientHeaderBuilder,
  type ContextSpec,
  generateBodyOptions,
  generateFormDataAndUrlEncodedFunction,
  generateMutatorConfig,
  generateMutatorRequestOptions,
  generateOptions,
  generateVerbImports,
  type GeneratorVerbOptions,
  getAngularFilteredParamsCallExpression,
  getAngularFilteredParamsExpression,
  getAngularFilteredParamsHelperBody,
  getDefaultContentType,
  getEnumImplementation,
  getIsBodyVerb,
  type GetterProp,
  GetterPropType,
  isBoolean,
  pascal,
  toObjectString,
} from '@orval/core';

import { ANGULAR_HTTP_CLIENT_DEPENDENCIES } from './constants';
import {
  HTTP_CLIENT_OBSERVE_OPTIONS_TEMPLATE,
  HTTP_CLIENT_OPTIONS_TEMPLATE,
  THIRD_PARAMETER_TEMPLATE,
} from './types';
import {
  createReturnTypesRegistry,
  getSchemaOutputTypeRef,
  isPrimitiveType,
  isZodSchemaOutput,
} from './utils';

/**
 * Narrowed context for `generateHttpClientImplementation`.
 *
 * The implementation only reads `context.output`, so callers don't need
 * to supply a full `ContextSpec` (which also requires `target`, `workspace`,
 * `spec`, etc.).
 *
 * @remarks
 * This keeps the call sites lightweight when `http-resource.ts` delegates
 * mutation generation back to the shared `HttpClient` implementation builder.
 */
export interface HttpClientGeneratorContext {
  route: string;
  context: Pick<ContextSpec, 'output'>;
}

// NOTE: Module-level singleton — reset() is called at the start of each
// header builder invocation (generateAngularHeader). Must stay in sync with
// the generation lifecycle.
const returnTypesRegistry = createReturnTypesRegistry();

const hasSchemaImport = (
  imports: readonly { name: string }[],
  typeName: string | undefined,
): boolean =>
  typeName != undefined && imports.some((imp) => imp.name === typeName);

const getSchemaValueRef = (typeName: string): string =>
  typeName === 'Error' ? 'ErrorSchema' : typeName;

/**
 * Partition props into the three buckets used by per-content-type overload
 * rendering: required non-body params, body params, and optional non-body
 * params. The body always sits between the required and optional non-body
 * params so that the per-content-type overloads can insert a required
 * `accept` literal immediately after the body without violating TS1016
 * (required parameter cannot follow an optional one).
 */
const partitionPropsForMultiContent = (
  props: readonly GetterProp[],
): {
  requiredNonBody: GetterProp[];
  body: GetterProp[];
  optionalNonBody: GetterProp[];
} => {
  const requiredNonBody: GetterProp[] = [];
  const body: GetterProp[] = [];
  const optionalNonBody: GetterProp[] = [];
  for (const p of props) {
    if (p.type === GetterPropType.BODY) {
      body.push(p);
    } else if (p.required && !p.default) {
      requiredNonBody.push(p);
    } else {
      optionalNonBody.push(p);
    }
  }
  return { requiredNonBody, body, optionalNonBody };
};

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
  return 'Blob';
};

/**
 * Returns the dependency list required by the Angular `HttpClient` generator.
 *
 * These imports are consumed by Orval's generic dependency-import emitter when
 * composing the generated Angular client file.
 *
 * @returns The Angular `HttpClient` dependency descriptors used during import generation.
 */
export const getAngularDependencies: ClientDependenciesBuilder = () => [
  ...ANGULAR_HTTP_CLIENT_DEPENDENCIES,
];

/**
 * Builds the generated TypeScript helper name used for multi-content-type
 * `Accept` header unions.
 *
 * Example: `listPets` -> `ListPetsAccept`.
 *
 * @returns A PascalCase helper type/const name for the operation's `Accept` values.
 */
export const getAcceptHelperName = (operationName: string) =>
  `${pascal(operationName)}Accept`;

/**
 * Collects the distinct successful response content types for a single
 * operation.
 *
 * The Angular generators use this to decide whether they need `Accept`
 * overloads or content-type-specific branching logic.
 *
 * @returns A de-duplicated list of response content types, excluding empty entries.
 */
export const getUniqueContentTypes = (
  successTypes: GeneratorVerbOptions['response']['types']['success'],
) => [...new Set(successTypes.map((t) => t.contentType).filter(Boolean))];

const toAcceptHelperKey = (contentType: string): string =>
  contentType
    .replaceAll(/[^A-Za-z0-9]+/g, '_')
    .replaceAll(/^_+|_+$/g, '')
    .toLowerCase();

const buildAcceptHelper = (
  operationName: string,
  contentTypes: string[],
  output: ContextSpec['output'],
): string => {
  const acceptHelperName = getAcceptHelperName(operationName);
  const unionValue = contentTypes
    .map((contentType) => `'${contentType}'`)
    .join(' | ');
  const names = contentTypes.map((contentType) =>
    toAcceptHelperKey(contentType),
  );
  const implementation = getEnumImplementation(
    unionValue,
    names,
    undefined,
    output.override.namingConvention.enum,
  );

  return `export type ${acceptHelperName} = typeof ${acceptHelperName}[keyof typeof ${acceptHelperName}];

export const ${acceptHelperName} = {
${implementation}} as const;`;
};

/**
 * Builds the shared `Accept` helper declarations for all operations in the
 * current Angular generation scope.
 *
 * @remarks
 * Helpers are emitted only for operations with more than one successful
 * response content type.
 *
 * @returns Concatenated type/const declarations or an empty string when no helpers are needed.
 */
export const buildAcceptHelpers = (
  verbOptions: readonly GeneratorVerbOptions[],
  output: ContextSpec['output'],
): string =>
  verbOptions
    .flatMap((verbOption) => {
      const contentTypes = getUniqueContentTypes(
        verbOption.response.types.success,
      );
      if (contentTypes.length <= 1) return [];

      return [
        buildAcceptHelper(verbOption.operationName, contentTypes, output),
      ];
    })
    .join('\n\n');

/**
 * Generates the static header section for Angular `HttpClient` output.
 *
 * Depending on the current generation options this may include:
 * - reusable request option helper types
 * - filtered query-param helper utilities
 * - mutator support types
 * - `Accept` helper unions/constants for multi-content-type operations
 * - the `@Injectable()` service class shell
 *
 * @returns A string containing the prelude and service class opening for the generated file.
 */
export const generateAngularHeader: ClientHeaderBuilder = ({
  title,
  isRequestOptions,
  isMutator,
  isGlobalMutator,
  provideIn,
  verbOptions,
  tag,
  output,
}) => {
  returnTypesRegistry.reset();

  const relevantVerbs = tag
    ? Object.values(verbOptions).filter((v) =>
        v.tags.some((t) => camel(t) === camel(tag)),
      )
    : Object.values(verbOptions);
  const hasQueryParams = relevantVerbs.some((v) => v.queryParams);
  const acceptHelpers = buildAcceptHelpers(relevantVerbs, output);

  return `
${
  isRequestOptions && !isGlobalMutator
    ? `${HTTP_CLIENT_OPTIONS_TEMPLATE}

${HTTP_CLIENT_OBSERVE_OPTIONS_TEMPLATE}

${hasQueryParams ? getAngularFilteredParamsHelperBody() : ''}`
    : ''
}

${isRequestOptions && isMutator ? THIRD_PARAMETER_TEMPLATE : ''}

${acceptHelpers}

@Injectable(${provideIn ? `{ providedIn: '${isBoolean(provideIn) ? 'root' : provideIn}' }` : ''})
export class ${title} {
  private readonly http = inject(HttpClient);
`;
};

/**
 * Generates the closing section for Angular `HttpClient` output.
 *
 * @remarks
 * Besides closing the generated service class, this appends any collected
 * `ClientResult` aliases registered while individual operations were emitted.
 *
 * @returns The footer text for the generated Angular client file.
 */
export const generateAngularFooter: ClientFooterBuilder = ({
  operationNames,
}) => {
  let footer = '};\n\n';

  const returnTypes = returnTypesRegistry.getFooter(operationNames);
  if (returnTypes) {
    footer += `${returnTypes}\n`;
  }

  return footer;
};

/**
 * Generates the Angular `HttpClient` method implementation for a single
 * OpenAPI operation.
 *
 * This function is responsible for:
 * - method signatures and overloads
 * - observe-mode branching
 * - multi-content-type `Accept` handling
 * - mutator integration
 * - runtime Zod validation hooks for Angular output
 * - registering the operation's `ClientResult` alias for footer emission
 *
 * @remarks
 * This is the central implementation builder shared by the dedicated
 * `httpClient` mode and the mutation side of Angular `both` / `httpResource`
 * generation.
 *
 * @returns The complete TypeScript method declaration and implementation for the operation.
 */
export const generateHttpClientImplementation = (
  {
    headers,
    queryParams,
    operationName,
    response,
    mutator,
    body,
    props,
    verb,
    override,
    formData,
    formUrlEncoded,
    paramsSerializer,
  }: GeneratorVerbOptions,
  { route, context }: HttpClientGeneratorContext,
) => {
  const isRequestOptions = override.requestOptions !== false;
  const isFormData = !override.formData.disabled;
  const isFormUrlEncoded = override.formUrlEncoded !== false;
  const isExactOptionalPropertyTypes =
    !!context.output.tsconfig?.compilerOptions?.exactOptionalPropertyTypes;
  const bodyForm = generateFormDataAndUrlEncodedFunction({
    formData,
    formUrlEncoded,
    body,
    isFormData,
    isFormUrlEncoded,
  });

  const dataType = response.definition.success || 'unknown';
  const isPrimitive = isPrimitiveType(dataType);
  const hasSchema = hasSchemaImport(response.imports, dataType);
  const isZodOutput = isZodSchemaOutput(context.output);
  const shouldValidateResponse =
    override.angular.runtimeValidation &&
    isZodOutput &&
    !isPrimitive &&
    hasSchema;
  const parsedDataType = shouldValidateResponse
    ? getSchemaOutputTypeRef(dataType)
    : dataType;
  const getGeneratedResponseType = (
    value: string,
    contentType: string | undefined,
  ): string => {
    if (
      override.angular.runtimeValidation &&
      isZodOutput &&
      !!contentType &&
      (contentType.includes('json') || contentType.includes('+json')) &&
      !isPrimitiveType(value) &&
      hasSchemaImport(response.imports, value)
    ) {
      return getSchemaOutputTypeRef(value);
    }

    return getContentTypeReturnType(contentType, value);
  };
  const resultAliasType = mutator
    ? dataType
    : response.types.success.length <= 1
      ? parsedDataType
      : [
          ...new Set(
            response.types.success.map(({ value, contentType }) =>
              getGeneratedResponseType(value, contentType),
            ),
          ),
        ].join(' | ') || parsedDataType;
  const schemaValueRef = shouldValidateResponse
    ? getSchemaValueRef(dataType)
    : dataType;
  // When Zod runtime validation is enabled the emitted method signature exposes
  // `parsedDataType` (e.g. `PetsOutput`) directly instead of a caller-overridable
  // `TData` generic. Casting `Schema.parse(data)` to `TData` is unsound because
  // `TData` can be widened/narrowed by callers while the runtime value is always
  // `PetsOutput`. We therefore drop the cast on the validation path and let the
  // inferred return type flow naturally.
  const validationPipe = shouldValidateResponse
    ? `.pipe(map(data => ${schemaValueRef}.parse(data)))`
    : '';
  const responseValidationPipe = shouldValidateResponse
    ? `.pipe(map(response => response.clone({ body: ${schemaValueRef}.parse(response.body) })))`
    : '';
  const eventValidationPipe = shouldValidateResponse
    ? `.pipe(map(event => event instanceof AngularHttpResponse ? event.clone({ body: ${schemaValueRef}.parse(event.body) }) : event))`
    : '';

  returnTypesRegistry.set(
    operationName,
    `export type ${pascal(
      operationName,
    )}ClientResult = NonNullable<${resultAliasType}>`,
  );

  if (mutator) {
    const mutatorConfig = generateMutatorConfig({
      route,
      body,
      headers,
      queryParams,
      response,
      verb,
      isFormData,
      isFormUrlEncoded,
      hasSignal: false,
      isExactOptionalPropertyTypes,
      isAngular: true,
    });

    const requestOptions = isRequestOptions
      ? generateMutatorRequestOptions(
          override.requestOptions,
          mutator.hasThirdArg,
        )
      : '';

    const propsImplementation =
      mutator.bodyTypeName && body.definition
        ? toObjectString(props, 'implementation').replace(
            new RegExp(String.raw`(\\w*):\\s?${body.definition}`),
            `$1: ${mutator.bodyTypeName}<${body.definition}>`,
          )
        : toObjectString(props, 'implementation');

    return ` ${operationName}<TData = ${dataType}>(\n    ${propsImplementation}\n ${
      isRequestOptions && mutator.hasThirdArg
        ? `options?: ThirdParameter<typeof ${mutator.name}>`
        : ''
    }) {${bodyForm}
      return ${mutator.name}<TData>(
      ${mutatorConfig},
      this.http,
      ${requestOptions});
    }
  `;
  }

  const optionsBase = {
    route,
    body,
    headers,
    queryParams,
    response,
    verb,
    requestOptions: override.requestOptions,
    isFormData,
    isFormUrlEncoded,
    paramsSerializer,
    paramsSerializerOptions: override.paramsSerializerOptions,
    isAngular: true,
    isExactOptionalPropertyTypes,
    hasSignal: false,
  } as const;

  const propsDefinition = toObjectString(props, 'definition');

  const successTypes = response.types.success;
  const uniqueContentTypes = getUniqueContentTypes(successTypes);
  const hasMultipleContentTypes = uniqueContentTypes.length > 1;
  const acceptTypeName = hasMultipleContentTypes
    ? getAcceptHelperName(operationName)
    : undefined;

  const needsObserveBranching = isRequestOptions && !hasMultipleContentTypes;
  const angularParamsRef = queryParams ? 'filteredParams' : undefined;

  let paramsDeclaration = '';
  if (angularParamsRef && queryParams) {
    if (isRequestOptions) {
      // Uses the shared filterParams helper emitted in the file header
      const callExpr = getAngularFilteredParamsCallExpression(
        '{...params, ...options?.params}',
        queryParams.requiredNullableKeys ?? [],
      );
      paramsDeclaration = paramsSerializer
        ? `const ${angularParamsRef} = ${paramsSerializer.name}(${callExpr});\n\n    `
        : `const ${angularParamsRef} = ${callExpr};\n\n    `;
    } else {
      // No shared helper available; use inline IIFE filtering
      const iifeExpr = getAngularFilteredParamsExpression(
        'params ?? {}',
        queryParams.requiredNullableKeys ?? [],
        !!paramsSerializer,
      );
      paramsDeclaration = paramsSerializer
        ? `const ${angularParamsRef} = ${paramsSerializer.name}(${iifeExpr});\n\n    `
        : `const ${angularParamsRef} = ${iifeExpr};\n\n    `;
    }
  }

  const optionsInput = {
    ...optionsBase,
    ...(angularParamsRef ? { angularParamsRef } : {}),
  } as const;

  const options = generateOptions(optionsInput);

  const defaultContentType = hasMultipleContentTypes
    ? (successTypes.find(
        ({ contentType }) =>
          !!contentType &&
          (contentType.includes('json') || contentType.includes('+json')),
      )?.contentType ?? getDefaultContentType(uniqueContentTypes))
    : (uniqueContentTypes[0] ?? 'application/json');

  const jsonSuccessValues = [
    ...new Set(
      successTypes
        .filter(
          ({ contentType }) =>
            !!contentType &&
            (contentType.includes('json') || contentType.includes('+json')),
        )
        .map(({ value }) => value),
    ),
  ];

  const jsonReturnType =
    jsonSuccessValues.length > 0 ? jsonSuccessValues.join(' | ') : 'unknown';
  const parsedJsonReturnType =
    jsonSuccessValues.length === 1 &&
    override.angular.runtimeValidation &&
    isZodOutput &&
    !isPrimitiveType(jsonSuccessValues[0]) &&
    hasSchemaImport(response.imports, jsonSuccessValues[0])
      ? getSchemaOutputTypeRef(jsonSuccessValues[0])
      : jsonReturnType;

  let jsonValidationPipe = shouldValidateResponse
    ? `.pipe(map(data => ${schemaValueRef}.parse(data)))`
    : '';
  if (
    hasMultipleContentTypes &&
    !shouldValidateResponse &&
    override.angular.runtimeValidation &&
    isZodOutput &&
    jsonSuccessValues.length === 1
  ) {
    const jsonType = jsonSuccessValues[0];
    const jsonIsPrimitive = isPrimitiveType(jsonType);
    const jsonHasSchema = hasSchemaImport(response.imports, jsonType);
    if (!jsonIsPrimitive && jsonHasSchema) {
      const jsonSchemaRef = getSchemaValueRef(jsonType);
      jsonValidationPipe = `.pipe(map(data => ${jsonSchemaRef}.parse(data)))`;
    }
  }

  const textSuccessTypes = successTypes.filter(
    ({ contentType, value }) =>
      !!contentType &&
      (contentType.startsWith('text/') ||
        contentType.includes('xml') ||
        value === 'string'),
  );
  const blobSuccessTypes = successTypes.filter(
    ({ contentType }) =>
      !!contentType &&
      !contentType.includes('json') &&
      !contentType.includes('+json') &&
      !contentType.startsWith('text/') &&
      !contentType.includes('xml'),
  );
  const multiReturnMembers = [
    parsedJsonReturnType,
    ...(textSuccessTypes.length > 0 ? ['string'] : []),
    ...(blobSuccessTypes.length > 0 ? ['Blob'] : []),
  ];
  const uniqueMultiReturnMembers = [...new Set(multiReturnMembers)];
  const refinedMultiImplementationReturnType = `Observable<${uniqueMultiReturnMembers.join(' | ')}>`;

  const observeOptions = needsObserveBranching
    ? {
        body: generateOptions({ ...optionsInput, angularObserve: 'body' }),
        events: generateOptions({ ...optionsInput, angularObserve: 'events' }),
        response: generateOptions({
          ...optionsInput,
          angularObserve: 'response',
        }),
      }
    : undefined;

  const isModelType =
    dataType !== 'Blob' && dataType !== 'string' && dataType !== 'ArrayBuffer';
  // When the response goes through a Zod runtime validation pipe the runtime
  // value is fixed to `parsedDataType` (e.g. `PetsOutput`), so we avoid
  // exposing a caller-overridable `<TData>` generic on that path.
  const hasTDataGeneric =
    isModelType && !hasMultipleContentTypes && !shouldValidateResponse;
  let functionName = operationName;
  if (hasTDataGeneric) {
    functionName += `<TData = ${parsedDataType}>`;
  }

  let contentTypeOverloads = '';
  if (hasMultipleContentTypes && isRequestOptions) {
    const {
      requiredNonBody: requiredNonBodyProps,
      body: bodyProps,
      optionalNonBody: optionalNonBodyProps,
    } = partitionPropsForMultiContent(props);
    const requiredNonBodyPart = requiredNonBodyProps
      .map((p) => p.definition)
      .join(',\n    ');
    const bodyPart = bodyProps.map((p) => p.definition).join(',\n    ');
    // Per-content-type overloads have a required `accept` literal after the body.
    // TS1016 forbids required params after optional ones, so optional body params
    // are rendered as positionally required (`name: Type | undefined`) here.
    // The `?` is removed via an identifier-anchored replacement so we only
    // affect the parameter's own optional marker, never a `?:` that may appear
    // elsewhere in the type (e.g. mapped or conditional types).
    const bodyOverloadPart = bodyProps
      .map((p) => {
        const optionalMarker = `${p.name}?:`;
        if (!p.required && p.definition.startsWith(optionalMarker)) {
          const required = `${p.name}:${p.definition.slice(optionalMarker.length)}`;
          return /\bundefined\b/.test(required)
            ? required
            : `${required} | undefined`;
        }
        return p.definition;
      })
      .join(',\n    ');
    const optionalNonBodyPart = optionalNonBodyProps
      .map((p) => p.definition)
      .join(',\n    ');
    const branchOverloads = successTypes
      .filter(({ contentType }) => !!contentType)
      .map(({ contentType, value }) => {
        const returnType = getGeneratedResponseType(value, contentType);
        const overloadParams = [
          requiredNonBodyPart,
          bodyOverloadPart,
          `accept: '${contentType}'`,
          optionalNonBodyPart,
        ]
          .filter(Boolean)
          .join(',\n    ');

        return `${operationName}(${overloadParams}, options?: HttpClientOptions): Observable<${returnType}>;`;
      })
      .join('\n  ');
    const allParams = [
      requiredNonBodyPart,
      bodyPart,
      `accept?: ${acceptTypeName ?? 'string'}`,
      optionalNonBodyPart,
    ]
      .filter(Boolean)
      .join(',\n    ');
    contentTypeOverloads = `${branchOverloads}\n  ${operationName}(${allParams}, options?: HttpClientOptions): ${refinedMultiImplementationReturnType};`;
  }

  const observeOverloads =
    isRequestOptions && !hasMultipleContentTypes
      ? `${functionName}(${propsDefinition} options?: HttpClientBodyOptions): Observable<${hasTDataGeneric ? 'TData' : parsedDataType}>;\n ${functionName}(${propsDefinition} options?: HttpClientEventOptions): Observable<HttpEvent<${hasTDataGeneric ? 'TData' : parsedDataType}>>;\n ${functionName}(${propsDefinition} options?: HttpClientResponseOptions): Observable<AngularHttpResponse<${hasTDataGeneric ? 'TData' : parsedDataType}>>;`
      : '';

  const overloads = contentTypeOverloads || observeOverloads;

  const observableDataType = hasTDataGeneric ? 'TData' : parsedDataType;
  const singleImplementationReturnType = isRequestOptions
    ? `Observable<${observableDataType} | HttpEvent<${observableDataType}> | AngularHttpResponse<${observableDataType}>>`
    : `Observable<${observableDataType}>`;

  if (hasMultipleContentTypes) {
    const bodyIdentifier = generateBodyOptions(
      body,
      isFormData,
      isFormUrlEncoded,
    );
    const deleteBodyOption =
      verb === 'delete' && bodyIdentifier ? `body: ${bodyIdentifier}` : '';
    const buildOptionsObject = (responseType: string) => `{
        ...options,
        responseType: '${responseType}',
        headers,
        ${angularParamsRef ? `params: ${angularParamsRef},` : ''}
        ${deleteBodyOption ? `${deleteBodyOption},` : ''}
      }`;
    const buildHttpClientCall = (typeArg: string, optionsObject: string) =>
      getIsBodyVerb(verb) && verb !== 'delete'
        ? `this.http.${verb}${typeArg}(\`${route}\`, ${bodyIdentifier ?? 'undefined'}, ${optionsObject})`
        : `this.http.${verb}${typeArg}(\`${route}\`, ${optionsObject})`;

    const {
      requiredNonBody: requiredNonBodyImplProps,
      body: bodyImplProps,
      optionalNonBody: optionalNonBodyImplProps,
    } = partitionPropsForMultiContent(props);
    const requiredNonBodyImplPart = requiredNonBodyImplProps
      .map((p) => p.implementation)
      .join(',\n    ');
    const bodyImplPart = bodyImplProps
      .map((p) => p.implementation)
      .join(',\n    ');
    const optionalNonBodyImplPart = optionalNonBodyImplProps
      .map((p) => p.implementation)
      .join(',\n    ');
    const allParams = [
      requiredNonBodyImplPart,
      bodyImplPart,
      `accept: ${acceptTypeName ?? 'string'} = '${defaultContentType}'`,
      optionalNonBodyImplPart,
    ]
      .filter(Boolean)
      .join(',\n    ');

    return ` ${overloads}
  ${operationName}(
    ${allParams},
    ${isRequestOptions ? 'options?: HttpClientOptions' : ''}
  ): ${refinedMultiImplementationReturnType} {${bodyForm}
    ${paramsDeclaration}const headers = options?.headers instanceof HttpHeaders
      ? options.headers.set('Accept', accept)
      : { ...(options?.headers ?? {}), Accept: accept };

    if (accept.includes('json') || accept.includes('+json')) {
      return ${buildHttpClientCall(`<${parsedJsonReturnType}>`, buildOptionsObject('json'))}${jsonValidationPipe};
    } else if (accept.startsWith('text/') || accept.includes('xml')) {
      return ${buildHttpClientCall('', buildOptionsObject('text'))} as Observable<string>;
    }${
      blobSuccessTypes.length > 0
        ? ` else {
      return ${buildHttpClientCall('', buildOptionsObject('blob'))} as Observable<Blob>;
    }`
        : `

    return ${buildHttpClientCall(`<${parsedJsonReturnType}>`, buildOptionsObject('json'))}${jsonValidationPipe};`
    }
  }
`;
  }

  // When the validation pipe is active the runtime payload is always the
  // parsed output type, so we emit `HttpClient.<verb><PetsOutput>(...)`
  // rather than threading a caller-overridable `TData` through the call.
  const httpTypeArg = hasTDataGeneric
    ? '<TData>'
    : shouldValidateResponse && isModelType
      ? `<${parsedDataType}>`
      : '';
  const observeImplementation = isRequestOptions
    ? `${paramsDeclaration}if (options?.observe === 'events') {
      return this.http.${verb}${httpTypeArg}(${observeOptions?.events ?? options})${eventValidationPipe};
    }

    if (options?.observe === 'response') {
      return this.http.${verb}${httpTypeArg}(${observeOptions?.response ?? options})${responseValidationPipe};
    }

    return this.http.${verb}${httpTypeArg}(${observeOptions?.body ?? options})${validationPipe};`
    : `return this.http.${verb}${httpTypeArg}(${options})${validationPipe};`;

  return ` ${overloads}
  ${functionName}(
    ${toObjectString(props, 'implementation')} ${
      isRequestOptions ? `options?: HttpClientObserveOptions` : ''
    }): ${singleImplementationReturnType} {${bodyForm}
    ${observeImplementation}
  }
`;
};

/**
 * Orval client builder entry point for Angular `HttpClient` output.
 *
 * It normalizes imports needed for runtime validation, delegates the actual
 * method implementation to `generateHttpClientImplementation`, and returns the
 * generated code plus imports for the current operation.
 *
 * @returns The generated implementation fragment and imports for one operation.
 */
export const generateAngular: ClientBuilder = (verbOptions, options) => {
  const isZodOutput = isZodSchemaOutput(options.context.output);
  const responseType = verbOptions.response.definition.success;
  const isPrimitiveResponse = isPrimitiveType(responseType);
  const shouldUseRuntimeValidation =
    verbOptions.override.angular.runtimeValidation && isZodOutput;

  const normalizedVerbOptions = (() => {
    if (!shouldUseRuntimeValidation) return verbOptions;

    let result: GeneratorVerbOptions = {
      ...verbOptions,
      response: {
        ...verbOptions.response,
        imports: verbOptions.response.imports.map((imp) => ({
          ...imp,
          values: true,
        })),
      },
    };

    if (
      !isPrimitiveResponse &&
      hasSchemaImport(result.response.imports, responseType)
    ) {
      result = {
        ...result,
        response: {
          ...result.response,
          imports: [
            ...result.response.imports.map((imp) =>
              imp.name === responseType ? { ...imp, values: true } : imp,
            ),
            { name: getSchemaOutputTypeRef(responseType) },
          ],
        },
      };
    }

    const successTypes = result.response.types.success;
    const uniqueContentTypes = [
      ...new Set(successTypes.map((t) => t.contentType).filter(Boolean)),
    ];
    if (uniqueContentTypes.length > 1) {
      const jsonSchemaNames = [
        ...new Set(
          successTypes
            .filter(
              ({ contentType }) =>
                !!contentType &&
                (contentType.includes('json') || contentType.includes('+json')),
            )
            .map(({ value }) => value),
        ),
      ];
      if (jsonSchemaNames.length === 1) {
        const jsonType = jsonSchemaNames[0];
        const jsonIsPrimitive = isPrimitiveType(jsonType);
        if (
          !jsonIsPrimitive &&
          hasSchemaImport(result.response.imports, jsonType)
        ) {
          result = {
            ...result,
            response: {
              ...result.response,
              imports: [
                ...result.response.imports.map((imp) =>
                  imp.name === jsonType ? { ...imp, values: true } : imp,
                ),
                { name: getSchemaOutputTypeRef(jsonType) },
              ],
            },
          };
        }
      }
    }

    return result;
  })();

  const implementation = generateHttpClientImplementation(
    normalizedVerbOptions,
    options,
  );

  const imports = [
    ...generateVerbImports(normalizedVerbOptions),
    ...(implementation.includes('.pipe(map(')
      ? [{ name: 'map', values: true, importPath: 'rxjs' }]
      : []),
  ];

  return { implementation, imports };
};

/**
 * Returns the footer aliases collected for the provided operation names.
 *
 * The Angular generators use these aliases to expose stable `ClientResult`
 * helper types such as `ListPetsClientResult`.
 *
 * @returns Concatenated `ClientResult` aliases for the requested operation names.
 */
export const getHttpClientReturnTypes = (operationNames: string[]) =>
  returnTypesRegistry.getFooter(operationNames);

/**
 * Clears the module-level return type registry used during Angular client
 * generation.
 *
 * This must be called at the start of each generation pass to avoid leaking
 * aliases across files or tags.
 *
 * @returns Nothing.
 */
export const resetHttpClientReturnTypes = () => {
  returnTypesRegistry.reset();
};

export { generateAngularTitle } from './utils';
