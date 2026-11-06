import {
  type ContextSpec,
  getAtPath,
  getRefInfo,
  isObject,
  isString,
  type OpenApiSchemaObject,
} from '@orval/core';

import { allOfMembers } from './composition';
import type { ValibotNode, ValibotSchema } from './nodes';

const COMPONENT_SCHEMA_PREFIX = '#/components/schemas/';

// Globals the generated code calls, which a constant must not shadow.
const RESERVED_NAMES: ReadonlySet<string> = new Set(['Date', 'RegExp']);

export const isReusableSchemasEnabled = (context: ContextSpec): boolean =>
  context.output.override.valibot.generateReusableSchemas;

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

/** The identifier a component's constant is declared and referenced by. */
export const resolveComponentName = (
  ref: string,
  context: ContextSpec,
): string => {
  const { name } = getRefInfo(ref, context);
  return RESERVED_NAMES.has(name) ? `${name}Schema` : name;
};

const alternativesOf = ({ schema }: ValibotNode): ValibotNode[] => {
  switch (schema.kind) {
    case 'union':
    case 'intersect': {
      return schema.members;
    }
    case 'variant': {
      return schema.options;
    }
    default: {
      return [];
    }
  }
};

const childNodes = (node: ValibotNode): ValibotNode[] => {
  const { schema } = node;
  switch (schema.kind) {
    case 'array': {
      return [schema.item];
    }
    case 'record': {
      return [schema.value];
    }
    case 'object': {
      return schema.entries.map((entry) => entry.value);
    }
    case 'objectWithRest': {
      return [...schema.entries.map((entry) => entry.value), schema.rest];
    }
    default: {
      return alternativesOf(node);
    }
  }
};

const refNameOf = (schema: ValibotSchema): string[] =>
  schema.kind === 'ref' ? [schema.name] : [];

/** The names of the components a node references, each once. */
export const collectRefNames = (node: ValibotNode): Set<string> => {
  const names = new Set<string>();
  const walk = (current: ValibotNode): void => {
    for (const name of refNameOf(current.schema)) names.add(name);
    for (const child of childNodes(current)) walk(child);
  };
  walk(node);
  return names;
};

/**
 * The components a node reads without descending into a property, item or
 * value. A cycle of such reads would recurse forever.
 */
export const collectUnguardedRefNames = (node: ValibotNode): Set<string> => {
  const names = new Set<string>(refNameOf(node.schema));
  for (const alternative of alternativesOf(node)) {
    for (const name of collectUnguardedRefNames(alternative)) names.add(name);
  }
  return names;
};

/** Replaces the unguarded references to the given components with `unknown`. */
export const cutUnguardedRefs = (
  node: ValibotNode,
  names: ReadonlySet<string>,
): ValibotNode => {
  const { schema } = node;
  switch (schema.kind) {
    case 'ref': {
      return names.has(schema.name)
        ? { ...node, schema: { kind: 'unknown' } }
        : node;
    }
    case 'union': {
      return {
        ...node,
        schema: {
          ...schema,
          members: schema.members.map((member) =>
            cutUnguardedRefs(member, names),
          ),
        },
      };
    }
    case 'intersect': {
      // A cut member checks nothing, so it leaves the intersection as an
      // unknown member of an `allOf` does.
      const members = schema.members.map((member) =>
        cutUnguardedRefs(member, names),
      );
      const isCut = members.some(
        (member, index) => member !== schema.members[index],
      );
      return {
        ...node,
        schema: { ...schema, members: isCut ? allOfMembers(members) : members },
      };
    }
    case 'variant': {
      return {
        ...node,
        schema: {
          ...schema,
          options: schema.options.map((option) =>
            cutUnguardedRefs(option, names),
          ),
        },
      };
    }
    default: {
      return node;
    }
  }
};
