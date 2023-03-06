import { GeneratorImport } from '@orval/core';
import { SchemaObject } from 'openapi3-ts';

export type MockValue =
  | {
      type: 'primitive';
      value: string;
    }
  | {
      type: 'object';
      value: Record<string, MockValue>;
    }
  | {
      type: 'oneOf';
      value: MockValue[];
    }
  | {
      type: 'anyOf';
      value: MockValue[];
    }
  | {
      type: 'allOf';
      value: MockValue[];
    };

export interface MockDefinition {
  value: MockValue;
  enums?: string[];
  imports: GeneratorImport[];
  name: string;
  overrided?: boolean;
  includedProperties?: string[];
}

export type MockSchemaObject = SchemaObject & {
  name: string;
  path?: string;
  isRef?: boolean;
};

export const serializeMockValue = (value: MockValue): string => {
  console.log('SERIALIZING', value);
  switch (value.type) {
    case 'primitive':
      return value.value;
    case 'object':
      return `{${Object.entries(value.value)
        .map(([key, value]) => `${key}: ${serializeMockValue(value)}`)
        .join(', ')}}`;
    case 'oneOf':
      return `faker.helpers.arrayElement([${value.value
        .map(serializeMockValue)
        .join(', ')}])`;
    case 'anyOf':
      return `(${value.value.map(serializeMockValue).join(' | ')})`;
    case 'allOf':
      return serializeMockValue(
        value.value.reduce(mergeValues, { type: 'object', value: {} }),
      );
    case 'array':
      return `[${value.value.map(serializeMockValue).join(', ')}]`;
  }

  throw new Error('Unknown type');
};

/**
 * Merge values together, prioritising the right hand side.
 */
export const mergeValues = (a: MockValue, b: MockValue): MockValue => {
  const primitive = (a, b) => b;
  const object = (a, b) => ({ ...a, ...b });
  const oneOf = (a, b) => [...a, ...b];
  const anyOf = oneOf;
  const array = oneOf;

  if (a.type === b.type) {
    return {
      type: a.type,
      value: (a.type === 'object'
        ? object
        : a.type === 'anyOf'
        ? anyOf
        : a.type === 'oneOf'
        ? oneOf
        : a.type === 'array'
        ? array
        : primitive)(a.value, b.value),
    };
  }

  return b;
};
