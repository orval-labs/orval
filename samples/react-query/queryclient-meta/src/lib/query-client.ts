import { QueryClient } from '@tanstack/react-query';
import { axiosInstance } from './axios';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      meta: { axiosInstance },
    },
    mutations: {
      meta: { axiosInstance },
    },
  },
});
