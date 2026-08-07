import { describe, expect, it } from 'vitest';

import { buildBarrelReExports } from './barrel-re-exports';

const options = { dirname: '/out', extension: '.ts', importExtension: '' };

// Mirrors Angular's `retrievalClient: 'both'` output: one file per tag, each
// repeating the same httpResource boilerplate.
const resourceFile = (tag: string) => ({
  path: `/out/${tag}/${tag}.resource.ts`,
  sharedExports: {
    types: ['OrvalHttpResourceOptions', 'ResourceState'],
    values: ['toResourceState'],
  },
});

describe('buildBarrelReExports', () => {
  it('wildcard-exports every file, in path order', () => {
    expect(
      buildBarrelReExports(
        [
          { path: '/out/pets/pets.resource.ts' },
          { path: '/out/health/health.resource.ts' },
        ],
        options,
      ),
    ).toEqual([
      "export * from './health/health.resource';",
      "export * from './pets/pets.resource';",
    ]);
  });

  it('re-exports names declared by more than one file ahead of the wildcards', () => {
    const lines = buildBarrelReExports(
      [resourceFile('health'), resourceFile('pets')],
      options,
    );

    expect(lines).toEqual([
      "export type { OrvalHttpResourceOptions, ResourceState } from './health/health.resource';",
      "export { toResourceState } from './health/health.resource';",
      "export * from './health/health.resource';",
      "export * from './pets/pets.resource';",
    ]);
  });

  it('leaves a name declared by a single file on its wildcard', () => {
    const lines = buildBarrelReExports(
      [
        resourceFile('health'),
        {
          path: '/out/pets/pets.resource.ts',
          sharedExports: { types: ['SomethingElse'], values: [] },
        },
      ],
      options,
    );

    expect(lines.join('\n')).not.toContain('SomethingElse');
    expect(lines.join('\n')).not.toContain('OrvalHttpResourceOptions');
  });

  it('attributes each shared name to the first file declaring it', () => {
    // `ResourceState` is absent from the first file, so intersecting the
    // shared set with file one would drop it and leave TS2308 unresolved.
    const lines = buildBarrelReExports(
      [
        {
          path: '/out/a/a.resource.ts',
          sharedExports: { types: ['Shared'], values: [] },
        },
        {
          path: '/out/b/b.resource.ts',
          sharedExports: { types: ['Shared', 'ResourceState'], values: [] },
        },
        {
          path: '/out/c/c.resource.ts',
          sharedExports: { types: ['ResourceState'], values: [] },
        },
      ],
      options,
    );

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
      [resourceFile('health'), resourceFile('pets')],
      options,
      ['ResourceState'],
    );

    expect(lines).toContain(
      "export type { OrvalHttpResourceOptions } from './health/health.resource';",
    );
    expect(lines.join('\n')).not.toContain(
      'export type { OrvalHttpResourceOptions, ResourceState }',
    );
  });

  it('ignores files that declare no shared exports', () => {
    const lines = buildBarrelReExports(
      [
        { path: '/out/pets/pets.handlers.ts' },
        { path: '/out/health/health.handlers.ts' },
      ],
      options,
    );

    expect(lines.every((line) => line.startsWith('export *'))).toBe(true);
  });

  it('ignores files outside the barrel directory', () => {
    expect(
      buildBarrelReExports([{ path: '/somewhere-else.resource.ts' }], options),
    ).toEqual([]);
  });

  it('strips a multi-part extension in one piece and adds the import extension', () => {
    expect(
      buildBarrelReExports([{ path: '/out/pets/pets.resource.generated.ts' }], {
        dirname: '/out',
        extension: '.generated.ts',
        importExtension: '.js',
      }),
    ).toEqual(["export * from './pets/pets.resource.js';"]);
  });

  it('returns nothing for no files', () => {
    expect(buildBarrelReExports([], options)).toEqual([]);
  });
});
