import type {
  CallToolResult,
  ServerContext,
} from '@modelcontextprotocol/server';

export const customHandler = async (
  fetcher: (
    overrides?: RequestInit,
  ) => Promise<{ status: number; data: unknown; headers: Headers }>,
  ctx: ServerContext,
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
      content: [{ type: 'text', text: `[${ctx.mcpReq.id}] ${text}` }],
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
