import { SchemaObject } from 'openapi3-ts';
import { ResolverValue } from '../../types/resolvers';
import { generalTypesFilter } from '../../utils/filters';
import { resolveValue } from './value';

export const resolveObject = (
  schema: SchemaObject,
  propName?: string,
): ResolverValue => {
  const resolvedValue = resolveValue(schema, propName);
  if (
    propName &&
    !resolvedValue.isEnum &&
    resolvedValue?.type === 'object' &&
    new RegExp(/{|&|\|/).test(resolvedValue.value)
  ) {
    return {
      value: propName,
      imports: [propName],
      schemas: [
        ...resolvedValue.schemas,
        {
          name: propName,
          model: `export type ${propName} = ${resolvedValue.value};\n`,
          imports: generalTypesFilter(resolvedValue.imports),
        },
      ],
      isEnum: false,
      type: 'object',
    };
  }

  return resolvedValue;
};
