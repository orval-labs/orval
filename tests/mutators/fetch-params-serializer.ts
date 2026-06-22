export const customParamsSerializer = (
  params: Record<string, unknown>,
): string =>
  new URLSearchParams(
    Object.entries(params ?? {}).flatMap(([k, v]) =>
      Array.isArray(v)
        ? v.map((item) => [k, String(item)])
        : [[k, String(v)]],
    ),
  ).toString();
