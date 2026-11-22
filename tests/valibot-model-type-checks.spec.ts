import { execFile } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vite-plus/test';

const run = promisify(execFile);
const generated = path.resolve(import.meta.dirname, 'generated/valibot');
const MODELS_IMPORT = '../model-type-checks-models/model';

interface Typecheck {
  ok: boolean;
  output: string;
}

const scratchDirs: string[] = [];

// What a failed `tsc` run wrote to stdout, where it reports its errors.
const stdoutOf = (error: unknown): string =>
  typeof error === 'object' &&
  error !== null &&
  'stdout' in error &&
  typeof error.stdout === 'string'
    ? error.stdout
    : '';

// A directory inside this package for what a test writes, which is ignored by
// git. The packages of this project resolve from it as they do for the
// generated files, on every drive.
const createScratchDir = async (): Promise<string> => {
  const dir = await mkdtemp(
    path.join(import.meta.dirname, '.tmp-model-checks-'),
  );
  scratchDirs.push(dir);
  return dir;
};

// A module specifier for a file, which uses `/` on every platform.
const toSpecifier = (file: string): string => file.split(path.sep).join('/');

// The compiler options of the project, with the types of its root.
const projectOptions = (
  compilerOptions: Record<string, unknown> = {},
): Record<string, unknown> => ({
  typeRoots: [
    path.resolve(import.meta.dirname, '../node_modules/@types'),
    path.join(import.meta.dirname, 'node_modules/@types'),
  ],
  ...compilerOptions,
});

