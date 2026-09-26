import { parse, stringify } from 'yaml';

export type SchemaFormat = 'yaml' | 'json';

export const SCHEMA_FORMATS: SchemaFormat[] = ['yaml', 'json'];

/**
 * Orval sniffs the spec format from its content rather than the file
 * extension, so the editor does the same. Text that opens like a JSON
 * document is JSON when it parses as JSON, and YAML when it only parses as
 * YAML (flow style, e.g. `{openapi: 3.0.0}`). Text that parses as neither is
 * usually JSON being edited, so it keeps the JSON label instead of flickering.
 */
export const detectSchemaFormat = (schema: string): SchemaFormat => {
  if (!/^\s*[{[]/.test(schema)) {
    return 'yaml';
  }

  try {
    JSON.parse(schema);
    return 'json';
  } catch {
    // Not JSON, maybe YAML flow style.
  }

  try {
    parse(schema);
    return 'yaml';
  } catch {
    return 'json';
  }
};

/**
 * Re-serializes a YAML or JSON schema in the requested format.
 * Throws when the schema cannot be parsed.
 */
export const convertSchema = (schema: string, format: SchemaFormat): string => {
  const document: unknown = parse(schema);

  if (document === null || typeof document !== 'object') {
    throw new Error('Schema must be a YAML or JSON object');
  }

  return format === 'json'
    ? `${JSON.stringify(document, null, 2)}\n`
    : stringify(document, { lineWidth: 0 });
};
