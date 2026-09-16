import type {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';

export type CreateMcpServer = (options?: RequestInit) => {
  server: McpServer;
  tools: Record<string, RegisteredTool>;
};

// Captured from the generated server.ts so mcp-runtime.spec.ts can boot it.
export let createMcpServer: CreateMcpServer | undefined;

export const customServer = (factory: CreateMcpServer) => {
  createMcpServer = factory;
};
