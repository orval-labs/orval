import { SchemaObject } from 'openapi3-ts';
import { ContextSpecs } from '../../types';
import { ResolverValue } from '../../types/resolvers';
import { getEnum } from '../getters/enum';
import { resolveValue } from './value';

export const resolveObject = async ({
  schema,
  propName,
  combined = false,
  context,
}: {
  schema: SchemaObject;
  propName?: string;
  combined?: boolean;
  context: ContextSpecs;
}): Promise<ResolverValue> => {
  const resolvedValue = await resolveValue({
    schema,
    name: propName,
    context,
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
      originalSchema: resolvedValue.originalSchema,
      isRef: resolvedValue.isRef,
    };
  }

  if (propName && resolvedValue.isEnum && !combined && !resolvedValue.isRef) {
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
      originalSchema: resolvedValue.originalSchema,
      isRef: resolvedValue.isRef,
    };
  }

  return resolvedValue;
};
