import { describe, it, expect } from 'vitest';
import { isZodVersionV4 } from './compatibleV4';

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
