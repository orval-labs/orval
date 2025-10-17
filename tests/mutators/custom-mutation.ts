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
  if (operation.operationId === 'deletePetById') {
    queryClient.invalidateQueries({ queryKey: ['/pets'] });
  }
  return options;
};
