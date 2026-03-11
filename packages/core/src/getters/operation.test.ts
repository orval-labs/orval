import { describe, expect, it } from 'vitest';

import { type OpenApiOperationObject, Verbs } from '../types';
import { getOperationId } from './operation';

describe('getOperationId getter', () => {
  for (const [input, expected] of [
    ['/api/test/{id}', 'GetApiTestId'],
    ['/api/test/{user_id}', 'GetApiTestUserId'],
    ['/api/test/{locale}.js', 'GetApiTestLocaleJs'],
    ['/api/test/i18n-{locale}.js', 'GetApiTestI18nLocaleJs'],
    ['/api/test/{param1}-{param2}.js', 'GetApiTestParam1Param2Js'],
    ['/api/test/user{param1}-{param2}.html', 'GetApiTestUserparam1Param2Html'],
  ]) {
    it(`should process ${input} to ${expected}`, () => {
      expect(
        getOperationId({} as OpenApiOperationObject, input, Verbs.GET),
      ).toBe(expected);
    });
  }
});
