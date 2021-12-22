import { ReferenceObject, SchemaObject } from 'openapi3-ts';
import { ContextSpecs } from '../../types';
import { GeneratorImport } from '../../types/generator';
import { ResolverValue } from '../../types/resolvers';
import { asyncReduce } from '../../utils/async-reduce';
import { pascal } from '../../utils/case';
import { getNumberWord } from '../../utils/string';
import { resolveObject } from '../resolvers/object';
import { getEnumImplementation } from './enum';

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
    } as Omit<ResolverValue, 'isRef' | 'isEnum' | 'value' | 'type'> & {
      values: string[];
      isRef: boolean[];
      isEnum: boolean[];
      types: string[];
    },
  );

  const isAllEnums = resolvedData.isEnum.every((v) => v);

  const value = resolvedData.values.join(
    ` ${!isAllEnums ? SEPARATOR[separator] : '|'} `,
  );

  if (isAllEnums && name) {
    const enums = resolvedData.values
      .map((e, i) => {
        if (resolvedData.isRef[i]) {
          return `...${e}`;
        }

        return getEnumImplementation(e, resolvedData.types[i], pascal(name));
      })
      .join(',');

    const newEnum = `\n\n// eslint-disable-next-line @typescript-eslint/no-redeclare\nexport const ${pascal(
      name,
    )} = {${enums}}`;

    return {
      value: value + newEnum,
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
    value,
    imports: resolvedData.imports,
    schemas: resolvedData.schemas,
    isEnum: isAllEnums,
    type: 'object',
    isRef: false,
  };
};
