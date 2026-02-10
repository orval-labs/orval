import { isNullish, unique } from 'remeda';

import { resolveExampleRefs, resolveObject } from '../resolvers';
import {
  type ContextSpec,
  EnumGeneration,
  type GeneratorImport,
  type GeneratorSchema,
  type OpenApiReferenceObject,
  type OpenApiSchemaObject,
  type ScalarValue,
  SchemaType,
} from '../types';
import { dedupeUnionType, getNumberWord, isSchema, pascal } from '../utils';
import { getCombinedEnumValue } from './enum';
import { getAliasedImports, getImportAliasForRefOrValue } from './imports';
import type { FormDataContext } from './object';
import { getScalar } from './scalar';

type CombinedData = {
  imports: GeneratorImport[];
  schemas: GeneratorSchema[];
  originalSchema: (OpenApiSchemaObject | undefined)[];
  values: string[];
  isRef: boolean[];
  isEnum: boolean[];
  types: string[];
  hasReadonlyProps: boolean;
  dependencies: string[];
  /**
   * List of all properties in all subschemas
   * - used to add missing properties in subschemas to avoid TS error described in @see https://github.com/orval-labs/orval/issues/935
   */
  allProperties: string[];
  requiredProperties: string[];
};

type Separator = 'allOf' | 'anyOf' | 'oneOf';
const mergeableAllOfKeys = new Set(['type', 'properties', 'required']);

function isMergeableAllOfObject(schema: OpenApiSchemaObject): boolean {
  // Must have properties to be worth merging
  if (isNullish(schema.properties)) {
    return false;
  }

  // Cannot merge if it contains nested composition
  if (schema.allOf || schema.anyOf || schema.oneOf) {
    return false;
  }

  // Only object types can be merged
  if (!isNullish(schema.type) && schema.type !== 'object') {
    return false;
  }

  // Only merge schemas with safe keys (type, properties, required)
  return Object.keys(schema).every((key) => mergeableAllOfKeys.has(key));
}

function normalizeAllOfSchema(
  schema: OpenApiSchemaObject,
): OpenApiSchemaObject {
  if (!schema.allOf) {
    return schema;
  }

  let didMerge = false;
  const mergedProperties = { ...schema.properties };
  const mergedRequired = new Set(schema.required);
  const remainingAllOf: (OpenApiSchemaObject | OpenApiReferenceObject)[] = [];

  for (const subSchema of schema.allOf) {
    if (isSchema(subSchema) && isMergeableAllOfObject(subSchema)) {
      didMerge = true;
      if (subSchema.properties) {
        Object.assign(mergedProperties, subSchema.properties);
      }
      if (subSchema.required) {
        for (const prop of subSchema.required) {
          mergedRequired.add(prop);
        }
      }
      continue;
    }

    remainingAllOf.push(subSchema);
  }

  if (!didMerge || remainingAllOf.length === 0) {
    return schema;
  }

  return {
    ...schema,
    ...(Object.keys(mergedProperties).length > 0 && {
      properties: mergedProperties,
    }),
    ...(mergedRequired.size > 0 && { required: [...mergedRequired] }),
    ...(remainingAllOf.length > 0 && { allOf: remainingAllOf }),
  };
}

interface CombineValuesOptions {
  resolvedData: CombinedData;
  resolvedValue?: ScalarValue;
  separator: Separator;
  context: ContextSpec;
  parentSchema?: OpenApiSchemaObject;
}

