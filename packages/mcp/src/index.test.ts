import { GetterPropType, type OpenApiInfoObject } from '@orval/core';
import { describe, expect, it } from 'vite-plus/test';

import {
  type CreateTestContextSpecOptions,
  createTestContextSpec,
  createTestGeneratorVerbOptions,
} from '../../core/src/test-utils';
import {
  generateExtraFiles,
  generateMcp,
  generateServer,
  getMcpHeader,
} from './index';

const spec: CreateTestContextSpecOptions['spec'] = {
  paths: {
    '/': {
      get: {
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'ok' } },
      },
    },
    '/health': { get: { responses: { '200': { description: 'ok' } } } },
  },
};

const context = createTestContextSpec({
  spec,
  output: { target: '/project/src/handlers.ts' },
});

const generateAllZodSchemas = {
  zod: {
    generate: {
      param: true,
      query: true,
      header: true,
      body: true,
      response: true,
    },
  },
};

const verbOptions = {
  listPets: createTestGeneratorVerbOptions({
    operationName: 'listPets',
    typeName: 'listPets',
    override: generateAllZodSchemas,
    queryParams: {
      schema: { name: 'ListPetsParams', model: '', imports: [] },
      deps: [],
      isOptional: false,
    },
    props: [
      {
        name: 'params',
        definition: 'params: ListPetsParams',
        implementation: 'params: ListPetsParams',
        default: false,
        required: true,
        type: GetterPropType.QUERY_PARAM,
      },
    ],
  }),
  healthCheck: createTestGeneratorVerbOptions({
    operationName: 'healthCheck',
    typeName: 'healthCheck',
    override: generateAllZodSchemas,
    route: '/health',
    pathRoute: '/health',
  }),
};

describe('MCP SDK v2 output', () => {
  it('registers tools against @modelcontextprotocol/server', () => {
    const [{ content }] = generateServer(verbOptions, context.output, context);

    expect(content).toContain(
      "import { McpServer, type RegisteredTool } from '@modelcontextprotocol/server';",
    );
    expect(content).toContain(
      "import { serveStdio } from '@modelcontextprotocol/server/stdio';",
    );
    expect(content).toContain('serveStdio(() => createMcpServer().server);');
    expect(content).toContain('inputSchema: ListPetsInput,');
    expect(content).toContain('ctx.mcpReq.signal');
    expect(content).toContain('(ctx) => healthCheckHandler(');
    expect(content).not.toContain('ListPetsQueryParams');
  });

  it('wraps tool inputs as a single schema in tool-schemas.zod.ts', async () => {
    const files = await generateExtraFiles(
      verbOptions,
      context.output,
      context,
    );
    const zodFile = files.find((file) =>
      file.path.endsWith('tool-schemas.zod.ts'),
    );

    expect(zodFile?.content).toContain(
      'export const ListPetsInput = zod.object({\n  queryParams: ListPetsQueryParams,\n});',
    );
    expect(zodFile?.content).not.toContain('HealthCheckInput');

    const content = zodFile?.content ?? '';
    expect(content.indexOf('ListPetsQueryParams')).toBeLessThan(
      content.indexOf('ListPetsInput'),
    );
    expect(content.indexOf('ListPetsInput')).toBeLessThan(
      content.indexOf('ListPetsResponse'),
    );
  });

  it('types the custom handler context as ServerContext', () => {
    const handlerContext = createTestContextSpec({
      spec,
      output: { target: '/project/src/handlers.ts' },
      override: {
        mcp: {
          handler: { path: '/project/custom-handler.ts', default: false },
        },
      },
    });
    const header = getMcpHeader({
      title: '',
      isRequestOptions: false,
      isMutator: false,
      isGlobalMutator: false,
      provideIn: false,
      hasAwaitedType: false,
      output: handlerContext.output,
      verbOptions,
      clientImplementation: '',
    });

    expect(header).toContain(
      "import type { ServerContext } from '@modelcontextprotocol/server';",
    );
    expect(header).not.toContain('@modelcontextprotocol/sdk');
  });

  it('imports every schema type used by path params and the body', () => {
    const schemasContext = createTestContextSpec({
      spec,
      output: {
        target: '/project/src/handlers.ts',
        schemas: '/project/src/http-schemas',
      },
    });
    const header = getMcpHeader({
      title: '',
      isRequestOptions: false,
      isMutator: false,
      isGlobalMutator: false,
      provideIn: false,
      hasAwaitedType: false,
      output: schemasContext.output,
      verbOptions: {
        addPet: createTestGeneratorVerbOptions({
          operationName: 'addPet',
          typeName: 'addPet',
          params: [
            {
              name: 'kind',
              definition: 'kind: PetKind',
              implementation: 'kind: PetKind',
              default: undefined,
              required: true,
              imports: [{ name: 'PetKind' }],
            },
          ],
          body: {
            definition: 'Cat | Dog',
            implementation: 'addPetBody',
            imports: [{ name: 'Cat' }, { name: 'Dog' }],
            isOptional: false,
          },
        }),
      },
      clientImplementation: '',
    });

    expect(header).toContain(
      "import type {\n  PetKind,\n  Cat,\n  Dog\n} from './http-schemas';",
    );
  });
});

