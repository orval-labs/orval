import { describe, expect, it } from 'vitest';

import { compareNatural } from './sort';

describe('compareNatural', () => {
  it('matches existing English numeric localeCompare ordering', () => {
    const values = [
      'item10',
      'item2',
      'item1',
      'Item2',
      'item-2',
      'item_2',
      'item.2',
      'item02',
      'item',
      'item20',
      'item11',
      'item1a',
      'item1b',
    ];

    expect([...values].sort(compareNatural)).toEqual(
      [...values].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })),
    );
  });

  it('returns zero for equal strings', () => {
    expect(compareNatural('schema10', 'schema10')).toBe(0);
  });
});
