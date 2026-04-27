import os from 'node:os';
import path from 'node:path';

import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  type GeneratorOperation,
  NamingConvention,
  type NormalizedOutputOptions,
  OutputClient,
  OutputMode,
  type WriteSpecBuilder,
} from '../types';
import { writeSplitMode } from './split-mode';
import { writeSplitTagsMode } from './split-tags-mode';
import { writeTagsMode } from './tags-mode';

// Regression coverage for https://github.com/orval-labs/orval/issues/2309
//
// When `client: 'zod'` is configured (or any setup where `needSchema` is
// false), the split-style writers must not include a `*.schemas.ts` path in
// their return value. The path used to leak through, causing
// `afterAllFilesWrite` consumers like `eslint --fix` to crash on a file that
// was never written.

const createOperation = (
  overrides: Partial<GeneratorOperation> = {},
): GeneratorOperation => ({
  imports: [],
  importsMock: [],
  implementation: '',
  implementationMock: { function: '', handler: '', handlerName: 'mockHandler' },
  tags: ['pets'],
  operationName: 'listPets',
  ...overrides,
});

const createBuilder = (target: string): WriteSpecBuilder =>
  ({
    operations: { listPets: createOperation() },
    verbOptions: {},
    schemas: [],
    title: () => ({ implementation: '', implementationMock: '' }),
    header: () => ({ implementation: '', implementationMock: '' }),
    footer: () => ({ implementation: '', implementationMock: '' }),
    imports: () => '',
    importsMock: () => '',
    extraFiles: [],
    info: { title: 'pet-store' },
    target,
    spec: {},
  }) as unknown as WriteSpecBuilder;

const createOutput = (
  target: string,
  overrides: Partial<NormalizedOutputOptions> = {},
): NormalizedOutputOptions =>
  ({
    target,
    fileExtension: '.ts',
    mode: OutputMode.SPLIT,
    namingConvention: NamingConvention.CAMEL_CASE,
    client: OutputClient.AXIOS,
    httpClient: 'axios',
    schemas: undefined,
    mock: false,
    clean: false,
    docs: false,
    headers: false,
    indexFiles: false,
    allParamsOptional: false,
    urlEncodeParameters: false,
    unionAddMissingProperties: false,
    optionsParamRequired: false,
    propertySortOrder: 'Alphabetical',
    override: {
      tags: {},
      operations: {},
      mutator: undefined,
      paramsSerializerOptions: undefined,
      requestOptions: true,
      header: false,
      formData: { disabled: false, mutator: undefined },
      formUrlEncoded: false,
      components: {
        schemas: { suffix: '', itemSuffix: '' },
        responses: { suffix: '' },
        parameters: { suffix: '' },
        requestBodies: { suffix: '' },
      },
      namingConvention: {},
      hono: {},
      mcp: {},
      query: {},
      angular: { provideIn: false },
      swr: {},
      zod: {},
      fetch: {},
    },
    ...overrides,
  }) as unknown as NormalizedOutputOptions;

const baseProps = (target: string) => ({
  builder: createBuilder(target),
  workspace: path.dirname(target),
  output: createOutput(target),
  projectName: undefined,
  header: '',
});

describe('split-style writers — schemas path is excluded when needSchema is false (#2309)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orval-2309-'));
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  describe('writeSplitMode', () => {
    it('omits the *.schemas.ts path when needSchema is false', async () => {
      const target = path.join(tmpDir, 'petstore.ts');
      const props = {
        ...baseProps(target),
        output: createOutput(target, { mode: OutputMode.SPLIT }),
      };

      const paths = await writeSplitMode({ ...props, needSchema: false });

      expect(paths.some((p) => p.endsWith('.schemas.ts'))).toBe(false);
      expect(fs.existsSync(path.join(tmpDir, 'petstore.schemas.ts'))).toBe(
        false,
      );
    });

    it('returns the *.schemas.ts path when needSchema is true', async () => {
      const target = path.join(tmpDir, 'petstore.ts');
      const props = {
        ...baseProps(target),
        output: createOutput(target, { mode: OutputMode.SPLIT }),
      };

      const paths = await writeSplitMode({ ...props, needSchema: true });

      const schemasPath = path.join(tmpDir, 'petstore.schemas.ts');
      expect(paths).toContain(schemasPath);
      expect(fs.existsSync(schemasPath)).toBe(true);
    });
  });

  describe('writeTagsMode', () => {
    it('omits the *.schemas.ts path when needSchema is false', async () => {
      const target = path.join(tmpDir, 'petstore.ts');
      const props = {
        ...baseProps(target),
        output: createOutput(target, { mode: OutputMode.TAGS }),
      };

      const paths = await writeTagsMode({ ...props, needSchema: false });

      expect(paths.some((p) => p.endsWith('.schemas.ts'))).toBe(false);
      expect(fs.existsSync(path.join(tmpDir, 'petstore.schemas.ts'))).toBe(
        false,
      );
    });

    it('returns the *.schemas.ts path when needSchema is true', async () => {
      const target = path.join(tmpDir, 'petstore.ts');
      const props = {
        ...baseProps(target),
        output: createOutput(target, { mode: OutputMode.TAGS }),
      };

      const paths = await writeTagsMode({ ...props, needSchema: true });

      const schemasPath = path.join(tmpDir, 'petstore.schemas.ts');
      expect(paths).toContain(schemasPath);
      expect(fs.existsSync(schemasPath)).toBe(true);
    });
  });

  describe('writeSplitTagsMode', () => {
    it('omits the *.schemas.ts path when needSchema is false', async () => {
      const target = path.join(tmpDir, 'petstore.ts');
      const props = {
        ...baseProps(target),
        output: createOutput(target, { mode: OutputMode.TAGS_SPLIT }),
      };

      const paths = await writeSplitTagsMode({ ...props, needSchema: false });

      expect(paths.some((p) => p.endsWith('.schemas.ts'))).toBe(false);
      expect(fs.existsSync(path.join(tmpDir, 'petstore.schemas.ts'))).toBe(
        false,
      );
    });

    it('returns the *.schemas.ts path when needSchema is true', async () => {
      const target = path.join(tmpDir, 'petstore.ts');
      const props = {
        ...baseProps(target),
        output: createOutput(target, { mode: OutputMode.TAGS_SPLIT }),
      };

      const paths = await writeSplitTagsMode({ ...props, needSchema: true });

      const schemasPath = path.join(tmpDir, 'petstore.schemas.ts');
      expect(paths).toContain(schemasPath);
      expect(fs.existsSync(schemasPath)).toBe(true);
    });
  });
});
