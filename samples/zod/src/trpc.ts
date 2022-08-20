import { createReactQueryHooks } from '@trpc/react';
import type { AppRouter } from './api/router';

export const {
  useQuery,
  useMutation,
  createClient,
  Provider: TrpcProvider,
} = createReactQueryHooks<AppRouter>();
