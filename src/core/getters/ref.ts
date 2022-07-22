import get from 'lodash.get';
import { ReferenceObject } from 'openapi3-ts';
import { resolve } from 'upath';
import url from 'url';
import { ContextSpecs } from '../../types';
import { pascal } from '../../utils/case';
import { getFileInfo } from '../../utils/file';
import { isUrl } from '../../utils/url';

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

/**
 * Return the output type from the $ref
 *
 * @param $ref
 */
export const getRefInfo = (
  $ref: ReferenceObject['$ref'],
  context: ContextSpecs,
): {
  name: string;
  originalName: string;
  refPaths: string[];
  specKey?: string;
} => {
  const [pathname, ref] = $ref.split('#');

  const refPaths = ref
    .slice(1)
    .split('/')
    .map((part) => part.replace(regex, '/'));

  const suffix = get(context.override, [...refPaths.slice(0, 2), 'suffix'], '');

  const originalName = refPaths[refPaths.length - 1];

  if (!pathname) {
    return {
      name: pascal(originalName) + suffix,
      originalName,
      refPaths,
    };
  }

  const path = isUrl(context.specKey)
    ? url.resolve(context.specKey, pathname)
    : resolve(getFileInfo(context.specKey).dirname, pathname);

  return {
    name: pascal(originalName) + suffix,
    originalName,
    specKey: path,
    refPaths,
  };
};
