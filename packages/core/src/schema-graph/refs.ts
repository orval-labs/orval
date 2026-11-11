import type { ContextSpec, OpenApiSchemaObject } from '../types';
import { isObject, isString } from '../utils/assertion';
import { getAtPath } from '../utils/collection';

const COMPONENT_SCHEMA_PREFIX = '#/components/schemas/';

/** The `$ref` of a schema, if any. An empty `$ref` points at nothing. */
export const getRef = (schema: unknown): string | undefined =>
  isObject(schema) && isString(schema.$ref) && schema.$ref !== ''
    ? schema.$ref
    : undefined;

const decodePointerSegment = (segment: string): string | undefined => {
  try {
    return decodeURIComponent(segment)
      .replaceAll('~1', '/')
      .replaceAll('~0', '~');
  } catch {
    return undefined;
  }
};

/** The `components.schemas` key a `$ref` points at, if it points at one. */
export const getComponentKey = (ref: string): string | undefined => {
  if (!ref.startsWith(COMPONENT_SCHEMA_PREFIX)) return undefined;
  const segment = ref.slice(COMPONENT_SCHEMA_PREFIX.length);
  return segment.includes('/') ? undefined : decodePointerSegment(segment);
};

/** The component a `$ref` points into, even when it points at a sub-schema. */
export const getRootComponentKey = (ref: string): string | undefined => {
  if (!ref.startsWith(COMPONENT_SCHEMA_PREFIX)) return undefined;
  const [segment] = ref.slice(COMPONENT_SCHEMA_PREFIX.length).split('/');
  return decodePointerSegment(segment);
};

/** The value a local `$ref` (`#/...`) points at, if the document has it. */
export const getLocalRefTarget = (
  ref: string,
  context: ContextSpec,
): unknown => {
  if (!ref.startsWith('#/')) return undefined;
  const segments = ref
    .slice(2)
    .split('/')
    .map((segment) => decodePointerSegment(segment));
  return segments.every((segment) => segment !== undefined)
    ? getAtPath(context.spec, segments)
    : undefined;
};

export const toComponentRef = (key: string): string =>
  COMPONENT_SCHEMA_PREFIX +
  encodeURIComponent(key.replaceAll('~', '~0').replaceAll('/', '~1'));

export const getComponentSchema = (
  ref: string,
  context: ContextSpec,
): OpenApiSchemaObject | undefined => {
  const key = getComponentKey(ref);
  const schemas = context.spec.components?.schemas;
  return key !== undefined && schemas && Object.hasOwn(schemas, key)
    ? schemas[key]
    : undefined;
};