describe('McpServer instructions', () => {
  const generate = (info?: OpenApiInfoObject) => {
    const instructionsContext = createTestContextSpec({
      spec: { ...spec, ...(info && { info }) },
      output: { target: '/project/src/handlers.ts' },
    });
    const [{ content }] = generateServer(
      verbOptions,
      instructionsContext.output,
      instructionsContext,
    );
    return content;
  };

  it('emits the spec description as the server instructions', () => {
    const content = generate({
      title: 'Pets',
      version: '2.0.0',
      description: "Pets API.\nSee https://example.com/docs ('v2')\n",
    });

    expect(content).toContain(
      "new McpServer(\n    {\n      name: 'petsServer',\n      version: '2.0.0',\n    },\n    {\n      instructions: 'Pets API.\\nSee https://example.com/docs (\\'v2\\')',\n    },\n  );",
    );
  });

  it('omits the server options without a spec description', () => {
    const content = generate();

    expect(content).toContain(
      "new McpServer({\n    name: 'testServer',\n    version: '1.0.0',\n  });",
    );
    expect(content).not.toContain('instructions');
  });
});

describe('McpServer cacheHints', () => {
  const generate = (cacheHints: object, info?: OpenApiInfoObject) => {
    const cacheHintsContext = createTestContextSpec({
      spec: { ...spec, ...(info && { info }) },
      output: {
        target: '/project/src/handlers.ts',
        override: { mcp: { cacheHints } },
      },
    });
    const [{ content }] = generateServer(
      verbOptions,
      cacheHintsContext.output,
      cacheHintsContext,
    );
    return content;
  };

  it('passes the hints through next to the instructions', () => {
    const content = generate(
      {
        'tools/list': { ttlMs: 3_600_000, cacheScope: 'public' },
        'server/discover': { ttlMs: 60_000 },
      },
      { title: 'Pets', version: '2.0.0', description: 'Pets API.' },
    );

    expect(content).toContain(
      "    {\n      instructions: 'Pets API.',\n      cacheHints: { 'tools/list': { ttlMs: 3600000, cacheScope: 'public' }, 'server/discover': { ttlMs: 60000 } },\n    },\n  );",
    );
  });

  it('emits only the hints without a spec description', () => {
    const content = generate({ 'tools/list': { cacheScope: 'private' } });

    expect(content).toContain(
      "    {\n      cacheHints: { 'tools/list': { cacheScope: 'private' } },\n    },\n  );",
    );
    expect(content).not.toContain('instructions');
  });

  it('omits the hints by default', () => {
    expect(generate({})).not.toContain('cacheHints');
  });
});

