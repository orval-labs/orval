import type {
  GeneratorOptions,
  GeneratorVerbOptions,
  NormalizedOverrideOutput,
} from '@orval/core';
import { ModelStyle } from '@orval/core';
import { describe, expect, it } from 'vitest';

import { builder } from './index';

describe('throws when trying to use named parameters with vue-query client', () => {
  it('vue-query builder type', () => {
    expect(() =>
      builder({ type: 'vue-query' })().client(
        {} as GeneratorVerbOptions,
        {
          override: { useNamedParameters: true } as NormalizedOverrideOutput,
        } as GeneratorOptions,
        'axios',
      ),
    ).toThrowErrorMatchingInlineSnapshot(
      '[Error: vue-query client does not support named parameters, and had broken reactivity previously, please set useNamedParameters to false; See for context: https://github.com/orval-labs/orval/pull/931#issuecomment-1752355686]',
    );
  });
  it('vue-query output client', () => {
    expect(() =>
      builder()().client(
        {} as GeneratorVerbOptions,
        {
          override: { useNamedParameters: true } as NormalizedOverrideOutput,
        } as GeneratorOptions,
        'vue-query',
      ),
    ).toThrowErrorMatchingInlineSnapshot(
      '[Error: vue-query client does not support named parameters, and had broken reactivity previously, please set useNamedParameters to false; See for context: https://github.com/orval-labs/orval/pull/931#issuecomment-1752355686]',
    );
  });
});

describe('react-query with zod model style', () => {
  it('should have extraFiles function', () => {
    const generator = builder({
      output: { modelStyle: ModelStyle.ZOD },
    })();
    expect(generator.extraFiles).toBeDefined();
    expect(typeof generator.extraFiles).toBe('function');
  });

  it('should have dependencies function', () => {
    const generator = builder({
      output: { modelStyle: ModelStyle.ZOD },
    })();
    expect(generator.dependencies).toBeDefined();
    expect(typeof generator.dependencies).toBe('function');
  });

  it('should include zod dependencies', () => {
    const generator = builder({
      output: { modelStyle: ModelStyle.ZOD },
    })();
    const deps = generator.dependencies!(
      false,
      false,
      undefined,
      'axios',
      false,
      undefined,
    );
    const zodDep = deps.find((dep) => dep.dependency === 'zod');
    expect(zodDep).toBeDefined();
    expect(zodDep?.exports).toBeDefined();
    expect(zodDep?.exports?.some((exp) => exp.name === 'zod')).toBe(true);
  });

  it('throws when trying to use named parameters with vue-query', () => {
    expect(() =>
      builder({
        type: 'vue-query',
        output: { modelStyle: ModelStyle.ZOD },
      })().client(
        {} as GeneratorVerbOptions,
        {
          override: { useNamedParameters: true } as NormalizedOverrideOutput,
        } as GeneratorOptions,
        'vue-query',
      ),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: vue-query client does not support named parameters, and had broken reactivity previously, please set useNamedParameters to false; See for context: https://github.com/orval-labs/orval/pull/931#issuecomment-1752355686]`,
    );
  });
});