afterEach(async () => {
  await Promise.all(
    scratchDirs
      .splice(0)
      .map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

const compile = async (tsconfig: string, dir: string): Promise<Typecheck> => {
  try {
    await run('bunx', ['tsc', '--noEmit', '--project', tsconfig], {
      cwd: dir,
    });
    return { ok: true, output: '' };
  } catch (error) {
    return { ok: false, output: stdoutOf(error) };
  }
};

// Typechecks a generated file where it is, with the project's compiler
// options and `compilerOptions` on top.
const typecheckGenerated = async (
  file: string,
  compilerOptions: Record<string, unknown> = {},
): Promise<Typecheck> => {
  const dir = await createScratchDir();
  const tsconfig = path.join(dir, 'tsconfig.json');
  await writeFile(
    tsconfig,
    JSON.stringify({
      extends: path.join(import.meta.dirname, 'tsconfig.json'),
      include: [],
      files: [path.join(generated, file)],
      compilerOptions: projectOptions(compilerOptions),
    }),
  );
  return compile(tsconfig, import.meta.dirname);
};

// Copies the generated schemas next to a copy of the models, which `patch`
// may change, and typechecks both with the project's compiler options.
const typecheckAgainst = async (
  patch?: (models: string) => Promise<void>,
): Promise<Typecheck> => {
  const dir = await createScratchDir();
  await cp(
    path.join(generated, 'model-type-checks-models/model'),
    path.join(dir, 'models'),
    { recursive: true },
  );
  const schemas = await readFile(
    path.join(generated, 'model-type-checks/model-type-checks.ts'),
    'utf8',
  );
  await writeFile(
    path.join(dir, 'schemas.ts'),
    schemas.replace(MODELS_IMPORT, './models'),
  );
  await patch?.(path.join(dir, 'models'));
  const tsconfig = path.join(dir, 'tsconfig.json');
  await writeFile(
    tsconfig,
    JSON.stringify({
      extends: path.join(import.meta.dirname, 'tsconfig.json'),
      // The base config includes every generated project; only these files matter.
      include: [],
      files: ['schemas.ts'],
      compilerOptions: projectOptions(),
    }),
  );
  return compile(tsconfig, import.meta.dirname);
};

describe('modelTypeChecks', () => {
  it('compiles when every schema matches its model', async () => {
    const result = await typecheckAgainst();
    expect(result).toEqual({ ok: true, output: '' });
  }, 60_000);

  it('skips the schemas that are looser than their models on purpose', async () => {
    const schemas = await readFile(
      path.join(generated, 'model-type-checks/model-type-checks.ts'),
      'utf8',
    );
    expect(schemas).toMatch(
      /\/\/ Point: skipped, prefixItems is validated as an array of unknown/,
    );
    expect(schemas).toMatch(/\/\/ Route: skipped, it references Point/);
    expect(schemas).toMatch(/\/\/ Upload: skipped, a binary string/);
    expect(schemas).toMatch(/\/\/ Settings: skipped, the default/);
    expect(schemas).toMatch(/\/\/ Anything: skipped, a schema without a type/);
    expect(schemas).toMatch(/\/\/ Tree: skipped, a circular reference/);
    expect(schemas).toMatch(/\/\/ Requirement: skipped, a required key/);
    expect(schemas).toMatch(/\/\/ Variant: skipped, an enum with an object/);
    expect(schemas).toMatch(/\/\/ Choice: skipped, an alternative that only/);
    expect(schemas).toMatch(/\/\/ NullAlt: skipped, a null, nullable or enum/);
    expect(schemas).toMatch(
      /\/\/ NullableConst: skipped, a const typed with null/,
    );
    expect(schemas).toMatch(/\/\/ PairHolder: skipped, prefixItems/);
    expect(schemas).toMatch(
      /\/\/ Labelled: skipped, the readOnly of a reference/,
    );
    expect(schemas).toMatch(/\/\/ Grid: skipped, a readOnly array in an array/);
    expect(schemas).toMatch(/\/\/ Contact: skipped, a required key that only/);
    expect(schemas).toMatch(/\/\/ Marker: skipped, a component of constants/);
    // Without a type, an object shape is validated as unknown, in a
    // component, a member of `allOf` and a property.
    for (const name of [
      'Dictionary',
      'Patterned',
      'Bare',
      'Merged',
      'Wrapper',
    ]) {
      expect(schemas).toContain(`// ${name}: skipped, a schema without a type`);
      expect(schemas).not.toContain(`Models.${name}>`);
    }
    expect(schemas).not.toContain('Models.Point>');
    expect(schemas).not.toContain('Models.Requirement>');
    expect(schemas).toContain('Models.Pet>');
    expect(schemas).toContain('Models.Receipt>');
  });

  it('fails when a model drifts from its schema', async () => {
    const result = await typecheckAgainst(async (models) => {
      const item = path.join(models, 'item.ts');
      await writeFile(
        item,
        (await readFile(item, 'utf8')).replace(
          'readonly tags: readonly string[]',
          'tags: string[]',
        ),
      );
    });
    expect(result.ok).toBe(false);
    expect(result.output).toMatch(/schemas\.ts\(\d+,\d+\): error TS2344/);
  }, 60_000);

  it('keeps the dot in the name of the models directory', async () => {
    const schemas = await readFile(
      path.join(
        generated,
        'model-type-checks-options/model-type-checks-options.ts',
      ),
      'utf8',
    );
    expect(schemas).toContain(
      "from '../model-type-checks-options-models/model.gen';",
    );
    const result = await typecheckGenerated(
      'model-type-checks-options/model-type-checks-options.ts',
    );
    expect(result).toEqual({ ok: true, output: '' });
  }, 60_000);

  it.each([
    ['.gen.ts', 'model-type-checks-gen-extension'],
    ['.types.ts', 'model-type-checks-types-extension'],
  ])(
    'imports the models of a project written as %s from their index',
    async (extension, project) => {
      const file = `${project}/${project}${extension}`;
      const schemas = await readFile(path.join(generated, file), 'utf8');
      expect(schemas).toContain(
        "from '../model-type-checks-options-models/model.gen';",
      );
      const result = await typecheckGenerated(file);
      expect(result).toEqual({ ok: true, output: '' });
    },
    60_000,
  );

  it('compiles under noUnusedLocals, which the checks do not trip', async () => {
    const result = await typecheckGenerated(
      'model-type-checks/model-type-checks.ts',
      { noUnusedLocals: true },
    );
    expect(result).toEqual({ ok: true, output: '' });
  }, 60_000);

  it('does not export a name that another file with checks exports too', async () => {
    const dir = await createScratchDir();
    const files = [
      'model-type-checks/model-type-checks.ts',
      'model-type-checks-options/model-type-checks-options.ts',
    ];
    await writeFile(
      path.join(dir, 'barrel.ts'),
      files
        .map(
          (file) =>
            `export * from '${toSpecifier(path.join(generated, file))}';`,
        )
        .join('\n'),
    );
    await writeFile(
      path.join(dir, 'tsconfig.json'),
      JSON.stringify({
        extends: path.join(import.meta.dirname, 'tsconfig.json'),
        include: [],
        files: [path.join(dir, 'barrel.ts')],
        compilerOptions: projectOptions(),
      }),
    );
    const result = await compile(
      path.join(dir, 'tsconfig.json'),
      import.meta.dirname,
    );
    // Both files export `Pet`, which clashes. Neither exports the checks.
    expect(result.output).toContain("'Pet'");
    expect(result.output).not.toContain('ModelTypeChecks');
  }, 60_000);

  it('skips what holds a 64-bit integer with useBigInt', async () => {
    const schemas = await readFile(
      path.join(
        generated,
        'model-type-checks-options/model-type-checks-options.ts',
      ),
      'utf8',
    );
    expect(schemas).toMatch(/\/\/ Counter: skipped, a 64-bit integer/);
    expect(schemas).toMatch(/\/\/ Dashboard: skipped, it references Counter/);
    expect(schemas).toContain('Models.Pet>');
  });

  it('skips what holds an array with useReadonlyArrays', async () => {
    const schemas = await readFile(
      path.join(
        generated,
        'model-type-checks-options/model-type-checks-options.ts',
      ),
      'utf8',
    );
    expect(schemas).toMatch(/\/\/ Tags: skipped, with useReadonlyArrays/);
    expect(schemas).not.toContain('Models.Tags>');
  });

  describe('with exactOptionalPropertyTypes', () => {
    const exactOptional = { exactOptionalPropertyTypes: true };

    it('compiles when the schemas are exactOptional', async () => {
      const result = await typecheckGenerated(
        'model-type-checks-exact-optional/model-type-checks-exact-optional.ts',
        exactOptional,
      );
      expect(result).toEqual({ ok: true, output: '' });
    }, 60_000);

    it('fails when they are not, as the warning at generation says', async () => {
      const result = await typecheckGenerated(
        'model-type-checks/model-type-checks.ts',
        exactOptional,
      );
      expect(result.ok).toBe(false);
      expect(result.output).toMatch(/error TS2344/);
    }, 60_000);
  });
});
