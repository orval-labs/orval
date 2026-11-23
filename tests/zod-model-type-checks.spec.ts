import { execFile } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vite-plus/test';

const run = promisify(execFile);
const generated = path.resolve(import.meta.dirname, 'generated/zod');
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

const compile = async (tsconfig: string): Promise<Typecheck> => {
  try {
    await run('bunx', ['tsc', '--noEmit', '--project', tsconfig], {
      cwd: import.meta.dirname,
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
  return compile(tsconfig);
};

// Copies the generated schemas next to a copy of the models, which `patch`
// may change, and typechecks both with the project's compiler options.
const typecheckAgainst = async (
  project: string,
  patch?: (models: string) => Promise<void>,
): Promise<Typecheck> => {
  const dir = await createScratchDir();
  await cp(
    path.join(generated, 'model-type-checks-models/model'),
    path.join(dir, 'models'),
    { recursive: true },
  );
  const schemas = await readFile(
    path.join(generated, project, `${project}.ts`),
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
  return compile(tsconfig);
};

describe.each(['model-type-checks', 'model-type-checks-mini'])(
  'zod modelTypeChecks (%s)',
  (project) => {
    it('compiles when every schema matches its model', async () => {
      const result = await typecheckAgainst(project);
      expect(result).toEqual({ ok: true, output: '' });
    }, 60_000);

    it('skips the schemas that are looser than their models on purpose', async () => {
      const schemas = await readFile(
        path.join(generated, project, `${project}.ts`),
        'utf8',
      );
      expect(schemas).toMatch(/\/\/ Settings: skipped, the default/);
      expect(schemas).toMatch(
        /\/\/ Anything: skipped, a schema without a type/,
      );
      expect(schemas).toMatch(/\/\/ Account: skipped, it references Settings/);
      expect(schemas).toMatch(/\/\/ Labels: skipped, a readOnly array/);
      expect(schemas).toMatch(/\/\/ Bag: skipped, additionalProperties/);
      expect(schemas).toMatch(/\/\/ Choice: skipped, an alternative that only/);
      expect(schemas).toMatch(
        /\/\/ NullAlt: skipped, a null, nullable or enum/,
      );
      expect(schemas).toMatch(
        /\/\/ NullableConst: skipped, a const typed with null/,
      );
      expect(schemas).toMatch(
        /\/\/ PairHolder: skipped, a reference to anything but a whole component/,
      );
      expect(schemas).toMatch(/\/\/ Marker: skipped, a component of constants/);
      expect(schemas).toMatch(/\/\/ Pair: skipped, a tuple of a fixed length/);
      expect(schemas).toMatch(
        /\/\/ LevelOwn: skipped, an enum allOf member next to properties/,
      );
      expect(schemas).toMatch(
        /\/\/ LevelInline: skipped, an enum allOf member next to properties/,
      );
      expect(schemas).toContain('Models.Level>');
      // Zod stops inlining a circular reference that runs through a tuple.
      expect(schemas).toMatch(
        /\/\/ TupleLoop: skipped, a circular reference through prefixItems/,
      );
      expect(schemas).toMatch(
        /\/\/ TupleFirst: skipped, a circular reference through prefixItems/,
      );
      expect(schemas).toMatch(/\/\/ TupleHolder: skipped, it references/);
      expect(schemas).toContain('Models.TupleLeaf>');
      expect(schemas).toMatch(/\/\/ NullAllOf: skipped, a null type next to/);
      expect(schemas).toMatch(/\/\/ NullAnyOf: skipped, a null type next to/);
      expect(schemas).toMatch(
        /\/\/ EmailConst: skipped, a const next to a string format/,
      );
      expect(schemas).toMatch(/\/\/ NoItems: skipped, items of false/);
      expect(schemas).toMatch(/\/\/ NeverItems: skipped, a not of an empty/);
      expect(schemas).toMatch(
        /\/\/ UnevaluatedRecord: skipped, unevaluatedProperties/,
      );
      expect(schemas).toMatch(
        /\/\/ Upload: skipped, the media type of a multipart part/,
      );
      expect(schemas).toMatch(
        /\/\/ ImageUpload: skipped, the media type of a multipart part/,
      );
      expect(schemas).toContain('Models.NullableObject>');
      // Without a type, only a component that Zod validates as unknown
      // differs from its model. Zod keeps a record for `additionalProperties`
      // and leaves a property or a member untyped like the models do.
      for (const name of ['Patterned', 'Bare', 'NoExtra']) {
        expect(schemas).toContain(
          `// ${name}: skipped, a schema without a type`,
        );
        expect(schemas).not.toContain(`Models.${name}>`);
      }
      for (const name of [
        'Dictionary',
        'AllowAll',
        'Merged',
        'MergedPattern',
        'MergedBare',
        'MergedNoExtra',
        'Wrapper',
        'WrapperPattern',
        'WrapperNoExtra',
      ]) {
        expect(schemas).toContain(`Models.${name}>`);
      }
      // Zod leaves out a required key without a property, and a readOnly
      // beside a reference, like the models do.
      expect(schemas).toContain('Models.Requirement>');
      expect(schemas).toContain('Models.Labelled>');
      // Zod types a tuple and a circular map like the models do.
      expect(schemas).toContain('Models.Point>');
      expect(schemas).toContain('Models.Stretch>');
      expect(schemas).toContain('Models.Tree>');
      expect(schemas).not.toContain('Models.Settings>');
    });

    it('fails when a model drifts from its schema', async () => {
      const result = await typecheckAgainst(project, async (models) => {
        const owner = path.join(models, 'owner.ts');
        await writeFile(
          owner,
          (await readFile(owner, 'utf8')).replace(
            'name: string;',
            'name: number;',
          ),
        );
      });
      expect(result.ok).toBe(false);
      expect(result.output).toMatch(/schemas\.ts\(\d+,\d+\): error TS2344/);
    }, 60_000);

    it('fails when a model lacks a value its schema accepts', async () => {
      const result = await typecheckAgainst(project, async (models) => {
        const status = path.join(models, 'petStatus.ts');
        await writeFile(
          status,
          (await readFile(status, 'utf8')).replace("  sold: 'sold',\n", ''),
        );
      });
      expect(result.ok).toBe(false);
      expect(result.output).toMatch(/schemas\.ts\(\d+,\d+\): error TS2344/);
    }, 60_000);

    it('fails when a model accepts a value its schema rejects', async () => {
      const result = await typecheckAgainst(project, async (models) => {
        const status = path.join(models, 'petStatus.ts');
        await writeFile(
          status,
          (await readFile(status, 'utf8')).replace(
            "  sold: 'sold',\n",
            "  sold: 'sold',\n  archived: 'archived',\n",
          ),
        );
      });
      expect(result.ok).toBe(false);
      expect(result.output).toMatch(/schemas\.ts\(\d+,\d+\): error TS2344/);
    }, 60_000);
  },
);

describe('zod modelTypeChecks options', () => {
  const options = 'model-type-checks-options/model-type-checks-options.ts';

  it('keeps the dot in the name of the models directory', async () => {
    const schemas = await readFile(path.join(generated, options), 'utf8');
    expect(schemas).toContain(
      "from '../model-type-checks-options-models/model.gen';",
    );
    const result = await typecheckGenerated(options);
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
    const result = await compile(path.join(dir, 'tsconfig.json'));
    // Both files export `Pet`, which clashes. Neither exports the checks.
    expect(result.output).toContain("'Pet'");
    expect(result.output).not.toContain('ModelTypeChecks');
  }, 60_000);

  it('skips what holds a 64-bit integer with useBigInt', async () => {
    const schemas = await readFile(path.join(generated, options), 'utf8');
    expect(schemas).toMatch(/\/\/ Counter: skipped, a 64-bit integer/);
    expect(schemas).toMatch(/\/\/ Dashboard: skipped, it references Counter/);
    expect(schemas).toContain('Models.Pet>');
  });

  it('skips what holds an array with useReadonlyArrays', async () => {
    const schemas = await readFile(path.join(generated, options), 'utf8');
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
