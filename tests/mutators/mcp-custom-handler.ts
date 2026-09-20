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
  const res = await fetcher();
  const text = JSON.stringify(res.data ?? null);

  if (res.status >= 400) {
    return {
      content: [{ type: 'text', text: `[${ctx.requestId}] ${text}` }],
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
