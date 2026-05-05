import type { ResReqTypesValue, Verbs } from '@orval/core';
import { describe, expect, it } from 'vitest';

import {
  createReturnTypesRegistry,
  createRouteRegistry,
  generateAngularTitle,
  getDefaultSuccessType,
  isMutationVerb,
  isRetrievalVerb,
} from './utils';

// ---------------------------------------------------------------------------
// generateAngularTitle
// ---------------------------------------------------------------------------

describe('generateAngularTitle', () => {
  it('pascal-cases a simple title and appends Service', () => {
    expect(generateAngularTitle('pet')).toBe('PetService');
  });

  it('handles multi-word titles', () => {
    expect(generateAngularTitle('pet store')).toBe('PetstoreService');
  });

  it('handles already pascal-cased titles', () => {
    expect(generateAngularTitle('PetStore')).toBe('PetStoreService');
  });
});

// ---------------------------------------------------------------------------
// isRetrievalVerb / isMutationVerb
// ---------------------------------------------------------------------------

describe('isRetrievalVerb', () => {
  it('returns true for GET regardless of operationName', () => {
    expect(isRetrievalVerb('get' as Verbs)).toBe(true);
    expect(isRetrievalVerb('get' as Verbs, 'deletePet')).toBe(true);
  });

  it.each([
    'searchPets',
    'listPets',
    'findPet',
    'queryUsers',
    'getPetById',
    'fetchOrders',
    'lookupAddress',
  ])('returns true for POST with retrieval name "%s"', (operationName) => {
    expect(isRetrievalVerb('post' as Verbs, operationName)).toBe(true);
  });

  it.each([
    'SearchPets',
    'SEARCH_PETS',
    'ListAllItems',
    'FindByName',
    'GetUser',
    'FetchData',
    'LookupRecord',
    'QueryResults',
  ])('is case-insensitive for retrieval prefix "%s"', (operationName) => {
    expect(isRetrievalVerb('post' as Verbs, operationName)).toBe(true);
  });

  it.each(['createPet', 'updateUser', 'deletePet', 'postMessage', 'sendEmail'])(
    'returns false for POST with mutation name "%s"',
    (operationName) => {
      expect(isRetrievalVerb('post' as Verbs, operationName)).toBe(false);
    },
  );

  it('returns false for POST without operationName', () => {
    expect(isRetrievalVerb('post' as Verbs)).toBe(false);
  });

  it.each(['put', 'patch', 'delete', 'head', 'options'] as Verbs[])(
    'returns false for %s verb',
    (verb) => {
      expect(isRetrievalVerb(verb)).toBe(false);
    },
  );

  describe('per-operation clientOverride', () => {
    it('httpResource override forces POST mutation to be retrieval', () => {
      expect(
        isRetrievalVerb('post' as Verbs, 'createPet', 'httpResource'),
      ).toBe(true);
    });

    it('httpClient override forces GET to be mutation', () => {
      expect(isRetrievalVerb('get' as Verbs, 'getPetById', 'httpClient')).toBe(
        false,
      );
    });

    it('httpClient override forces POST retrieval-name to be mutation', () => {
      expect(isRetrievalVerb('post' as Verbs, 'searchPets', 'httpClient')).toBe(
        false,
      );
    });

    it('httpResource override forces PUT to be retrieval', () => {
      expect(isRetrievalVerb('put' as Verbs, 'updatePet', 'httpResource')).toBe(
        true,
      );
    });

    it('both override falls through to default heuristic', () => {
      expect(isRetrievalVerb('get' as Verbs, 'getPet', 'both')).toBe(true);
      expect(isRetrievalVerb('post' as Verbs, 'createPet', 'both')).toBe(false);
    });

    it('undefined override falls through to default heuristic', () => {
      expect(isRetrievalVerb('post' as Verbs, 'searchPets')).toBe(true);
      expect(isRetrievalVerb('post' as Verbs, 'createPet')).toBe(false);
    });
  });
});

