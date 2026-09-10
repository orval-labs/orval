import { describe, expect, it } from 'vite-plus/test';

import { getOperationUrlHelperNames } from './name';

describe('getOperationUrlHelperNames', () => {
  it('reserves operation names and resolves collisions deterministically', () => {
    expect(
      getOperationUrlHelperNames(['foo', 'getFooUrl'], ['foo', 'getFooUrl']),
    ).toEqual(['getFooUrl2', 'getGetFooUrlUrl']);
  });

  it('keeps non-conflicting helper names unchanged', () => {
    expect(
      getOperationUrlHelperNames(
        ['listPets', 'createPet'],
        ['listPets', 'createPet'],
      ),
    ).toEqual(['getListPetsUrl', 'getCreatePetUrl']);
  });

  it('does not let a fallback collide with another operation or helper', () => {
    expect(
      getOperationUrlHelperNames(
        ['foo', 'getFooUrl', 'getFooUrl2'],
        ['foo', 'getFooUrl', 'getFooUrl2'],
      ),
    ).toEqual(['getFooUrl3', 'getGetFooUrlUrl', 'getGetFooUrl2Url']);
  });
});
