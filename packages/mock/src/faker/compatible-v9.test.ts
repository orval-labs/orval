import { describe, expect, it } from 'vitest';

import { isFakerVersionV9 } from './compatible-v9';

describe('isFakerVersionV9', () => {
  it('should return false when faker is not in package.json', () => {
    const packageJson = {
      dependencies: {
        'other-package': '1.0.0',
      },
    };

    expect(isFakerVersionV9(packageJson)).toBe(false);
  });

  it('should return false for faker v8', () => {
    const packageJson = {
      dependencies: {
        '@faker-js/faker': '8.4.0',
      },
    };

    expect(isFakerVersionV9(packageJson)).toBe(false);
  });

  it('should return true for faker v9', () => {
    const packageJson = {
      dependencies: {
        '@faker-js/faker': '9.0.0',
      },
    };

    expect(isFakerVersionV9(packageJson)).toBe(true);
  });

  it('should return true for faker v9+', () => {
    const packageJson = {
      dependencies: {
        '@faker-js/faker': '9.1.0',
      },
    };

    expect(isFakerVersionV9(packageJson)).toBe(true);
  });

  it('should handle release candidate versions correctly', () => {
    const packageJson = {
      dependencies: {
        '@faker-js/faker': '9.0.0-rc.1',
      },
    };

    expect(isFakerVersionV9(packageJson)).toBe(true);
  });
});
