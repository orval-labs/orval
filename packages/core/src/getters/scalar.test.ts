import { OperationObject } from 'openapi3-ts/oas30';
import { getScalar } from './scalar';
import { expect } from 'vitest';

describe('getScalar getter', () => {

  const context = {
    output: {
      override: {
        customStringFormatResolver: (format: string) => {
          switch (format) {
            case 'date':
              return 'TestDateTime'
            case 'date-time':
              return 'TestDate'
            case 'password':
              return 'TestPassword'
          }
        }
      }
    }
  } as ContextSpecs;

        [
        ['date', 'TestDateTime'],
          ['date-time', 'TestDate'],
          ['password', 'TestPassword'],
        ].forEach(([input, expected]) => {
        it(`should process ${input} to ${expected}`, () => {
          expect(getScalar({
            item: {
              type: 'string',
              format: input
            },
            name: '',
            context,
          })).toEqual(expect.objectContaining({value: expected}));
        });
      })

    it('should return string if resolver does not have a match for format', () => {
      expect(getScalar({
        item: {
          type: 'string',
          format: 'int64'
        },
        name: '',
        context,
      })).toEqual(expect.objectContaining({value: "string"}));
    })
});
