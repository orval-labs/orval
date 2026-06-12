import { describe, expect, it } from 'vitest';

import type { GeneratorOperation, GeneratorSchema } from '../types';
import { buildSchemaTagMap } from './schema-tag-mapper';

describe('buildSchemaTagMap', () => {
  const makeOperation = (
    name: string,
    tags: string[],
    importNames: string[],
  ): GeneratorOperation =>
    ({
      imports: importNames.map((n) => ({ name: n })),
      implementation: '',
      mockOutputs: [],
      tags,
      operationName: name,
    }) as GeneratorOperation;

  const makeSchema = (
    name: string,
    importNames: string[] = [],
  ): GeneratorSchema =>
    ({
      name,
      model: `type ${name} = any;`,
      imports: importNames.map((n) => ({ name: n })),
    }) as GeneratorSchema;

  it('maps tag-specific schemas to their tag directory', () => {
    const operations = [
      makeOperation('listPets', ['pets'], ['Pets', 'ListPetsParams']),
      makeOperation('getHealth', ['health'], ['HealthResponse']),
    ];
    const schemas = [
      makeSchema('Pets'),
      makeSchema('ListPetsParams'),
      makeSchema('HealthResponse'),
    ];

    const result = buildSchemaTagMap(operations, schemas);

    expect(result.get('Pets')).toBe('pets');
    expect(result.get('ListPetsParams')).toBe('pets');
    expect(result.get('HealthResponse')).toBe('health');
  });

  it('places schemas referenced by multiple tags at root', () => {
    const operations = [
      makeOperation('listPets', ['pets'], ['Pets', 'Error']),
      makeOperation('getHealth', ['health'], ['HealthResponse', 'Error']),
    ];
    const schemas = [
      makeSchema('Pets'),
      makeSchema('Error'),
      makeSchema('HealthResponse'),
    ];

    const result = buildSchemaTagMap(operations, schemas);

    expect(result.get('Pets')).toBe('pets');
    expect(result.get('HealthResponse')).toBe('health');
    expect(result.get('Error')).toBe('.');
  });

  it('places orphan schemas (not referenced by any operation) at root', () => {
    const operations = [makeOperation('listPets', ['pets'], ['Pets'])];
    const schemas = [makeSchema('Pets'), makeSchema('UnusedType')];

    const result = buildSchemaTagMap(operations, schemas);

    expect(result.get('Pets')).toBe('pets');
    expect(result.get('UnusedType')).toBe('.');
  });

  it('propagates tags transitively through schema imports', () => {
    const operations = [makeOperation('listPets', ['pets'], ['Pets'])];
    const schemas = [
      makeSchema('Pets', ['Pet']),
      makeSchema('Pet', ['Tag']),
      makeSchema('Tag'),
    ];

    const result = buildSchemaTagMap(operations, schemas);

    expect(result.get('Pets')).toBe('pets');
    expect(result.get('Pet')).toBe('pets');
    expect(result.get('Tag')).toBe('pets');
  });

  it('propagates multiple tags transitively to root', () => {
    const operations = [
      makeOperation('listPets', ['pets'], ['Pets', 'Pagination']),
      makeOperation('listStores', ['stores'], ['Stores', 'Pagination']),
    ];
    const schemas = [
      makeSchema('Pets', ['PetItem']),
      makeSchema('PetItem'),
      makeSchema('Stores'),
      makeSchema('Pagination', ['PageInfo']),
      makeSchema('PageInfo'),
    ];

    const result = buildSchemaTagMap(operations, schemas);

    expect(result.get('Pets')).toBe('pets');
    expect(result.get('PetItem')).toBe('pets');
    expect(result.get('Stores')).toBe('stores');
    expect(result.get('Pagination')).toBe('.');
    expect(result.get('PageInfo')).toBe('.');
  });

  it('handles operations with no tags using default', () => {
    const operations = [makeOperation('listPets', [], ['Pets'])];
    const schemas = [makeSchema('Pets')];

    const result = buildSchemaTagMap(operations, schemas);

    expect(result.get('Pets')).toBe('default');
  });
});
