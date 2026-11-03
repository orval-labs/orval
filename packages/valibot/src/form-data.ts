import {
  getFormDataFieldFileType,
  isObject,
  isString,
  type OpenApiNonBooleanSchemaObject,
  type OpenApiSchemaObject,
} from '@orval/core';

import { plainNode, type ValibotNode, type ValibotSchema } from './nodes';

export type PartEncoding = Record<string, { contentType?: string } | undefined>;

const FILE: ValibotSchema = { kind: 'file' };

const getPartContentType = (
  encoding: PartEncoding | undefined,
  key: string,
): string | undefined => {
  const contentType =
    encoding && Object.hasOwn(encoding, key)
      ? encoding[key]?.contentType
      : undefined;
  return isString(contentType) ? contentType : undefined;
};

// A binary part is a file; a text part is a file or the string it was.
const toFile = (
  node: ValibotNode,
  schema: OpenApiSchemaObject,
  contentType: string | undefined,
): ValibotNode => {
  const type =
    node.schema.kind === 'file'
      ? undefined
      : getFormDataFieldFileType(schema, contentType);
  if (type === 'binary') {
    return {
      ...node,
      schema: FILE,
      actions: node.actions.filter((action) => action.kind === 'describe'),
    };
  }
  return type
    ? {
        ...node,
        schema: {
          kind: 'union',
          members: [
            plainNode(FILE),
            {
              ...node,
              nullable: false,
              optional: false,
              defaultValue: undefined,
            },
          ],
        },
        actions: [],
      }
    : node;
};

const toFilePart = (
  node: ValibotNode,
  part: OpenApiSchemaObject,
  contentType: string | undefined,
): ValibotNode => {
  const { schema } = node;
  if (schema.kind !== 'array') return toFile(node, part, contentType);
  return isObject(part) && part.items !== undefined
    ? {
        ...node,
        schema: {
          ...schema,
          item: toFile(schema.item, part.items, contentType),
        },
      }
    : node;
};

/**
 * Turns the top-level parts that carry a file into files, as the type
 * generator does: `encoding.contentType` or `contentMediaType` marks a part,
 * not only `format: binary`.
 */
export const withFileParts = (
  node: ValibotNode,
  schema: OpenApiNonBooleanSchemaObject,
  encoding: PartEncoding | undefined,
): ValibotNode => {
  const root = node.schema;
  if (root.kind !== 'object' && root.kind !== 'objectWithRest') return node;
  const properties = isObject(schema.properties) ? schema.properties : {};
  const entries = root.entries.map((entry) =>
    Object.hasOwn(properties, entry.key)
      ? {
          ...entry,
          value: toFilePart(
            entry.value,
            properties[entry.key],
            getPartContentType(encoding, entry.key),
          ),
        }
      : entry,
  );
  return { ...node, schema: { ...root, entries } };
};
