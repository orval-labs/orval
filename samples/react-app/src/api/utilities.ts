export const createApiError = <T extends any>(error?: T): T => {
  return ({
    code: 'INTERNALSERVERERROR',
    message: '',
    ...error,
  } as any) as T;
};

export type HttpResponse<V, E extends any> = [E | null, V | undefined];
/**
 * Handling Promise error for axios
 * @param promise
 */
export function httpTo<V, E extends any>(
  promise: Promise<V>,
): Promise<HttpResponse<V, E>> {
  return promise
    .then<[null, V]>((data) => [null, data])
    .catch<[E, undefined]>((error: E) => {
      return [createApiError(error), undefined];
    });
}
