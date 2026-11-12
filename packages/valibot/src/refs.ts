import {
  type ContextSpec,
  getSchemaLibrary,
  resolveComponentName as resolveSharedComponentName,
} from '@orval/core';

import type { ValibotNode, ValibotSchema } from './nodes';

// Globals the generated code calls, which a constant must not shadow.
export const RESERVED_NAMES: ReadonlySet<string> = new Set(['Date', 'RegExp']);

/** Whether the schemas are written for `schemas: { type: 'valibot' }`. */
export const isSchemasOutput = (context: ContextSpec): boolean =>
  getSchemaLibrary(context.output) === 'valibot';

export const isReusableSchemasEnabled = (context: ContextSpec): boolean =>
  context.output.override.valibot.generateReusableSchemas ||
  isSchemasOutput(context);

/** The identifier a component's constant is declared and referenced by. */
export const resolveComponentName = (
  ref: string,
  context: ContextSpec,
): string => resolveSharedComponentName(ref, context, RESERVED_NAMES);

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
