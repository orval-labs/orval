import type { QueryKey } from '@tanstack/react-query';

const TENANT_KEY_PREFIX = 'tenant-abc';

export function customQueryOptions<T extends { queryKey: QueryKey }>(
  options: T,
): T {
  return {
    ...options,
    queryKey: [TENANT_KEY_PREFIX, ...options.queryKey],
  };
}
