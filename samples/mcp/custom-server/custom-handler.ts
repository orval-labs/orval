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
  const res = await fetcher({
    headers: ctx?.sessionId ? { 'Mcp-Session-Id': ctx.sessionId } : undefined,
  });

  if (res.status >= 400) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            requestId: ctx?.requestId,
            status: res.status,
            error: res.data ?? null,
          }),
        },
      ],
      isError: true,
    };
  }

  const data = res.data;

  return {
    content: [{ type: 'text', text: JSON.stringify(data ?? null) }],
    structuredContent:
      typeof data === 'object' && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : undefined,
  };
};
