type StandardIssue = {
  message: string;
  path?: readonly (PropertyKey | { key: PropertyKey })[];
};

type StandardResult =
  | { value: unknown; issues?: undefined }
  | { issues: readonly StandardIssue[] };

type StandardSchema = {
  '~standard': {
    validate: (value: unknown) => StandardResult | Promise<StandardResult>;
  };
};

// Prefixes the message with the field path, such as `id: Invalid type`.
const formatIssue = ({ message, path = [] }: StandardIssue): string => {
  const keys = path.map((item) =>
    String(typeof item === 'object' ? item.key : item),
  );
  return keys.length > 0 ? `${keys.join('.')}: ${message}` : message;
};

// An empty body, as of a 204, has nothing to parse. A body that is not JSON,
// such as an HTML error page, is kept as text unless the response succeeded.
const parseBody = (text: string, ok: boolean): unknown => {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch (error) {
    if (ok) throw error;
    return text;
  }
};

// Receives the response schema from the generated client and validates the
// body through `~standard`, so it works with any Standard Schema library,
// such as Valibot or Effect. The schema describes the success response, so an
// error body is returned as is.
export const standardSchemaFetch = async <T>(
  url: string,
  options: RequestInit & { schema?: StandardSchema },
): Promise<T> => {
  const { schema, ...init } = options;
  const response = await fetch(url, init);
  const body = parseBody(await response.text(), response.ok);

  const result =
    schema && response.ok
      ? await schema['~standard'].validate(body)
      : { value: body };
  if (result.issues) {
    throw new Error(result.issues.map(formatIssue).join('; '));
  }

  return {
    data: result.value,
    status: response.status,
    headers: response.headers,
  } as T;
};
