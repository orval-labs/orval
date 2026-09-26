export const useCustomFetch = () => {
  return async <T>(url: string, options: RequestInit): Promise<T> => {
    const response = await fetch(url, options);
    const body = [204, 205, 304].includes(response.status)
      ? null
      : await response.text();

    return {
      status: response.status,
      data: body ? (JSON.parse(body) as unknown) : {},
      headers: response.headers,
    } as T;
  };
};

export default useCustomFetch;
