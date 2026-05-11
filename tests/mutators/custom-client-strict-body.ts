// Stricter BodyType<T> fixture used to prove that all generated Query
// helpers (hook signature, getXxxQueryOptions, getXxxQueryKey,
// setQueryData / getQueryData) wrap the body type with the mutator's
// BodyType<T>. The required `metadata` field makes plain `T` non-assignable
// to `BodyType<T>`, so any helper that still emits the raw body type
// would fail to compile and produce a visible snapshot diff.

export const customClientStrictBody = async <ResponseType>({
  url,
  method,
  params,
  data,
}: {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  params?: Record<string, string>;
  data?: BodyType<unknown>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}) => {
  const response = await fetch(url + new URLSearchParams(params), {
    method,
    headers: data?.metadata?.headers,
    ...(data ? { body: JSON.stringify(data.payload) } : {}),
  });

  return (await response.json()) as ResponseType;
};

export default customClientStrictBody;

export type ErrorType<ErrorData> = ErrorData;

// Strictly required envelope so a plain `T` is NOT assignable.
export type BodyType<BodyData> = {
  payload: BodyData;
  metadata: { traceId: string; headers?: Record<string, string> };
};
