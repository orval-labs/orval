import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import fs from 'fs-extra';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

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
import { createSchemaOutputPlanForOutput } from './schema-output-plan';

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
          inline: false,
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

  it('routes mock schema imports through schemaOutputPlan (#3967)', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const importsMockCalls: Array<{ imports: readonly GeneratorDependency[] }> =
      [];
    const baseProps = createSplitModeProps(target);
    const props = {
      ...baseProps,
      builder: {
        ...baseProps.builder,
        schemas: [petSchema, petTypeSchema],
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
                imports: [{ name: 'Pet' }, { name: 'PetType' }],
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
        indexFiles: false,
        schemas: {
          path: path.join(tmpDir, 'model'),
          type: 'typescript',
          splitByTags: false,
          routes: { default: 'models', enum: 'enums' },
        },
        mock: {
          indexMockFiles: false,
          inline: false,
          path: path.join(tmpDir, 'mocks'),
          generators: [{ type: OutputMockType.MSW }],
        },
      }),
    };

    await writeSingleMode({
      ...props,
      needSchema: true,
      schemaTagMap: undefined,
      schemaOutputPlan: createSchemaOutputPlanForOutput(
        [petSchema, petTypeSchema],
        props.output,
        undefined,
      ),
    });

    // The mock file's Pet import must use the routed subpath (`models/pet`),
    // same as the client file — not the flat `../model/pet`. PetType is an
    // enum schema, so it must route through the `enums` route dir instead.
    const petImports = importsMockCalls
      .flatMap((call) => call.imports)
      .filter((dep) => dep.exports.some((entry) => entry.name === 'Pet'));
    expect(petImports.length).toBeGreaterThan(0);
    for (const dep of petImports) {
      expect(dep.dependency).toContain('models/pet');
    }
    const petTypeImports = importsMockCalls
      .flatMap((call) => call.imports)
      .filter((dep) => dep.exports.some((entry) => entry.name === 'PetType'));
    expect(petTypeImports.length).toBeGreaterThan(0);
    for (const dep of petTypeImports) {
      expect(dep.dependency).toContain('enums/petType');
    }
  });
});

// Regression coverage for https://github.com/orval-labs/orval/issues/3627
//
// On wide specs with `faker schemas: true`, shared-array import aggregation
// can strip `get<X>Mock()` factory imports from `mockOutput.imports`.
// split-mode, tags-mode, and split-tags-mode all recover these by scanning
// the finalized mock implementation. single-mode was the only writer missing
// this recovery — both the inline branch and the de-inlined branch.

const petTypeSchema: GeneratorSchema = {
  name: 'PetType',
  model: "export type PetType = 'dog' | 'cat' | 'bird';",
  imports: [],
  schema: { type: 'string', enum: ['dog', 'cat', 'bird'] },
};

const petSchema: GeneratorSchema = {
  name: 'Pet',
  model: 'export type Pet = { id: number };',
  imports: [],
  schema: { type: 'object', properties: { id: { type: 'integer' } } },
};

const createRecoveryProps = (target: string, { inline = false } = {}) => {
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
        inline,
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
    // `mock.inline: true` opts back into the legacy inlined layout, which
    // is the branch this test targets.
    const props = createRecoveryProps(target, { inline: true });

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

// #3831: importing the generated client must not evaluate `msw` or
// `@faker-js/faker`. The mocked factories below record whether they ran.
// Generated files use a `.mjs` extension so Node can import them directly.
const { evaluated } = vi.hoisted(() => ({
  evaluated: { msw: false, faker: false },
}));

vi.mock('msw', () => {
  evaluated.msw = true;
  return {
    http: { get: () => ({}) },
    HttpResponse: { json: (body: unknown) => body },
  };
});

vi.mock('@faker-js/faker', () => {
  evaluated.faker = true;
  return { faker: new Proxy({}, { get: () => () => 'mock-value' }) };
});

describe('writeSingleMode — importing the client does not evaluate msw/faker (#3831)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'orval-single-mode-import-'),
    );
    evaluated.msw = false;
    evaluated.faker = false;
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  it('does not run the msw/faker module factories, but the sibling mock files do', async () => {
    const target = path.join(tmpDir, 'petstore.mjs');
    const baseProps = createSplitModeProps(target);
    const props = {
      ...baseProps,
      builder: {
        ...baseProps.builder,
        operations: {
          listPets: createSplitModeOperation({
            implementation:
              "export const listPets = () => fetch('/pets').then((r) => r.json());\n",
            mockOutputs: [
              {
                type: OutputMockType.MSW,
                implementation: {
                  function:
                    'export const getListPetsResponseMock = () => [];\n',
                  handler:
                    "export const getListPetsMock = () => http.get('*/pets', () => HttpResponse.json(getListPetsResponseMock()));\n",
                  handlerName: 'getListPetsMock',
                },
                imports: [],
              },
              {
                type: OutputMockType.FAKER,
                implementation: {
                  function:
                    'export const getListPetsFakerResponseMock = () => [faker.number.int()];\n',
                  handler: '',
                  handlerName: '',
                },
                imports: [],
              },
            ],
          }),
        },
        importsMock: ({ options }: { options?: { type: OutputMockType } }) =>
          options?.type === OutputMockType.FAKER
            ? "import { faker } from '@faker-js/faker';\n"
            : "import { HttpResponse, http } from 'msw';\n",
      } as typeof baseProps.builder,
      output: createSplitModeOutput(target, {
        mode: OutputMode.SINGLE,
        fileExtension: '.mjs',
        mock: {
          indexMockFiles: false,
          inline: false,
          generators: [
            { type: OutputMockType.MSW },
            { type: OutputMockType.FAKER },
          ],
        },
      }),
    };

    await writeSingleMode({ ...props, needSchema: false });

    const mswPath = path.join(tmpDir, 'petstore.msw.mjs');
    const fakerPath = path.join(tmpDir, 'petstore.faker.mjs');
    expect(fs.existsSync(target)).toBe(true);
    expect(fs.existsSync(mswPath)).toBe(true);
    expect(fs.existsSync(fakerPath)).toBe(true);

    // Importing the generated client must not evaluate msw or faker.
    await import(pathToFileURL(target).href);
    expect(evaluated.msw).toBe(false);
    expect(evaluated.faker).toBe(false);

    // Prove the harness can actually detect evaluation: importing the
    // sibling mock files DOES trigger their respective module factories.
    await import(pathToFileURL(mswPath).href);
    expect(evaluated.msw).toBe(true);
    expect(evaluated.faker).toBe(false);

    await import(pathToFileURL(fakerPath).href);
    expect(evaluated.faker).toBe(true);
  });
});
