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
 * Determine if a form-data root field should be treated as binary or text file
 * based on encoding.contentType or contentMediaType.
 *
 * Returns:
 * - 'binary': field is a binary file (Blob in types)
 * - 'text': field is a text file that can accept string (Blob | string in types)
 * - undefined: no override, use standard resolution
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
