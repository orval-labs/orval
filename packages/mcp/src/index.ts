import path from 'node:path';

import {
  camel,
  type ClientBuilder,
  type ClientExtraFilesBuilder,
  type ClientGeneratorsBuilder,
  type ClientHeaderBuilder,
  type ContextSpec,
  conventionName,
  generateMutatorImports,
  type GeneratorVerbOptions,
  getFileInfo,
  getImportExtension,
  getFullRoute,
  getParamsInPath,
  GetterPropType,
  isObject,
  isString,
  jsDoc,
  jsStringEscape,
  type NormalizedOutputOptions,
  type OpenApiInfoObject,
  getKey,
  getPropertyAccessor,
  pascal,
  upath,
  type Verbs,
} from '@orval/core';
import { generateClient, generateFetchHeader } from '@orval/fetch';
import {
  generateZodSections,
  getZodImportSource,
  hasResponseSchema,
  isObjectResponseSchema,
} from '@orval/zod';

// Always a namespace import: `import { z as zod }` pulls in zod's assembled `z` object,
// which transitively references every locale table and cannot be tree-shaken. Matches
// what `@orval/zod` and `@orval/effect` already emit via `namespaceImport`.
const getZodSchemaImportStatement = (
  variant: NormalizedOutputOptions['override']['zod']['variant'],
) => `import * as zod from '${getZodImportSource(variant)}';`;

const getHeader = (
  option: false | ((info: OpenApiInfoObject) => string | string[]),
  info: OpenApiInfoObject,
): string => {
  if (!option) {
    return '';
  }

  const header = option(info);

  return Array.isArray(header) ? jsDoc({ description: header }) : header;
};

const getAnnotations = (verb: Verbs): string => {
  switch (verb) {
    case 'get':
    case 'head':
    case 'options': {
      return '{ readOnlyHint: true }';
    }
    case 'query': {
      return '{ readOnlyHint: true, idempotentHint: true }';
    }
    case 'post':
    case 'patch': {
      // POST and PATCH mutate state, so they must not claim to be additive-only.
      // destructiveHint defaults to true, but stating it explicitly keeps the
      // generated server self-documenting.
      return '{ destructiveHint: true }';
    }
    case 'put':
    case 'delete': {
      return '{ destructiveHint: true, idempotentHint: true }';
    }
    default: {
      return '';
    }
  }
};

const getCustomModuleImport = (
  module: { path: string; name?: string; default: boolean },
  fallbackName: string,
  fromPath: string,
) => {
  const name = module.name ?? fallbackName;
  const specifier = module.default ? name : `{ ${name} }`;
  const relativePath = upath.getRelativeImportPath(fromPath, module.path);

  return `import ${specifier} from '${relativePath}';`;
};

const getSpecInfo = (context: ContextSpec): OpenApiInfoObject =>
  // oxlint-disable-next-line typescript/no-unnecessary-condition
  context.spec.info ?? {
    title: 'API',
    version: '1.0.0',
  };

// Entries of the per-tool `XInput` object schema; empty means the tool takes
// no arguments and its callback receives only `ctx`.
const getInputShape = (verbOption: GeneratorVerbOptions) => {
  const name = pascal(verbOption.typeName);
  const pathParams = verbOption.params.length > 0 ? `${name}Params` : undefined;
  const queryParams = verbOption.queryParams ? `${name}QueryParams` : undefined;
  const bodyParams = verbOption.body.definition
    ? `${name}Body${verbOption.body.isOptional ? '.optional()' : ''}`
    : undefined;

  return Object.entries({ pathParams, queryParams, bodyParams })
    .filter(([, schema]) => schema !== undefined)
    .map(([key, schema]) => `${key}: ${schema}`);
};

