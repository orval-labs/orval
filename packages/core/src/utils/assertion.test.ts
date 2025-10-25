import { describe, expect, it } from 'vitest';

import { isUrl } from './assertion';

describe('assertion testing', () => {
  it('check for valid URLs', () => {
    expect(isUrl('http://my-docker-service/docs.json')).toBeTruthy();
    expect(isUrl('https://www.example.com')).toBeTruthy();
    expect(isUrl('http://localhost:8080/docs/spec.yaml')).toBeTruthy();
    expect(isUrl('http://localhost/test.json')).toBeTruthy();
    expect(isUrl('http://localhost:6001/swagger/v1/swagger.json')).toBeTruthy();
    expect(isUrl('D:/a/test.txt')).toBeFalsy();
    expect(isUrl('./file.txt')).toBeFalsy();
  });
});
