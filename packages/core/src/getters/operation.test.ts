import type { OperationObject } from 'openapi3-ts/oas30';
import { describe, expect, it } from 'vitest';

import { getOperationId } from './operation';

describe('getOperationId getter', () => {
  for (const [input, expected] of [
    ['/api/test/{id}', 'ApiTestId'],
    ['/api/test/{user_id}', 'ApiTestUserId'],
    ['/api/test/{locale}.js', 'ApiTestLocaleJs'],
    ['/api/test/i18n-{locale}.js', 'ApiTestI18nLocaleJs'],
    ['/api/test/{param1}-{param2}.js', 'ApiTestParam1Param2Js'],
    ['/api/test/user{param1}-{param2}.html', 'ApiTestUserparam1Param2Html'],
  ]) {
    it(`should process ${input} to ${expected}`, () => {
      expect(getOperationId({} as OperationObject, input, '')).toBe(expected);
    });
  }
});
