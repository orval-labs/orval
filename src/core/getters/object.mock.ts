import cuid from 'cuid';
import { ReferenceObject, SchemaObject } from 'openapi3-ts';
import { ContextSpecs, MockOptions } from '../../types';
import { GeneratorImport } from '../../types/generator';
import { MockDefinition } from '../../types/mocks';
import { isBoolean, isReference } from '../../utils/is';
import { count } from '../../utils/occurrence';
import { resolveMockValue } from '../resolvers/value.mock';
import { combineSchemasMock } from './combine.mock';
import { getKey } from './keys';

export const getMockObject = async ({
  item,
  mockOptions,
  operationId,
  tags,
  combine,
  context,
  imports,
}: {
  item: SchemaObject & { name: string; path?: string; specKey?: string };
  operationId: string;
  mockOptions?: MockOptions;
  tags: string[];
  combine?: { properties: string[] };
  context: ContextSpecs;
  imports: GeneratorImport[];
}): Promise<MockDefinition> => {
  if (isReference(item)) {
    return resolveMockValue({
      schema: {
        ...item,
        name: item.name,
        path: item.path ? `${item.path}.${item.name}` : item.name,
        specKey: item.specKey,
      },
      mockOptions,
      operationId,
      tags,
      context,
      imports,
    });
  }

  if (item.allOf || item.oneOf || item.anyOf) {
    return combineSchemasMock({
      item,
      items: (item.allOf || item.oneOf || item.anyOf)!,
      isOneOf: !!(item.oneOf || item.anyOf),
      mockOptions,
      operationId,
      tags,
      combine,
      context,
      imports,
    });
  }

  if (item.properties) {
    let value = !combine ? '{' : '';
    let imports: GeneratorImport[] = [];
    let properties: string[] = [];
    value += (
      await Promise.all(
        Object.entries(item.properties).map(
          async ([key, prop]: [string, ReferenceObject | SchemaObject]) => {
            if (combine?.properties.includes(key)) {
              return undefined;
            }

            const isRequired =
              mockOptions?.required ||
              (Array.isArray(item.required) ? item.required : []).includes(key);

            if (count(item.path, `\\.${key}\\.`) >= 1) {
              return undefined;
            }

            const resolvedValue = await resolveMockValue({
              schema: {
                ...prop,
                name: key,
                path: item.path ? `${item.path}.${key}` : `#.${key}`,
                specKey: item.specKey,
              },
              mockOptions,
              operationId,
              tags,
              context,
              imports,
            });

            imports = [...imports, ...resolvedValue.imports];
            properties = [...properties, key];

            const keyDefinition = getKey(key);
            if (!isRequired && !resolvedValue.overrided) {
              return `${keyDefinition}: faker.helpers.arrayElement([${resolvedValue.value}, undefined])`;
            }

            return `${keyDefinition}: ${resolvedValue.value}`;
          },
        ),
      )
    )
      .filter(Boolean)
      .join(', ');
    value += !combine ? '}' : '';
    return {
      value,
      imports,
      name: item.name,
      properties,
    };
  }

  if (item.additionalProperties) {
    if (isBoolean(item.additionalProperties)) {
      return { value: `{}`, imports: [], name: item.name };
    }

    const resolvedValue = await resolveMockValue({
      schema: {
        ...item.additionalProperties,
        name: item.name,
        path: item.path ? `${item.path}.#` : '#',
        specKey: item.specKey,
      },
      mockOptions,
      operationId,
      tags,
      context,
      imports,
    });

    return {
      ...resolvedValue,
      value: `{
        '${cuid()}': ${resolvedValue.value}
      }`,
    };
  }

  return { value: '{}', imports: [], name: item.name };
};
