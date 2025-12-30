import type { ContextSpec, NormalizedOverrideOutput } from '../types';
import { getFileInfo, isUrl, pascal, sanitize, upath } from '../utils';

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
}
/**
 * Return the output type from the $ref
 *
 * @param $ref
 */
export function getRefInfo($ref: string, context: ContextSpec): RefInfo {
  const [pathname, ref] = $ref.split('#');

  const refPaths = ref
    .slice(1)
    .split('/')
    .map((part) => decodeURIComponent(part.replaceAll(regex, '/')));

  const getOverrideSuffix = (
    override: NormalizedOverrideOutput,
    paths: string[],
  ) => {
    const firstLevel = override[paths[0] as keyof NormalizedOverrideOutput];
    if (!firstLevel) return '';

    const secondLevel = (firstLevel as Record<string, { suffix?: string }>)[
      paths[1]
    ];
    return secondLevel?.suffix ?? '';
  };

  const suffix = getOverrideSuffix(context.output.override, refPaths);

  const originalName = ref
    ? refPaths[refPaths.length - 1]
    : upath.getSchemaFileName(pathname);

  if (!pathname) {
    return {
      name: sanitize(pascal(originalName) + suffix, {
        es5keyword: true,
        es5IdentifierName: true,
        underscore: true,
        dash: true,
      }),
      originalName,
      refPaths,
    };
  }

  return {
    name: sanitize(pascal(originalName) + suffix, {
      es5keyword: true,
      es5IdentifierName: true,
      underscore: true,
      dash: true,
    }),
    originalName,
    refPaths,
  };
}
