import type {
  AngularRuntimeValidation,
  GeneratorImport,
  NormalizedAngularRuntimeValidation,
  NormalizedOverrideOutput,
  NormalizedRuntimeValidation,
  RuntimeValidation,
  RuntimeValidationStrategy,
} from '../types';

/**
 * The syntactic shape a validation snippet has to take at the call site it is
 * spliced into. Each generator emits validation at one of these four shapes:
 *
 * - `rxjs-map`: a trailing `.pipe(map(...))` operator chained onto an observable
 *   (Angular `HttpClient`, `angular-query`). The mapped value is named `data`.
 * - `clone-expression`: a value expression injected into a larger expression
 *   such as `response.clone({ body: <here> })`. Multi-statement `both` bodies
 *   are IIFE-wrapped so they stay expressions.
 * - `fetch-assign`: a value expression assigned to `const data = <here>` inside
 *   the generated `fetch` function. Also IIFE-wrapped for `both`.
 * - `parse-fn`: the value of Angular `httpResource`'s native `parse:` option —
 *   `throw` emits a bare `Schema.parse` reference, `both` an arrow function.
 */
export type RuntimeValidationEmitContext =
  | 'rxjs-map'
  | 'clone-expression'
  | 'fetch-assign'
  | 'parse-fn';

export interface EmitResponseValidationOptions {
  /** Reference to the Zod schema value, e.g. `PetsSchema`. */
  schemaRef: string;
  /** Operation name, surfaced in the `both` strategy's `console.error` message. */
  operationName: string;
  strategy: RuntimeValidationStrategy;
  context: RuntimeValidationEmitContext;
  /**
   * Source expression to validate. Required for `clone-expression` and
   * `fetch-assign`; ignored for `rxjs-map` (always `data`) and `parse-fn`
   * (always the arrow's `raw` parameter).
   */
  inputExpression?: string;
}

/**
 * Builds the statement body shared by every `both` emission: `safeParse`, log
 * the raw `ZodError` for production visibility, then re-throw so the failure
 * still propagates through the client's native error channel.
 *
 * The raw `ZodError` is passed to `console.error` (no `prettifyError`/`flatten`)
 * to stay agnostic across Zod 3 and Zod 4.
 *
 * `operationName` is interpolated into a single-quoted string literal. The
 * default is a sanitized camelCase identifier, but `override.operationName` can
 * return arbitrary strings, so backslashes and single quotes are escaped to
 * keep the generated literal syntactically valid. Sanitized identifiers contain
 * neither character, so common output is unchanged.
 */
const escapeSingleQuoted = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const buildGuardBody = (
  schemaRef: string,
  operationName: string,
  input: string,
  subject: 'response' | 'request body' = 'response',
): string =>
  `const result = ${schemaRef}.safeParse(${input}); ` +
  `if (!result.success) { ` +
  `console.error('[orval] ${escapeSingleQuoted(operationName)} ${subject} validation failed', result.error); ` +
  `throw result.error; ` +
  `} ` +
  `return result.data;`;

/**
 * Emits the response-validation snippet for a single call site.
 *
 * The `throw` strategy is byte-identical to the historical inline
 * `Schema.parse(...)` emission, which keeps existing snapshots unchanged.
 */
export const emitResponseValidation = ({
  schemaRef,
  operationName,
  strategy,
  context,
  inputExpression,
}: EmitResponseValidationOptions): string => {
  switch (context) {
    case 'rxjs-map':
      return strategy === 'both'
        ? `.pipe(map(data => { ${buildGuardBody(schemaRef, operationName, 'data')} }))`
        : `.pipe(map(data => ${schemaRef}.parse(data)))`;

    case 'clone-expression':
    case 'fetch-assign': {
      if (inputExpression === undefined) {
        throw new Error(
          `emitResponseValidation: "${context}" requires an inputExpression`,
        );
      }
      return strategy === 'both'
        ? `(() => { ${buildGuardBody(schemaRef, operationName, inputExpression)} })()`
        : `${schemaRef}.parse(${inputExpression})`;
    }

    case 'parse-fn':
      return strategy === 'both'
        ? `(raw) => { ${buildGuardBody(schemaRef, operationName, 'raw')} }`
        : `${schemaRef}.parse`;
  }
};

