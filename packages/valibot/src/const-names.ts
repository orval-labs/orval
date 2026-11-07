const withSuffix = (baseName: string, attempt: number): string => {
  if (attempt === 0) return baseName;
  return attempt === 1
    ? `${baseName}Schema`
    : `${baseName}Schema${attempt - 1}`;
};

/** A name no component or earlier constant uses; it is added to `taken`. */
export const allocateConstName = (
  baseName: string,
  taken: Set<string>,
): string => {
  let attempt = 0;
  while (taken.has(withSuffix(baseName, attempt))) attempt += 1;
  const name = withSuffix(baseName, attempt);
  taken.add(name);
  return name;
};
