import { SchemaObject } from 'openapi3-ts';
import { ContextSpecs } from '../../types';
import { ResolverValue } from '../../types/resolvers';
import { jsDoc } from '../../utils/doc';
import { getEnum } from '../getters/enum';
import { resolveValue } from './value';

export const resolveObject = ({
  schema,
  propName,
  combined = false,
  context,
}: {
  schema: SchemaObject;
  propName?: string;
  combined?: boolean;
  context: ContextSpecs;
}): ResolverValue => {
  const resolvedValue = resolveValue({
    schema,
    name: propName,
    context,
  });
  const doc = jsDoc(resolvedValue.originalSchema ?? {});

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
          model: `${doc}export type ${propName} = ${resolvedValue.value};\n`,
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
          model: doc + enumValue,
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
