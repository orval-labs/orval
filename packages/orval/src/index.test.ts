import * as cli from '@orval/cli';
import { describe, expect, it } from 'vite-plus/test';

import * as orval from './index';

describe('complete installation API', () => {
  it('preserves the base API and the default generate export', () => {
    expect(Object.keys(orval).sort()).toEqual(Object.keys(cli).sort());
    expect(orval).toEqual(cli);
    expect(orval.default).toBe(orval.generate);
  });
});
