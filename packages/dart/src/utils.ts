/**
 * Convert a string to snake_case (Dart file naming convention).
 */
export function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

/**
 * Convert a string to camelCase (Dart property naming convention).
 */
export function toCamelCase(str: string): string {
  return str.replace(/[_-](\w)/g, (_, c: string) => c.toUpperCase());
}

/**
 * Convert a string to PascalCase (Dart class naming convention).
 */
export function toPascalCase(str: string): string {
  const camel = toCamelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/**
 * Sanitize a tag name into a valid Dart class name.
 * e.g. "Tenant · Emergency" → "TenantEmergency"
 */
export function sanitizeTagName(tag: string): string {
  return tag
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

/**
 * Sanitize a schema name for use as a Dart class name.
 * Handles names like "Body_bulk_upload_api_flat_bulk_upload__post".
 */
export function sanitizeClassName(name: string): string {
  return name
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

const DART_RESERVED = new Set([
  'abstract',
  'as',
  'assert',
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'covariant',
  'default',
  'deferred',
  'do',
  'dynamic',
  'else',
  'enum',
  'export',
  'extends',
  'extension',
  'external',
  'factory',
  'false',
  'final',
  'finally',
  'for',
  'Function',
  'get',
  'hide',
  'if',
  'implements',
  'import',
  'in',
  'interface',
  'is',
  'late',
  'library',
  'mixin',
  'new',
  'null',
  'on',
  'operator',
  'part',
  'required',
  'rethrow',
  'return',
  'sealed',
  'set',
  'show',
  'static',
  'super',
  'switch',
  'sync',
  'this',
  'throw',
  'true',
  'try',
  'typedef',
  'var',
  'void',
  'when',
  'while',
  'with',
  'yield',
]);

/**
 * Escape a Dart reserved word by appending an underscore suffix.
 */
export function escapeDartReserved(name: string): string {
  return DART_RESERVED.has(name) ? `${name}_` : name;
}
