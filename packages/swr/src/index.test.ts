import { describe, expect, it } from 'vitest';

import { isFunction } from '@orval/core';

import { builder } from './index';

describe('swr builder', () => {
  it('returns a valid builder function', () => {
    const result = builder();
    expect(result).toBeDefined();
    expect(isFunction(result)).toBe(true);
  });

  it('builder returns client builder with required methods', () => {
    const result = builder()();
    expect(result).toBeDefined();
    expect(result.client).toBeDefined();
    expect(result.dependencies).toBeDefined();
    expect(result.header).toBeDefined();
    expect(isFunction(result.client)).toBe(true);
    expect(isFunction(result.dependencies)).toBe(true);
    expect(isFunction(result.header)).toBe(true);
  });
});