const getMcpTargetInfo = (
  output: NormalizedOutputOptions,
  info: OpenApiInfoObject,
) =>
  getFileInfo(output.target, {
    backupFilename: conventionName(
      // oxlint-disable-next-line typescript/no-unnecessary-condition
      info.title ?? 'filename',
      output.namingConvention,
    ),
    extension: output.fileExtension,
  });

export const getMcpHeader: ClientHeaderBuilder = ({ verbOptions, output }) => {
  const targetInfo = getFileInfo(output.target);
  const schemasPath = (
    isObject(output.schemas)
      ? output.schemas.path
      : isString(output.schemas)
        ? output.schemas
        : undefined
  ) as string | undefined;
  const schemaInfo = schemasPath ? getFileInfo(schemasPath) : undefined;

  const isZodSchemaOutput =
    isObject(output.schemas) && output.schemas.type === 'zod';
  const basePath = schemaInfo?.dirname;
  const relativeSchemaImportPath = basePath
    ? isZodSchemaOutput && output.indexFiles
      ? upath.getRelativeImportPath(targetInfo.path, basePath, true)
      : upath.getRelativeImportPath(targetInfo.path, basePath)
    : './' +
      targetInfo.filename +
      '.schemas' +
      // Custom part of `schemaFileExtension` only (`.types.ts` → `.types`).
      getImportExtension(output.schemaFileExtension);

  const importSchemaNames = new Set(
    Object.values(verbOptions).flatMap((verbOption) => {
      const imports = [];
      const pascalOperationName = pascal(verbOption.typeName);

      if (verbOption.queryParams) {
        imports.push(`${pascalOperationName}Params`);
      }

      if (verbOption.body.imports[0]?.name) {
        imports.push(verbOption.body.imports[0]?.name);
      }

      return imports;
    }),
  )
    .values()
    .toArray();

  const importSchemasImplementation = schemasPath
    ? `import type {\n  ${importSchemaNames.join(
        ',\n  ',
      )}\n} from '${relativeSchemaImportPath}';
`
    : '';

  const httpClientPath = path.join(
    targetInfo.dirname,
    `http-client${output.fileExtension}`,
  );
  const relativeFetchClientPath = upath.getRelativeImportPath(
    targetInfo.path,
    httpClientPath,
  );
  const importFetchClientNames = new Set(
    Object.values(verbOptions).flatMap(
      (verbOption) => verbOption.operationName,
    ),
  )
    .values()
    .toArray();

  const importFetchClientImplementation = `import {\n  ${importFetchClientNames.join(
    ',\n  ',
  )}\n} from '${relativeFetchClientPath}';
  `;

  const handlerOptions = output.override.mcp.handler;
  const importCustomHandlerImplementation = handlerOptions
    ? `${getCustomModuleImport(handlerOptions, 'customHandler', targetInfo.path)}
import type { ServerContext } from '@modelcontextprotocol/server';
`
    : '';

  const content = [
    importSchemasImplementation,
    importFetchClientImplementation,
    importCustomHandlerImplementation,
  ].join('\n');

  return content + '\n';
};

