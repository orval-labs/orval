import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type {
  CallToolResult,
  ServerNotification,
  ServerRequest,
} from '@modelcontextprotocol/sdk/types.js';

export const customHandler = async (
  fetcher: (
    overrides?: RequestInit,
  ) => Promise<{ status: number; data: unknown; headers: Headers }>,
  ctx?: RequestHandlerExtra<ServerRequest, ServerNotification>,
): Promise<CallToolResult> => {
  const res = await fetcher();
  const text = JSON.stringify(res.data ?? null);

  if (res.status >= 400) {
    return {
      content: [{ type: 'text', text: `[${ctx?.requestId}] ${text}` }],
      isError: true,
    };
  }

  return {
    content: [{ type: 'text', text }],
    structuredContent: res.data as Record<string, unknown>,
  };
};
