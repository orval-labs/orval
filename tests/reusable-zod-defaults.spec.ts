import { expect, it } from 'vite-plus/test';

import { Test } from './generated/zod/issue-4255/schemas.zod';

it('preserves literal reference markers and extra keys in reusable defaults', () => {
  expect(Test.parse({}).parameters).toEqual({
    method: 'option_a',
    range: [2, 400],
    extra: 42,
    marker: '__REF_Method__',
    __REF_Method__: 'literal-key',
  });
});