export const generateMcp: ClientBuilder = (verbOptions, options) => {
  const handlerArgsTypes = [];
  const originalParamNames = getParamsInPath(verbOptions.pathRoute);
  const pathParamsType = verbOptions.params
    .map((param, index) => {
      const paramName = originalParamNames[index];
      const paramType = param.implementation.split(': ')[1];
      return `    ${getKey(paramName)}: ${paramType}`;
    })
    .join(',\n');
  if (pathParamsType) {
    handlerArgsTypes.push(`  pathParams: {\n${pathParamsType}\n  };`);
  }
  if (verbOptions.queryParams) {
    handlerArgsTypes.push(
      `  queryParams: ${verbOptions.queryParams.schema.name};`,
    );
  }
  if (verbOptions.body.definition) {
    handlerArgsTypes.push(
      `  bodyParams${verbOptions.body.isOptional ? '?' : ''}: ${verbOptions.body.definition};`,
    );
  }

  const handlerArgsName = `${verbOptions.operationName}Args`;
  const handlerArgsImplementation =
    handlerArgsTypes.length > 0
      ? `
export type ${handlerArgsName} = {
${handlerArgsTypes.join('\n')}
}
`
      : '';

  const fetchParams = [];
  if (verbOptions.params.length > 0) {
    const pathParamsArgs = originalParamNames
      .map((paramName) => `args.pathParams${getPropertyAccessor(paramName)}`)
      .join(', ');

    fetchParams.push(pathParamsArgs);
  }
  // Body and query args must follow the same order as the generated client
  // function signature, which sorts required params before optional ones (see
  // `getProps`/`sortByPriority`). Emitting a fixed body-then-query order would
  // swap the two arguments whenever the query param is required and the body is
  // optional, sending the body as the query string and vice versa.
  for (const prop of verbOptions.props) {
    if (prop.type === GetterPropType.BODY) {
      fetchParams.push('args.bodyParams');
    } else if (prop.type === GetterPropType.QUERY_PARAM) {
      fetchParams.push('args.queryParams');
    }
  }

  const handlerName = `${verbOptions.operationName}Handler`;
  const handlerArgsSignature =
    handlerArgsTypes.length > 0 ? `args: ${handlerArgsName}, ` : '';
  const fetchArgs = fetchParams.length > 0 ? `${fetchParams.join(', ')}, ` : '';

  const customHandler = options.override.mcp.handler;
  const handlerImplementation = customHandler
    ? `
export const ${handlerName} = async (${handlerArgsSignature}options: RequestInit, ctx: ServerContext, toStructuredContent: (data: unknown) => { success: true; data: Record<string, unknown> | undefined } | { success: false; error: { message: string } }) => {
  const fetcher = (overrides?: RequestInit) => ${verbOptions.operationName}(${fetchArgs}{
    ...options,
    ...overrides,
    headers: {
      ...Object.fromEntries(new Headers(options.headers)),
      ...Object.fromEntries(new Headers(overrides?.headers)),
    },
  });

  return ${customHandler.name ?? 'customHandler'}(fetcher, ctx, toStructuredContent);
};`
    : `
export const ${handlerName} = async (${handlerArgsSignature}options: RequestInit, toStructuredContent: (data: unknown) => { success: true; data: Record<string, unknown> | undefined } | { success: false; error: { message: string } }) => {
  const res = await ${verbOptions.operationName}(${fetchArgs}options);

  if (res.status >= 400) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(res.data ?? null),
        },
      ],
      isError: true,
    };
  }

  const text = JSON.stringify(res.data ?? null);
  const result = toStructuredContent(res.data);

  return result.success
    ? { content: [{ type: 'text' as const, text }], structuredContent: result.data }
    : {
        content: [
          { type: 'text' as const, text },
          { type: 'text' as const, text: result.error.message },
        ],
        isError: true,
      };
};`;

  const handlersImplementation = [
    handlerArgsImplementation,
    handlerImplementation,
  ].join('');

  return {
    implementation: handlersImplementation ? `${handlersImplementation}\n` : '',
    imports: [],
  };
};

