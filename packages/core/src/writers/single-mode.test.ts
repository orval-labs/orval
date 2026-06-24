import os from 'node:os';
import path from 'node:path';

import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createSplitModeOperation,
  createSplitModeOutput,
  createSplitModeProps,
} from '../test-utils/split-modes';
import {
  type GeneratorDependency,
  type GeneratorSchema,
  OutputMockType,
  OutputMode,
} from '../types';
import { writeSingleMode } from './single-mode';

describe('writeSingleMode — separated mocks import inline schemas from the target file', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orval-single-mode-'));
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  it('does not import a non-existent *.schemas file when output.schemas is unset', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const importsMockCalls: Array<{ imports: readonly GeneratorDependency[] }> =
      [];
    const baseProps = createSplitModeProps(target);
    const props = {
      ...baseProps,
      builder: {
        ...baseProps.builder,
        operations: {
          listPets: createSplitModeOperation({
            mockOutputs: [
              {
                type: OutputMockType.MSW,
                implementation: {
                  function: '',
                  handler: '',
                  handlerName: 'mockHandler',
                },
                imports: [{ name: 'Pet' }],
              },
            ],
          }),
        },
        importsMock: (args: { imports: readonly GeneratorDependency[] }) => {
          importsMockCalls.push(args);
          return '';
        },
      },
      output: createSplitModeOutput(target, {
        mode: OutputMode.SINGLE,
        indexFiles: true,
        schemas: undefined,
        mock: {
          indexMockFiles: false,
          path: path.join(tmpDir, 'mocks'),
          generators: [{ type: OutputMockType.MSW }],
        },
      }),
      generateSchemasInline: () => 'export interface Pet {}\n',
    };

    await writeSingleMode({ ...props, needSchema: true });

    expect(fs.existsSync(path.join(tmpDir, 'petstore.schemas.ts'))).toBe(false);
    expect(importsMockCalls.length).toBeGreaterThan(0);
    expect(importsMockCalls[0]?.imports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dependency: '../petstore' }),
      ]),
    );
    expect(importsMockCalls[0]?.imports).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dependency: '../petstore.schemas' }),
      ]),
    );
  });
});

// Regression coverage for https://github.com/orval-labs/orval/issues/3627
//
// On wide specs with `faker schemas: true`, shared-array import aggregation
// can strip `get<X>Mock()` factory imports from `mockOutput.imports`.
// split-mode, tags-mode, and split-tags-mode all recover these by scanning
// the finalized mock implementation. single-mode was the only writer missing
// this recovery — both the inline branch and the de-inlined branch.

const petSchema: GeneratorSchema = {
  name: 'Pet',
  model: 'export type Pet = { id: number };',
  imports: [],
  schema: { type: 'object', properties: { id: { type: 'integer' } } },
};

const createRecoveryProps = (target: string) => {
  const baseProps = createSplitModeProps(target);
  return {
    ...baseProps,
    builder: {
      ...baseProps.builder,
      schemas: [petSchema],
      operations: {
        listPets: createSplitModeOperation({
          mockOutputs: [
            {
              type: OutputMockType.FAKER,
              implementation: {
                function:
                  'export const getPetResponseMock = () => ({ ...getPetMock() });',
                handler: '',
                handlerName: '',
              },
              imports: [],
            },
          ],
        }),
      },
    } as typeof baseProps.builder,
    output: createSplitModeOutput(target, {
      mode: OutputMode.SINGLE,
      indexFiles: true,
      schemas: path.join(path.dirname(target), 'model'),
      mock: {
        indexMockFiles: false,
        generators: [{ type: OutputMockType.FAKER, schemas: true }],
      },
    }),
  };
};

describe('writeSingleMode — recovers schema-factory imports stripped by aggregation (inline mocks)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orval-single-mode-'));
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  it('recovers getPetMock() missing from mockOutput.imports', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const importsMockCalls: Array<{ imports: readonly GeneratorDependency[] }> =
      [];
    const props = createRecoveryProps(target);

    props.builder.importsMock = ({
      imports,
    }: {
      imports: readonly GeneratorDependency[];
    }) => {
      importsMockCalls.push({ imports });
      return '';
    };

    await writeSingleMode({ ...props, needSchema: false });

    expect(importsMockCalls.length).toBeGreaterThan(0);
    const allExportNames = importsMockCalls.flatMap((call) =>
      call.imports.flatMap((dep) => dep.exports.map((entry) => entry.name)),
    );
    expect(allExportNames).toContain('getPetMock');
  });
});

describe('writeSingleMode — recovers schema-factory imports stripped by aggregation (de-inlined mocks)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orval-single-mode-'));
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  it('recovers getPetMock() in the generated .faker.ts file', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const props = createRecoveryProps(target);

    props.output.mock.path = path.join(tmpDir, 'mocks');
    props.builder.importsMock = ({
      imports,
    }: {
      imports: readonly GeneratorDependency[];
    }) =>
      imports
        .map(
          ({ dependency, exports }: GeneratorDependency) =>
            `import { ${exports.map((entry) => entry.name).join(', ')} } from '${dependency}';`,
        )
        .join('\n');

    await writeSingleMode({ ...props, needSchema: false });

    const mockContent = await fs.readFile(
      path.join(tmpDir, 'mocks', 'petstore.faker.ts'),
      'utf8',
    );
    expect(mockContent).toMatch(/import\s*\{[^}]*getPetMock[^}]*\}\s*from/);
  });
});
