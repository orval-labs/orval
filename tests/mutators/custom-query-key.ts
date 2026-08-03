const TENANT_KEY_PREFIX = 'tenant-abc';

export function customQueryKey(
  // The 1st arg is the queryProperties dictionary (params / petId / etc.),
  // which varies per operation — type it as a broad record so a single
  // mutator can handle every endpoint.
  properties: Record<string, unknown>,
  // Inside generated query options the 2nd arg also carries `queryOptions`;
  // the exported key factories and cache helpers pass only `url`.
  context: { url: string; queryOptions?: unknown },
) {
  return [TENANT_KEY_PREFIX, context.url, properties] as const;
}
