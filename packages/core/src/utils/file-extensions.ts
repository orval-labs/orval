import type { ClientMockBuilder, GlobalMockOptions } from '../types';
import { isFunction } from './assertion';

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
