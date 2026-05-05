import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPTransport } from '@hono/mcp';
import { Hono } from 'hono';

export const customServer = (createMcpServer: () => McpServer) => {
  const app = new Hono();

  const server = createMcpServer();
  const transport = new StreamableHTTPTransport();

  app.all('/mcp', async (c) => {
    if (!server.isConnected()) {
      await server.connect(transport);
    }
    return transport.handleRequest(c);
  });

  Bun.serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) });
};
