import type { OpenApiSchemaObject } from '@orval/core';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { logger, resetWarnings, startRun, warnOnce } from './logger';
import { gen } from './test-helpers';

describe('warnings', () => {
  const warn = vi.spyOn(logger, 'warn');

  beforeEach(() => {
    resetWarnings();
    warn.mockClear();
  });

  afterEach(() => {
    resetWarnings();
  });

  it('logs a warning once', () => {
    warnOnce('x');
    warnOnce('x');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('logs it again for a new run, but not within the same run', () => {
    const first = {};
    startRun(first);
    warnOnce('x');
    startRun(first);
    warnOnce('x');
    expect(warn).toHaveBeenCalledTimes(1);
    startRun({});
    warnOnce('x');
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it.each<[string, OpenApiSchemaObject, string]>([
    [
      'a prefixItems tuple',
      { type: 'array', prefixItems: [{ type: 'string' }] },
      '`prefixItems` is not supported yet',
    ],
    [
      'a non-integer multipleOf',
      { type: 'number', multipleOf: 0.01 },
      'Skipping non-integer multipleOf 0.01.',
    ],
    [
      'a pattern JavaScript cannot compile',
      { type: 'string', pattern: '(?i)a' },
      'Skipping pattern that is not a JavaScript RegExp',
    ],
    [
      'a prefixItems tuple next to a composition',
      { type: 'array', prefixItems: [{ type: 'string' }], allOf: [{}] },
      '`prefixItems` is not supported yet',
    ],
    [
      'a const object',
      { const: { a: 1 } },
      '`const` with an object or array value is not supported',
    ],
    [
      'a structured array enum',
      { type: 'array', enum: [[1], [2]] },
      '`enum` with object or array members is not validated.',
    ],
    [
      'a structured enum member',
      { enum: ['a', { b: 1 }] },
      '`enum` with object or array members is not validated.',
    ],
  ])('warns about %s', (_name, schema, message) => {
    gen(schema);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(message));
  });
  it('warns about a number default that is left out', () => {
    gen({ type: 'number', default: 'NaN' }, { required: false });
    expect(warn).toHaveBeenCalledWith(
      'The default "NaN" does not fit a number, it is left out.',
    );
  });
});
