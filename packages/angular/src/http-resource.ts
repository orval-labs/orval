import {
  type ClientBuilder,
  type ClientDependenciesBuilder,
  type ClientExtraFilesBuilder,
  type ClientFooterBuilder,
  type ClientHeaderBuilder,
  type ContextSpec,
  conventionName,
  generateDependencyImports,
  generateFormDataAndUrlEncodedFunction,
  generateMutatorImports,
  generateVerbImports,
  type GeneratorDependency,
  type GeneratorImport,
  type GeneratorMutator,
  type GeneratorOptions,
  type GeneratorVerbOptions,
  getFileInfo,
  getFullRoute,
  GetterPropType,
  isObject,
  isSyntheticDefaultImportsAllow,
  jsDoc,
  type NormalizedOutputOptions,
  type OpenApiInfoObject,
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
  generateHttpClientImplementation,
  getHttpClientReturnTypes,
  resetHttpClientReturnTypes,
} from './http-client';
import {
  buildServiceClassOpen,
  type ClientOverride,
  createReturnTypesRegistry,
  createRouteRegistry,
  getDefaultSuccessType,
  isMutationVerb,
  isRetrievalVerb,
} from './utils';

/**
 * Reads the per-operation angular client override from the orval config.
 *
 * Mirrors the pattern used by `@orval/query` for `operationQueryOptions`:
 * ```ts
 * override: {
 *   operations: {
 *     myPostSearch: { angular: { client: 'httpResource' } },
 *   }
 * }
 * ```
 */
interface AngularOperationOverride {
  readonly client?: ClientOverride;
}

const isAngularOperationOverride = (
  value: unknown,
): value is AngularOperationOverride =>
  value !== undefined &&
  typeof value === 'object' &&
  value !== null &&
  (!('client' in value) ||
    value.client === 'httpClient' ||
    value.client === 'httpResource' ||
    value.client === 'both');

const getClientOverride = (
  verbOption: GeneratorVerbOptions,
): ClientOverride | undefined => {
  const angular =
    verbOption.override.operations[verbOption.operationId]?.angular;

  return isAngularOperationOverride(angular) ? angular.client : undefined;
};

const resourceReturnTypesRegistry = createReturnTypesRegistry();

/** @internal Exported for testing only */
export const routeRegistry = createRouteRegistry();

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
  const merged = new Map<string, GeneratorDependency>();

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

export const getAngularHttpResourceDependencies: ClientDependenciesBuilder =
  () =>
    mergeDependencies([
      ...ANGULAR_HTTP_CLIENT_DEPENDENCIES,
      ...ANGULAR_HTTP_RESOURCE_DEPENDENCIES,
    ]);

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

const getHttpResourceFactory = (
  response: { readonly isBlob: boolean },
  contentType: string | undefined,
  dataType: string,
): HttpResourceFactoryName => {
  if (isResponseText(contentType, dataType)) return 'httpResource.text';
  if (isResponseArrayBuffer(contentType)) return 'httpResource.arrayBuffer';
  if (isResponseBlob(contentType, response.isBlob)) return 'httpResource.blob';
  return 'httpResource';
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
    prop.default;
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
      param.default;
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
  const paramsValue = paramsAccess
    ? paramsSerializer
      ? `params?.() ? ${paramsSerializer.name}(params()) : undefined`
      : paramsAccess
    : undefined;

  const requestLines = [
    `url: \`${route}\``,
    verb === 'get' ? undefined : `method: '${verb.toUpperCase()}'`,
    bodyValue ? `body: ${bodyValue}` : undefined,
    paramsValue ? `params: ${paramsValue}` : undefined,
    headersAccess ? `headers: ${headersAccess}` : undefined,
  ].filter(Boolean);

  const request = `({\n      ${requestLines.join(',\n      ')}\n    })`;

  return {
    bodyForm,
    request,
  };
};

const getParseOption = (
  response: {
    readonly imports: readonly { name: string; isZodSchema?: boolean }[];
  },
  factory: HttpResourceFactoryName,
): string => {
  if (factory !== 'httpResource') return '';
  const zodSchema = response.imports.find((imp) => imp.isZodSchema);
  return zodSchema ? `, { parse: ${zodSchema.name}.parse }` : '';
};

const buildHttpResourceFunction = (
  verbOption: GeneratorVerbOptions,
  route: string,
): string => {
  const { operationName, response, props, params, mutator } = verbOption;

  const dataType = response.definition.success || 'unknown';
  const resourceName = `${operationName}Resource`;
  resourceReturnTypesRegistry.set(
    operationName,
    `export type ${pascal(
      operationName,
    )}ResourceResult = NonNullable<${dataType}>`,
  );

  const successTypes = response.types.success as ResReqTypesValue[];
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

  const { bodyForm, request } = buildResourceRequest(verbOption, signalRoute);
  const parseOption = getParseOption(response, resourceFactory);

  // HttpClient-style mutators expect (config, httpClient) — incompatible with
  // standalone httpResource functions which have no HttpClient instance.
  // Only apply mutators that accept a single argument (request config only).
  const isResourceCompatibleMutator =
    mutator !== undefined && !mutator.hasSecondArg;
  const returnExpression = isResourceCompatibleMutator
    ? `${mutator.name}(request)`
    : 'request';

  return `/**
 * @experimental httpResource is experimental (Angular v19.2+)
 */
export function ${resourceName}(${args}): HttpResourceRef<${dataType} | undefined> {
  return ${resourceFactory}<${dataType}>(() => {
    ${bodyForm ? `${bodyForm};` : ''}
    const request = ${request};
    return ${returnExpression};
  }${parseOption});
}
`;
};

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

