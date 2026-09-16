import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vite-plus/test';

// Drives the generated petstore server through the SDK client so the round
// trip includes the SDK's output validation on both sides.

const pets = [
  { id: 1, name: 'Rex', tag: 'dog' },
  { id: 2, name: 'Tom', tag: 'cat' },
];
const owner = { tag: 'friendly', pet: null };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const fetchStub = vi.fn(
  async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const pathname = url.split('?')[0];
    const method = (init?.method ?? 'GET').toUpperCase();

    if (method === 'GET' && pathname === '/pets') return json(pets);
    if (method === 'GET' && pathname === '/pets/1/owner') return json(owner);
    if (method === 'DELETE' && pathname === '/pets/1') {
      return new Response(null, { status: 204 });
    }
    if (method === 'GET' && pathname === '/health') {
      return new Response('ok', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      });
    }

    return json({ code: 404, message: `no stub for ${method} ${pathname}` }, 404);
  },
);

const textOf = (result: CallToolResult): string => {
  const [first] = result.content;
  if (first?.type !== 'text') {
    throw new Error(`expected a text content block, got ${first?.type}`);
  }
  return first.text;
};

describe('generated MCP server on an in-memory transport', () => {
  let server: McpServer;
  let client: Client;

  beforeAll(async () => {
    vi.stubGlobal('fetch', fetchStub);

    // Importing the generated module runs `customServer(createMcpServer)`.
    await import('./generated/mcp/custom-server/server');
    const { createMcpServer } = await import('./mutators/mcp-custom-server');
    if (!createMcpServer) {
      throw new Error('generated server.ts did not call customServer()');
    }

    ({ server } = createMcpServer());
    client = new Client({ name: 'orval-tests', version: '1.0.0' });

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
  });

  afterAll(async () => {
    await client.close();
    await server.close();
    vi.unstubAllGlobals();
  });

  it('declares outputSchema only for tools whose response is a plain object', async () => {
    const { tools } = await client.listTools();
    const byName = new Map(tools.map((tool) => [tool.name, tool]));

    expect(byName.get('showPetWithOwner')?.outputSchema?.type).toBe('object');

    for (const name of [
      'listPets',
      'createPets',
      'showPetById',
      'deletePetById',
      'healthCheck',
    ]) {
      expect(byName.get(name)?.outputSchema, name).toBeUndefined();
    }
  });

  it('returns an array response as text without structuredContent', async () => {
    const result = (await client.callTool({
      name: 'listPets',
      arguments: { queryParams: { sort: 'name' } },
    })) as CallToolResult;

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toBeUndefined();
    expect(JSON.parse(textOf(result))).toEqual(pets);
  });

  it('returns an object response as structuredContent', async () => {
    const result = (await client.callTool({
      name: 'showPetWithOwner',
      arguments: { pathParams: { petId: '1' } },
    })) as CallToolResult;

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual(owner);
    expect(JSON.parse(textOf(result))).toEqual(owner);
  });

  it('returns a 204 response without error', async () => {
    const result = (await client.callTool({
      name: 'deletePetById',
      arguments: { pathParams: { petId: '1' } },
    })) as CallToolResult;

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toBeUndefined();
  });

  it('returns a text/plain response as text', async () => {
    const result = (await client.callTool({
      name: 'healthCheck',
      arguments: {},
    })) as CallToolResult;

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toBeUndefined();
    expect(textOf(result)).toBe('"ok"');
  });
});
