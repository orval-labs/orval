import type { ReferenceObject, SchemaObject } from 'openapi3-ts/oas30';

import { getEnum, getEnumDescriptions, getEnumNames } from '../getters/enum';
import type { ContextSpecs, ResolverValue } from '../types';
import { jsDoc } from '../utils';
import { resolveValue } from './value';

const resolveObjectOriginal = ({
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
    let model = '';
    const isConstant = 'const' in schema;
    const constantIsString =
      'type' in schema &&
      (schema.type === 'string' ||
        (Array.isArray(schema.type) && schema.type.includes('string')));

    model += isConstant
      ? `${doc}export const ${propName} = ${constantIsString ? `'${schema.const}'` : schema.const} as const;\n`
      : `${doc}export type ${propName} = ${resolvedValue.value};\n`;

    return {
      value: propName,
      imports: [{ name: propName, isConstant }],
      schemas: [
        ...resolvedValue.schemas,
        {
          name: propName,
          model,
          imports: resolvedValue.imports,
          dependencies: resolvedValue.dependencies,
        },
      ],
      isEnum: false,
      type: 'object',
      originalSchema: resolvedValue.originalSchema,
      isRef: resolvedValue.isRef,
      hasReadonlyProps: resolvedValue.hasReadonlyProps,
      dependencies: resolvedValue.dependencies,
    };
  }

  if (propName && resolvedValue.isEnum && !combined && !resolvedValue.isRef) {
    const enumValue = getEnum(
      resolvedValue.value,
      propName,
      getEnumNames(resolvedValue.originalSchema),
      context.output.override.enumGenerationType,
      getEnumDescriptions(resolvedValue.originalSchema),
      context.output.override.namingConvention?.enum,
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
          dependencies: resolvedValue.dependencies,
        },
      ],
      isEnum: false,
      type: 'enum',
      originalSchema: resolvedValue.originalSchema,
      isRef: resolvedValue.isRef,
      hasReadonlyProps: resolvedValue.hasReadonlyProps,
      dependencies: resolvedValue.dependencies,
    };
  }

  return resolvedValue;
};

const resolveObjectCacheMap = new Map<string, ResolverValue>();

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
  const hashKey = JSON.stringify({
    schema,
    propName,
    combined,
    specKey: context.specKey,
  });

  if (resolveObjectCacheMap.has(hashKey)) {
    return resolveObjectCacheMap.get(hashKey)!;
  }

  const result = resolveObjectOriginal({
    schema,
    propName,
    combined,
    context,
  });

  resolveObjectCacheMap.set(hashKey, result);

  return result;
};
