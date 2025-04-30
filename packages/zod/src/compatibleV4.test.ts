import { describe, it, expect } from 'vitest';
import {
  isZodVersionV4,
  getZodDateFormat,
  getZodTimeFormat,
  getZodDateTimeFormat,
} from './compatibleV4';

describe('isZodVersionV4', () => {
  it('should return false when zod is not in package.json', () => {
    const packageJson = {
      dependencies: {
        'other-package': '1.0.0',
      },
    };

    expect(isZodVersionV4(packageJson)).toBe(false);
  });

  it('should return false for zod v3', () => {
    const packageJson = {
      dependencies: {
        zod: '3.24.3',
      },
    };

    expect(isZodVersionV4(packageJson)).toBe(false);
  });

  it('should return true for zod v4', () => {
    const packageJson = {
      dependencies: {
        zod: '4.0.0',
      },
    };

    expect(isZodVersionV4(packageJson)).toBe(true);
  });

  it('should return true for zod v4+', () => {
    const packageJson = {
      dependencies: {
        zod: '4.1.0',
      },
    };

    expect(isZodVersionV4(packageJson)).toBe(true);
  });

  it('should handle release candidate versions correctly', () => {
    const packageJson = {
      dependencies: {
        zod: '4.0.0-rc.1',
      },
    };

    expect(isZodVersionV4(packageJson)).toBe(true);
  });
});

describe('getZodDateFormat', () => {
  it('should return "iso.date" when isZodV4 is true', () => {
    expect(getZodDateFormat(true)).toBe('iso.date');
  });

  it('should return "date" when isZodV4 is false', () => {
    expect(getZodDateFormat(false)).toBe('date');
  });
});

describe('getZodTimeFormat', () => {
  it('should return "iso.time" when isZodV4 is true', () => {
    expect(getZodTimeFormat(true)).toBe('iso.time');
  });

  it('should return "time" when isZodV4 is false', () => {
    expect(getZodTimeFormat(false)).toBe('time');
  });
});

describe('getZodDateTimeFormat', () => {
  it('should return "iso.datetime" when isZodV4 is true', () => {
    expect(getZodDateTimeFormat(true)).toBe('iso.datetime');
  });

  it('should return "datetime" when isZodV4 is false', () => {
    expect(getZodDateTimeFormat(false)).toBe('datetime');
  });
});
