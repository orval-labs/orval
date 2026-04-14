import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export const customServer = (_createMcpServer: () => McpServer) => {
  // Custom server implementation (e.g. Streamable HTTP transport)
  // Users can call createMcpServer() per-request for stateless HTTP mode
};
