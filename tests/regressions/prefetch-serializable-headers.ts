import type { listPetsResponseSuccess } from '../generated/react-query/prefetch-serializable-headers/endpoints';

declare const response: listPetsResponseSuccess;

// With `serializeResponseHeaders`, headers are a plain object, so a query cache
// built from the response survives `dehydrate()`.
const headers: Record<string, string> = response.headers;
void headers;

// @ts-expect-error - headers must not be a `Headers` instance.
response.headers.get('content-type');