export const generateServer = (
  verbOptions: Record<string, GeneratorVerbOptions>,
  output: NormalizedOutputOptions,
  context: ContextSpec,
) => {
  const info = getSpecInfo(context);
  const {
    path: targetPath,
    extension,
    dirname,
  } = getMcpTargetInfo(output, info);
  const serverPath = path.join(dirname, `server${extension}`);
  const header = getHeader(output.override.header, info);

  const mcpServerOptions = output.override.mcp.server;

  const toolImplementations = Object.values(verbOptions)
    .map((verbOption) => {
      const pascalOperationName = pascal(verbOption.typeName);
      const hasInputSchema = getInputShape(verbOption).length > 0;
      const inputSchemaImplementation = hasInputSchema
        ? `\n    inputSchema: ${pascalOperationName}Input,`
        : '';

      // `outputSchema` and `toStructuredContent` use the same schema so the
      // structured content always matches the declared schema. Parsing drops
      // fields that are not in the spec, which the SDK's JSON Schema rejects.
      const outputSchema = hasResponseSchema(verbOption, context)
        ? isObjectResponseSchema(verbOption, context)
          ? `${pascalOperationName}Response`
          : `${pascalOperationName}Output`
        : undefined;
      const outputSchemaImplementation = outputSchema
        ? `\n    outputSchema: ${outputSchema},`
        : '';
      const toStructuredContent = !outputSchema
        ? '() => ({ success: true as const, data: undefined })'
        : isObjectResponseSchema(verbOption, context)
          ? `(data: unknown) => ${outputSchema}.safeParse(data)`
          : `(data: unknown) => ${outputSchema}.safeParse({ result: data })`;

      const annotationsValue = getAnnotations(verbOption.verb);
      const annotationsImplementation = annotationsValue
        ? `\n    annotations: ${annotationsValue},`
        : '';

      const titleImplementation = verbOption.summary
        ? `\n    title: '${jsStringEscape(verbOption.summary)}',`
        : '';
      const operationDescription = verbOption.originalOperation.description;
      const descriptionValue =
        (operationDescription && operationDescription.length > 0
          ? operationDescription
          : verbOption.summary) ?? '';
      const descriptionImplementation = descriptionValue
        ? `\n    description: '${jsStringEscape(descriptionValue)}',`
        : '';

      const requestInitWithSignal = `{
    ...options,
    signal: options?.signal ? AbortSignal.any([options.signal, ctx.mcpReq.signal]) : ctx.mcpReq.signal,
  }`;
      const ctxArgument = output.override.mcp.handler ? ', ctx' : '';
      const handlerCallImplementation = hasInputSchema
        ? `(args, ctx) => ${verbOption.operationName}Handler(args, ${requestInitWithSignal}${ctxArgument}, ${toStructuredContent})`
        : `(ctx) => ${verbOption.operationName}Handler(${requestInitWithSignal}${ctxArgument}, ${toStructuredContent})`;

      const toolImplementation = `
tools.${verbOption.operationName} = server.registerTool(
  '${jsStringEscape(verbOption.operationName)}',
  {${titleImplementation}${descriptionImplementation}${inputSchemaImplementation}${outputSchemaImplementation}${annotationsImplementation}
  },
  ${handlerCallImplementation}
);`;

      return toolImplementation;
    })
    .join('\n');

  const importToolSchemas = Object.values(verbOptions)
    .flatMap((verbOption) => {
      const imports = [];

      const pascalOperationName = pascal(verbOption.typeName);

      if (getInputShape(verbOption).length > 0)
        imports.push(`  ${pascalOperationName}Input`);
      if (hasResponseSchema(verbOption, context))
        imports.push(
          `  ${pascalOperationName}${isObjectResponseSchema(verbOption, context) ? 'Response' : 'Output'}`,
        );

      return imports;
    })
    .join(',\n');
  const toolSchemasPath = path.join(dirname, `tool-schemas.zod${extension}`);
  const relativeToolSchemasPath = upath.getRelativeImportPath(
    serverPath,
    toolSchemasPath,
  );
  const importToolSchemasImplementation = `import {\n${importToolSchemas}\n} from '${relativeToolSchemasPath}';`;

  const importHandlers = Object.values(verbOptions)
    .filter((verbOption) =>
      toolImplementations.includes(`${verbOption.operationName}Handler`),
    )
    .map((verbOption) => `  ${verbOption.operationName}Handler`)
    .join(`,\n`);
  const relativeHandlersPath = upath.getRelativeImportPath(
    serverPath,
    targetPath,
  );
  const importHandlersImplementation = `import {\n${importHandlers}\n} from '${relativeHandlersPath}';`;

  const createMcpServerImplementation = `
const createMcpServer = (options?: RequestInit): { server: McpServer; tools: Record<string, RegisteredTool> } => {
  const server = new McpServer({
    name: '${camel(info.title)}Server',
    version: '${jsStringEscape(info.version)}',
  });
  const tools: Record<string, RegisteredTool> = {};
${toolImplementations}

  return { server, tools };
};
`;

  const serverFunctionName = mcpServerOptions?.name ?? 'customServer';

  const importMcpServer = `import { McpServer, type RegisteredTool } from '@modelcontextprotocol/server';
`;

  const importTransport = mcpServerOptions
    ? getCustomModuleImport(mcpServerOptions, 'customServer', serverPath)
    : `import { serveStdio } from '@modelcontextprotocol/server/stdio';`;

  const importDependenciesImplementation = `${importMcpServer}
${importTransport}
`;

  const customServerConnectImplementation = `\n${serverFunctionName}(createMcpServer);\n`;
  // `serveStdio` calls the factory per connection (and per `server/discover`
  // probe) and pins one instance to the connection, so a pre-built server
  // cannot be shared across openings.
  const stdioServerConnectImplementation = `
serveStdio(() => createMcpServer().server);
`;

  const serverConnectImplementation = mcpServerOptions
    ? customServerConnectImplementation
    : stdioServerConnectImplementation;

  const content = [
    header,
    importDependenciesImplementation,
    importHandlersImplementation,
    importToolSchemasImplementation,
    createMcpServerImplementation,
    serverConnectImplementation,
  ].join('\n');

  return [
    {
      content,
      path: serverPath,
    },
  ];
};

