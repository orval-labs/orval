import path from 'node:path';

import {
  camel,
  type ClientBuilder,
  type ClientExtraFilesBuilder,
  type ClientGeneratorsBuilder,
  type ClientHeaderBuilder,
  type ContextSpec,
  generateMutatorImports,
  type GeneratorVerbOptions,
  getFileInfo,
  getFullRoute,
  getParamsInPath,
  GetterPropType,
  isObject,
  isString,
  jsDoc,
  jsStringEscape,
  type NormalizedOutputOptions,
  type OpenApiInfoObject,
  pascal,
  upath,
  type Verbs,
} from '@orval/core';
import { generateClient, generateFetchHeader } from '@orval/fetch';
import { generateZod, getZodImportSource } from '@orval/zod';

const getZodSchemaImportStatement = (
  variant: NormalizedOutputOptions['override']['zod']['variant'],
) =>
  variant === 'mini'
    ? `import * as zod from '${getZodImportSource(variant)}';`
    : `import { z as zod } from '${getZodImportSource(variant)}';`;

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
    case 'head': {
      return '{ readOnlyHint: true, destructiveHint: false }';
    }
    case 'post': {
      return '{ destructiveHint: false }';
    }
    case 'put': {
      return '{ destructiveHint: false, idempotentHint: true }';
    }
    case 'patch': {
      return '{ destructiveHint: false }';
    }
    case 'delete': {
      return '{ idempotentHint: true }';
    }
    default: {
      return '';
    }
  }
};

