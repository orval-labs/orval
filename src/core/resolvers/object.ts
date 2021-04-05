import { SchemaObject, SchemasObject } from 'openapi3-ts';
import { InputTarget } from '../../types';
import { ResolverValue } from '../../types/resolvers';
import { getEnum } from '../getters/enum';
import { resolveValue } from './value';

export const resolveObject = async ({
  schema,
  propName,
  schemas = {},
  combined = false,
  target,
}: {
  schema: SchemaObject;
  propName?: string;
  schemas?: SchemasObject;
  combined?: boolean;
  target: InputTarget;
}): Promise<ResolverValue> => {
  const resolvedValue = await resolveValue({
    schema,
    name: propName,
    schemas,
    target,
  });
  if (
    propName &&
    !resolvedValue.isEnum &&
    resolvedValue?.type === 'object' &&
    new RegExp(/{|&|\|/).test(resolvedValue.value)
  ) {
    return {
      value: propName,
      imports: [{ name: propName }],
      schemas: [
        ...resolvedValue.schemas,
        {
          name: propName,
          model: `export type ${propName} = ${resolvedValue.value};\n`,
          imports: resolvedValue.imports,
        },
      ],
      isEnum: false,
      type: 'object',
    };
  }

  if (propName && resolvedValue.isEnum && !combined && !schema.$ref) {
    const enumValue = getEnum(
      resolvedValue.value,
      resolvedValue.type,
      propName,
    );

    return {
      value: propName,
      imports: [{ name: propName }],
      schemas: [
        ...resolvedValue.schemas,
        {
          name: propName,
          model: enumValue,
          imports: resolvedValue.imports,
        },
      ],
      isEnum: false,
      type: 'enum',
    };
  }

  return resolvedValue;
};
