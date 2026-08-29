import type { ZodType } from 'zod';

// NOTE: The mutator owns the request, so it also owns the response validation.
// `override.includeZodSchemaInArguments` hands it the generated zod schema.
export const customFetch = async <T>(
  url: string,
  options: RequestInit & { schema?: ZodType },
): Promise<T> => {
  const { schema, ...init } = options;

  const response = await fetch(url, init);
  const data: unknown = await response.json();

  return (schema ? schema.parse(data) : data) as T;
};
