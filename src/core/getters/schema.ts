import { SchemaObject } from 'openapi3-ts';
import { ContextSpecs } from '../../types';
import { isReference } from '../../utils/is';

export const getSchema = (
  name: string,
  context: ContextSpecs,
  specKey: string,
) => {
  const schemas = Object.entries(
    context.specs[specKey].components?.schemas ?? [],
  ).reduce<Record<string, SchemaObject>>((acc, [name, type]) => {
    acc[name] = type;

    return acc;
  }, {});

  const responses = Object.entries(
    context.specs[specKey].components?.responses ?? [],
  ).reduce<Record<string, SchemaObject | undefined>>((acc, [name, type]) => {
    acc[name] = isReference(type)
      ? type
      : type.content?.['application/json']?.schema;

    return acc;
  }, {});

  const allSchemas = { ...schemas, ...responses };

  return { ...allSchemas[name], specKey };
};
