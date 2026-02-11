import { useCallback } from 'react';

export function useCustomFetch() {
  return useCallback(
    async <T>(url: string, options?: RequestInit): Promise<T> => {
      const headers = new Headers(options?.headers);
      const response = await fetch(url, {
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