const getSpecInfo = (context: ContextSpec): OpenApiInfoObject =>
  context.spec.info ?? {
    title: 'API',
    version: '1.0.0',
  };

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
    : './' + targetInfo.filename + '.schemas';

  const importSchemaNames = new Set(
    Object.values(verbOptions).flatMap((verbOption) => {
      const imports = [];
      const pascalOperationName = pascal(verbOption.operationName);

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

  const importSchemasImplementation = `import {\n  ${importSchemaNames.join(
    ',\n  ',
  )}\n} from '${relativeSchemaImportPath}';
`;

  const relativeFetchClientPath = './http-client';
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

  const content = [
    importSchemasImplementation,
    importFetchClientImplementation,
  ].join('\n');

  return content + '\n';
};

export const generateMcp: ClientBuilder = (verbOptions) => {
  const handlerArgsTypes = [];
  const originalParamNames = getParamsInPath(verbOptions.pathRoute);
  const pathParamsType = verbOptions.params
    .map((param, index) => {
      const paramName = originalParamNames[index];
      const paramType = param.implementation.split(': ')[1];
      return `    ${paramName}: ${paramType}`;
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
      .map((paramName) => `args.pathParams.${paramName}`)
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
  const handlerImplementation = `
export const ${handlerName} = async (${handlerArgsTypes.length > 0 ? `args: ${handlerArgsName}, ` : ''}options?: RequestInit) => {
  const res = await ${verbOptions.operationName}(${fetchParams.length > 0 ? `${fetchParams.join(', ')}, ` : ''}options);

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

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(res.data ?? null),
      },
    ],
    structuredContent: res.data,
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
  const { extension, dirname } = getFileInfo(output.target);
  const serverPath = path.join(dirname, `server${extension}`);
  const header = getHeader(output.override.header, info);

  const mcpServerOptions = output.override.mcp.server;
  const hasResponseSchema =
    output.override.zod.generate.response &&
    !output.override.zod.generateEachHttpStatus;

  const toolImplementations = Object.values(verbOptions)
    .map((verbOption) => {
      const pascalOperationName = pascal(verbOption.operationName);
      const inputSchemaTypes = [];
      if (verbOption.params.length > 0)
        inputSchemaTypes.push(`pathParams: ${pascalOperationName}Params`);
      if (verbOption.queryParams)
        inputSchemaTypes.push(`queryParams: ${pascalOperationName}QueryParams`);
      if (verbOption.body.definition)
        inputSchemaTypes.push(
          `bodyParams: ${pascalOperationName}Body${verbOption.body.isOptional ? '.optional()' : ''}`,
        );

      const inputSchemaImplementation =
        inputSchemaTypes.length > 0
          ? `\n    inputSchema: {\n      ${inputSchemaTypes.join(',\n      ')}\n    },`
          : '';

      const outputSchemaImplementation = hasResponseSchema
        ? `\n    outputSchema: ${pascalOperationName}Response,`
        : '';

      const annotationsValue = getAnnotations(verbOption.verb);
      const annotationsImplementation = annotationsValue
        ? `\n    annotations: ${annotationsValue},`
        : '';

      const titleImplementation = verbOption.summary
        ? `\n    title: '${jsStringEscape(verbOption.summary)}',`
        : '';
      const operationDescription = verbOption.originalOperation.description as
        | string
        | undefined;
      const descriptionValue =
        (operationDescription && operationDescription.length > 0
          ? operationDescription
          : verbOption.summary) ?? '';
      const descriptionImplementation = descriptionValue
        ? `\n    description: '${jsStringEscape(descriptionValue)}',`
        : '';

      const handlerCallImplementation =
        inputSchemaTypes.length > 0
          ? `(args) => ${verbOption.operationName}Handler(args, options)`
          : `() => ${verbOption.operationName}Handler(options)`;

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

      const pascalOperationName = pascal(verbOption.operationName);

      if (verbOption.headers) imports.push(`  ${pascalOperationName}Header`);
      if (verbOption.params.length > 0)
        imports.push(`  ${pascalOperationName}Params`);
      if (verbOption.queryParams)
        imports.push(`  ${pascalOperationName}QueryParams`);
      if (verbOption.body.definition)
        imports.push(`  ${pascalOperationName}Body`);
      if (hasResponseSchema) imports.push(`  ${pascalOperationName}Response`);

      return imports;
    })
    .join(',\n');
  const importToolSchemasImplementation = `import {\n${importToolSchemas}\n} from './tool-schemas.zod';`;

  const importHandlers = Object.values(verbOptions)
    .filter((verbOption) =>
      toolImplementations.includes(`${verbOption.operationName}Handler`),
    )
    .map((verbOption) => `  ${verbOption.operationName}Handler`)
    .join(`,\n`);
  const importHandlersImplementation = `import {\n${importHandlers}\n} from './handlers';`;

  const createMcpServerImplementation = `
const createMcpServer = (options?: RequestInit): { server: McpServer; tools: Record<string, RegisteredTool> } => {
  const server = new McpServer({
    name: '${camel(info.title)}Server',
    version: '1.0.0',
  });
  const tools: Record<string, RegisteredTool> = {};
${toolImplementations}

  return { server, tools };
};
`;

  const serverFunctionName = mcpServerOptions?.name ?? 'customServer';
  const relativeServerPath = mcpServerOptions
    ? upath.getRelativeImportPath(serverPath, mcpServerOptions.path)
    : '';
  const importSpecifier = mcpServerOptions?.default
    ? serverFunctionName
    : `{ ${serverFunctionName} }`;

  const importMcpServer = `import {
  McpServer,
  type RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
`;

  const importTransport = mcpServerOptions
    ? `import ${importSpecifier} from '${relativeServerPath}';`
    : `import {
  StdioServerTransport
} from '@modelcontextprotocol/sdk/server/stdio.js';`;

  const importDependenciesImplementation = `${importMcpServer}
${importTransport}
`;

  const customServerConnectImplementation = `\n${serverFunctionName}(createMcpServer);\n`;
  const stdioServerConnectImplementation = `
const { server } = createMcpServer();
const transport = new StdioServerTransport();

server.connect(transport).then(() => {
  console.error('MCP server running on stdio');
}).catch(console.error);
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
  const { extension, dirname } = getFileInfo(output.target);

  const header = getHeader(output.override.header, getSpecInfo(context));

  const zods = await Promise.all(
    Object.values(verbOptions).map(async (verbOption) =>
      generateZod(
        verbOption,
        {
          route: verbOption.route,
          pathRoute: verbOption.pathRoute,
          override: output.override,
          context,
          output: output.target,
        },
        output.client,
      ),
    ),
  );

  const allMutators = new Map(
    zods.flatMap((z) => z.mutators ?? []).map((m) => [m.name, m]),
  )
    .values()
    .toArray();

  const mutatorsImports = generateMutatorImports({
    mutators: allMutators,
  });

  let content = `${header}${getZodSchemaImportStatement(output.override.zod.variant)}\n${mutatorsImports}\n`;

  const zodPath = path.join(dirname, `tool-schemas.zod${extension}`);

  content += zods.map((zod) => zod.implementation).join('\n');

  return [
    {
      content,
      path: zodPath,
    },
  ];
};

const generateHttpClientFiles = async (
  verbOptions: Record<string, GeneratorVerbOptions>,
  output: NormalizedOutputOptions,
  context: ContextSpec,
) => {
  const {
    path: targetPath,
    extension,
    dirname,
    filename,
  } = getFileInfo(output.target);

  const header = getHeader(output.override.header, getSpecInfo(context));

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
    : './' + filename + '.schemas';

  const importNames = clients
    .flatMap((client) => client.imports)
    .map((imp) => imp.name);
  const uniqueImportNames = new Set(importNames).values().toArray();

  const importImplementation = `import { ${uniqueImportNames.join(
    ',\n',
  )} } from '${relativeSchemasPath}';`;

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
    fetchHeader,
    clientImplementation,
  ].join('\n');
  const outputPath = path.join(dirname, `http-client${extension}`);

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
