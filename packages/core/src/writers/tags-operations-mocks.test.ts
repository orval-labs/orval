import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import {
  createSplitModeOperation,
  createSplitModeOutput,
  createSplitModeProps,
} from '../test-utils/split-modes';
import {
  type GeneratorMockOutputFull,
  type GlobalMockOptions,
  OutputClient,
  OutputMockType,
  OutputMode,
} from '../types';
import { writeTagsOperationsMode } from './tags-operations-mode';
import { writeTagsOperationsSplitMode } from './tags-operations-split-mode';

const responseMock =
  'export const getListPetsResponseMock = (): Pet[] => [];\n\n';

const mswOutput: GeneratorMockOutputFull = {
  type: OutputMockType.MSW,
  implementation: {
    function: responseMock,
    handler:
      'export const getListPetsMockHandler = (overrideResponse?: Pet[]) => http.get("*/pets", () => HttpResponse.json(overrideResponse !== undefined ? overrideResponse : getListPetsResponseMock()));\n',
    handlerName: 'getListPetsMockHandler',
  },
  imports: [],
};

const fakerOutput: GeneratorMockOutputFull = {
  type: OutputMockType.FAKER,
  implementation: { function: responseMock, handler: '', handlerName: '' },
  imports: [],
};

const modes = [
  {
    mode: OutputMode.TAGS_OPERATIONS,
    write: writeTagsOperationsMode,
  },
  {
    mode: OutputMode.TAGS_OPERATIONS_SPLIT,
    write: writeTagsOperationsSplitMode,
  },
] as const;

describe.each(modes)('$mode mock files', ({ mode, write }) => {
  let tmpDir: string;
  let mockDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orval-tags-ops-mocks-'));
    mockDir = path.join(tmpDir, 'mocks');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const run = async (
    mockOutputs: GeneratorMockOutputFull[],
    generators: GlobalMockOptions[],
    indexMockFiles = false,
  ) => {
    const target = path.join(tmpDir, 'petstore.ts');
    const baseProps = createSplitModeProps(target);
    return write({
      ...baseProps,
      builder: {
        ...baseProps.builder,
        operations: {
          listPets: createSplitModeOperation({
            tags: ['pets'],
            operationName: 'listPets',
            mockOutputs,
          }),
        },
      },
      output: createSplitModeOutput(target, {
        mode,
        client: OutputClient.REACT_QUERY,
        mock: { indexMockFiles, inline: false, path: mockDir, generators },
      }),
      needSchema: false,
    });
  };

  const read = (...segments: string[]) =>
    fs.readFileSync(path.join(mockDir, ...segments), 'utf8');

  it('writes the faker response factories of each operation', async () => {
    const paths = await run(
      [fakerOutput],
      [{ type: OutputMockType.FAKER, operationResponses: true }],
    );

    const fakerPath = path.join(mockDir, 'pets', 'list-pets.faker.ts');
    expect(paths).toContain(fakerPath);
    expect(read('pets', 'list-pets.faker.ts')).toContain(
      'export const getListPetsResponseMock',
    );
  });

  it('keeps the factories in the faker file when msw is configured too', async () => {
    await run(
      [mswOutput, fakerOutput],
      [
        { type: OutputMockType.MSW },
        { type: OutputMockType.FAKER, operationResponses: true },
      ],
    );

    const msw = read('pets', 'list-pets.msw.ts');
    expect(msw).not.toContain('export const getListPetsResponseMock');
    expect(msw).toContain(
      "export { getListPetsResponseMock } from './list-pets.faker';",
    );
    expect(msw).toContain('getListPetsMockHandler');
    expect(read('pets', 'list-pets.faker.ts')).toContain(
      'export const getListPetsResponseMock',
    );
  });

  it('drops the factories from msw when its operationResponses is false', async () => {
    await run(
      [mswOutput],
      [{ type: OutputMockType.MSW, operationResponses: false }],
    );

    const msw = read('pets', 'list-pets.msw.ts');
    expect(msw).not.toContain('getListPetsResponseMock');
    expect(msw).toContain('? overrideResponse : undefined');
  });

  it('skips an operation without a response factory', async () => {
    const paths = await run(
      [
        {
          ...fakerOutput,
          implementation: { function: '', handler: '', handlerName: '' },
        },
      ],
      [{ type: OutputMockType.FAKER, operationResponses: true }],
    );

    expect(
      fs.existsSync(path.join(mockDir, 'pets', 'list-pets.faker.ts')),
    ).toBe(false);
    expect(paths.some((p) => p.endsWith('.faker.ts'))).toBe(false);
  });

  it('lists the faker files in the faker mock index', async () => {
    await run(
      [mswOutput, fakerOutput],
      [
        { type: OutputMockType.MSW },
        { type: OutputMockType.FAKER, operationResponses: true },
      ],
      true,
    );

    expect(read('index.faker.ts')).toBe(
      "export * from './pets/list-pets.faker'\n",
    );
    expect(read('index.msw.ts')).toBe(
      "export { getListPetsMockHandler as PetsListPetsMockHandler } from './pets/list-pets.msw'\n",
    );
  });
});
