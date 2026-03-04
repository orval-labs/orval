import { SupportedFormatter } from '@orval/core';
import { describe, expect, it, vi } from 'vitest';

import {
  assertFormatterConsistency,
  formatterFromFlags,
  resolveFormatter,
} from './options';

vi.mock('@orval/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@orval/core')>();
  return {
    ...actual,
    createLogger: () => ({ warn: vi.fn(), warnOnce: vi.fn() }),
  };
});

describe('formatterFromFlags', () => {
  it('returns undefined when no flags are set', () => {
    expect(formatterFromFlags({})).toBeUndefined();
  });

  it('returns prettier', () => {
    expect(formatterFromFlags({ prettier: true })).toBe(
      SupportedFormatter.PRETTIER,
    );
  });

  it('returns biome', () => {
    expect(formatterFromFlags({ biome: true })).toBe(SupportedFormatter.BIOME);
  });

  it('returns oxfmt', () => {
    expect(formatterFromFlags({ oxfmt: true })).toBe(SupportedFormatter.OXFMT);
  });
});

describe('assertFormatterConsistency', () => {
  it('allows a single legacy flag', () => {
    expect(() => {
      assertFormatterConsistency({ prettier: true }, 'output');
    }).not.toThrow();
  });

  it('allows formatter enum alone', () => {
    expect(() => {
      assertFormatterConsistency(
        { formatter: SupportedFormatter.OXFMT },
        'output',
      );
    }).not.toThrow();
  });

  it('throws when two legacy flags are enabled', () => {
    expect(() => {
      assertFormatterConsistency({ prettier: true, biome: true }, 'output');
    }).toThrow('mutually exclusive');
  });

  it('throws when formatter enum and a legacy flag are both set', () => {
    expect(() => {
      assertFormatterConsistency(
        { formatter: SupportedFormatter.PRETTIER, oxfmt: true },
        'global',
      );
    }).toThrow('mutually exclusive');
  });

  it('allows no formatter at all', () => {
    expect(() => {
      assertFormatterConsistency({}, 'output');
    }).not.toThrow();
  });
});

describe('resolveFormatter', () => {
  it('returns undefined when nothing is set', () => {
    expect(resolveFormatter({}, {})).toBeUndefined();
  });

  it('uses output.formatter over everything else', () => {
    expect(
      resolveFormatter(
        { formatter: SupportedFormatter.OXFMT },
        { formatter: SupportedFormatter.PRETTIER },
      ),
    ).toBe(SupportedFormatter.OXFMT);
  });

  it('falls back to output legacy flag', () => {
    expect(resolveFormatter({ biome: true }, {})).toBe(
      SupportedFormatter.BIOME,
    );
  });

  it('falls back to global.formatter when output has nothing', () => {
    expect(resolveFormatter({}, { formatter: SupportedFormatter.BIOME })).toBe(
      SupportedFormatter.BIOME,
    );
  });

  it('falls back to global legacy flag last', () => {
    expect(resolveFormatter({}, { oxfmt: true })).toBe(
      SupportedFormatter.OXFMT,
    );
  });

  it('output legacy flag takes precedence over global.formatter', () => {
    expect(
      resolveFormatter(
        { prettier: true },
        { formatter: SupportedFormatter.BIOME },
      ),
    ).toBe(SupportedFormatter.PRETTIER);
  });

  it('none on output disables a global formatter', () => {
    expect(
      resolveFormatter(
        { formatter: SupportedFormatter.NONE },
        { formatter: SupportedFormatter.PRETTIER },
      ),
    ).toBeUndefined();
  });

  it('none on global results in no formatter', () => {
    expect(
      resolveFormatter({}, { formatter: SupportedFormatter.NONE }),
    ).toBeUndefined();
  });
});
