import { run } from '../../testing-helper';
import { WriteSpecsProps } from '../../types/writers';

describe('schemaDefinition generateSchemasDefinition', () => {
  it('not include unknown', async () => {
    const results = await run(
      '/tests/specifications/core/generators/schemaDefinition/all-of-case.yaml',
    );
    expect(JSON.stringify(results['schemas']['test']).includes('unknown')).toBe(
      false,
    );
  });
});
