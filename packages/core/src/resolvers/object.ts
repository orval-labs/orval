import { getEnum, getEnumDescriptions, getEnumNames } from '../getters/enum';
import type {
  ContextSpec,
  OpenApiReferenceObject,
  OpenApiSchemaObject,
  ResolverValue,
} from '../types';
import { jsDoc } from '../utils';
import { resolveValue } from './value';

interface ResolveOptions {
  schema: OpenApiSchemaObject | OpenApiReferenceObject;
  propName?: string;
  combined?: boolean;
  context: ContextSpec;
}

function resolveObjectOriginal({
  schema,
  propName,
  combined = false,
  context,
}: ResolveOptions): ResolverValue {
  const resolvedValue = resolveValue({
    schema,
    name: propName,
    context,
  });
  const doc = jsDoc(resolvedValue.originalSchema ?? {});

  // aliasCombinedTypes (v7 compat): match '|' and '&' so 'string | number' creates named type
  // v8 default: only match '{' so combined primitives are inlined
  if (
    propName &&
    !resolvedValue.isEnum &&
    resolvedValue?.type === 'object' &&
    new RegExp(
      context.output.override.aliasCombinedTypes ? String.raw`{|&|\|` : '{',
    ).test(resolvedValue.value)
  ) {
    let model = '';
    const isConstant = typeof schema === 'object' && schema !== null && 'const' in schema;
    const constantIsString =
      typeof schema === 'object' && schema !== null && 'type' in schema &&
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
    const enumGenerationType = context.output.override.enumGenerationType;
    const enumValue = getEnum(
      resolvedValue.value,
      propName,
      getEnumNames(resolvedValue.originalSchema),
      enumGenerationType,
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
      dependencies: [...resolvedValue.dependencies, propName],
    };
  }

  return resolvedValue;
}

const resolveObjectCacheMap = new Map<string, ResolverValue>();

export function resolveObject({
  schema,
  propName,
  combined = false,
  context,
}: ResolveOptions): ResolverValue {
  const hashKey = JSON.stringify({
    schema,
    propName,
    combined,
    projectName: context.projectName ?? context.output.target,
  });

  if (resolveObjectCacheMap.has(hashKey)) {
    // .has(...) guarantees existence
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
}
