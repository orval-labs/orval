export const customClient = async <ResponseType>({
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
    headers: data?.headers,
    ...(data ? { body: JSON.stringify(data) } : {}),
  });

  return (await response.json()) as ResponseType;
};

export default customClient;

export type ErrorType<ErrorData> = ErrorData;

export type BodyType<BodyData> = BodyData & { headers?: any };