describe('header parameters', () => {
  const headerContext = createTestContextSpec({
    spec: {
      paths: {
        '/items/{id}': {
          patch: {
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string' },
              },
              { name: 'If-Match', in: 'header', schema: { type: 'string' } },
            ],
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { name: { type: 'string' } },
                  },
                },
              },
            },
            responses: { '200': { description: 'ok' } },
          },
        },
      },
    },
    output: { target: '/project/src/handlers.ts', headers: true },
  });

  const updateItem = createTestGeneratorVerbOptions({
    verb: 'patch',
    operationName: 'updateItem',
    typeName: 'updateItem',
    override: generateAllZodSchemas,
    route: '/items/${id}',
    pathRoute: '/items/{id}',
    params: [
      {
        name: 'id',
        definition: 'id: string',
        implementation: 'id: string',
        default: undefined,
        required: true,
        imports: [],
      },
    ],
    body: {
      definition: 'UpdateItemBody',
      implementation: 'updateItemBody',
      isOptional: true,
    },
    headers: {
      schema: { name: 'UpdateItemHeaders', model: '', imports: [] },
      deps: [],
      isOptional: true,
    },
    props: [
      {
        name: 'id',
        definition: 'id: string',
        implementation: 'id: string',
        default: undefined,
        required: true,
        type: GetterPropType.PARAM,
      },
      {
        name: 'updateItemBody',
        definition: 'updateItemBody?: UpdateItemBody',
        implementation: 'updateItemBody?: UpdateItemBody',
        default: undefined,
        required: false,
        type: GetterPropType.BODY,
      },
      {
        name: 'headers',
        definition: 'headers?: UpdateItemHeaders',
        implementation: 'headers?: UpdateItemHeaders',
        default: undefined,
        required: false,
        type: GetterPropType.HEADER,
      },
    ],
  });

  it('passes the headers to the client before the request options', async () => {
    const { implementation } = await generateMcp(
      updateItem,
      {
        route: updateItem.route,
        pathRoute: updateItem.pathRoute,
        override: headerContext.output.override,
        context: headerContext,
        output: headerContext.output.target,
      },
      'mcp',
    );

    expect(implementation).toContain('  headerParams?: UpdateItemHeaders;');
    expect(implementation).toContain(
      'await updateItem(args.pathParams.id, args.bodyParams, args.headerParams, options);',
    );
  });

  it('adds the header schema to the tool input', async () => {
    const files = await generateExtraFiles(
      { updateItem },
      headerContext.output,
      headerContext,
    );
    const zodFile = files.find((file) =>
      file.path.endsWith('tool-schemas.zod.ts'),
    );

    expect(zodFile?.content).toContain('export const UpdateItemHeader = ');
    expect(zodFile?.content).toContain(
      'export const UpdateItemInput = zod.object({\n  pathParams: UpdateItemParams,\n  headerParams: UpdateItemHeader.optional(),\n  bodyParams: UpdateItemBody.optional(),\n});',
    );
  });

  it('keeps the header input required when the client requires it', async () => {
    const requiredContext = createTestContextSpec({
      spec: headerContext.spec,
      output: {
        target: '/project/src/handlers.ts',
        headers: true,
        optionsParamRequired: true,
      },
    });

    const { implementation } = await generateMcp(
      updateItem,
      {
        route: updateItem.route,
        pathRoute: updateItem.pathRoute,
        override: requiredContext.output.override,
        context: requiredContext,
        output: requiredContext.output.target,
      },
      'mcp',
    );
    const files = await generateExtraFiles(
      { updateItem },
      requiredContext.output,
      requiredContext,
    );
    const zodFile = files.find((file) =>
      file.path.endsWith('tool-schemas.zod.ts'),
    );

    expect(implementation).toContain('  headerParams: UpdateItemHeaders;');
    expect(zodFile?.content).toContain('  headerParams: UpdateItemHeader,\n');
  });

  it('passes a defaulted path param after a required header', async () => {
    const versionParam = {
      name: 'version',
      definition: 'version?: number',
      implementation: 'version: number = 1',
      default: 1,
      required: true,
      imports: [],
    };
    const getItem = createTestGeneratorVerbOptions({
      verb: 'get',
      operationName: 'getItem',
      typeName: 'getItem',
      route: '/items/${version}',
      pathRoute: '/items/{version}',
      params: [versionParam],
      headers: {
        schema: { name: 'GetItemHeaders', model: '', imports: [] },
        deps: [],
        isOptional: false,
      },
      props: [
        {
          name: 'headers',
          definition: 'headers: GetItemHeaders',
          implementation: 'headers: GetItemHeaders',
          default: undefined,
          required: true,
          type: GetterPropType.HEADER,
        },
        { ...versionParam, type: GetterPropType.PARAM },
      ],
    });

    const { implementation } = await generateMcp(
      getItem,
      {
        route: getItem.route,
        pathRoute: getItem.pathRoute,
        override: headerContext.output.override,
        context: headerContext,
        output: headerContext.output.target,
      },
      'mcp',
    );

    expect(implementation).toContain(
      'await getItem(args.headerParams, args.pathParams.version, options);',
    );
  });
});
