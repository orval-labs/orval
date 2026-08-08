import { UseMutationOptions, useQueryClient } from '@tanstack/react-query';

export const useCustomMutation = <T, TError, TData, TContext>(
  options: UseMutationOptions<T, TError, TData, TContext> &
    Required<
      Pick<UseMutationOptions<T, TError, TData, TContext>, 'mutationFn'>
    >,
  _: { url: string },
  operation: { operationId: string; operationName: string },
) => {
  const queryClient = useQueryClient();

  if (operation.operationId !== 'deletePetById') {
    return options;
  }

  // Invalidate after the mutation settles, not while the hook renders. The
  // generated options function calls this mutator on every render, so an
  // invalidation in the body refetches `/pets` on each one, and the refetch
  // re-renders.
  return {
    ...options,
    onSuccess: async (data: T, variables: TData, context: TContext) => {
      // `onSuccess` may return a promise, and the mutation waits for it, so
      // awaiting the invalidation keeps the mutation pending until `/pets` is
      // refreshed instead of settling while the refetch is still in flight.
      await queryClient.invalidateQueries({ queryKey: ['/pets'] });
      return options.onSuccess?.(data, variables, context);
    },
  };
};
