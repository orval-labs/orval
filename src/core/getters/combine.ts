import omit from 'lodash.omit';
import { SchemaObject } from 'openapi3-ts';
import { ContextSpecs } from '../../types';
import { GeneratorImport } from '../../types/generator';
import { ResolverValue } from '../../types/resolvers';
import { asyncReduce } from '../../utils/async-reduce';
import { pascal } from '../../utils/case';
import { getNumberWord } from '../../utils/string';
import { resolveObject } from '../resolvers/object';
import { resolveValue } from '../resolvers/value';
import { getEnumImplementation } from './enum';

type CombinedData = Omit<
  ResolverValue,
  'isRef' | 'isEnum' | 'value' | 'type'
> & {
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

export const combineSchemas = async ({
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
}) => {
  const items = schema[separator] ?? [];

  const resolvedData = await asyncReduce(
    items,
    async (acc, subSchema) => {
      let propName = name ? name + pascal(separator) : undefined;
      if (propName && acc.schemas.length) {
        propName = propName + pascal(getNumberWord(acc.schemas.length + 1));
      }

      const resolvedValue = await resolveObject({
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

      return acc;
    },
    {
      values: [],
      imports: [],
      schemas: [],
      isEnum: [], // check if only enums
      isRef: [],
      types: [],
    } as CombinedData,
  );

  const isAllEnums = resolvedData.isEnum.every((v) => v);

  let resolvedValue;

  if (schema.properties) {
    resolvedValue = await resolveValue({
      schema: omit(schema, separator),
      context,
    });
  }

  const value = combineValues({ resolvedData, separator, resolvedValue });

  if (isAllEnums && name && items.length > 1) {
    const newEnum = `\n\n// eslint-disable-next-line @typescript-eslint/no-redeclare\nexport const ${pascal(
      name,
    )} = ${getCombineEnumValue(resolvedData, name)}`;

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
      type: 'object',
      isRef: false,
    };
  }

  return {
    value: value + nullable,
    imports: resolvedData.imports,
    schemas: resolvedData.schemas,
    isEnum: false,
    type: 'object',
    isRef: false,
  };
};

const getCombineEnumValue = (
  { values, isRef, types }: CombinedData,
  name: string,
) => {
  if (values.length === 1) {
    if (isRef[0]) {
      return values[0];
    }

    return `{${getEnumImplementation(values[0], types[0])}} as const`;
  }

  const enums = values
    .map((e, i) => {
      if (isRef[i]) {
        return `...${e},`;
      }

      return getEnumImplementation(e, types[i]);
    })
    .join('');

  return `{${enums}} as const`;
};
