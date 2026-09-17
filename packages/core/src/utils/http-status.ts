import type { SharedTypeDeclaration } from '../types';

const WILDCARD_STATUS_CODE_REGEX = /^[1-5]XX$/i;
const EXACT_STATUS_CODE_REGEX = /^[1-5]\d{2}$/;

/**
 * Refuses an OpenAPI response key that is not a status code.
 *
 * A response key reaches generated source in unquoted positions — a TypeScript
 * type (`status: <key>`) in the fetch and axios clients, and a runtime
 * expression (`response.status === <key>`) in the axios empty-response
 * normalization. There is no quote to escape in either, so a key like
 * `2 || <expression>` or `number }; <statement>; type _ = { _z: number` is
 * spliced in as live code rather than data. Parse it, and refuse the document
 * rather than emitting whatever it says.
 *
 * The spec validator rejects such keys, but `input.unsafeDisableValidation`
 * turns it off, so the check has to sit at the emission point to be worth
 * anything. This mirrors `assertSafeStatusCode` in the mock generator, which
 * guards the structurally identical sink unconditionally for the same reason.
 *
 * `default` is deliberately refused: it is a valid spec key but not a valid
 * status expression, and every caller resolves it to its own construct
 * (`Exclude<HTTPStatusCodes, …>`) before reaching an emission sink.
 *
 * @see GHSA-rw75-cc5p-q7c9 (fetch/axios type position)
 * @see GHSA-4j53-7m38-656f (axios runtime condition)
 */
export const assertSafeResponseStatusKey = (key: string): string => {
  if (WILDCARD_STATUS_CODE_REGEX.test(key) || EXACT_STATUS_CODE_REGEX.test(key))
    return key;

  throw new Error(
    `orval: refusing to generate code for an OpenAPI response key that is not a status code (got "${key}"). This value would otherwise be emitted verbatim into generated source.`,
  );
};

export const getStatusCodeType = (key: string, responseKeys: string[] = []) => {
  if (WILDCARD_STATUS_CODE_REGEX.test(key)) {
    const wildcardType = `HTTPStatusCode${key[0]}xx`;
    const exactStatuses = [
      ...new Set(
        responseKeys.filter(
          (responseKey) =>
            EXACT_STATUS_CODE_REGEX.test(responseKey) &&
            responseKey[0] === key[0],
        ),
      ),
    ];

    return exactStatuses.length
      ? `Exclude<${wildcardType}, ${exactStatuses.join(' | ')}>`
      : wildcardType;
  }
  return assertSafeResponseStatusKey(key);
};

export const HTTP_STATUS_CODE_SHARED_TYPES: SharedTypeDeclaration[] = [
  {
    name: 'HTTPStatusCode1xx',
    exported: true,
    code: 'type HTTPStatusCode1xx = 100 | 101 | 102 | 103;',
  },
  {
    name: 'HTTPStatusCode2xx',
    exported: true,
    code: 'type HTTPStatusCode2xx = 200 | 201 | 202 | 203 | 204 | 205 | 206 | 207;',
  },
  {
    name: 'HTTPStatusCode3xx',
    exported: true,
    code: 'type HTTPStatusCode3xx = 300 | 301 | 302 | 303 | 304 | 305 | 307 | 308;',
  },
  {
    name: 'HTTPStatusCode4xx',
    exported: true,
    code: 'type HTTPStatusCode4xx = 400 | 401 | 402 | 403 | 404 | 405 | 406 | 407 | 408 | 409 | 410 | 411 | 412 | 413 | 414 | 415 | 416 | 417 | 418 | 419 | 420 | 421 | 422 | 423 | 424 | 426 | 428 | 429 | 431 | 451;',
  },
  {
    name: 'HTTPStatusCode5xx',
    exported: true,
    code: 'type HTTPStatusCode5xx = 500 | 501 | 502 | 503 | 504 | 505 | 507 | 511;',
  },
  {
    name: 'HTTPStatusCodes',
    exported: true,
    code: 'type HTTPStatusCodes = HTTPStatusCode1xx | HTTPStatusCode2xx | HTTPStatusCode3xx | HTTPStatusCode4xx | HTTPStatusCode5xx;',
  },
];

export const needsHttpStatusCodeTypes = (implementation: string) =>
  /HTTPStatusCode[1-5]xx|<HTTPStatusCodes,/.test(implementation);

/**
 * Builds a boolean expression that is true when `accessor` holds a status
 * matching the OpenAPI response `key`, given every key the operation declares.
 *
 * A wildcard (`2XX`) excludes exact statuses declared in the same class, since
 * those have their own responses; `default` is the negation of every other
 * declared key. Exact and wildcard keys go through
 * `assertSafeResponseStatusKey`, because the result is emitted as live code.
 */
export const getResponseStatusCondition = ({
  key,
  declaredKeys,
  accessor,
}: {
  key: string;
  declaredKeys: readonly string[];
  accessor: string;
}): string => {
  const exactStatuses = declaredKeys.filter((declared) =>
    EXACT_STATUS_CODE_REGEX.test(declared),
  );

  const conditionFor = (statusKey: string) => {
    if (WILDCARD_STATUS_CODE_REGEX.test(statusKey)) {
      const start = Number(statusKey[0]) * 100;
      const exclusions = exactStatuses
        .filter((status) => status[0] === statusKey[0])
        .map((status) => `${accessor} !== ${status}`)
        .join(' && ');
      return `${accessor} >= ${start} && ${accessor} < ${start + 100}${
        exclusions ? ` && ${exclusions}` : ''
      }`;
    }
    return `${accessor} === ${assertSafeResponseStatusKey(statusKey)}`;
  };

  if (key === 'default') {
    const declaredConditions = declaredKeys
      .filter((declared) => declared !== 'default')
      .map(conditionFor);
    return declaredConditions.length
      ? `!(${declaredConditions.join(' || ')})`
      : 'true';
  }

  return conditionFor(key);
};
