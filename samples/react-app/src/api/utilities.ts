export const createApiError = <T extends {}>(error?: T): T => {
  return {
    code: 'INTERNALSERVERERROR',
    message: '',
    ...error,
  } as any as T;
};