const generateZodFiles = async (
  verbOptions: Record<string, GeneratorVerbOptions>,
  output: NormalizedOutputOptions,
  context: ContextSpec,
) => {
  const info = getSpecInfo(context);
  const { extension, dirname } = getMcpTargetInfo(output, info);

  const header = getHeader(output.override.header, info);

  // One block per tool: request schemas, Input, response schemas, Output.
  const tools = await Promise.all(
    Object.values(verbOptions).map(async (verbOption) => {
      const { request, response, mutators } = await generateZodSections(
        verbOption,
        {
          route: verbOption.route,
          pathRoute: verbOption.pathRoute,
          override: output.override,
          context,
          output: output.target,
        },
      );
      const name = pascal(verbOption.typeName);
      const shape = getInputShape(verbOption);
      const inputSchema =
        shape.length > 0
          ? `export const ${name}Input = zod.object({\n  ${shape.join(',\n  ')},\n});`
          : undefined;
      // Non-object responses are exposed to MCP wrapped as `{ result }`; the
      // wrapping schema is emitted here so server.ts can use it for both
      // `outputSchema` and `structuredContent` validation.
      const outputSchema =
        hasResponseSchema(verbOption, context) &&
        !isObjectResponseSchema(verbOption, context)
          ? `export const ${name}Output = zod.object({ result: ${name}Response });`
          : undefined;

      return {
        implementation: [request, inputSchema, response, outputSchema]
          .filter(Boolean)
          .join('\n\n'),
        mutators,
      };
    }),
  );

  const allMutators = new Map(
    tools.flatMap((tool) => tool.mutators).map((m) => [m.name, m]),
  )
    .values()
    .toArray();

  const mutatorsImports = generateMutatorImports({
    mutators: allMutators,
  });

  const content = `${header}${getZodSchemaImportStatement(output.override.zod.variant)}\n${mutatorsImports}\n${tools
    .map((tool) => tool.implementation)
    .filter(Boolean)
    .join('\n\n')}\n`;

  return [
    {
      content,
      path: path.join(dirname, `tool-schemas.zod${extension}`),
    },
  ];
};

