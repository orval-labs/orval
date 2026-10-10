import { createMcpHonoApp } from '@modelcontextprotocol/hono';
import {
  type McpServer,
  type RegisteredTool,
  WebStandardStreamableHTTPServerTransport,
} from '@modelcontextprotocol/server';

// `createMcpHonoApp` parses JSON bodies into this variable.
declare module 'hono' {
  interface ContextVariableMap {
    parsedBody?: unknown;
  }
}

export const customServer = (
  createMcpServer: () => {
    server: McpServer;
    tools: Record<string, RegisteredTool>;
  },
) => {
  const app = createMcpHonoApp();

  app.all('/mcp', async (c) => {
    // Stateless: a fresh server and transport per request.
    const { server } = createMcpServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    return transport.handleRequest(c.req.raw, {
      parsedBody: c.get('parsedBody'),
    });
  });

  Bun.serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) });
};
