import cuid from 'cuid';
import { ReferenceObject, SchemaObject } from 'openapi3-ts';
import { InputTarget, MockOptions } from '../../types';
import { GeneratorImport } from '../../types/generator';
import { MockDefinition } from '../../types/mocks';
import { isBoolean, isReference } from '../../utils/is';
import { count } from '../../utils/occurrence';
import { resolveMockValue } from '../resolvers/value.mock';
import { combineSchemasMock } from './combine.mock';

export const getMockObject = async ({
  item,
  schemas,
  mockOptions,
  operationId,
  tags,
  combine,
  target,
}: {
  item: SchemaObject & { name: string; path?: string; specKey?: string };
  schemas: { [key: string]: SchemaObject };
  operationId: string;
  mockOptions?: MockOptions;
  tags: string[];
  combine?: { properties: string[] };
  target: InputTarget;
}): Promise<MockDefinition> => {
  if (isReference(item)) {
    return await resolveMockValue({
      schema: {
        ...item,
        schemas,
        name: item.name,
        path: item.path ? `${item.path}.${item.name}` : item.name,
        specKey: item.specKey,
      },
      schemas,
      mockOptions,
      operationId,
      tags,
      target,
    });
  }

  if (item.allOf || item.oneOf || item.anyOf) {
    return combineSchemasMock({
      item,
      items: (item.allOf || item.oneOf || item.anyOf)!,
      isOneOf: !!(item.oneOf || item.anyOf),
      schemas,
      mockOptions,
      operationId,
      tags,
      combine,
      target,
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
              mockOptions?.required || (item.required || []).includes(key);

            if (count(item.path, `.${key}.`) >= 1) {
              return undefined;
            }

            const resolvedValue = await resolveMockValue({
              schema: {
                ...prop,
                name: key,
                path: item.path ? `${item.path}.${key}` : `#.${key}`,
                specKey: item.specKey,
              },
              schemas,
              mockOptions,
              operationId,
              tags,
              target,
            });

            imports = [...imports, ...resolvedValue.imports];
            properties = [...properties, key];

            if (!isRequired && !resolvedValue.overrided) {
              return `${key}: faker.helpers.randomize([${resolvedValue.value}, undefined])`;
            }

            return `${key}: ${resolvedValue.value}`;
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
      schemas,
      mockOptions,
      operationId,
      tags,
      target,
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
