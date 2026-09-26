import { parse, stringify } from 'yaml';

export type SchemaFormat = 'yaml' | 'json';

export const SCHEMA_FORMATS: SchemaFormat[] = ['yaml', 'json'];

/**
 * Orval sniffs the spec format from its content rather than the file
 * extension, so the editor does the same: anything that opens like a JSON
 * document is treated as JSON, everything else as YAML.
 */
export const detectSchemaFormat = (schema: string): SchemaFormat =>
  /^\s*[{[]/.test(schema) ? 'json' : 'yaml';

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
