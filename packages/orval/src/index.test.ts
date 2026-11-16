import * as cli from '@orval/cli';
import { describe, expect, it } from 'vite-plus/test';

import cliPackage from '../../cli/package.json';
import orvalPackage from '../package.json';
import * as orval from './index';

describe('complete installation API', () => {
  it('preserves the base API and the default generate export', () => {
    expect(Object.keys(orval).sort()).toEqual(Object.keys(cli).sort());
    expect(orval).toEqual(cli);
    expect(orval.default).toBe(orval.generate);
  });

  it.each(['prettier', 'typedoc', 'typedoc-plugin-markdown'] as const)(
    'forwards the optional %s peer to the CLI',
    (name) => {
      expect(orvalPackage).toHaveProperty(
        ['peerDependencies', name],
        cliPackage.peerDependencies[name],
      );
      expect(orvalPackage).toHaveProperty(
        ['peerDependenciesMeta', name, 'optional'],
        true,
      );
    },
  );
});
