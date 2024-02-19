import get from 'lodash.get';
import { ReferenceObject } from 'openapi3-ts/oas30';
import { ContextSpecs } from '../types';
import { getFileInfo, isUrl, pascal, upath } from '../utils';

type RefComponent = 'schemas' | 'responses' | 'parameters' | 'requestBodies';

const RefComponent = {
  schemas: 'schemas' as RefComponent,
  responses: 'responses' as RefComponent,
  parameters: 'parameters' as RefComponent,
  requestBodies: 'requestBodies' as RefComponent,
};

export const RefComponentSuffix: Record<RefComponent, string> = {
  schemas: '',
  responses: 'Response',
  parameters: 'Parameter',
  requestBodies: 'Body',
};

const regex = new RegExp('~1', 'g');

const resolveUrl = (from: string, to: string): string => {
  const resolvedUrl = new URL(to, new URL(from, 'resolve://'));
  if (resolvedUrl.protocol === 'resolve:') {
    // `from` is a relative URL.
    const { pathname, search, hash } = resolvedUrl;
    return pathname + search + hash;
  }
  return resolvedUrl.toString();
};

export interface RefInfo {
  name: string;
  originalName: string;
  refPaths?: string[];
  specKey?: string;
}
/**
 * Return the output type from the $ref
 *
 * @param $ref
 */
export const getRefInfo = (
  $ref: ReferenceObject['$ref'],
  context: ContextSpecs,
): RefInfo => {
  const [pathname, ref] = $ref.split('#');

  const refPaths = ref
    ?.slice(1)
    .split('/')
    .map((part) => part.replace(regex, '/'));

  const suffix = refPaths
    ? get(context.output.override, [...refPaths.slice(0, 2), 'suffix'], '')
    : '';

  const originalName = ref
    ? refPaths[refPaths.length - 1]
    : upath.getSchemaFileName(pathname);

  if (!pathname) {
    return {
      name: pascal(originalName) + suffix,
      originalName,
      refPaths,
    };
  }

  const path = isUrl(context.specKey)
    ? resolveUrl(context.specKey, pathname)
    : upath.resolve(getFileInfo(context.specKey).dirname, pathname);

  return {
    name: pascal(originalName) + suffix,
    originalName,
    specKey: path,
    refPaths,
  };
};
