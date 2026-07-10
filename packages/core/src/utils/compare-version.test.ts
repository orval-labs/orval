import { describe, expect, it } from 'vitest';

import { compareVersions } from './compare-version';

describe('compareVersions', () => {
  it('compares npm alias version ranges', () => {
    expect(compareVersions('npm:@typescript/typescript6@^6.0.0', '4.5.0')).toBe(
      true,
    );
  });

  it('compares npm alias exact versions', () => {
    expect(compareVersions('npm:typescript@4.4.0', '4.5.0')).toBe(false);
  });
});
