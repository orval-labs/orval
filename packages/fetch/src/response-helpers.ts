import {
  type ContextSpec,
  filterByContentType,
  type GeneratedDateDeserializer,
  generateResponseDateDeserializer,
  type GeneratorOptions,
  type GeneratorVerbOptions,
  isObject,
  type OpenApiReferenceObject,
  type OpenApiResponseObject,
  OutputClient,
  resolveRef,
} from '@orval/core';

/**
 * Whether a response media type is an ndjson stream, in any letter case.
 */
export const isContentTypeNdJson = (contentType: string) => {
  const lowerContentType = contentType.toLowerCase();
  return (
    lowerContentType === 'application/nd-json' ||
    lowerContentType === 'application/x-ndjson'
  );
};

/**
 * Whether a custom mutator receives the response's zod schema as `schema:`.
 * When the response also has a date deserializer, the inline style's schema
 * converts dates first. The emitted option and the `zod` import decision both
 * read this.
 */
export const passesZodSchemaToMutator = (
  mutator: GeneratorVerbOptions['mutator'],
  context: ContextSpec,
) =>
  mutator !== undefined &&
  !!context.output.override.includeZodSchemaInArguments &&
  isObject(context.output.schemas) &&
  context.output.schemas.type === 'zod';

export const getMutatorErrorResponses = (
  {
    response,
    override,
    mutator,
    operationName,
  }: Pick<
    GeneratorVerbOptions,
    'response' | 'override' | 'mutator' | 'operationName'
  >,
  context: GeneratorOptions['context'],
) => {
  if (!override.fetch.includeHttpErrorResponse) {
    return undefined;
  }
  if (
    !override.fetch.includeHttpResponseReturnType ||
    !override.fetch.forceSuccessResponse ||
    !mutator ||
    mutator.isHook ||
    !mutator.hasThirdArg
  ) {
    throw new Error(
      'includeHttpErrorResponse requires includeHttpResponseReturnType, forceSuccessResponse, and a non-hook mutator accepting three arguments.',
    );
  }

  // Type resolution may supply a default JSON media type or collapse
  // referenced content. Runtime metadata must preserve the source declaration.
  const errorResponses = Object.entries(response.originalSchema ?? {})
    .filter(([key]) => response.types.errors.some((entry) => entry.key === key))
    .flatMap(([key, declaredResponse]) => {
      // Range/default responses need a runtime precedence contract. Reject them
      // in this opt-in mode instead of emitting metadata that cannot match its types.
      if (!/^[1-5]\d\d$/.test(key)) {
        throw new Error(
          `includeHttpErrorResponse requires explicit error status codes; received ${key} in ${operationName}.`,
        );
      }
      const { schema } = resolveRef<OpenApiResponseObject>(
        declaredResponse as OpenApiReferenceObject,
        context,
      );
      const contentTypes = Object.keys(schema.content ?? {});
      const status = Number(key);
      if (contentTypes.length === 0) {
        return [{ status, contentType: '' }];
      }
      return filterByContentType(
        contentTypes.map((contentType) => ({ status, contentType })),
        override.contentType,
      );
    });

  return errorResponses;
};

// `useDatesTransform` converts only JSON bodies. MCP handlers forward the
// result to the model as JSON, where a `Date` adds nothing and re-serializes
// a `format: date` value as a full datetime, so MCP gets no transform.
export const getIsDatesTransformEnabled = (
  override: GeneratorVerbOptions['override'],
  context: ContextSpec,
) => override.useDatesTransform && context.output.client !== OutputClient.MCP;

/**
 * Builds the `deserialize{Op}Response` function for a verb's response, or
 * returns `undefined` when its dates are not converted.
 */
export const getResponseDateDeserializer = (
  {
    operationName,
    response,
    mutator,
    override,
  }: Pick<
    GeneratorVerbOptions,
    'operationName' | 'response' | 'mutator' | 'override'
  >,
  context: ContextSpec,
) => {
  // ndjson is excluded explicitly: its media type contains `json`, which the
  // core deserializer's content-type check accepts.
  const isNdJson = response.contentTypes.some(isContentTypeNdJson);
  // An inferred mutator's return type is unknown to orval — it may not even be
  // a promise — so its response cannot be converted. Skipping the deserializer
  // entirely (rather than generating it and simply never wiring it up) keeps
  // the output free of an unreferenced const, which `tsc --noUnusedLocals`
  // rejects. The request serializer still applies regardless.
  return getIsDatesTransformEnabled(override, context) &&
    !isNdJson &&
    !mutator?.inferred
    ? generateResponseDateDeserializer({ operationName, response, context })
    : undefined;
};

/**
 * Wraps `schemaRef` so it converts dates with `deserializer` before it
 * validates. A value the deserializer can't walk, such as an error string,
 * passes through unchanged, so `safeParse` reports the mismatch instead of
 * throwing.
 *
 * `zod.preprocess` would type the schema's input as `unknown`, which zod v3
 * won't assign to the documented mutator option `schema?: ZodType<T>`.
 * `zod.custom<T>()` accepts any value but keeps the input typed as the
 * response. `zod/mini` has neither method chains nor `preprocess`.
 */
export const wrapSchemaWithDateDeserializer = (
  schemaRef: string,
  deserializer: GeneratedDateDeserializer,
  responseType: string,
  context: ContextSpec,
) => {
  const convert = `(value: unknown) => {
      try {
        return ${deserializer.name}(value as ${responseType});
      } catch {
        return value;
      }
    }`;
  return context.output.override.zod.variant === 'mini'
    ? `zod.pipe(zod.transform(${convert}), ${schemaRef})`
    : `zod.custom<${responseType}>().transform(${convert}).pipe(${schemaRef})`;
};
