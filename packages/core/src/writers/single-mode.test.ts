import os from 'node:os';
import path from 'node:path';

import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createSplitModeOperation,
  createSplitModeOutput,
  createSplitModeProps,
} from '../test-utils/split-modes';
import { type GeneratorDependency, OutputMockType, OutputMode } from '../types';
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
