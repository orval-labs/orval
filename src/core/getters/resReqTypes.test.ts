import { run } from '../../testing-helper';
import { WriteSpecsProps } from '../../types/writers';

export const overrideCaseMatcher = (results: WriteSpecsProps, name: string) => {
  const target = results['schemas']['test'].find((obj) => obj.name === name);
  try {
    expect(target?.model?.includes('override description')).toBe(true);
    expect(target?.model?.includes('@deprecated')).toBe(true);
    expect(target?.model?.includes('date: string;')).toBe(true);
  } catch (e) {
    console.log(`failed target \n ${JSON.stringify(target, null, '\t')}`);
    throw e;
  }
  return target;
};

describe('resReqTypes getResReqTypes', () => {
  it('[TopLevelAllOf] correct response type', async () => {
    const results = await run(
      '/tests/specifications/core/getters/resReqTypes/all-of-case.yaml',
    );
    overrideCaseMatcher(results, 'TopLevelAllOf201');
    overrideCaseMatcher(results, 'TopLevelAllOf201Children');
  });

  it('[TopLevelAllOf] > [NestedAllOf] correct response type', async () => {
    const results = await run(
      '/tests/specifications/core/getters/resReqTypes/all-of-case.yaml',
    );
    overrideCaseMatcher(results, 'TopLevelAllOf201NestedTopLevelAllOf');
    overrideCaseMatcher(results, 'TopLevelAllOf201NestedTopLevelAllOfTwoTest');
  });

  it('[NestedAllOf] correct response type', async () => {
    const results = await run(
      '/tests/specifications/core/getters/resReqTypes/all-of-case.yaml',
    );
    overrideCaseMatcher(results, 'NestedAllOf201Test');
    overrideCaseMatcher(results, 'NestedAllOf201TestChildren');

    // override with ref
    const NestedAllOf201TestReverse = results['schemas']['test'].find(
      (obj) => obj.name === 'NestedAllOf201TestReverse',
    );
    expect(
      NestedAllOf201TestReverse?.model?.includes('my type description'),
    ).toBe(true);
    expect(NestedAllOf201TestReverse?.model?.includes('date: string;')).toBe(
      true,
    );
  });

  it('[ArrayTopLevelAllOf][ArrayNestedAllOf] and so on... not include unknown', async () => {
    const results = await run(
      '/tests/specifications/core/getters/resReqTypes/all-of-case.yaml',
    );
    expect(JSON.stringify(results['schemas']['test']).includes('unknown')).toBe(
      false,
    );
  });
});
