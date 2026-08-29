import { describe, expect, it } from 'vite-plus/test';

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

  it('picks a later file as canonical when only later files share the name', () => {
    // Regression: `canonical` must not be pinned to `entries[0]` — the first
    // file here declares only a name unique to it, so a canonical picker that
    // always looks at the first entry would never see `Shared` declared there
    // and would leave both later files wildcard-exporting it, keeping the
    // TS2308 ambiguity unresolved.
    const lines = buildBarrelReExports(
      [
        {
          path: '/out/a/a.resource.ts',
          sharedExports: { types: ['OnlyInA'], values: [] },
        },
        {
          path: '/out/b/b.resource.ts',
          sharedExports: { types: ['Shared'], values: [] },
        },
        {
          path: '/out/c/c.resource.ts',
          sharedExports: { types: ['Shared'], values: [] },
        },
      ],
      options,
    );

    expect(lines).toEqual([
      "export type { Shared } from './b/b.resource';",
      "export * from './a/a.resource';",
      "export * from './b/b.resource';",
      "export * from './c/c.resource';",
    ]);
  });

  it('skips names the barrel already re-exports by name', () => {
    const lines = buildBarrelReExports(
      [resourceFile('health'), resourceFile('pets')],
      options,
      { types: ['ResourceState'] },
    );

    expect(lines).toContain(
      "export type { OrvalHttpResourceOptions } from './health/health.resource';",
    );
    expect(lines.join('\n')).not.toContain(
      'export type { OrvalHttpResourceOptions, ResourceState }',
    );
  });

  it('claims a name as both a type and a value when different files declare each', () => {
    // Regression: claiming `Shared` as a type in one file must not suppress
    // the explicit value re-export another file still needs — a single
    // shared `claimed` set across categories left the value wildcard-only,
    // which TypeScript still reports as TS2308.
    const lines = buildBarrelReExports(
      [
        {
          path: '/out/a/a.resource.ts',
          sharedExports: { types: ['Shared'], values: [] },
        },
        {
          path: '/out/b/b.resource.ts',
          sharedExports: { types: ['Shared'], values: ['Shared'] },
        },
      ],
      options,
    );

    expect(lines).toContain("export type { Shared } from './a/a.resource';");
    expect(lines).toContain("export { Shared } from './b/b.resource';");
  });

  it('preclaiming a name as a type does not preclaim it as a value', () => {
    const lines = buildBarrelReExports(
      [
        {
          path: '/out/a/a.resource.ts',
          sharedExports: { types: [], values: ['Shared'] },
        },
        {
          path: '/out/b/b.resource.ts',
          sharedExports: { types: [], values: ['Shared'] },
        },
      ],
      options,
      { types: ['Shared'] },
    );

    expect(lines).toContain("export { Shared } from './a/a.resource';");
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
