import { ReferenceObject, SchemaObject, SchemasObject } from 'openapi3-ts';
import { InputTarget } from '../../types';
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
  schemas,
  separator,
  target,
}: {
  name?: string;
  items: (SchemaObject | ReferenceObject)[];
  schemas: SchemasObject;
  separator: keyof typeof SEPARATOR;
  target: InputTarget;
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
        schemas,
        combined: true,
        target,
      });

      return {
        ...acc,
        value: acc.value
          ? `${acc.value} ${SEPARATOR[separator]} ${resolvedValue.value}`
          : resolvedValue.value,
        imports: [...acc.imports, ...resolvedValue.imports],
        schemas: [...acc.schemas, ...resolvedValue.schemas],
        isEnum: !acc.isEnum ? acc.isEnum : resolvedValue.isEnum,
      };
    },
    {
      value: '',
      imports: [],
      schemas: [],
      isEnum: true,
      type: 'object',
    } as ResolverValue,
  );

  if (resolvedData.isEnum && name) {
    const enums = resolvedData.value
      .split(' | ')
      .map((e) => `...${e}`)
      .join(',');
    const newEnum = `\n\nexport const ${pascal(name)} = {${enums}}`;
    return {
      ...resolvedData,
      value: resolvedData.value + newEnum,
      isEnum: false,
    };
  }

  return resolvedData;
};
