import { describe, expect, it } from 'vitest';

import type { BrandedTypeRegistry } from '../types';
import { generateBrandedDefinition } from './branded-definition';

describe('generateBrandedDefinition', () => {
  it('should generate single branded type definition correctly', () => {
    const registry: BrandedTypeRegistry = new Map([
      [
        'UserId',
        {
          name: 'UserId',
          baseType: 'number',
          brand: 'UserId',
        },
      ],
    ]);

    const result = generateBrandedDefinition(registry);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('UserId');
    expect(result[0].model).toBe(
      'export type UserId = Branded<number, "UserId">;\n',
    );
  });

  it('should generate multiple branded type definitions', () => {
    const registry: BrandedTypeRegistry = new Map([
      [
        'UserId',
        {
          name: 'UserId',
          baseType: 'number',
          brand: 'UserId',
        },
      ],
      [
        'Email',
        {
          name: 'Email',
          baseType: 'string',
          brand: 'Email',
        },
      ],
      [
        'IsActive',
        {
          name: 'IsActive',
          baseType: 'boolean',
          brand: 'IsActive',
        },
      ],
    ]);

    const result = generateBrandedDefinition(registry);

    expect(result).toHaveLength(3);

    const userIdSchema = result.find((s) => s.name === 'UserId');
    const emailSchema = result.find((s) => s.name === 'Email');
    const isActiveSchema = result.find((s) => s.name === 'IsActive');

    expect(userIdSchema?.model).toBe(
      'export type UserId = Branded<number, "UserId">;\n',
    );
    expect(emailSchema?.model).toBe(
      'export type Email = Branded<string, "Email">;\n',
    );
    expect(isActiveSchema?.model).toBe(
      'export type IsActive = Branded<boolean, "IsActive">;\n',
    );
  });

  it('should generate branded type with Date base type (useDates)', () => {
    const registry: BrandedTypeRegistry = new Map([
      [
        'CreatedAt',
        {
          name: 'CreatedAt',
          baseType: 'Date',
          brand: 'CreatedAt',
        },
      ],
    ]);

    const result = generateBrandedDefinition(registry);

    expect(result).toHaveLength(1);
    expect(result[0].model).toBe(
      'export type CreatedAt = Branded<Date, "CreatedAt">;\n',
    );
  });

  it('should generate branded type with bigint base type (useBigInt)', () => {
    const registry: BrandedTypeRegistry = new Map([
      [
        'UserId',
        {
          name: 'UserId',
          baseType: 'bigint',
          brand: 'UserId',
        },
      ],
    ]);

    const result = generateBrandedDefinition(registry);

    expect(result).toHaveLength(1);
    expect(result[0].model).toBe(
      'export type UserId = Branded<bigint, "UserId">;\n',
    );
  });
});
