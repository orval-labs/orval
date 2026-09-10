import type { PackageJson } from '@orval/core';
import { noopReporter, withReporter } from '@orval/core';
import { describe, expect, it, vi } from 'vite-plus/test';

import { createFrameworkAdapter } from './index';

/**
 * `isQueryV5` answers `false` for a dependency it cannot resolve, so an
 * undetectable version silently generates v4-shaped hooks. On a v5 project that
 * makes the generated `query` option non-partial and `queryKey` mandatory
 * (#2396), so the ambiguity is worth reporting.
 */
describe('undetected query version warning', () => {
  const build = (
    packageJson?: PackageJson,
    queryVersion?: number,
    outputClient: unknown = 'react-query',
  ) => {
    const warn = vi.fn();
    withReporter({ ...noopReporter, warn }, () => {
      createFrameworkAdapter({
        outputClient: outputClient as never,
        packageJson,
        queryVersion,
      });
    });
    return warn.mock.calls.map(([event]) => event.message).join('\n');
  };

  it('warns when neither a package.json nor an explicit version resolves', () => {
    const warnings = build(undefined, undefined, 'svelte-query');

    expect(warnings).toContain('@tanstack/svelte-query');
    expect(warnings).toContain('override.query.version: 5');
  });

  it('stays quiet when the dependency resolves', () => {
    const warnings = build(
      { resolvedVersions: { '@tanstack/vue-query': '5.90.1' } },
      undefined,
      'vue-query',
    );

    expect(warnings).toBe('');
  });

  it('stays quiet when the version is configured explicitly', () => {
    const warnings = build(undefined, 4, 'solid-query');

    expect(warnings).toBe('');
  });

  it('stays quiet for angular-query, which is v5 only', () => {
    const warnings = build(undefined, undefined, 'angular-query');

    expect(warnings).toBe('');
  });

  it('stays quiet for a custom OutputClientFunc', () => {
    // A custom client reaches this generator as the user's own function.
    // Interpolating it into the message printed the function source, and there
    // is no package name to advise on anyway.
    const customClient = () => ({
      client: () => ({ implementation: '', imports: [] }),
    });

    const warnings = build(undefined, undefined, customClient as never);

    expect(warnings).toBe('');
  });

  it('reports a client once, not once per operation', () => {
    // react-query is used here so the dedupe set is not shared with the
    // clients the other cases assert on.
    const first = build(undefined, undefined, 'react-query');
    const second = build(undefined, undefined, 'react-query');

    expect(first).toContain('@tanstack/react-query');
    expect(second).toBe('');
  });
});
