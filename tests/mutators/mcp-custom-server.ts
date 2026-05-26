import type {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';

export const customServer = (
  _createMcpServer: () => {
    server: McpServer;
    tools: Record<string, RegisteredTool>;
  },
) => {
  // Custom server implementation (e.g. Streamable HTTP transport)
  // Users can call createMcpServer() per-request for stateless HTTP mode
};
