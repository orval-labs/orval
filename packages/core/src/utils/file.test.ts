import { describe, expect, it } from 'vite-plus/test';

import { stripFileExtension } from './file';

describe('stripFileExtension', () => {
  it('strips a multi-part fileExtension in one piece', () => {
    // Regression: stripping only the last dot-segment leaves `.generated`
    // behind, so appending an import extension doubles the suffix
    // (`pets.generated.ts` -> `pets.generated` -> `pets.generated.generated`).
    expect(stripFileExtension('./pets.generated.ts', '.generated.ts')).toBe(
      './pets',
    );
  });

  it('appends cleanly after stripping a multi-part extension', () => {
    const withoutExt = stripFileExtension(
      './pets.generated.ts',
      '.generated.ts',
    );
    expect(withoutExt + '.js').toBe('./pets.js');
  });

  it('falls back to stripping the last segment for a plain extension', () => {
    expect(stripFileExtension('./pets.ts', '.ts')).toBe('./pets');
  });

  it('falls back to stripping the last segment when the path does not end with the configured extension', () => {
    expect(stripFileExtension('./pets.schemas.ts', '.generated.ts')).toBe(
      './pets.schemas',
    );
  });

  it('leaves a dot in a directory name alone', () => {
    expect(stripFileExtension('./v1.0/pets.ts', '.generated.ts')).toBe(
      './v1.0/pets',
    );
  });
});
