import {
  generateVerbImports,
  ClientBuilder,
  ClientExtraFilesBuilder,
  ClientFooterBuilder,
  ClientGeneratorsBuilder,
  ClientHeaderBuilder,
  ContextSpecs,
  generateMutatorImports,
  GeneratorDependency,
  GeneratorMutator,
  GeneratorVerbOptions,
  getFileInfo,
  jsDoc,
  NormalizedOutputOptions,
  upath,
} from '@orval/core';
import { generateZod } from '@orval/zod';
import {
  generateRequestFunction as generateFetchRequestFunction,
  generateClient,
  generateFetchHeader,
} from '@orval/fetch';

import { InfoObject } from 'openapi3-ts/oas30';

const MCP_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      {
        name: 'McpServer',
        values: true,
      },
    ],
    dependency: '@modelcontextprotocol/sdk/server/mcp.js',
  },
  {
    exports: [
      {
        name: 'StdioServerTransport',
        values: true,
      },
    ],
    dependency: '@modelcontextprotocol/sdk/server/stdio.js',
  },
];

export const getMcpDependencies = () => MCP_DEPENDENCIES;

const getHeader = (
  option: false | ((info: InfoObject) => string | string[]),
  info: InfoObject,
): string => {
  if (!option) {
    return '';
  }

  const header = option(info);

  return Array.isArray(header) ? jsDoc({ description: header }) : header;
};

export const getMcpHeader: ClientHeaderBuilder = ({
  verbOptions,
  clientImplementation,
}) => {
  const importToolSchemas = Object.values(verbOptions)
    .flatMap((verbOption) => {
      const imports = [];

      if (verbOption.headers)
        imports.push(`  ${verbOption.operationName}Header`);
      if (verbOption.params.length)
        imports.push(`  ${verbOption.operationName}Params`);
      if (verbOption.queryParams)
        imports.push(`  ${verbOption.operationName}QueryParams`);
      if (verbOption.body.definition)
        imports.push(`  ${verbOption.operationName}Body`);

      return imports;
    })
    .join(',\n');
  const importToolSchemasImplementation = `import {\n${importToolSchemas}\n} from './tool-schemas.zod';`;

  const importHandlers = Object.values(verbOptions)
    .filter((verbOption) =>
      clientImplementation.includes(`${verbOption.operationName}Handler`),
    )
    .map((verbOption) => `  ${verbOption.operationName}Handler`)
    .join(`,\n`);
  const importHandlersImplementation = `import {\n${importHandlers}\n} from './handlers';`;

  const newMcpServerImplementation = `
const server = new McpServer({
  name: 'mcp-server',
  version: '1.0.0',
});
`;

  return [
    importHandlersImplementation,
    importToolSchemasImplementation,
    newMcpServerImplementation,
  ].join('\n');
};

export const getMcpFooter: ClientFooterBuilder = () => `
const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  console.error('MCP server running on stdio');
}).catch(console.error);
`;

export const generateMcp: ClientBuilder = async (verbOptions, options) => {
  const imputSchemaTypes = [];
  if (verbOptions.params.length)
    imputSchemaTypes.push(`  pathParams: ${verbOptions.operationName}Params`);
  if (verbOptions.queryParams)
    imputSchemaTypes.push(
      `  queryParams: ${verbOptions.operationName}QueryParams`,
    );
  if (verbOptions.body.definition)
    imputSchemaTypes.push(`  bodyParams: ${verbOptions.operationName}Body`);

  const imputSchemaImplementation = imputSchemaTypes.length
    ? `  {
  ${imputSchemaTypes.join(',\n  ')}
  },`
    : '';

  const toolImplementation = `
server.tool(
  '${verbOptions.operationName}',
  '${verbOptions.summary}',${imputSchemaImplementation ? `\n${imputSchemaImplementation}` : ''}
  ${verbOptions.operationName}Handler
);`;

  const schemaImports = generateVerbImports(verbOptions);
  const imports = [...schemaImports];

  return {
    implementation: toolImplementation ? `${toolImplementation}\n` : '',
    imports,
  };
};

const getHandler = (verbOption: GeneratorVerbOptions) => {
  const handlerArgsTypes = [];
  const pathParamsType = verbOption.params
    .map((param) => {
      const paramName = param.name.split(': ')[0];
      const paramType = param.implementation.split(': ')[1];
      return `    ${paramName}: ${paramType}`;
    })
    .join(',\n');
  if (pathParamsType)
    handlerArgsTypes.push(`  pathParams: {\n${pathParamsType}\n  };`);
  if (verbOption.queryParams)
    handlerArgsTypes.push(
      `  queryParams: ${verbOption.queryParams.schema.name};`,
    );
  if (verbOption.body.definition)
    handlerArgsTypes.push(`  bodyParams: ${verbOption.body.definition};`);

  const handlerArgsName = `${verbOption.operationName}Args`;
  const handlerArgsImplementation = handlerArgsTypes.length
    ? `
export type ${handlerArgsName} = {
${handlerArgsTypes.join('\n')}
}
`
    : '';

  const fetchParams = [];
  if (verbOption.params.length) {
    const pathParamsArgs = verbOption.params
      .map((param) => {
        const paramName = param.name.split(': ')[0];

        return `args.pathParams.${paramName}`;
      })
      .join(', ');

    fetchParams.push(`${pathParamsArgs}`);
  }
  if (verbOption.body.definition) fetchParams.push(`args.bodyParams`);
  if (verbOption.queryParams) fetchParams.push(`args.queryParams`);

  const handlerName = `${verbOption.operationName}Handler`;
  const handlerImplementation = `
export const ${handlerName} = async (${handlerArgsTypes.length ? `args: ${handlerArgsName}` : ''}) => {
  const res = await ${verbOption.operationName}(${fetchParams.join(', ')});

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(res),
      },
    ],
  };
};`;

  return [handlerArgsImplementation, handlerImplementation].join('');
};

