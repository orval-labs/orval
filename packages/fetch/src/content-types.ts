export const isContentTypeNdJson = (contentType: string) =>
  contentType === 'application/nd-json' ||
  contentType === 'application/x-ndjson';

export const isContentTypeJson = (contentType: string) =>
  contentType.toLowerCase().includes('json');
