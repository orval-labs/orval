import {
  type ClientMockBuilder,
  type GlobalMockOptions,
  OutputMockType,
} from '../types';
import { isFunction } from './assertion';

/**
 * Returns the filename suffix for a given mock entry's output file. For
 * example a `{ type: OutputMockType.MSW }` entry produces `<file>.msw.ts` and
 * a `{ type: OutputMockType.FAKER }` entry produces `<file>.faker.ts`.
 *
 * Custom `ClientMockBuilder` functions default to the `msw` suffix to preserve
 * the historical behavior.
 */
export function getMockFileExtensionByTypeName(
  mock: GlobalMockOptions | ClientMockBuilder,
): OutputMockType {
  if (isFunction(mock)) {
    return OutputMockType.MSW;
  }
  return mock.type;
}