const generateHttpClientFiles = async (
  verbOptions: Record<string, GeneratorVerbOptions>,
  output: NormalizedOutputOptions,
  context: ContextSpec,
) => {
  const info = getSpecInfo(context);
  const {
    path: targetPath,
    extension,
    dirname,
  } = getMcpTargetInfo(output, info);
  const outputPath = path.join(dirname, `http-client${extension}`);

  const header = getHeader(output.override.header, info);

  const clients = await Promise.all(
    Object.values(verbOptions).map(async (verbOption) => {
      const fullRoute = getFullRoute(
        verbOption.route,
        context.spec.servers,
        output.baseUrl,
      );

      const options = {
        route: fullRoute,
        pathRoute: verbOption.pathRoute,
        override: output.override,
        context,
        output: output.target,
      };

      return generateClient(verbOption, options, output.client, output);
    }),
  );

  const clientImplementation = clients
    .map((client) => client.implementation)
    .join('\n');

  const isZodSchemaOutput =
    isObject(output.schemas) && output.schemas.type === 'zod';
  const schemasPath = (
    isObject(output.schemas)
      ? output.schemas.path
      : isString(output.schemas)
        ? output.schemas
        : undefined
  ) as string | undefined;
  const basePath = schemasPath ? getFileInfo(schemasPath).dirname : undefined;
  const relativeSchemasPath = basePath
    ? isZodSchemaOutput && output.indexFiles
      ? upath.getRelativeImportPath(targetPath, basePath, true)
      : upath.getRelativeImportPath(targetPath, basePath)
    : upath.getRelativeImportPath(outputPath, targetPath);

  const importNames = clients
    .flatMap((client) => client.imports)
    .map((imp) => imp.name);
  const uniqueImportNames = new Set(importNames).values().toArray();

  // Type-only schemas — the http-client references them in type positions
  // (response/params/body type aliases and function signatures), so the
  // import is type-only.
  const importImplementation = `import type { ${uniqueImportNames.join(
    ',\n',
  )} } from '${relativeSchemasPath}';`;

  // Mutator paths are resolved against the target directory, which is also
  // where http-client lives.
  const mutatorImports = generateMutatorImports({
    mutators: Object.values(verbOptions).flatMap((verbOption) =>
      [
        verbOption.mutator,
        verbOption.formData,
        verbOption.formUrlEncoded,
        verbOption.paramsSerializer,
        verbOption.fetchReviver,
      ].filter((mutator) => mutator !== undefined),
    ),
    implementation: clientImplementation,
  });

  const rawFetchHeader = generateFetchHeader({
    title: '',
    isRequestOptions: false,
    isMutator: false,
    noFunction: false,
    isGlobalMutator: false,
    provideIn: false,
    hasAwaitedType: false,
    output,
    verbOptions,
    clientImplementation,
  });

  const fetchHeader =
    typeof rawFetchHeader === 'string'
      ? rawFetchHeader
      : [
          rawFetchHeader.implementation,
          ...(rawFetchHeader.sharedTypes ?? []).map(
            (t) => `${t.exported ? 'export ' : ''}${t.code}`,
          ),
        ].join('\n');

  const content = [
    header,
    importImplementation,
    mutatorImports,
    fetchHeader,
    clientImplementation,
  ].join('\n');
  return [
    {
      content,
      path: outputPath,
    },
  ];
};

export const generateExtraFiles: ClientExtraFilesBuilder = async (
  verbOptions,
  output,
  context,
) => {
  const server = generateServer(verbOptions, output, context);
  const [zods, httpClients] = await Promise.all([
    generateZodFiles(verbOptions, output, context),
    generateHttpClientFiles(verbOptions, output, context),
  ]);

  return [...server, ...zods, ...httpClients];
};

const mcpClientBuilder: ClientGeneratorsBuilder = {
  client: generateMcp,
  header: getMcpHeader,
  extraFiles: generateExtraFiles,
};

export const builder = () => () => mcpClientBuilder;

export default builder;
