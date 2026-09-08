import { camel } from './case';

/**
 * Returns `name` or the first deterministic numeric suffix not in
 * `reservedNames`.
 */
export function getUniqueName(
  name: string,
  reservedNames: ReadonlySet<string>,
): string {
  let candidate = name;
  let index = 2;

  while (reservedNames.has(candidate)) {
    candidate = `${name}${index}`;
    index += 1;
  }

  return candidate;
}

/**
 * Resolves URL helper names while reserving every generated operation name.
 * The returned names correspond to `helperOperationNames` in order.
 */
export function getOperationUrlHelperNames(
  operationNames: readonly string[],
  helperOperationNames: readonly string[],
): string[] {
  const reservedNames = new Set(operationNames);

  return helperOperationNames.map((operationName) => {
    const helperName = getUniqueName(
      camel(`get-${operationName}-url`),
      reservedNames,
    );
    reservedNames.add(helperName);
    return helperName;
  });
}
