import { describe, expect, it } from 'vitest';

import type { Tsconfig } from '../types';
import { getImportExtension } from './tsconfig';

describe('getImportExtension', () => {
  it('strips a .ts file extension when no tsconfig is provided', () => {
    expect(getImportExtension('.ts')).toBe('');
    expect(getImportExtension('.gen.ts')).toBe('.gen');
  });

  it('preserves non-.ts file extensions when no tsconfig is provided', () => {
    expect(getImportExtension('.mjs')).toBe('.mjs');
  });

  it('keeps the file extension as-is when allowImportingTsExtensions is true', () => {
    const tsconfig: Tsconfig = {
      compilerOptions: { allowImportingTsExtensions: true },
    };
    expect(getImportExtension('.gen.ts', tsconfig)).toBe('.gen.ts');
    expect(getImportExtension('.ts', tsconfig)).toBe('.ts');
  });

  it('rewrites .ts to .js when module is NodeNext', () => {
    const tsconfig: Tsconfig = {
      compilerOptions: { module: 'NodeNext' },
    };
    expect(getImportExtension('.ts', tsconfig)).toBe('.js');
    expect(getImportExtension('.gen.ts', tsconfig)).toBe('.gen.js');
  });

  it('rewrites .ts to .js when moduleResolution is Node16', () => {
    const tsconfig: Tsconfig = {
      compilerOptions: { moduleResolution: 'Node16' },
    };
    expect(getImportExtension('.ts', tsconfig)).toBe('.js');
  });

  it('matches NodeNext/Node16 case-insensitively', () => {
    expect(
      getImportExtension('.ts', { compilerOptions: { module: 'nodenext' } }),
    ).toBe('.js');
    expect(
      getImportExtension('.ts', {
        compilerOptions: { moduleResolution: 'node16' },
      }),
    ).toBe('.js');
  });

  it('prefers allowImportingTsExtensions over NodeNext rewrites', () => {
    const tsconfig: Tsconfig = {
      compilerOptions: {
        module: 'NodeNext',
        allowImportingTsExtensions: true,
      },
    };
    expect(getImportExtension('.gen.ts', tsconfig)).toBe('.gen.ts');
  });

  it('falls back to stripping .ts for other module settings', () => {
    const tsconfig: Tsconfig = {
      compilerOptions: { module: 'ESNext' },
    };
    expect(getImportExtension('.ts', tsconfig)).toBe('');
    expect(getImportExtension('.gen.ts', tsconfig)).toBe('.gen');
  });
});
