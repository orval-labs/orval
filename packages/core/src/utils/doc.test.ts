import { describe, expect, it } from 'vitest';

import { jsDoc } from './doc';

describe('jsDoc', () => {
  it('includes validators from array items', () => {
    expect(
      jsDoc({
        type: 'array',
        maxItems: 20,
        items: {
          type: 'string',
          maxLength: 50,
          pattern: '^[a-z]+$',
        },
      }),
    ).toBe(`/**
 * @maxItems 20
 * @items.maxLength 50
 * @items.pattern ^[a-z]+$
 */
`);
  });

  it('includes validators from nested array items', () => {
    expect(
      jsDoc({
        type: 'array',
        items: {
          type: 'array',
          minItems: 2,
          maxItems: 5,
          items: {
            type: 'string',
            minLength: 1,
          },
        },
      }),
    ).toBe(`/**
 * @items.minItems 2
 * @items.maxItems 5
 * @items.items.minLength 1
 */
`);
  });

  it('prefixes each line of a multi-line description with *', () => {
    expect(
      jsDoc({
        description: 'line one\nline two\nline three',
      }),
    ).toBe(`/**
 * line one
 * line two
 * line three
 */
`);
  });

  it('prefixes each line of multi-line array descriptions with *', () => {
    expect(
      jsDoc({
        description: ['first\nsecond', 'third'],
      }),
    ).toBe(`/**
 * first
 * second
 * third
 */
`);
  });

  it('stops traversing circular item schemas', () => {
    interface CircularItems {
      [key: string]: unknown;
      items?: CircularItems;
      maxLength: number;
      type: string;
    }

    const circularItems: CircularItems = {
      type: 'string',
      maxLength: 50,
    };
    circularItems.items = circularItems;

    expect(
      jsDoc({
        type: 'array',
        items: circularItems,
      }),
    ).toBe(`/**
 * @items.maxLength 50
 */
`);
  });
});
