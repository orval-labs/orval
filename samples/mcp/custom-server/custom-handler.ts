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
  ctx: RequestHandlerExtra<ServerRequest, ServerNotification>,
  toStructuredContent: (
    data: unknown,
  ) =>
    | { success: true; data: Record<string, unknown> | undefined }
    | { success: false; error: { message: string } },
): Promise<CallToolResult> => {
  const res = await fetcher({
    headers: ctx.sessionId ? { 'Mcp-Session-Id': ctx.sessionId } : undefined,
  });
  const text = JSON.stringify(res.data ?? null);

  if (res.status >= 400) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            requestId: ctx.requestId,
            status: res.status,
            error: res.data ?? null,
          }),
        },
      ],
      isError: true,
    };
  }

  const result = toStructuredContent(res.data);

  return result.success
    ? { content: [{ type: 'text', text }], structuredContent: result.data }
    : {
        content: [
          { type: 'text', text },
          { type: 'text', text: result.error.message },
        ],
        isError: true,
      };
};
