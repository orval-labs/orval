/**
 * Self-contained helpers emitted once per generated file when
 * `runtimeValidation.standardSchema` is on. They only use the `~standard`
 * interface of the schema value, so no runtime import is needed. The input
 * type is structural, which keeps `@standard-schema/spec` out of the output.
 *
 * Every global is spelled out structurally or through `globalThis`: a spec
 * schema named `Error`, `String` and the like is imported into the same file
 * and would shadow the global. Function declarations keep the output valid in
 * `.tsx` files, where an arrow generic `<O>(` does not parse.
 *
 * Validation must be synchronous: an async schema fails loudly.
 */
const STANDARD_SCHEMA_SAFE_HELPER = `type StandardSchemaIssue = {
  readonly message: string;
  readonly path?:
    | readonly (string | number | symbol | { readonly key: string | number | symbol })[]
    | undefined;
};
type StandardSchemaResult<O> =
  | { readonly value: O; readonly issues?: undefined }
  | { readonly issues: readonly StandardSchemaIssue[] };
type StandardSchemaPending = {
  readonly then: (onFulfilled: undefined, onRejected: () => void) => unknown;
};
type StandardSchemaLike<O> = {
  readonly '~standard': {
    readonly validate: (
      value: unknown,
    ) => StandardSchemaResult<O> | StandardSchemaPending;
    readonly types?: { readonly output: O } | undefined;
  };
};
type StandardSchemaError = globalThis.Error & {
  issues: readonly StandardSchemaIssue[];
};

function safeParseStandardSchema<O>(
  schema: StandardSchemaLike<O>,
  value: unknown,
):
  | { success: true; data: O }
  | { success: false; error: StandardSchemaError } {
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

const STANDARD_SCHEMA_PARSE_HELPER = `function parseStandardSchema<O>(
  schema: StandardSchemaLike<O>,
  value: unknown,
): O {
  const result = safeParseStandardSchema(schema, value);
  if (!result.success) throw result.error;
  return result.data;
}
`;

/**
 * Whether generated code calls the Standard Schema helpers, so a file only
 * declares them when a validation call needs them.
 */
const usesStandardSchemaHelper = (implementation: string): boolean =>
  implementation.includes('ParseStandardSchema(') ||
  implementation.includes('parseStandardSchema(');

/**
 * The helper declarations a generated file needs: the safe variant always (the
 * `both` strategy and the throwing variant use it), the throwing variant only
 * when called, so no unused local is emitted.
 */
export const getStandardSchemaHelper = (implementation: string): string =>
  !usesStandardSchemaHelper(implementation)
    ? ''
    : STANDARD_SCHEMA_SAFE_HELPER +
      (/(?<![A-Za-z])parseStandardSchema\(/.test(implementation)
        ? `\n${STANDARD_SCHEMA_PARSE_HELPER}`
        : '');