describe('isMutationVerb', () => {
  it('is the inverse of isRetrievalVerb', () => {
    expect(isMutationVerb('get' as Verbs)).toBe(false);
    expect(isMutationVerb('post' as Verbs, 'createPet')).toBe(true);
    expect(isMutationVerb('post' as Verbs, 'searchPets')).toBe(false);
    expect(isMutationVerb('put' as Verbs)).toBe(true);
    expect(isMutationVerb('patch' as Verbs)).toBe(true);
    expect(isMutationVerb('delete' as Verbs)).toBe(true);
  });

  it('respects clientOverride', () => {
    expect(isMutationVerb('get' as Verbs, 'getPet', 'httpClient')).toBe(true);
    expect(isMutationVerb('post' as Verbs, 'createPet', 'httpResource')).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// createRouteRegistry
// ---------------------------------------------------------------------------

describe('createRouteRegistry', () => {
  it('stores and retrieves routes', () => {
    const registry = createRouteRegistry();
    registry.set('getPetById', '/api/pets/${petId}');
    expect(registry.get('getPetById', '/fallback')).toBe('/api/pets/${petId}');
  });

  it('returns fallback for unknown operations', () => {
    const registry = createRouteRegistry();
    expect(registry.get('unknown', '/fallback')).toBe('/fallback');
  });

  it('clears all entries on reset', () => {
    const registry = createRouteRegistry();
    registry.set('getPetById', '/api/pets/${petId}');
    registry.reset();
    expect(registry.get('getPetById', '/fallback')).toBe('/fallback');
  });

  it('overwrites existing routes', () => {
    const registry = createRouteRegistry();
    registry.set('getPetById', '/v1/pets/${petId}');
    registry.set('getPetById', '/v2/pets/${petId}');
    expect(registry.get('getPetById', '/fallback')).toBe('/v2/pets/${petId}');
  });
});

// ---------------------------------------------------------------------------
// createReturnTypesRegistry
// ---------------------------------------------------------------------------

describe('createReturnTypesRegistry', () => {
  it('stores and retrieves type definitions', () => {
    const registry = createReturnTypesRegistry();
    registry.set('getPetById', 'export type GetPetByIdResult = Pet');

    const footer = registry.getFooter(['getPetById']);
    expect(footer).toBe('export type GetPetByIdResult = Pet');
  });

  it('filters by provided operationNames', () => {
    const registry = createReturnTypesRegistry();
    registry.set('getPetById', 'export type GetPetByIdResult = Pet');
    registry.set('listPets', 'export type ListPetsResult = Pet[]');

    const footer = registry.getFooter(['getPetById']);
    expect(footer).toBe('export type GetPetByIdResult = Pet');
    expect(footer).not.toContain('ListPets');
  });

  it('returns empty string for no matching operations', () => {
    const registry = createReturnTypesRegistry();
    registry.set('getPetById', 'export type GetPetByIdResult = Pet');

    expect(registry.getFooter(['unknownOp'])).toBe('');
  });

  it('joins multiple types with newlines', () => {
    const registry = createReturnTypesRegistry();
    registry.set('getPetById', 'type A');
    registry.set('listPets', 'type B');

    const footer = registry.getFooter(['getPetById', 'listPets']);
    expect(footer).toBe('type A\ntype B');
  });

  it('clears all entries on reset', () => {
    const registry = createReturnTypesRegistry();
    registry.set('getPetById', 'type A');
    registry.reset();
    expect(registry.getFooter(['getPetById'])).toBe('');
  });
});

// ---------------------------------------------------------------------------
// getDefaultSuccessType
// ---------------------------------------------------------------------------

describe('getDefaultSuccessType', () => {
  const makeType = (value: string, contentType: string): ResReqTypesValue =>
    ({
      value,
      contentType,
      key: '200',
      type: 'object',
      isEnum: false,
      hasReadonlyProps: false,
      imports: [],
      schemas: [],
      isRef: false,
      dependencies: [],
    }) as ResReqTypesValue;

  it('returns the single content type when there is only one', () => {
    const result = getDefaultSuccessType(
      [makeType('Pet', 'application/json')],
      'unknown',
    );
    expect(result.contentType).toBe('application/json');
    expect(result.value).toBe('Pet');
  });

  it('falls back to application/json when no content types exist', () => {
    const result = getDefaultSuccessType(
      [{ ...makeType('Pet', ''), contentType: '' }],
      'Pet',
    );
    expect(result.contentType).toBe('application/json');
  });

  it('prefers application/json when multiple content types include json', () => {
    const result = getDefaultSuccessType(
      [
        makeType('string', 'text/plain'),
        makeType('Pet', 'application/json'),
        makeType('Pet', 'application/xml'),
      ],
      'unknown',
    );
    expect(result.contentType).toBe('application/json');
    expect(result.value).toBe('Pet');
  });

  it('uses fallback value when no matching type is found', () => {
    const result = getDefaultSuccessType([], 'FallbackType');
    expect(result.value).toBe('FallbackType');
  });
});
