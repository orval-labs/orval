import type {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPTransport } from '@hono/mcp';
import { Hono } from 'hono';

export const customServer = (
  createMcpServer: () => {
    server: McpServer;
    tools: Record<string, RegisteredTool>;
  },
) => {
  const app = new Hono();

  const { server } = createMcpServer();
  const transport = new StreamableHTTPTransport();

  app.all('/mcp', async (c) => {
    if (!server.isConnected()) {
      await server.connect(transport);
    }
    return transport.handleRequest(c);
  });

  Bun.serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) });
};
