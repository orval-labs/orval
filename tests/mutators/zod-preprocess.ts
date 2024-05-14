export const stripNill = (object: unknown) =>
  !!object && typeof object === 'object' && !Array.isArray(object)
    ? Object.fromEntries(
        Object.entries(object).filter(
          ([_, value]) => value !== null && value !== undefined,
        ),
      )
    : object;
