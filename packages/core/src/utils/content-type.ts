import type { OpenApiSchemaObject } from '../types';

// Known binary application/* types — add new entries here as needed
const binaryApplicationTypes = new Set([
  'application/octet-stream',
  'application/pdf',
]);

/**
 * Determine if a content type is binary.
 * Only known binary types return true. Unknown types default to false (non-binary)
 * so that schema type information is preserved rather than being overridden with Blob.
 */
export function isBinaryContentType(contentType: string): boolean {
  // Strip parameters (e.g., "; charset=utf-8") to get the base MIME type
  const baseType = contentType.split(';')[0].trim();

  if (baseType.startsWith('image/')) return true;
  if (baseType.startsWith('audio/')) return true;
  if (baseType.startsWith('video/')) return true;
  if (baseType.startsWith('font/')) return true;

  return binaryApplicationTypes.has(baseType);
}

/**
 * Determine if a form-data field should be treated as a file (binary or text).
 *
 * Precedence (per OAS 3.1): encoding.contentType > schema.contentMediaType
 *
 * Returns:
 * - 'binary': binary file (Blob)
 * - 'text': text file (Blob | string)
 * - undefined: not a file, use standard string resolution
 */
export function getFormDataFieldFileType(
  resolvedSchema: OpenApiSchemaObject,
  partContentType: string | undefined,
): 'binary' | 'text' | undefined {
  // Only override string fields - objects/arrays with encoding are just serialized
  if (resolvedSchema.type !== 'string') {
    return undefined;
  }

  // contentEncoding (e.g., base64) means the value is an encoded string, not a file
  if (resolvedSchema.contentEncoding) {
    return undefined;
  }

  const contentMediaType = resolvedSchema.contentMediaType as
    | string
    | undefined;
  const effectiveContentType = partContentType ?? contentMediaType;

  if (effectiveContentType) {
    return isBinaryContentType(effectiveContentType) ? 'binary' : 'text';
  }

  return undefined;
}

/**
 * Filter configuration for content types
 */
export interface ContentTypeFilter {
  include?: string[];
  exclude?: string[];
}

/**
 * Filters items by content type based on include/exclude rules
 *
 * @param items - Array of items with contentType property
 * @param filter - Optional filter configuration
 * @returns Filtered array
 *
 * @example
 * ```ts
 * const types = [
 *   { contentType: 'application/json', value: '...' },
 *   { contentType: 'text/xml', value: '...' }
 * ];
 *
 * // Include only JSON
 * filterByContentType(types, { include: ['application/json'] });
 *
 * // Exclude XML
 * filterByContentType(types, { exclude: ['text/xml'] });
 * ```
 */
export function filterByContentType<T extends { contentType: string }>(
  items: T[],
  filter?: ContentTypeFilter,
): T[] {
  if (!filter) {
    return items;
  }

  return items.filter((item) => {
    const shouldInclude =
      !filter.include || filter.include.includes(item.contentType);

    const shouldExclude = filter.exclude?.includes(item.contentType) ?? false;

    return shouldInclude && !shouldExclude;
  });
}