function combineValues({
  resolvedData,
  resolvedValue,
  separator,
  context,
  parentSchema,
}: CombineValuesOptions) {
  const isAllEnums = resolvedData.isEnum.every(Boolean);

  if (isAllEnums) {
    return `${resolvedData.values.join(` | `)}${
      resolvedValue ? ` | ${resolvedValue.value}` : ''
    }`;
  }

  if (separator === 'allOf') {
    // Wrap values containing unions in parens to preserve precedence
    // e.g. allOf: [A, oneOf: [B, C]] should be A & (B | C), not A & B | C
    let resolvedDataValue = resolvedData.values
      .map((v) => (v.includes(' | ') ? `(${v})` : v))
      .join(` & `);
    if (resolvedData.originalSchema.length > 0 && resolvedValue) {
      const discriminatedPropertySchemas = resolvedData.originalSchema.filter(
        (s) =>
          s?.discriminator &&
          resolvedValue.value.includes(` ${s.discriminator.propertyName}:`),
      ) as OpenApiSchemaObject[];
      if (discriminatedPropertySchemas.length > 0) {
        resolvedDataValue = `Omit<${resolvedDataValue}, '${discriminatedPropertySchemas.map((s) => s.discriminator?.propertyName).join("' | '")}'>`;
      }
    }
    // Also wrap resolvedValue if it contains union (sibling pattern: allOf + oneOf at same level)
    const resolvedValueStr = resolvedValue?.value.includes(' | ')
      ? `(${resolvedValue.value})`
      : resolvedValue?.value;
    const joined = `${resolvedDataValue}${
      resolvedValue ? ` & ${resolvedValueStr}` : ''
    }`;

    // Parent object may have set required properties that only exist in child
    // objects. Make sure the resulting object has these properties as required,
    // but there is no need to override properties that are already required
    const overrideRequiredProperties = resolvedData.requiredProperties.filter(
      (prop) =>
        !resolvedData.originalSchema.some(
          (schema) =>
            schema?.properties?.[prop] && schema.required?.includes(prop),
        ) &&
        !(
          parentSchema?.properties?.[prop] &&
          parentSchema.required?.includes(prop)
        ),
    );
    if (overrideRequiredProperties.length > 0) {
      return `${joined} & Required<Pick<${joined}, '${overrideRequiredProperties.join("' | '")}'>>`;
    }
    return joined;
  }

  let values = resolvedData.values;
  const hasObjectSubschemas = resolvedData.allProperties.length;
  if (hasObjectSubschemas && context.output.unionAddMissingProperties) {
    values = []; // the list of values will be rebuilt to add missing properties (if exist) in subschemas
    for (let i = 0; i < resolvedData.values.length; i += 1) {
      const subSchema = resolvedData.originalSchema[i];
      if (subSchema?.type !== 'object') {
        values.push(resolvedData.values[i]);
        continue;
      }

      const missingProperties = unique(
        resolvedData.allProperties.filter(
          (p) => !Object.keys(subSchema.properties!).includes(p),
        ),
      );
      values.push(
        `${resolvedData.values[i]}${
          missingProperties.length > 0
            ? ` & {${missingProperties.map((p) => `${p}?: never`).join('; ')}}`
            : ''
        }`,
      );
    }
  }

  if (resolvedValue) {
    return `(${values.join(` & ${resolvedValue.value}) | (`)} & ${
      resolvedValue.value
    })`;
  }

  return values.join(' | ');
}

