import { describe, expect, it } from 'vitest';

import type { NormalizedInputOptions } from '../types.ts';
import { _filteredVerbs } from './verbs-options.ts';

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

    const filters: NormalizedInputOptions['filters'] = {
      tags: ['tag1'],
    };

    expect(_filteredVerbs(verbs, filters)).toEqual(
      Object.entries({ get: verbs.get }),
    );
  });

  it('should return verbs that match the regex filter', () => {
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

    const filters: NormalizedInputOptions['filters'] = {
      tags: [/tag1/],
    };

    expect(_filteredVerbs(verbs, filters)).toEqual(
      Object.entries({ get: verbs.get }),
    );
  });

  describe('filters.mode', () => {
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

      const filters: NormalizedInputOptions['filters'] = {
        tags: ['tag1'],
        mode: 'include',
      };

      expect(_filteredVerbs(verbs, filters)).toEqual(
        Object.entries({ get: verbs.get }),
      );
    });

    it('should return verbs that do not match the tag filter', () => {
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

      const filters: NormalizedInputOptions['filters'] = {
        tags: ['tag1'],
        mode: 'exclude',
      };

      expect(_filteredVerbs(verbs, filters)).toEqual(
        Object.entries({ post: verbs.post }),
      );
    });
  });
});
