import { getEnum, getEnumMembers } from '../getters/enum';
import type { FormDataContext } from '../getters/object';
import type {
  ContextSpec,
  OpenApiReferenceObject,
  OpenApiSchemaObject,
  ResolverValue,
  ScalarValue,
} from '../types';
import { isSchemaNullable, jsDoc, toJsLiteral } from '../utils';
import { resolveValue } from './value';

interface ResolveOptions {
  schema: OpenApiSchemaObject | OpenApiReferenceObject;
  propName?: string;
  combined?: boolean;
  context: ContextSpec;
  formDataContext?: FormDataContext;
}

interface CreateTypeAliasOptions {
  resolvedValue: ResolverValue;
  propName: string | undefined;
  context: ContextSpec;
}

/**
 * Wraps inline object type in a type alias.
 * E.g. `{ foo: string }` → value becomes `FooBody`, schema gets `export type FooBody = { foo: string };`
 */
export function createTypeAliasIfNeeded({
  resolvedValue,
  propName,
  context,
}: CreateTypeAliasOptions): ScalarValue | undefined {
  if (!propName) {
    return undefined;
  }

  if (resolvedValue.isEnum || resolvedValue.type !== 'object') {
    return undefined;
  }

  // aliasCombinedTypes (v7 compat): match '|' and '&' so 'string | number' creates named type
  // v8 default: only match '{' so combined primitives are inlined
  const aliasPattern = context.output.override.aliasCombinedTypes
    ? String.raw`{|&|\|`
    : '{';
  if (!new RegExp(aliasPattern).test(resolvedValue.value)) {
    return undefined;
  }

  const { originalSchema } = resolvedValue;
  const doc = jsDoc(originalSchema);
  const isConstant = 'const' in originalSchema;

  // The constant lands in value position (`export const X = <here> as const`),
  // so it has to be serialized from what it actually is. Quoting off the
  // declared `type` left every non-string schema — an inline object being the
  // reachable case, via an array component's `items` — emitting the document's
  // text raw, which runs as an expression on import.
  const model = isConstant
    ? `${doc}export const ${propName} = ${toJsLiteral(originalSchema.const)} as const;\n`
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
        kind: 'schema',
      },
    ],
    isEnum: false,
    type: 'object',
    isRef: resolvedValue.isRef,
    hasReadonlyProps: resolvedValue.hasReadonlyProps,
    dependencies: resolvedValue.dependencies,
  };
}

function resolveObjectOriginal({
  schema,
  propName,
  combined = false,
  context,
  formDataContext,
}: ResolveOptions): ResolverValue {
  const resolvedValue = resolveValue({
    schema,
    name: propName,
    context,
    formDataContext,
  });

  // Try to create a type alias for object types
  const aliased = createTypeAliasIfNeeded({
    resolvedValue,
    propName,
    context,
  });
  if (aliased) {
    return {
      ...aliased,
      originalSchema: resolvedValue.originalSchema,
    };
  }

  if (propName && resolvedValue.isEnum && !combined && !resolvedValue.isRef) {
    const doc = jsDoc(resolvedValue.originalSchema);
    const enumValue = getEnum(
      getEnumMembers(resolvedValue.originalSchema),
      propName,
      isSchemaNullable(resolvedValue.originalSchema),
      context.output.override.enumGenerationType,
      context.output.override.namingConvention.enum,
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
          kind: 'enum',
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
  formDataContext,
}: ResolveOptions): ResolverValue {
  const hashKey = JSON.stringify({
    schema,
    propName,
    combined,
    projectName: context.projectName ?? context.output.target,
    formDataContext,
    dynamicScope: context.dynamicScope,
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
    formDataContext,
  });

  resolveObjectCacheMap.set(hashKey, result);

  return result;
}
