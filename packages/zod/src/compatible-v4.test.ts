import { describe, expect, it } from 'vitest';

import {
  assertZodTarget,
  getLooseObjectFunctionName,
  getObjectFunctionName,
  getZodImportSource,
  getZodTypeName,
  getParameterFunctions,
  getZodDateFormat,
  getZodDateTimeFormat,
  getZodTimeFormat,
  isZodVersionV4,
  resolveIsZodV4,
} from './compatible-v4';

describe('zod target helpers', () => {
  it('resolves import source and recursive type for classic zod', () => {
    expect(getZodImportSource('classic')).toBe('zod');
    expect(getZodTypeName('classic')).toBe('ZodType');
  });

  it('resolves import source and recursive type for zod mini', () => {
    expect(getZodImportSource('mini')).toBe('zod/mini');
    expect(getZodTypeName('mini')).toBe('ZodMiniType');
  });

  it('rejects zod mini when the resolved target is not zod v4', () => {
    expect(() => assertZodTarget({ variant: 'mini', isZodV4: false })).toThrow(
      'Zod Mini requires Zod 4 output',
    );
  });
});

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

describe('isZodVersionV4 with resolvedVersions', () => {
  it('should prefer resolvedVersions over dependencies', () => {
    const packageJson = {
      dependencies: {
        zod: '3.24.3',
      },
      resolvedVersions: {
        zod: '4.0.0',
      },
    };

    expect(isZodVersionV4(packageJson)).toBe(true);
  });

  it('should return true when only resolvedVersions is present', () => {
    const packageJson = {
      resolvedVersions: {
        zod: '4.1.0',
      },
    };

    expect(isZodVersionV4(packageJson)).toBe(true);
  });

  it('should fall back to dependencies when resolvedVersions is absent', () => {
    const packageJson = {
      dependencies: {
        zod: '3.24.3',
      },
    };

    expect(isZodVersionV4(packageJson)).toBe(false);
  });
});

describe('resolveIsZodV4', () => {
  const v3PackageJson = { dependencies: { zod: '3.24.3' } };
  const v4PackageJson = { dependencies: { zod: '4.0.0' } };

  describe("when version is 'auto'", () => {
    it('infers v4 from the resolved zod version', () => {
      expect(resolveIsZodV4('auto', v4PackageJson)).toBe(true);
    });

    it('infers v3 from the resolved zod version', () => {
      expect(resolveIsZodV4('auto', v3PackageJson)).toBe(false);
    });

    it('defaults to v4 when no packageJson is available', () => {
      expect(resolveIsZodV4('auto', undefined)).toBe(true);
    });

    it('defaults to v4 when packageJson has no detectable zod version', () => {
      expect(resolveIsZodV4('auto', {})).toBe(true);
      expect(resolveIsZodV4('auto', { dependencies: {} })).toBe(true);
      expect(
        resolveIsZodV4('auto', { dependencies: { 'other-pkg': '1.0.0' } }),
      ).toBe(true);
    });
  });

  describe('when version is pinned explicitly', () => {
    it('forces v4 even when the installed zod is v3', () => {
      expect(resolveIsZodV4(4, v3PackageJson)).toBe(true);
    });

    it('forces v3 even when the installed zod is v4', () => {
      expect(resolveIsZodV4(3, v4PackageJson)).toBe(false);
    });

    it('forces v4 even when no packageJson is available', () => {
      expect(resolveIsZodV4(4, undefined)).toBe(true);
    });

    it('forces v3 even when no packageJson is available', () => {
      expect(resolveIsZodV4(3, undefined)).toBe(false);
    });
  });

  it("treats an undefined version like 'auto'", () => {
    expect(resolveIsZodV4(undefined, v4PackageJson)).toBe(true);
    expect(resolveIsZodV4(undefined, v3PackageJson)).toBe(false);
    expect(resolveIsZodV4(undefined, undefined)).toBe(true);
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

describe('getParameterFunctions', () => {
  const parameters = { test: 'value' };

  describe('when isZodV4 is true', () => {
    describe('when strict is true', () => {
      it('should return [["strictObject", parameters]]', () => {
        const result = getParameterFunctions(true, true, parameters);
        expect(result).toEqual([['strictObject', parameters]]);
      });
    });

    describe('when strict is false', () => {
      it('should return [["object", parameters]]', () => {
        const result = getParameterFunctions(true, false, parameters);
        expect(result).toEqual([['object', parameters]]);
      });
    });
  });

  describe('when isZodV4 is false', () => {
    describe('when strict is true', () => {
      it('should return [["object", parameters], ["strict", undefined]]', () => {
        const result = getParameterFunctions(false, true, parameters);
        expect(result).toEqual([
          ['object', parameters],
          ['strict', undefined],
        ]);
      });
    });

    describe('when strict is false', () => {
      it('should return [["object", parameters]]', () => {
        const result = getParameterFunctions(false, false, parameters);
        expect(result).toEqual([['object', parameters]]);
      });
    });
  });
});

describe('getObjectFunctionName', () => {
  describe('when isZodV4 is true', () => {
    describe('when strict is true', () => {
      it('should return "strictObject"', () => {
        const result = getObjectFunctionName(true, true);
        expect(result).toBe('strictObject');
      });
    });

    describe('when strict is false', () => {
      it('should return "object"', () => {
        const result = getObjectFunctionName(true, false);
        expect(result).toBe('object');
      });
    });
  });

  describe('when isZodV4 is false', () => {
    describe('when strict is true', () => {
      it('should return "object"', () => {
        const result = getObjectFunctionName(false, true);
        expect(result).toBe('object');
      });
    });

    describe('when strict is false', () => {
      it('should return "object"', () => {
        const result = getObjectFunctionName(false, false);
        expect(result).toBe('object');
      });
    });
  });
});

describe('getLooseObjectFunctionName', () => {
  it('should return "looseObject" when isZodV4 is true', () => {
    const result = getLooseObjectFunctionName(true);
    expect(result).toBe('looseObject');
  });

  it('should return "object" when isZodV4 is false', () => {
    const result = getLooseObjectFunctionName(false);
    expect(result).toBe('object');
  });
});
