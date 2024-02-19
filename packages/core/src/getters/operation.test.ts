import { OperationObject } from 'openapi3-ts/oas30';
import { getOperationId } from './operation';

describe('getOperationId getter', () => {
  [
    ['/api/test/{id}', 'ApiTestId'],
    ['/api/test/{user_id}', 'ApiTestUserId'],
    ['/api/test/{locale}.js', 'ApiTestLocaleJs'],
    ['/api/test/i18n-{locale}.js', 'ApiTestI18nLocaleJs'],
    ['/api/test/{param1}-{param2}.js', 'ApiTestParam1Param2Js'],
    ['/api/test/user{param1}-{param2}.html', 'ApiTestUserparam1Param2Html'],
  ].forEach(([input, expected]) => {
    it(`should process ${input} to ${expected}`, () => {
      expect(getOperationId({} as OperationObject, input, '')).toBe(expected);
    });
  });
});
