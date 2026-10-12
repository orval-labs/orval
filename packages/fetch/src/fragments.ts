/**
 * Source shared verbatim between the inline emitter and the shared runtime
 * template, so a fix lands in both implementations at once.
 */

// `RequestInit['headers']` is declared per runtime, and the old narrowing
// chain only fitted the DOM's declaration, leaving `return h` unsound in two
// separate ways:
//
//  - Outside the DOM the non-record member need not be an array —
//    `@cloudflare/workers-types` uses `Iterable<Iterable<string>>`, which
//    `Array.isArray` cannot exclude (#4034). Narrowing on iterability covers
//    every declaration, since the record is the only non-iterable member.
//    That also fixes the runtime half: spreading an iterable as an object
//    silently dropped every header. Each entry is materialized because
//    `Object.fromEntries` reads `[0]`/`[1]` rather than iterating, so a
//    non-indexable entry (`new Set([new Set(['X-Trace', '1'])])`) would
//    otherwise yield a single `undefined` key and lose the real header.
//  - The record member's values are not always `string`. Hono's header
//    record admits `undefined` (#4029), which the declared return type does
//    not. Building the result entry by entry keeps that guarantee by
//    construction, and skipping the `undefined` values is what the caller
//    wants anyway: passed through, they reach the wire as the literal text
//    "undefined".
export const GET_HEADERS_HELPER = `  const getHeaders = (h?: NonNullable<RequestInit['headers']>): Record<string, string | readonly string[]> => {
    if (!h) return {};
    if (h instanceof Headers) return Object.fromEntries(h.entries());
    if (Symbol.iterator in h) {
      return Object.fromEntries(
        Array.from(h as Iterable<Iterable<string>>, (entry) => Array.from(entry) as [string, string]),
      );
    }
    const headers: Record<string, string | readonly string[]> = {};
    for (const [name, value] of Object.entries<string | readonly string[] | undefined>(h)) {
      if (value !== undefined) headers[name] = value;
    }
    return headers;
  };
`;
