/**
 * Self-contained helpers emitted once per generated file when
 * `runtimeValidation.standardSchema` is on. They only use the `~standard`
 * interface of the schema value, so no runtime import is needed. The input
 * type is structural, which keeps `@standard-schema/spec` out of the output.
 *
 * Every global is spelled out structurally or through `globalThis`: a spec
 * schema named `Error`, `String` and the like is imported into the same file
 * and would shadow the global. Function declarations keep the output valid in
 * `.tsx` files, where an arrow generic `<O>(` does not parse. Every top-level
 * name carries an `orval` prefix so a spec schema imported into the same file
 * cannot collide with it.
 *
 * Validation must be synchronous: an async schema fails loudly.
 */
/**
 * Names of the emitted functions. Call sites and the declarations are both
 * built from these, and the helper is detected by them.
 */
export const STANDARD_SCHEMA_PARSE_NAME = 'orvalParseStandardSchema';
export const STANDARD_SCHEMA_SAFE_PARSE_NAME = 'orvalSafeParseStandardSchema';

const PARSE_NAME = STANDARD_SCHEMA_PARSE_NAME;
const SAFE_NAME = STANDARD_SCHEMA_SAFE_PARSE_NAME;

const STANDARD_SCHEMA_SAFE_HELPER = `type OrvalStandardSchemaIssue = {
  readonly message: string;
  readonly path?:
    | readonly (string | number | symbol | { readonly key: string | number | symbol })[]
    | undefined;
};
type OrvalStandardSchemaResult<O> =
  | { readonly value: O; readonly issues?: undefined }
  | { readonly issues: readonly OrvalStandardSchemaIssue[] };
type OrvalStandardSchemaPending = {
  readonly then: (onFulfilled: undefined, onRejected: () => void) => unknown;
};
type OrvalStandardSchemaLike<O> = {
  readonly '~standard': {
    readonly validate: (
      value: unknown,
    ) => OrvalStandardSchemaResult<O> | OrvalStandardSchemaPending;
    readonly types?: { readonly output: O } | undefined;
  };
};
type OrvalStandardSchemaError = globalThis.Error & {
  issues: readonly OrvalStandardSchemaIssue[];
};

function ${SAFE_NAME}<O>(
  schema: OrvalStandardSchemaLike<O>,
  value: unknown,
):
  | { success: true; data: O }
  | { success: false; error: OrvalStandardSchemaError } {
  // Zod below 3.24 has no standard schema property.
  if (!('~standard' in schema)) {
    throw new globalThis.TypeError(
      'Schema does not implement Standard Schema (Zod 3.24 or newer is required)',
    );
  }
  const result = schema['~standard'].validate(value);
  if ('then' in result) {
    // Swallow the rejection so only the error below reaches the caller.
    result.then(undefined, () => {});
    throw new globalThis.TypeError('Async Standard Schema validation is not supported');
  }
  if (result.issues) {
    const message = result.issues
      .map(({ message, path }) => {
        const keys = (path ?? []).map((k) =>
          globalThis.String(typeof k === 'object' ? k.key : k),
        );
        return keys.length > 0 ? \`\${keys.join('.')}: \${message}\` : message;
      })
      .join('; ');
    return {
      success: false,
      error: globalThis.Object.assign(new globalThis.Error(message), {
        name: 'StandardSchemaError',
        issues: result.issues,
      }),
    };
  }
  return { success: true, data: result.value };
}
`;

const STANDARD_SCHEMA_PARSE_HELPER = `function ${PARSE_NAME}<O>(
  schema: OrvalStandardSchemaLike<O>,
  value: unknown,
): O {
  const result = ${SAFE_NAME}(schema, value);
  if (!result.success) throw result.error;
  return result.data;
}
`;

const callPattern = (name: string): RegExp =>
  new RegExp(`(?<![A-Za-z0-9_$])${name}\\(`);

// An operation description is emitted as a JSDoc block and may quote a call.
const JSDOC_BLOCK = /\/\*\*[\s\S]*?\*\//g;

/**
 * The helper declarations a generated file needs, from the calls its source
 * makes: the safe variant for any call (the throwing variant is built on it),
 * the throwing variant only when called, so no unused local is emitted.
 */
export const getStandardSchemaHelper = (implementation: string): string => {
  const code = implementation.replaceAll(JSDOC_BLOCK, '');
  const callsParse = callPattern(PARSE_NAME).test(code);
  const callsSafeParse = callPattern(SAFE_NAME).test(code);

  if (!callsParse && !callsSafeParse) return '';

  return callsParse
    ? `${STANDARD_SCHEMA_SAFE_HELPER}\n${STANDARD_SCHEMA_PARSE_HELPER}`
    : STANDARD_SCHEMA_SAFE_HELPER;
};
