import {SchemaObject} from 'openapi3-ts';
import {resolveValue} from './resolveValue';

export const resolveObject = (schema: SchemaObject, propName?: string) => {
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
          model: `export type ${propName} = ${resolvedValue.value}`,
          imports: resolvedValue.imports
        }
      ]
    };
  }

  return {
    value: resolvedValue.value,
    imports: resolvedValue.imports,
    schemas: resolvedValue.schemas
  };
};
