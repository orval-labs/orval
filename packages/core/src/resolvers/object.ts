import { ReferenceObject, SchemaObject } from 'openapi3-ts';
import { getEnum } from '../getters/enum';
import { ContextSpecs, ResolverValue } from '../types';
import { jsDoc } from '../utils';
import { resolveValue } from './value';

export const resolveObject = ({
  schema,
  propName,
  combined = false,
  context,
}: {
  schema: SchemaObject | ReferenceObject;
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
      hasReadonlyProps: resolvedValue.hasReadonlyProps,
    };
  }

  if (propName && resolvedValue.isEnum && !combined && !resolvedValue.isRef) {
    const enumValue = getEnum(
      resolvedValue.value,
      propName,
      resolvedValue.originalSchema?.['x-enumNames'],
      context.override.useNativeEnums,
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
      hasReadonlyProps: resolvedValue.hasReadonlyProps,
    };
  }

  return resolvedValue;
};
