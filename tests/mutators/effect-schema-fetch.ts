import { Schema as S } from 'effect';

// NOTE: `override.includeZodSchemaInArguments` hands the mutator the Effect
// schema itself, so it decodes with Effect instead of going through `~standard`.
export const effectSchemaFetch = async <T>(
  url: string,
  options: RequestInit & { schema?: S.Decoder<unknown> },
): Promise<T> => {
  const { schema, ...init } = options;
  const response = await fetch(url, init);
  // An empty body, as of a 204, has nothing to parse.
  const text = await response.text();
  const data: unknown = text ? JSON.parse(text) : undefined;

  // The schema describes the success response, so an error body is returned as is.
  return {
    data: schema && response.ok ? S.decodeUnknownSync(schema)(data) : data,
    status: response.status,
    headers: response.headers,
  } as T;
};