export const generateHttpResourceHeader: ClientHeaderBuilder = ({
  title,
  isRequestOptions,
  isMutator,
  isGlobalMutator,
  provideIn,
  output,
  verbOptions,
}) => {
  resetHttpClientReturnTypes();
  resourceReturnTypesRegistry.reset();

  const resources = Object.values(verbOptions)
    .filter((verbOption) =>
      isRetrievalVerb(
        verbOption.verb,
        verbOption.operationName,
        getClientOverride(verbOption),
      ),
    )
    .map((verbOption) => {
      const fullRoute = routeRegistry.get(
        verbOption.operationName,
        verbOption.route,
      );
      return buildHttpResourceFunction(verbOption, fullRoute);
    })
    .join('\n');

  const mutations = Object.values(verbOptions).filter((verbOption) =>
    isMutationVerb(
      verbOption.verb,
      verbOption.operationName,
      getClientOverride(verbOption),
    ),
  );

  const mutationImplementation = mutations
    .map((verbOption) => {
      const fullRoute = routeRegistry.get(
        verbOption.operationName,
        verbOption.route,
      );
      const generatorOptions = {
        route: fullRoute,
        pathRoute: verbOption.pathRoute,
        override: verbOption.override,
        context: { output } as ContextSpec,
        output: output.target,
      } satisfies GeneratorOptions;

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
})}
${mutationImplementation}
};
`
    : '';

  return `${resources}${classImplementation}`;
};

export const generateHttpResourceFooter: ClientFooterBuilder = ({
  operationNames,
}) => {
  const resourceTypes = resourceReturnTypesRegistry.getFooter(operationNames);
  const clientTypes = getHttpClientReturnTypes(operationNames);
  const utilities = buildResourceStateUtilities();

  return `${resourceTypes ? `${resourceTypes}\n` : ''}${
    clientTypes ? `${clientTypes}\n` : ''
  }${utilities}`;
};

export const generateHttpResourceClient: ClientBuilder = (
  verbOptions,
  options,
) => {
  routeRegistry.set(verbOptions.operationName, options.route);
  const imports = generateVerbImports(verbOptions);

  return { implementation: '\n', imports };
};

const buildHttpResourceFile = (
  verbOptions: Record<string, GeneratorVerbOptions>,
  output: NormalizedOutputOptions,
  context: ContextSpec,
) => {
  resourceReturnTypesRegistry.reset();

  const resources = Object.values(verbOptions)
    .filter((verbOption) =>
      isRetrievalVerb(
        verbOption.verb,
        verbOption.operationName,
        getClientOverride(verbOption),
      ),
    )
    .map((verbOption) => {
      const fullRoute = getFullRoute(
        verbOption.route,
        context.spec.servers,
        output.baseUrl,
      );
      return buildHttpResourceFunction(verbOption, fullRoute);
    })
    .join('\n');

  const resourceTypes = resourceReturnTypesRegistry.getFooter(
    Object.values(verbOptions).map((verbOption) => verbOption.operationName),
  );
  const utilities = buildResourceStateUtilities();

  return `${resources}\n${resourceTypes ? `${resourceTypes}\n` : ''}${utilities}`;
};

const buildSchemaImportDependencies = (
  output: NormalizedOutputOptions,
  imports: GeneratorImport[],
  relativeSchemasPath: string,
) => {
  const isZodSchemaOutput =
    isObject(output.schemas) && output.schemas.type === 'zod';
  const uniqueImports = [
    ...new Map(imports.map((imp) => [imp.name, imp])).values(),
  ];

  if (!output.indexFiles) {
    return [...uniqueImports].map((imp) => {
      const baseName = imp.schemaName ?? imp.name;
      const name = conventionName(baseName, output.namingConvention);
      const suffix = isZodSchemaOutput ? '.zod' : '';
      const importExtension = output.fileExtension.replace(/\.ts$/, '');
      return {
        exports: isZodSchemaOutput ? [{ ...imp, values: true }] : [imp],
        dependency: upath.joinSafe(
          relativeSchemasPath,
          `${name}${suffix}${importExtension}`,
        ),
      };
    });
  }

  if (isZodSchemaOutput) {
    return [
      {
        exports: uniqueImports.map((imp) => ({ ...imp, values: true })),
        dependency: upath.joinSafe(relativeSchemasPath, 'index.zod'),
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

export const generateHttpResourceExtraFiles: ClientExtraFilesBuilder = (
  verbOptions,
  output,
  context,
) => {
  const { extension, dirname, filename } = getFileInfo(output.target);
  const outputPath = upath.join(dirname, `${filename}.resource${extension}`);
  const header = getHeader(output.override.header, context.spec.info);

  const implementation = buildHttpResourceFile(verbOptions, output, context);

  const schemasPath = isObject(output.schemas)
    ? output.schemas.path
    : output.schemas;
  const basePath = schemasPath ? getFileInfo(schemasPath).dirname : undefined;
  const relativeSchemasPath = basePath
    ? output.indexFiles
      ? upath.relativeSafe(dirname, basePath)
      : upath.relativeSafe(dirname, basePath)
    : `./${filename}.schemas`;

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
      .flatMap((verbOption) => generateVerbImports(verbOption)),
    relativeSchemasPath,
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
      ].filter(Boolean);
    });

  const mutatorImports =
    mutators.length > 0
      ? generateMutatorImports({
          mutators: mutators as GeneratorMutator[],
        })
      : '';

  const content = `${header}${importImplementation}${mutatorImports}${implementation}`;

  return Promise.resolve([
    {
      content,
      path: outputPath,
    },
  ]);
};

export { generateAngularTitle } from './utils';
