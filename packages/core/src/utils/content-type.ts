import type { OpenApiSchemaObject } from '../types';

/**
 * Determine if a content type is binary (vs text-based).
 */
export function isBinaryContentType(contentType: string): boolean {
  if (contentType === 'application/octet-stream') return true;

  if (contentType.startsWith('image/')) return true;
  if (contentType.startsWith('audio/')) return true;
  if (contentType.startsWith('video/')) return true;
  if (contentType.startsWith('font/')) return true;

  // text/* types are not binary
  if (contentType.startsWith('text/')) return false;

  // text-based suffixes (RFC 6838)
  const textSuffixes = [
    '+json',
    '-json',
    '+xml',
    '-xml',
    '+yaml',
    '-yaml',
    '+rss',
    '-rss',
    '+csv',
    '-csv',
  ];
  if (textSuffixes.some((suffix) => contentType.includes(suffix))) {
    return false;
  }

  // text-based whitelist - these are NOT binary
  const textApplicationTypes = new Set([
    'application/json',
    'application/xml',
    'application/yaml',
    'application/x-www-form-urlencoded',
    'application/javascript',
    'application/ecmascript',
    'application/graphql',
  ]);

  return !textApplicationTypes.has(contentType);
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

  const effectiveContentType =
    partContentType ?? resolvedSchema.contentMediaType;

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
