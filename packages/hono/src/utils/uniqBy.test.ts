import { uniqBy } from './uniqBy';
import { describe, expect, it } from 'vitest';

describe('uniqBy', () => {
  it.each([
    {
      name: 'should remove duplicate elements',
      param: [
        { id: '1' },
        { id: '2' },
        { id: '3' },
        { id: '3' },
        { id: '4' },
        { id: '4' },
        { id: '4' },
        { id: '1' },
      ],
      expected: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }],
    },
    {
      name: 'should do nothing if no duplicates exist',
      param: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }],
      expected: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }],
    },
  ])(`$name`, ({ param, expected }) => {
    expect(uniqBy(param, 'id')).toStrictEqual(expected);
  });
});