export function combineSchemas({
  name,
  schema,
  separator,
  context,
  nullable,
  formDataContext,
}: {
  name?: string;
  schema: OpenApiSchemaObject;
  separator: Separator;
  context: ContextSpec;
  nullable: string;
  formDataContext?: FormDataContext;
}): ScalarValue {
  // Normalize allOf schemas by merging inline objects into parent (fixes #2458)
  // Only applies when: using allOf, not in v7 compat mode, no sibling oneOf/anyOf
  const canMergeInlineAllOf =
    separator === 'allOf' &&
    !context.output.override.aliasCombinedTypes &&
    !schema.oneOf &&
    !schema.anyOf;

  const normalizedSchema = canMergeInlineAllOf
    ? normalizeAllOfSchema(schema)
    : schema;

  const items = normalizedSchema[separator] ?? [];

  const resolvedData: CombinedData = items.reduce<CombinedData>(
    (acc, subSchema) => {
      // aliasCombinedTypes (v7 compat): create intermediate types like ResponseAnyOf
      // v8 default: propName stays undefined so combined types are inlined directly
      let propName: string | undefined;
      if (context.output.override.aliasCombinedTypes) {
        propName = name ? name + pascal(separator) : undefined;
        if (propName && acc.schemas.length > 0) {
          propName = propName + pascal(getNumberWord(acc.schemas.length + 1));
        }
      }

      if (separator === 'allOf' && isSchema(subSchema) && subSchema.required) {
        acc.requiredProperties.push(...subSchema.required);
      }

      const resolvedValue = resolveObject({
        schema: subSchema,
        propName,
        combined: true,
        context,
        formDataContext,
      });

      const aliasedImports = getAliasedImports({
        context,
        name,
        resolvedValue,
      });

      const value = getImportAliasForRefOrValue({
        context,
        resolvedValue,
        imports: aliasedImports,
      });

      acc.values.push(value);
      acc.imports.push(...aliasedImports);
      acc.schemas.push(...resolvedValue.schemas);
      acc.dependencies.push(...resolvedValue.dependencies);
      acc.isEnum.push(resolvedValue.isEnum);
      acc.types.push(resolvedValue.type);
      acc.isRef.push(resolvedValue.isRef);
      acc.originalSchema.push(resolvedValue.originalSchema);
      if (resolvedValue.hasReadonlyProps) {
        acc.hasReadonlyProps = true;
      }

      if (
        resolvedValue.type === 'object' &&
        resolvedValue.originalSchema.properties
      ) {
        acc.allProperties.push(
          ...Object.keys(resolvedValue.originalSchema.properties),
        );
      }

      return acc;
    },
    {
      values: [],
      imports: [],
      schemas: [],
      isEnum: [], // check if only enums
      isRef: [],
      types: [],
      dependencies: [],
      originalSchema: [],
      allProperties: [],
      hasReadonlyProps: false,
      example: schema.example,
      examples: resolveExampleRefs(schema.examples, context),
      requiredProperties: separator === 'allOf' ? (schema.required ?? []) : [],
    } as CombinedData,
  );

  const isAllEnums = resolvedData.isEnum.every(Boolean);
  const isAvailableToGenerateCombinedEnum =
    isAllEnums &&
    name &&
    items.length > 1 &&
    context.output.override.enumGenerationType !== EnumGeneration.UNION;

  // Only generate a combined const when enum values exist at runtime.
  if (isAvailableToGenerateCombinedEnum) {
    const {
      value: combinedEnumValue,
      valueImports,
      hasNull,
    } = getCombinedEnumValue(
      resolvedData.values.map((value, index) => ({
        value,
        isRef: resolvedData.isRef[index],
        schema: resolvedData.originalSchema[index],
      })),
    );
    const newEnum = `export const ${pascal(name)} = ${combinedEnumValue}`;
    const valueImportSet = new Set(valueImports);
    const enumNullSuffix =
      hasNull && !nullable.includes('null') ? ' | null' : '';
    const typeSuffix = `${nullable}${enumNullSuffix}`;

    return {
      value: `typeof ${pascal(name)}[keyof typeof ${pascal(name)}]${typeSuffix}`,
      imports: [
        {
          name: pascal(name),
        },
      ],
      schemas: [
        ...resolvedData.schemas,
        {
          imports: resolvedData.imports
            .filter((toImport) =>
              valueImportSet.has(toImport.alias ?? toImport.name),
            )
            .map<GeneratorImport>((toImport) => ({
              ...toImport,
              values: true,
            })),
          model: newEnum,
          name: name,
        },
      ],
      isEnum: false,
      type: 'object' as SchemaType,
      isRef: false,
      hasReadonlyProps: resolvedData.hasReadonlyProps,
      dependencies: resolvedData.dependencies,
      example: schema.example,
      examples: resolveExampleRefs(schema.examples, context),
    };
  }

  let resolvedValue: ScalarValue | undefined;

  if (normalizedSchema.properties) {
    resolvedValue = getScalar({
      item: Object.fromEntries(
        Object.entries(normalizedSchema).filter(([key]) => key !== separator),
      ),
      name,
      context,
      formDataContext,
    });
  } else if (separator === 'allOf' && (schema.oneOf || schema.anyOf)) {
    // Handle sibling pattern: allOf + oneOf/anyOf at same level
    // e.g. { allOf: [A], oneOf: [B, C] } should produce A & (B | C)
    const siblingCombiner = schema.oneOf ? 'oneOf' : 'anyOf';
    resolvedValue = combineSchemas({
      schema: { [siblingCombiner]: schema[siblingCombiner] },
      name,
      separator: siblingCombiner,
      context,
      nullable: '',
    });
  }

  const value = combineValues({
    resolvedData,
    separator,
    resolvedValue,
    context,
    parentSchema: normalizedSchema,
  });

  return {
    value: dedupeUnionType(value + nullable),
    imports: resolvedValue
      ? [...resolvedData.imports, ...resolvedValue.imports]
      : resolvedData.imports,
    schemas: resolvedValue
      ? [...resolvedData.schemas, ...resolvedValue.schemas]
      : resolvedData.schemas,
    dependencies: resolvedValue
      ? [...resolvedData.dependencies, ...resolvedValue.dependencies]
      : resolvedData.dependencies,
    isEnum: false,
    type: 'object' as SchemaType,
    isRef: false,
    hasReadonlyProps:
      resolvedData.hasReadonlyProps ||
      (resolvedValue?.hasReadonlyProps ?? false),
    example: schema.example,
    examples: resolveExampleRefs(schema.examples, context),
  };
}
