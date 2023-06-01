import { _filteredVerbs } from './verbs-options';
import { describe, expect, it } from 'vitest';

describe('_filteredVerbs', () => {
  it('should return all verbs if filters.tags is undefined', () => {
    const verbs = {
      get: {
        tags: ['tag1', 'tag2'],
        responses: {},
      },
      post: {
        tags: ['tag3', 'tag4'],
        responses: {},
      },
    };

    const filters = {
      tags: undefined,
    };

    expect(_filteredVerbs(verbs, filters)).toEqual(Object.entries(verbs));
  });

  it('should return verbs that match the tag filter', () => {
    const verbs = {
      get: {
        tags: ['tag1', 'tag2'],
        responses: {},
      },
      post: {
        tags: ['tag3', 'tag4'],
        responses: {},
      },
    };

    const filters = {
      tags: ['tag1'],
    };

    expect(_filteredVerbs(verbs, filters)).toEqual(
      Object.entries({ get: verbs.get }),
    );
  });

  it('should verbs that match the regex filter', () => {
    const verbs = {
      get: {
        tags: ['tag1', 'tag2'],
        responses: {},
      },
      post: {
        tags: ['tag3', 'tag4'],
        responses: {},
      },
    };

    const filters = {
      tags: [/tag1/],
    };

    expect(_filteredVerbs(verbs, filters)).toEqual(
      Object.entries({ get: verbs.get }),
    );
  });
});
