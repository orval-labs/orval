import { isBooleanJsonSchema } from '@scalar/openapi-types/helpers';

import type { OpenApiSchemaObject } from '../types';
import { isStringLikeSchema } from './assertion';

// Known binary application/* types — add new entries here as needed
const binaryApplicationTypes = new Set([
  'application/octet-stream',
  'application/pdf',
  'application/zip',
]);

/**
 * Determine if a content type is binary.
 * Only known binary types return true. Unknown types default to false (non-binary)
 * so that schema type information is preserved rather than being overridden with Blob.
 */
export function isBinaryContentType(contentType: string): boolean {
  // Strip parameters (e.g., "; charset=utf-8") to get the base MIME type.
  // Media type names are case-insensitive (RFC 9110 §8.3.1).
  const baseType = contentType.split(';')[0].trim().toLowerCase();

  if (baseType.startsWith('image/')) return true;
  if (baseType.startsWith('audio/')) return true;
  if (baseType.startsWith('video/')) return true;
  if (baseType.startsWith('font/')) return true;

  return binaryApplicationTypes.has(baseType);
}

/**
 * Whether a content type is read as text: `text/*` or any XML type. Media type
 * names are case-insensitive (RFC 9110 §8.3.1), so `TEXT/PLAIN` counts.
 */
export function isTextContentType(contentType: string): boolean {
  const lowerContentType = contentType.toLowerCase();
  return (
    lowerContentType.startsWith('text/') || lowerContentType.includes('xml')
  );
}

/**
 * Whether a media type is `application/octet-stream`, in any letter case. A
 * schema's `contentMediaType` carries it for the upgraded `format: binary`.
 */
export function isOctetStreamContentType(
  contentType: string | undefined,
): boolean {
  return contentType?.toLowerCase() === 'application/octet-stream';
}

/**
 * Whether a content type is `multipart/form-data`, in any letter case.
 */
export function isFormDataContentType(contentType: string): boolean {
  return contentType.toLowerCase() === 'multipart/form-data';
}

/**
 * Whether a content type is `application/x-www-form-urlencoded`, in any
 * letter case.
 */
export function isFormUrlEncodedContentType(contentType: string): boolean {
  return contentType.toLowerCase() === 'application/x-www-form-urlencoded';
}

/**
 * Looks up `mediaType` in a `content` map. Media type names are
 * case-insensitive (RFC 9110 §8.3.1), so a key in another case matches; the
 * exact spelling wins when both are declared.
 */
export function findMediaType<T>(
  content: Record<string, T> | undefined,
  mediaType: string,
): T | undefined {
  if (!content) return undefined;
  if (Object.hasOwn(content, mediaType)) return content[mediaType];

  const lowerMediaType = mediaType.toLowerCase();
  return Object.entries(content).find(
    ([contentType]) => contentType.toLowerCase() === lowerMediaType,
  )?.[1];
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
  // Only override string fields - objects/arrays with encoding are just
  // serialized. The OAS 3.1 nullable union ['string', 'null'] counts: that is
  // what `resolveSpec` makes of a 3.0 `{ type: 'string', nullable: true }`
  // part, and rejecting it left nullable file fields typed `string | null`
  // while the zod/effect validators still emitted `instanceof Blob` (#4141).
  if (
    isBooleanJsonSchema(resolvedSchema) ||
    !isStringLikeSchema(resolvedSchema)
  ) {
    return undefined;
  }

  // contentEncoding (e.g., base64) means the value is an encoded string, not a file
  if (resolvedSchema.contentEncoding) {
    return undefined;
  }

  const contentMediaType = resolvedSchema.contentMediaType;
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
 * Filters items by content type based on include/exclude rules. Media types
 * match case-insensitively (RFC 9110 §8.3.1).
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

  const include = filter.include?.map((type) => type.toLowerCase());
  const exclude = filter.exclude?.map((type) => type.toLowerCase());

  return items.filter((item) => {
    const contentType = item.contentType.toLowerCase();
    const shouldInclude = !include || include.includes(contentType);

    const shouldExclude = exclude?.includes(contentType) ?? false;

    return shouldInclude && !shouldExclude;
  });
}
