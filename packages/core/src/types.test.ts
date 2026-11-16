import type { escapePath as escapeGlobPath } from 'tinyglobby';
import { describe, expectTypeOf, it } from 'vite-plus/test';

import type { escapePath } from './utils/file';

describe('public helper types', () => {
  it('preserves the glob escaping helper signature', () => {
    expectTypeOf<typeof escapePath>().toEqualTypeOf<typeof escapeGlobPath>();
  });
});
