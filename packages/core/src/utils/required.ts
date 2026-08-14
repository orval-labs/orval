import type { OpenApiSchemaObject } from '../types';

/**
 * Read a schema object's `required` keyword.
 *
 * Some generators emit `required: true` on a schema that carries a `$ref`,
 * borrowing the boolean that belongs on the request body object. Spreading that
 * boolean fails with `required ?? [] is not iterable`, which says nothing about
 * the document. Report the offending schema and the expected shape instead. The
 * document is not rewritten: a boolean carries no property names, so there is
 * nothing to recover from it. (#3719)
 *
 * @param schema - Schema whose `required` keyword to read.
 * @param name - Label for the offending schema, used in the error message.
 */
export function getRequiredKeys(schema: OpenApiSchemaObject, name: string) {
  const required = schema.required as unknown;

  if (required === undefined) return [];
  if (Array.isArray(required)) return required;

  throw new Error(
    `Invalid OpenAPI document: schema "${name}" has \`required: ${JSON.stringify(
      required,
    )}\`, but a schema object's \`required\` must be an array of property names. A boolean \`required\` belongs on the request body object or on a parameter, not on the schema it references.`,
  );
}
