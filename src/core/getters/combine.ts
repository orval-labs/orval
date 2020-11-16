import { ReferenceObject, SchemaObject, SchemasObject } from 'openapi3-ts';
import { ResolverValue } from '../../types/resolvers';
import { pascal } from '../../utils/case';
import { resolveObject } from '../resolvers/object';

export const combineSchemas = ({
  name,
  items,
  schemas,
  separator,
}: {
  name?: string;
  items: (SchemaObject | ReferenceObject)[];
  schemas: SchemasObject;
  separator: string;
}) => {
  const resolvedData = items.reduce<ResolverValue>(
    (acc, schema) => {
      const propName = name ? name + 'Data' : undefined;
      const resolvedValue = resolveObject({
        schema,
        propName,
        schemas,
        combined: true,
      });
      return {
        ...acc,
        value: acc.value
          ? `${acc.value} ${separator} ${resolvedValue.value}`
          : resolvedValue.value,
        imports: [...acc.imports, ...resolvedValue.imports],
        schemas: [...acc.schemas, ...resolvedValue.schemas],
        isEnum: !acc.isEnum ? acc.isEnum : resolvedValue.isEnum,
      };
    },
    { value: '', imports: [], schemas: [], isEnum: true, type: 'object' },
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
