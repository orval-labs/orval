import { ReferenceObject, SchemaObject } from 'openapi3-ts';
import { ContextSpecs } from '../../types';
import { GeneratorImport } from '../../types/generator';
import { ResolverValue } from '../../types/resolvers';
import { asyncReduce } from '../../utils/async-reduce';
import { pascal } from '../../utils/case';
import { getNumberWord } from '../../utils/string';
import { resolveObject } from '../resolvers/object';

const SEPARATOR = {
  allOf: '&',
  oneOf: '|',
  anyOf: '|',
};

export const combineSchemas = async ({
  name,
  items,
  separator,
  context,
}: {
  name?: string;
  items: (SchemaObject | ReferenceObject)[];
  separator: keyof typeof SEPARATOR;
  context: ContextSpecs;
}) => {
  const resolvedData = await asyncReduce(
    items,
    async (acc, schema) => {
      let propName = name ? name + pascal(separator) : undefined;

      if (propName && acc.schemas.length) {
        propName = propName + pascal(getNumberWord(acc.schemas.length + 1));
      }

      const resolvedValue = await resolveObject({
        schema,
        propName,
        combined: true,
        context,
      });

      if (acc.isEnum.length && !acc.isEnum.includes(resolvedValue.isEnum)) {
        throw new Error(`Enums can only combine with enum`);
      }

      return {
        values: [...acc.values, resolvedValue.value],
        imports: [...acc.imports, ...resolvedValue.imports],
        schemas: [...acc.schemas, ...resolvedValue.schemas],
        isEnum: [...acc.isEnum, resolvedValue.isEnum],
        isRef: [...acc.isRef, resolvedValue.isRef],
      };
    },
    {
      values: [],
      imports: [],
      schemas: [],
      isEnum: [], // check if only enums
      type: 'object',
      isRef: [],
    } as Omit<ResolverValue, 'isRef' | 'isEnum' | 'value'> & {
      values: string[];
      isRef: boolean[];
      isEnum: boolean[];
    },
  );

  const isAllEnums = resolvedData.isEnum.every((v) => v);

  if (isAllEnums && name) {
    const enums = resolvedData.value
      .split(' | ')
      .map((e) => `...${e}`)
      .join(',');

    const newEnum = `\n\nexport const ${pascal(name)} = {${enums}}`;
    return {
      ...resolvedData,
      imports: resolvedData.imports.map<GeneratorImport>((toImport) => ({
        ...toImport,
        values: true,
      })),
      value: resolvedData.value + newEnum,
      isEnum: false,
    };
  }

  return resolvedData;
};
