import type { ClientMockBuilder, GlobalMockOptions } from '../types.ts';
import { isFunction } from './assertion.ts';

export function getMockFileExtensionByTypeName(
  mock: GlobalMockOptions | ClientMockBuilder,
) {
  if (isFunction(mock)) {
    return 'msw';
  }
  switch (mock.type) {
    default: {
      // case 'msw':
      return 'msw';
    }
  }
}
