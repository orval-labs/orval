import omit from 'lodash.omit';
import { SchemaObject } from 'openapi3-ts';
import { resolveObject } from '../resolvers';
import {
  ContextSpecs,
  GeneratorImport,
  GeneratorSchema,
  ResolverValue,
  SchemaType,
} from '../types';
import { getNumberWord, pascal } from '../utils';
import { getEnumImplementation } from './enum';
import { getScalar } from './scalar';

type CombinedData = {
  imports: GeneratorImport[];
  schemas: GeneratorSchema[];
  originalSchema: (SchemaObject | undefined)[];
  values: string[];
  isRef: boolean[];
  isEnum: boolean[];
  types: string[];
};

type Separator = 'allOf' | 'anyOf' | 'oneOf';

const combineValues = ({
  resolvedData,
  resolvedValue,
  separator,
}: {
  resolvedData: CombinedData;
  resolvedValue?: ResolverValue;
  separator: Separator;
}) => {
  const isAllEnums = resolvedData.isEnum.every((v) => v);

  if (isAllEnums) {
    return `${resolvedData.values.join(` | `)}${
      resolvedValue ? ` | ${resolvedValue.value}` : ''
    }`;
  }

  if (separator === 'allOf') {
    return `${resolvedData.values.join(` & `)}${
      resolvedValue ? ` & ${resolvedValue.value}` : ''
    }`;
  }

  if (resolvedValue) {
    return `(${resolvedData.values.join(` & ${resolvedValue.value}) | (`)} & ${
      resolvedValue.value
    })`;
  }

  return resolvedData.values.join(' | ');
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
}): ResolverValue => {
  const items = schema[separator] ?? [];

  const resolvedData = items.reduce<CombinedData>(
    (acc, subSchema) => {
      let propName = name ? name + pascal(separator) : undefined;
      if (propName && acc.schemas.length) {
        propName = propName + pascal(getNumberWord(acc.schemas.length + 1));
      }

      const resolvedValue = resolveObject({
        schema: subSchema,
        propName,
        combined: true,
        context,
      });

      acc.values.push(resolvedValue.value);
      acc.imports.push(...resolvedValue.imports);
      acc.schemas.push(...resolvedValue.schemas);
      acc.isEnum.push(resolvedValue.isEnum);
      acc.types.push(resolvedValue.type);
      acc.isRef.push(resolvedValue.isRef);
      acc.originalSchema.push(resolvedValue.originalSchema);

      return acc;
    },
    {
      values: [],
      imports: [],
      schemas: [],
      isEnum: [], // check if only enums
      isRef: [],
      types: [],
      originalSchema: [],
    } as CombinedData,
  );

  const isAllEnums = resolvedData.isEnum.every((v) => v);

  let resolvedValue;

  if (schema.properties) {
    resolvedValue = getScalar({ item: omit(schema, separator), name, context });
  }

  const value = combineValues({ resolvedData, separator, resolvedValue });

  if (isAllEnums && name && items.length > 1) {
    const newEnum = `\n\n// eslint-disable-next-line @typescript-eslint/no-redeclare\nexport const ${pascal(
      name,
    )} = ${getCombineEnumValue(resolvedData)}`;

    return {
      value:
        `typeof ${pascal(name)}[keyof typeof ${pascal(name)}] ${nullable};` +
        newEnum,
      imports: resolvedData.imports.map<GeneratorImport>((toImport) => ({
        ...toImport,
        values: true,
      })),
      schemas: resolvedData.schemas,
      isEnum: false,
      type: 'object' as SchemaType,
      isRef: false,
    };
  }

  return {
    value: value + nullable,
    imports: resolvedValue
      ? [...resolvedData.imports, ...resolvedValue.imports]
      : resolvedData.imports,
    schemas: resolvedValue
      ? [...resolvedData.schemas, ...resolvedValue.schemas]
      : resolvedData.schemas,
    isEnum: false,
    type: 'object' as SchemaType,
    isRef: false,
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

      const names = originalSchema[i]?.['x-enumNames'] as string[];

      return getEnumImplementation(e, names);
    })
    .join('');

  return `{${enums}} as const`;
};
