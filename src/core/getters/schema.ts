import { SchemaObject } from 'openapi3-ts';
import { ContextSpecs } from '../../types';
import { isReference } from '../../utils/is';

export const getSchema = (
  name: string,
  context: ContextSpecs,
  specKey?: string,
) => {
  const schemas = Object.entries(
    context.specs[specKey || context.specKey]?.components?.schemas || [],
  ).reduce((acc, [name, type]) => ({ ...acc, [name]: type }), {}) as {
    [key: string]: SchemaObject;
  };

  const responses = Object.entries(
    context.specs[specKey || context.specKey]?.components?.responses || [],
  ).reduce(
    (acc, [name, type]) => ({
      ...acc,
      [name]: isReference(type)
        ? type
        : type.content?.['application/json']?.schema,
    }),
    {},
  ) as { [key: string]: SchemaObject };

  const allSchemas = { ...schemas, ...responses };

  return { ...allSchemas[name], specKey };
};
