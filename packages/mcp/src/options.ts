import type { McpServerOptions as McpSdkServerOptions } from '@modelcontextprotocol/server';

export interface McpServerOptions {
  path: string;
  name?: string;
  default?: boolean;
}

export interface NormalizedMcpServerOptions {
  path: string;
  name?: string;
  default: boolean;
}

export interface McpHandlerOptions {
  path: string;
  name?: string;
  default?: boolean;
}

export interface NormalizedMcpHandlerOptions {
  path: string;
  name?: string;
  default: boolean;
}

export interface McpOptions {
  server?: McpServerOptions;
  handler?: McpHandlerOptions;
  /**
   * Cache hints the generated server attaches to list and read results on
   * MCP 2026-07-28 connections. Passed to `McpServer` as is; omitted by
   * default so the SDK's own default (`ttlMs: 0`, `private`) applies.
   *
   * The generated tool list is fixed at build time, so `tools/list` is a
   * typical candidate for `cacheScope: 'public'` with a TTL of a few minutes
   * to an hour. The server never sends `listChanged`, so a redeploy with new
   * tools becomes visible only once the TTL expires.
   */
  cacheHints?: McpSdkServerOptions['cacheHints'];
}

export interface NormalizedMcpOptions {
  server?: NormalizedMcpServerOptions;
  handler?: NormalizedMcpHandlerOptions;
  cacheHints?: McpSdkServerOptions['cacheHints'];
}
