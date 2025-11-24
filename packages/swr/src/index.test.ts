import { describe, expect, it } from 'vitest';

import { builder } from './index';

describe('swr builder', () => {
  it('returns a valid builder function', () => {
    const result = builder();
    expect(result).toBeDefined();
    expect(typeof result).toBe('function');
  });

  it('builder returns client builder with required methods', () => {
    const result = builder()();
    expect(result).toBeDefined();
    expect(result.client).toBeDefined();
    expect(result.dependencies).toBeDefined();
    expect(result.header).toBeDefined();
    expect(typeof result.client).toBe('function');
    expect(typeof result.dependencies).toBe('function');
    expect(typeof result.header).toBe('function');
  });
});
