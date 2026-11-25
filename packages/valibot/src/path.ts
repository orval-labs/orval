/** The place of a schema: where it is used, then the chain down to it. */
export const joinPath = (
  path: string | undefined,
  segment: string | undefined,
): string | undefined =>
  segment === undefined
    ? path
    : path === undefined
      ? segment
      : `${path} > ${segment}`;
