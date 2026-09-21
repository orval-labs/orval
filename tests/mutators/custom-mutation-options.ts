/**
 * A `mutationOptions` mutator that calls no hooks of its own, so that with
 * `useHooks: false` the generated `getXxxMutationOptions` factory can be
 * invoked straight from a test. It stamps the operation onto `meta` and is
 * otherwise a pass-through, which is what makes it useful for asserting that
 * everything the generator built — notably the `mutationInvalidates`
 * `onSuccess` handler of #4165 — actually reaches the mutator.
 */
export function customMutationOptions<T extends object>(
  options: T,
  _: { url: string },
  operation: { operationId: string; operationName: string },
): T & { meta: { operationId: string } } {
  return { ...options, meta: { operationId: operation.operationId } };
}
