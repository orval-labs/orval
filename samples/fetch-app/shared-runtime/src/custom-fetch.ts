// A global mutator: the store output sends every request through it, and the
// shared runtime passes the URL and the prepared `RequestInit` unchanged.
export const customFetch = async <T>(
  url: string,
  options: RequestInit,
): Promise<T> => {
  const headers = new Headers(options.headers);
  headers.set('Authorization', 'Bearer sample-token');

  const res = await fetch(url, { ...options, headers });
  const body = [204, 205, 304].includes(res.status) ? '' : await res.text();
  const data: unknown = body ? JSON.parse(body) : undefined;

  return { data, status: res.status, headers: res.headers } as T;
};