export interface EmitRequestBodyValidationOptions {
  /** Reference to the Zod schema value, e.g. `CreatePetsBody`. */
  schemaRef: string;
  /** Operation name, surfaced in the `both` strategy's `console.error` message. */
  operationName: string;
  strategy: RuntimeValidationStrategy;
  /** The body argument to parse, e.g. `createPetsBody`. */
  inputExpression: string;
  /** An omitted optional body is passed through instead of parsed. */
  isOptional?: boolean;
}

/**
 * Emits an expression that parses a request body before it is sent. `throw`
 * is a bare `Schema.parse(...)`; `both` logs the raw `ZodError` and re-throws,
 * like its response counterpart.
 */
export const emitRequestBodyValidation = ({
  schemaRef,
  operationName,
  strategy,
  inputExpression,
  isOptional = false,
}: EmitRequestBodyValidationOptions): string => {
  const parse =
    strategy === 'both'
      ? `(() => { ${buildGuardBody(schemaRef, operationName, inputExpression, 'request body')} })()`
      : `${schemaRef}.parse(${inputExpression})`;

  return isOptional
    ? `${inputExpression} === undefined ? undefined : ${parse}`
    : parse;
};

/**
 * Normalizes the user-facing `runtimeValidation` config surface
 * (`boolean | { strategy }`) into the canonical `{ enabled, strategy }` object
 * consumed by the generators.
 *
 * Idempotent: an already-normalized value is returned unchanged, so it is safe
 * to call on an inherited (already-normalized) value — e.g. when a per-operation
 * `query` override inherits the normalized global default.
 */
export const normalizeRuntimeValidation = (
  value: RuntimeValidation | NormalizedRuntimeValidation | undefined,
): NormalizedRuntimeValidation => {
  if (!value) {
    return { enabled: false, strategy: 'throw' };
  }
  if (value === true) {
    return { enabled: true, strategy: 'throw' };
  }
  // Already-normalized canonical object — return as-is (idempotent).
  if ('enabled' in value) {
    return value;
  }
  return { enabled: true, strategy: value.strategy ?? 'throw' };
};

/**
 * Angular variant of {@link normalizeRuntimeValidation}: also resolves the
 * `requestBodies` opt-in, which only the object form can switch on.
 * Idempotent, like the shared normalizer.
 */
export const normalizeAngularRuntimeValidation = (
  value:
    | AngularRuntimeValidation
    | NormalizedAngularRuntimeValidation
    | undefined,
): NormalizedAngularRuntimeValidation => {
  if (typeof value !== 'object') {
    return { ...normalizeRuntimeValidation(value), requestBodies: false };
  }
  if ('enabled' in value) {
    return value;
  }
  return {
    ...normalizeRuntimeValidation({ strategy: value.strategy ?? 'throw' }),
    requestBodies: value.requestBodies ?? false,
  };
};

/**
 * Response types the runtime-validation generators never validate: primitives
 * and `void`/`unknown` have no generated Zod schema to parse against.
 */
const RESPONSE_PRIMITIVE_TYPES = new Set([
  'string',
  'number',
  'boolean',
  'void',
  'unknown',
]);

/**
 * Indicates whether a response definition names a primitive (non-schema) type,
 * which runtime validation skips.
 */
export const isPrimitiveResponseType = (t: string | undefined): boolean =>
  t !== undefined && RESPONSE_PRIMITIVE_TYPES.has(t);

/**
 * Indicates whether the response imports carry a schema for the given type
 * name — the precondition for emitting a `Schema.parse`/`safeParse` call.
 */
export const hasSchemaImport = (
  imports: readonly { name: string }[],
  typeName: string | undefined,
): boolean =>
  typeName !== undefined && imports.some((imp) => imp.name === typeName);

/**
 * Maps a response type name to the identifier its Zod schema value is bound to
 * at the call site. `Error` collides with the global constructor, so validated
 * call sites reference that schema as `ErrorSchema`.
 */
export const getSchemaValueRef = (typeName: string): string =>
  typeName === 'Error' ? 'ErrorSchema' : typeName;

/**
 * Maps a schema type name to its Zod output-type alias (`${typeName}Output`),
 * emitted next to every schema in zod-schemas mode. A validated response
 * returns `zod.output` at runtime, so its declared type must reference this
 * alias — the bare schema name aliases `zod.input`, which diverges under
 * `coerce`, `useDates`, defaults and transforms.
 */
