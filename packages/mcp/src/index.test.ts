import { GetterPropType, type OpenApiInfoObject } from '@orval/core';
import { describe, expect, it } from 'vite-plus/test';

import {
  type CreateTestContextSpecOptions,
  createTestContextSpec,
  createTestGeneratorVerbOptions,
} from '../../core/src/test-utils';
import { generateExtraFiles, generateServer, getMcpHeader } from './index';

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
});

describe('McpServer instructions', () => {
  const generate = (override?: object, info?: OpenApiInfoObject) => {
    const instructionsContext = createTestContextSpec({
      spec: { ...spec, ...(info && { info }) },
      output: { target: '/project/src/handlers.ts', override },
    });
    const [{ content }] = generateServer(
      verbOptions,
      instructionsContext.output,
      instructionsContext,
    );
    return content;
  };

  it('emits the spec description followed by the tool conventions', () => {
    const content = generate(undefined, {
      title: 'Pets',
      version: '2.0.0',
      description: 'Pets API.\nSee https://example.com/docs\n',
    });

    expect(content).toContain(
      "instructions: 'Pets API.\\nSee https://example.com/docs\\n\\nEach tool wraps one REST operation of this API.",
    );
    expect(content).toContain(
      "new McpServer(\n    {\n      name: 'petsServer',\n      version: '2.0.0',\n    },\n    {\n      instructions:",
    );
  });

  it('emits only the tool conventions without a spec description', () => {
    expect(generate()).toContain(
      "instructions: 'Each tool wraps one REST operation of this API.",
    );
  });

  it('omits the server options when instructions is false', () => {
    const content = generate({ mcp: { instructions: false } });

    expect(content).toContain(
      "new McpServer({\n    name: 'testServer',\n    version: '1.0.0',\n  });",
    );
    expect(content).not.toContain('instructions');
  });

  it('uses a string verbatim and calls a function with the spec info', () => {
    expect(
      generate({ mcp: { instructions: "Use 'listPets' first." } }),
    ).toContain("instructions: 'Use \\'listPets\\' first.',");
    expect(
      generate({
        mcp: {
          instructions: (info: { title: string }) => `${info.title} tools`,
        },
      }),
    ).toContain("instructions: 'Test tools',");
  });
});

describe('McpServer cacheHints', () => {
  const generate = (mcp: object) => {
    const cacheHintsContext = createTestContextSpec({
      spec,
      output: { target: '/project/src/handlers.ts', override: { mcp } },
    });
    const [{ content }] = generateServer(
      verbOptions,
      cacheHintsContext.output,
      cacheHintsContext,
    );
    return content;
  };

  it('passes the hints through next to the instructions', () => {
    const content = generate({
      cacheHints: {
        'tools/list': { ttlMs: 3_600_000, cacheScope: 'public' },
        'server/discover': { ttlMs: 60_000 },
      },
    });

    expect(content).toContain(
      "instructions: 'Each tool wraps one REST operation of this API.",
    );
    expect(content).toContain(
      "cacheHints: { 'tools/list': { ttlMs: 3600000, cacheScope: 'public' }, 'server/discover': { ttlMs: 60000 } },",
    );
  });

  it('emits only the hints when instructions is false', () => {
    const content = generate({
      instructions: false,
      cacheHints: { 'tools/list': { cacheScope: 'private' } },
    });

    expect(content).toContain(
      "    {\n      cacheHints: { 'tools/list': { cacheScope: 'private' } },\n    },\n  );",
    );
    expect(content).not.toContain('instructions');
  });

  it('omits the hints by default', () => {
    expect(generate({})).not.toContain('cacheHints');
  });
});
