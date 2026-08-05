import { describe, expect, it } from 'vitest';

import { buildBarrelReExports } from './barrel-re-exports';

// Mirrors Angular's `retrievalClient: 'both'` output: one file per tag, each
// repeating the same httpResource boilerplate.
const resourceEntry = (tag: string) => ({
  specifier: `./${tag}/${tag}.resource`,
  sharedExports: {
    types: ['OrvalHttpResourceOptions', 'ResourceState'],
    values: ['toResourceState'],
  },
});

describe('buildBarrelReExports', () => {
  it('wildcard-exports every entry', () => {
    expect(
      buildBarrelReExports([
        { specifier: './pets/pets.resource' },
        { specifier: './health/health.resource' },
      ]),
    ).toEqual([
      "export * from './pets/pets.resource';",
      "export * from './health/health.resource';",
    ]);
  });

  it('re-exports names declared by more than one entry ahead of the wildcards', () => {
    const lines = buildBarrelReExports([
      resourceEntry('health'),
      resourceEntry('pets'),
    ]);

    expect(lines).toEqual([
      "export type { OrvalHttpResourceOptions, ResourceState } from './health/health.resource';",
      "export { toResourceState } from './health/health.resource';",
      "export * from './health/health.resource';",
      "export * from './pets/pets.resource';",
    ]);
  });

  it('leaves a name declared by a single entry on its wildcard', () => {
    const lines = buildBarrelReExports([
      resourceEntry('health'),
      {
        specifier: './pets/pets.resource',
        sharedExports: { types: ['SomethingElse'], values: [] },
      },
    ]);

    expect(lines.join('\n')).not.toContain('SomethingElse');
    expect(lines.join('\n')).not.toContain('OrvalHttpResourceOptions');
  });

  it('attributes each shared name to the first entry declaring it', () => {
    // `ResourceState` is absent from the first entry, so intersecting the
    // shared set with entry one would drop it and leave TS2308 unresolved.
    const lines = buildBarrelReExports([
      {
        specifier: './a/a.resource',
        sharedExports: { types: ['Shared'], values: [] },
      },
      {
        specifier: './b/b.resource',
        sharedExports: { types: ['Shared', 'ResourceState'], values: [] },
      },
      {
        specifier: './c/c.resource',
        sharedExports: { types: ['ResourceState'], values: [] },
      },
    ]);

    expect(lines).toEqual([
      "export type { Shared } from './a/a.resource';",
      "export type { ResourceState } from './b/b.resource';",
      "export * from './a/a.resource';",
      "export * from './b/b.resource';",
      "export * from './c/c.resource';",
    ]);
  });

  it('skips names the barrel already re-exports by name', () => {
    const lines = buildBarrelReExports(
      [resourceEntry('health'), resourceEntry('pets')],
      ['ResourceState'],
    );

    expect(lines).toContain(
      "export type { OrvalHttpResourceOptions } from './health/health.resource';",
    );
    expect(lines.join('\n')).not.toContain(
      'export type { OrvalHttpResourceOptions, ResourceState }',
    );
  });

  it('ignores entries that declare no shared exports', () => {
    const lines = buildBarrelReExports([
      { specifier: './pets/pets.handlers' },
      { specifier: './health/health.handlers' },
    ]);

    expect(lines.every((line) => line.startsWith('export *'))).toBe(true);
  });

  it('returns nothing for no entries', () => {
    expect(buildBarrelReExports([])).toEqual([]);
  });
});
