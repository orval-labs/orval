import { describe, expect, it } from 'vite-plus/test';

import { getComponentBaseNames, getOperationUrlHelperNames } from './name';

describe('getComponentBaseNames', () => {
  it('keeps non-colliding names as their PascalCase form', () => {
    expect([
      ...getComponentBaseNames({ pet: {}, 'user-info': {} }).entries(),
    ]).toEqual([
      ['pet', 'Pet'],
      ['user-info', 'UserInfo'],
    ]);
  });

  it('gives the PascalCase key the plain name regardless of order', () => {
    const names = getComponentBaseNames({
      address: {},
      Address: {},
      ADDRESS: {},
    });
    expect(names.get('Address')).toBe('Address');
    expect(names.get('address')).toBe('Address2');
    expect(names.get('ADDRESS')).toBe('Address3');
  });

  it('falls back to the first declared key and skips taken suffixes', () => {
    const names = getComponentBaseNames({
      address: {},
      'address-': {},
      Address2: {},
    });
    expect(names.get('address')).toBe('Address');
    expect(names.get('Address2')).toBe('Address2');
    expect(names.get('address-')).toBe('Address3');
  });

  it('checks collisions on the sanitized identifier', () => {
    // `1Address` and `N1Address` only meet once sanitized (`N1Address`), and
    // the suffixed `1Address2` would sanitize onto the existing `N1Address2`.
    const names = getComponentBaseNames({
      '1-address': {},
      '1-Address': {},
      N1Address2: {},
    });
    const identifiers = [...names.values()].map((name) =>
      /^[0-9]/.test(name) ? `N${name}` : name,
    );
    expect(new Set(identifiers).size).toBe(3);
    expect(names.get('N1Address2')).toBe('N1Address2');
  });
});

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