export const getSchemaOutputTypeRef = (typeName: string): string =>
  `${typeName}Output`;

/**
 * Rewrites a verb's response imports for a runtime-validated response: the
 * schema import becomes a value import (the generated code calls
 * `parse`/`safeParse` on it), and the schema's `Output` type alias is imported
 * for the declared response type. `zodBaseName` routes the alias import to the
 * base schema's `.zod` file in per-file (`indexFiles: false`) layouts.
 *
 * `includeOutputType: false` keeps the value-import flip but skips the alias —
 * for call sites where validation is delegated (e.g. a custom mutator handed
 * the schema via `includeZodSchemaInArguments`) and the declared type is
 * intentionally left as the schema (input) name.
 */
export const rewriteImportsForResponseValidation = (
  imports: readonly GeneratorImport[],
  responseType: string,
  { includeOutputType = true }: { includeOutputType?: boolean } = {},
): GeneratorImport[] => [
  ...imports.map((imp) =>
    imp.name === responseType ? { ...imp, values: true } : imp,
  ),
  ...(includeOutputType
    ? [
        {
          name: getSchemaOutputTypeRef(responseType),
          zodBaseName: responseType,
        },
      ]
    : []),
];

/**
 * How a validated array response is composed from its element schema.
 *
 * An inline `type: array` response resolves to the definition `Item[]`, and
 * every gate into Zod runtime validation compares that definition to the
 * response import names verbatim. `Item[]` never equals `Item`, so the whole
 * validation branch is skipped while a `$ref` to a *named* array component
 * validates normally (#3718, #4106). The element carries the generated schema;
 * the array wrapper is composed at the use site.
 */
export interface ArrayResponseSchema {
  /** Element schema name, e.g. `Item` — the import to promote to a value. */
  elementName: string;
  /** Expression to call `.parse` on, e.g. `zod.array(Item)`. */
  schemaRef: string;
  /** Declared type of the parsed value, e.g. `ItemOutput[]`. */
  outputTypeRef: string;
}

/** A definition that is exactly one `[]` level over a bare identifier. */
const ARRAY_DEFINITION_PATTERN = /^([A-Za-z_$][\w$]*)\[]$/;

/**
 * Resolves the array-response shape described by {@link ArrayResponseSchema},
 * or `undefined` when the definition is not a validatable array.
 *
 * Deliberately narrow. A primitive element (`string[]`) has no generated schema
 * to compose from, and a nested array (`Item[][]`) is left alone rather than
 * guessed at — both keep their current unvalidated output.
 *
 * @param toValueRef Maps the element name to the identifier its schema value is
 *   bound to at the call site (`Error` is emitted as `ErrorSchema`).
 */
export const getArrayResponseSchema = (
  imports: readonly { name: string }[],
  definition: string | undefined,
  toValueRef: (typeName: string) => string = (typeName) => typeName,
): ArrayResponseSchema | undefined => {
  if (definition === undefined) return undefined;

  const elementName = ARRAY_DEFINITION_PATTERN.exec(definition)?.[1];
  if (elementName === undefined || isPrimitiveResponseType(elementName)) {
    return undefined;
  }
  if (!imports.some((imp) => imp.name === elementName)) return undefined;

  return {
    elementName,
    schemaRef: `zod.array(${toValueRef(elementName)})`,
    outputTypeRef: `${getSchemaOutputTypeRef(elementName)}[]`,
  };
};

/**
 * Module specifier for the `zod` namespace import that composed array
 * expressions reference. Mini ships its constructors from a separate entry
 * point, and only the functional `zod.array(...)` form exists there — which is
 * why the composed expression is built that way rather than as `Item.array()`.
 */
export const getZodNamespaceImportSource = (
  override?: NormalizedOverrideOutput,
): string => (override?.zod.variant === 'mini' ? 'zod/mini' : 'zod');

/** The namespace import a composed `zod.array(...)` expression requires. */
export const getZodNamespaceImport = (override?: NormalizedOverrideOutput) => ({
  name: 'zod',
  values: true,
  namespaceImport: true,
  importPath: getZodNamespaceImportSource(override),
});
