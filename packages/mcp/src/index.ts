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
  isObject,
  jsDoc,
  jsStringEscape,
  type NormalizedOutputOptions,
  type OpenApiInfoObject,
  pascal,
  upath,
} from '@orval/core';
import { generateClient, generateFetchHeader } from '@orval/fetch';
import { generateZod } from '@orval/zod';

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

export const getMcpHeader: ClientHeaderBuilder = ({ verbOptions, output }) => {
  const targetInfo = getFileInfo(output.target);
  const schemasPath = isObject(output.schemas)
    ? output.schemas.path
    : output.schemas;
  const schemaInfo = schemasPath ? getFileInfo(schemasPath) : undefined;

  const isZodSchemaOutput =
    isObject(output.schemas) && output.schemas.type === 'zod';
  const basePath = schemaInfo?.dirname;
  const relativeSchemaImportPath = basePath
    ? isZodSchemaOutput && output.indexFiles
      ? upath.relativeSafe(
          targetInfo.dirname,
          upath.joinSafe(basePath, 'index.zod'),
        )
      : upath.relativeSafe(targetInfo.dirname, basePath)
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
  const pathParamsType = verbOptions.params
    .map((param) => {
      const paramName = param.name.split(': ')[0];
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
    handlerArgsTypes.push(`  bodyParams: ${verbOptions.body.definition};`);
  }

  handlerArgsTypes.push(`  options?: RequestInit;`);

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
    const pathParamsArgs = verbOptions.params
      .map((param) => {
        const paramName = param.name.split(': ')[0];

        return `args.pathParams.${paramName}`;
      })
      .join(', ');

    fetchParams.push(pathParamsArgs);
  }
  if (verbOptions.body.definition) fetchParams.push(`args.bodyParams`);
  if (verbOptions.queryParams) fetchParams.push(`args.queryParams`);

  fetchParams.push(`args.options`);

  const handlerName = `${verbOptions.operationName}Handler`;
  const handlerImplementation = `
export const ${handlerName} = async (${handlerArgsTypes.length > 0 ? `args: ${handlerArgsName}` : ''}) => {
  const res = await ${verbOptions.operationName}(${fetchParams.join(', ')});

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(res),
      },
    ],
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
  const info = context.spec.info;
  const { extension, dirname } = getFileInfo(output.target);
  const serverPath = upath.join(dirname, `server${extension}`);
  const header = getHeader(output.override.header, info);

  const toolImplementations = Object.values(verbOptions)
    .map((verbOption) => {
      const pascalOperationName = pascal(verbOption.operationName);
      const inputSchemaTypes = [];
      if (verbOption.params.length > 0)
        inputSchemaTypes.push(`  pathParams: ${pascalOperationName}Params`);
      if (verbOption.queryParams)
        inputSchemaTypes.push(
          `  queryParams: ${pascalOperationName}QueryParams`,
        );
      if (verbOption.body.definition)
        inputSchemaTypes.push(`  bodyParams: ${pascalOperationName}Body`);

      const inputSchemaImplementation =
        inputSchemaTypes.length > 0
          ? `  {
  ${inputSchemaTypes.join(',\n  ')}
  },`
          : '';

      const toolImplementation = `
server.tool(
  '${jsStringEscape(verbOption.operationName)}',
  '${jsStringEscape(verbOption.summary)}',${inputSchemaImplementation ? `\n${inputSchemaImplementation}` : ''}
  ${jsStringEscape(verbOption.operationName)}Handler
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

  const importDependenciesImplementation = `import {
  McpServer
} from '@modelcontextprotocol/sdk/server/mcp.js';
  
import {
  StdioServerTransport
} from '@modelcontextprotocol/sdk/server/stdio.js';  
`;
  const newMcpServerImplementation = `
const server = new McpServer({
  name: '${camel(info.title)}Server',
  version: '1.0.0',
});
`;
  const serverConnectImplementation = `
const transport = new StdioServerTransport();

server.connect(transport).then(() => {
  console.error('MCP server running on stdio');
}).catch(console.error);
`;

  const content = [
    header,
    importDependenciesImplementation,
    importHandlersImplementation,
    importToolSchemasImplementation,
    newMcpServerImplementation,
    toolImplementations,
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

  const header = getHeader(output.override.header, context.spec.info);

  const zods = await Promise.all(
    Object.values(verbOptions).map(async (verbOption) =>
      generateZod(
        verbOption,
        {
          route: verbOption.route,
          pathRoute: verbOption.pathRoute,
          override: output.override,
          context,
          mock: output.mock,
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

  let content = `${header}import { z as zod } from 'zod';\n${mutatorsImports}\n`;

  const zodPath = upath.join(dirname, `tool-schemas.zod${extension}`);

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
  const { extension, dirname, filename } = getFileInfo(output.target);

  const header = getHeader(output.override.header, context.spec.info);

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
        mock: output.mock,
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
  const schemasPath = isObject(output.schemas)
    ? output.schemas.path
    : output.schemas;
  const basePath = schemasPath ? getFileInfo(schemasPath).dirname : undefined;
  const relativeSchemasPath = basePath
    ? isZodSchemaOutput && output.indexFiles
      ? upath.relativeSafe(dirname, upath.joinSafe(basePath, 'index.zod'))
      : upath.relativeSafe(dirname, basePath)
    : './' + filename + '.schemas';

  const importNames = clients
    .flatMap((client) => client.imports)
    .map((imp) => imp.name);
  const uniqueImportNames = new Set(importNames).values().toArray();

  const importImplementation = `import { ${uniqueImportNames.join(
    ',\n',
  )} } from '${relativeSchemasPath}';`;

  const fetchHeader = generateFetchHeader({
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

  const content = [
    header,
    importImplementation,
    fetchHeader,
    clientImplementation,
  ].join('\n');
  const outputPath = upath.join(dirname, `http-client${extension}`);

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