const generateHandlers = async (
  verbOptions: Record<string, GeneratorVerbOptions>,
  output: NormalizedOutputOptions,
) => {
  const { extension, dirname, filename } = getFileInfo(output.target);

  const handlerPath = upath.join(dirname, `handlers${extension}`);

  const relativeSchemaImportPath = output.schemas
    ? upath.relativeSafe(dirname, getFileInfo(output.schemas).dirname)
    : './' + filename + '.schemas';
  const importSchemaNames = await Promise.all(
    Object.values(verbOptions)
      .flatMap((verbOption) => generateVerbImports(verbOption))
      .reduce((acc, imp) => {
        if (!acc.find((name) => name === imp.name)) {
          acc.push(imp.name);
        }

        return acc;
      }, [] as string[]),
  );
  const importSchemasImplementation = `import { ${importSchemaNames.join(
    ',\n',
  )} } from '${relativeSchemaImportPath}';`;

  const relativeFetchClientPath = './http-client';
  const importFetchClientNames = await Promise.all(
    Object.values(verbOptions)
      .flatMap((verbOption) => verbOption.operationName)
      .reduce((acc, name) => {
        if (!acc.find((i) => i === name)) {
          acc.push(name);
        }

        return acc;
      }, [] as string[]),
  );

  const importFetchClientImplementation = `import { ${importFetchClientNames.join(
    ',\n',
  )} } from '${relativeFetchClientPath}';`;

  const handlersImplementation = Object.values(verbOptions)
    .map((verbOption) => {
      return getHandler(verbOption);
    })
    .join('\n');

  const content = [
    importSchemasImplementation,
    importFetchClientImplementation,
    handlersImplementation,
  ].join('\n');

  return [
    {
      content,
      path: handlerPath,
    },
  ];
};

const generateZodFiles = async (
  verbOptions: Record<string, GeneratorVerbOptions>,
  output: NormalizedOutputOptions,
  context: ContextSpecs,
) => {
  const { extension, dirname, filename } = getFileInfo(output.target);

  const header = getHeader(
    output.override.header,
    context.specs[context.specKey].info,
  );

  const zods = await Promise.all(
    Object.values(verbOptions).map((verbOption) =>
      generateZod(
        verbOption,
        {
          route: verbOption.route,
          pathRoute: verbOption.pathRoute,
          override: output.override,
          context,
          mock: output.mock,
          output: output.target!,
        },
        output.client,
      ),
    ),
  );

  const allMutators = zods.reduce(
    (acc, z) => {
      (z.mutators ?? []).forEach((mutator) => {
        acc[mutator.name] = mutator;
      });
      return acc;
    },
    {} as Record<string, GeneratorMutator>,
  );

  const mutatorsImports = generateMutatorImports({
    mutators: Object.values(allMutators),
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

const generateHttpClinetFiles = async (
  verbOptions: Record<string, GeneratorVerbOptions>,
  output: NormalizedOutputOptions,
  context: ContextSpecs,
) => {
  const { extension, dirname, filename } = getFileInfo(output.target);

  const header = getHeader(
    output.override.header,
    context.specs[context.specKey].info,
  );

  const clients = await Promise.all(
    Object.values(verbOptions).map((verbOption) => {
      const options = {
        route: verbOption.route,
        pathRoute: verbOption.pathRoute,
        override: output.override,
        context,
        mock: output.mock,
        output: output.target!,
      };

      return generateClient(verbOption, options, output.client, output);
    }),
  );
  const clientImplementation = clients
    .map((client) => client.implementation)
    .join('\n');

  const relativeSchemasPath = output.schemas
    ? upath.relativeSafe(dirname, getFileInfo(output.schemas).dirname)
    : './' + filename + '.schemas';
  const importNames = clients
    .flatMap((client) => client.imports)
    .reduce((acc, imp) => {
      if (!acc.find((i) => i === imp.name)) {
        acc.push(imp.name);
      }

      return acc;
    }, [] as string[]);
  const importImplementation = `import { ${importNames.join(
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
  const [handlers, zods, httpClients] = await Promise.all([
    generateHandlers(verbOptions, output),
    generateZodFiles(verbOptions, output, context),
    generateHttpClinetFiles(verbOptions, output, context),
  ]);

  return [...handlers, ...zods, ...httpClients];
};

const mcpClientBuilder: ClientGeneratorsBuilder = {
  client: generateMcp,
  dependencies: getMcpDependencies,
  header: getMcpHeader,
  footer: getMcpFooter,
  extraFiles: generateExtraFiles,
};

export const builder = () => () => mcpClientBuilder;

export default builder;
