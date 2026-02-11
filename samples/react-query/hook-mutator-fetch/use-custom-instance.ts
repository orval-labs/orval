import { useCallback, useState } from 'react';

export function useGetBaseUrl() {
  const [baseUrl] = useState('')
  return baseUrl;
}

export function useCustomFetch() {
  const baseUrl = useGetBaseUrl();
  return useCallback(
    async <T>(url: string, options?: RequestInit): Promise<T> => {
      const headers = new Headers(options?.headers);
      const response = await fetch(`${baseUrl}${url}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    },
    [],
  );
}
