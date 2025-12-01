import type { SchemaObject } from 'openapi3-ts/oas30';
import { unique } from 'remeda';

import { resolveExampleRefs, resolveObject } from '../resolvers';
import {
  type ContextSpecs,
  type GeneratorImport,
  type GeneratorSchema,
  type ScalarValue,
  SchemaType,
} from '../types';
import { getNumberWord, isSchema, pascal } from '../utils';
import {
  getEnumDescriptions,
  getEnumImplementation,
  getEnumNames,
} from './enum';
import { getAliasedImports, getImportAliasForRefOrValue } from './imports';
import { getScalar } from './scalar';

type CombinedData = {
  imports: GeneratorImport[];
  schemas: GeneratorSchema[];
  originalSchema: (SchemaObject | undefined)[];
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

const combineValues = ({
  resolvedData,
  resolvedValue,
  separator,
  context,
}: {
  resolvedData: CombinedData;
  resolvedValue?: ScalarValue;
  separator: Separator;
  context: ContextSpecs;
}) => {
  const isAllEnums = resolvedData.isEnum.every(Boolean);

  if (isAllEnums) {
    return `${resolvedData.values.join(` | `)}${
      resolvedValue ? ` | ${resolvedValue.value}` : ''
    }`;
  }

  if (separator === 'allOf') {
    let resolvedDataValue = resolvedData.values.join(` & `);
    if (resolvedData.originalSchema.length > 0 && resolvedValue) {
      const discriminatedPropertySchemas = resolvedData.originalSchema.filter(
        (s) =>
          s?.discriminator &&
          resolvedValue.value.includes(` ${s.discriminator.propertyName}:`),
      ) as SchemaObject[];
      if (discriminatedPropertySchemas.length > 0) {
        resolvedDataValue = `Omit<${resolvedDataValue}, '${discriminatedPropertySchemas.map((s) => s.discriminator?.propertyName).join("' | '")}'>`;
      }
    }
    const joined = `${resolvedDataValue}${
      resolvedValue ? ` & ${resolvedValue.value}` : ''
    }`;

    // Parent object may have set required properties that only exist in child
    // objects. Make sure the resulting object has these properties as required,
    // but there is no need to override properties that are already required
    const overrideRequiredProperties = resolvedData.requiredProperties.filter(
      (prop) =>
        !resolvedData.originalSchema.some(
          (schema) =>
            schema?.properties?.[prop] && schema.required?.includes(prop),
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
};

export const combineSchemas = ({
  name,
  schema,
  separator,
  context,
  nullable,
}: {
  name?: string;
  schema: SchemaObject;
  separator: Separator;
  context: ContextSpecs;
  nullable: string;
}): ScalarValue => {
  const items = schema[separator] ?? [];

  const resolvedData = items.reduce<CombinedData>(
    (acc, subSchema) => {
      let propName = name ? name + pascal(separator) : undefined;
      if (propName && acc.schemas.length > 0) {
        propName = propName + pascal(getNumberWord(acc.schemas.length + 1));
      }

      if (separator === 'allOf' && isSchema(subSchema) && subSchema.required) {
        acc.requiredProperties.push(...subSchema.required);
      }

      const resolvedValue = resolveObject({
        schema: subSchema,
        propName,
        combined: true,
        context,
      });

      const aliasedImports = getAliasedImports({
        context,
        name,
        resolvedValue,
        existingImports: acc.imports,
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
      acc.hasReadonlyProps ||= resolvedValue.hasReadonlyProps;

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

  // For oneOf, we should generate union types instead of const objects
  // even when all subschemas are enums
  if (isAllEnums && name && items.length > 1 && separator !== 'oneOf') {
    const newEnum = `// eslint-disable-next-line @typescript-eslint/no-redeclare\nexport const ${pascal(
      name,
    )} = ${getCombineEnumValue(resolvedData)}`;

    return {
      value: `typeof ${pascal(name)}[keyof typeof ${pascal(name)}] ${nullable}`,
      imports: [
        {
          name: pascal(name),
        },
      ],
      schemas: [
        ...resolvedData.schemas,
        {
          imports: resolvedData.imports.map<GeneratorImport>((toImport) => ({
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

  if (schema.properties) {
    resolvedValue = getScalar({
      item: Object.fromEntries(
        Object.entries(schema).filter(([key]) => key !== separator),
      ),
      name,
      context,
    });
  }

  const value = combineValues({
    resolvedData,
    separator,
    resolvedValue,
    context,
  });

  return {
    value: value + nullable,
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
      resolvedData?.hasReadonlyProps ||
      resolvedValue?.hasReadonlyProps ||
      false,
    example: schema.example,
    examples: resolveExampleRefs(schema.examples, context),
  };
};

const getCombineEnumValue = ({
  values,
  isRef,
  originalSchema,
}: CombinedData) => {
  if (values.length === 1) {
    if (isRef[0]) {
      return values[0];
    }

    return `{${getEnumImplementation(values[0])}} as const`;
  }

  const enums = values
    .map((e, i) => {
      if (isRef[i]) {
        return `...${e},`;
      }

      const names = getEnumNames(originalSchema[i]);
      const descriptions = getEnumDescriptions(originalSchema[i]);

      return getEnumImplementation(e, names, descriptions);
    })
    .join('');

  return `{${enums}} as const`;
};
