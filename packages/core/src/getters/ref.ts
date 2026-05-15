import type { ContextSpec, NormalizedOverrideOutput } from '../types';
import { pascal, sanitize, upath } from '../utils';

/**
 * `$ref`s targeting these sections under `#/components/...` are emitted as
 * named TypeScript imports (e.g. `import type { Pet } from './model'`).
 * Refs to any other location — for example `#/paths/.../schema` produced by
 * JSON-Schema-Ref-Parser `bundle()` — have no corresponding `export type`
 * and must be inlined by the resolver. See issue #398.
 */
export const NAMED_COMPONENT_SECTIONS = [
  'schemas',
  'responses',
  'parameters',
  'requestBodies',
] as const;

type RefComponent = (typeof NAMED_COMPONENT_SECTIONS)[number];

export const RefComponentSuffix: Record<RefComponent, string> = {
  schemas: '',
  responses: 'Response',
  parameters: 'Parameter',
  requestBodies: 'Body',
};

const COMPONENT_REF_PATTERN = new RegExp(
  String.raw`^#\/components\/(${NAMED_COMPONENT_SECTIONS.join('|')})\/[^/]+$`,
);

/**
 * True iff `ref` targets a named slot eligible for emission as a TypeScript
 * import. Used by `resolveValue` to decide between named import vs inlining
 * the resolved schema.
 */
export function isComponentRef(ref: string): boolean {
  return COMPONENT_REF_PATTERN.test(ref);
}

const regex = new RegExp('~1', 'g');

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

    const secondLevel = (
      firstLevel as Record<string, { suffix?: string } | undefined>
    )[paths[1]];
    return secondLevel?.suffix ?? '';
  };

  const suffix = getOverrideSuffix(context.output.override, refPaths);

  const originalName = ref
    ? (refPaths.at(-1) ?? '')
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
