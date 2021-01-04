import { SchemaObject, SchemasObject } from 'openapi3-ts';
import { ResolverValue } from '../../types/resolvers';
import { upper } from '../../utils/case';
import { generalTypesFilter } from '../../utils/filters';
import { sanitize } from '../../utils/string';
import { resolveValue } from './value';

export const resolveObject = ({
  schema,
  propName,
  schemas = {},
  combined = false,
}: {
  schema: SchemaObject;
  propName?: string;
  schemas?: SchemasObject;
  combined?: boolean;
}): ResolverValue => {
  const resolvedValue = resolveValue({
    schema,
    name: propName,
    schemas,
  });
  if (
    propName &&
    !resolvedValue.isEnum &&
    resolvedValue?.type === 'object' &&
    new RegExp(/{|&|\|/).test(resolvedValue.value)
  ) {
    return {
      value: propName,
      imports: [propName],
      schemas: [
        ...resolvedValue.schemas,
        {
          name: propName,
          model: `export type ${propName} = ${resolvedValue.value};\n`,
          imports: generalTypesFilter(resolvedValue.imports),
        },
      ],
      isEnum: false,
      type: 'object',
    };
  }

  if (propName && resolvedValue.isEnum && !combined && !schema.$ref) {
    let enumValue = `export type ${propName} = ${resolvedValue.value};\n`;

    const implementation = resolvedValue.value
      .split(' | ')
      .reduce((acc, val) => {
        return (
          acc +
          `  ${
            resolvedValue.type === 'number'
              ? `${upper(resolvedValue.type)}_${val}`
              : sanitize(val)
          }: ${val} as ${propName},\n`
        );
      }, '');

    enumValue += `\n\nexport const ${propName} = {\n${implementation}};\n`;

    return {
      value: propName,
      imports: [propName],
      schemas: [
        ...resolvedValue.schemas,
        {
          name: propName,
          model: enumValue,
          imports: generalTypesFilter(resolvedValue.imports),
        },
      ],
      isEnum: false,
      type: 'enum',
    };
  }

  return resolvedValue;
};
