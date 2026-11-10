type StandardResult =
  | { value: unknown; issues?: undefined }
  | { issues: readonly { message: string }[] };

interface StandardSchema {
  '~standard': {
    validate: (value: unknown) => StandardResult | Promise<StandardResult>;
  };
}

// Validates through `~standard`, so it works with any validator.
export const schemaFetch = async <T>(
  url: string,
  options: RequestInit & { schema?: StandardSchema },
): Promise<T> => {
  const response = await fetch(url, options);
  const data: unknown = await response.json();
  const result = options.schema
    ? await options.schema['~standard'].validate(data)
    : { value: data };
  if (result.issues) throw new Error(result.issues[0].message);
  return { data: result.value, status: response.status } as T;
};
