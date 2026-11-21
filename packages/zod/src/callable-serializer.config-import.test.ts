import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { promisify } from 'node:util';

import type { BoundRefinement } from '@orval/core';
import { createJiti } from 'jiti';
import { describe, expect, it } from 'vite-plus/test';

import { generate } from '../../orval/src/index';
import { serializeCallableParts } from './callable-serializer';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

/**
 * Run the installed TypeScript CLI rather than its JavaScript compiler API.
 * TypeScript 7 exports only version metadata from the package root, so
 * ts.createProgram / ts.ScriptTarget / ts.getPreEmitDiagnostics do not exist.
 * Resolve the binary from the package that this test actually imports: a
 * workspace's generic `tsc` command might point to a different TS version.
 */
const checkGeneratedTypeScript = async (
  root: string,
  sourceFiles: readonly string[],
): Promise<void> => {
  const tsPackagePath = require.resolve('typescript/package.json');
  const compiler = path.join(path.dirname(tsPackagePath), 'bin', 'tsc');
  const project = path.join(root, 'tsconfig.refinement-imports.json');

  await fs.writeFile(
    project,
    JSON.stringify({
      compilerOptions: {
        noEmit: true,
        strict: true,
        skipLibCheck: true,
        types: [],
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
      },
      files: [...sourceFiles],
    }),
  );

  const { stdout, stderr } = await execFileAsync(
    compiler,
    ['--project', project],
    { cwd: root },
  );
  expect(stdout.trim()).toBe('');
  expect(stderr.trim()).toBe('');
};

type DecimalExtension = {
  validatorsGenerator: (schema: {
    'x-max-precision'?: number;
  }) => BoundRefinement<string, 4> | null;
};

type LoadedConfig = {
  petstore: {
    output: {
      override: { zod: { schemaExtension: DecimalExtension[] } };
    };
  };
};

/**
 * Exercise actual TypeScript imports through Jiti, as Orval does when loading
 * orval.config.ts. Tests that define a callback directly do not catch Jiti's
 * generated module identifiers (e.g. `_decimalValidator`).
 */
const loadConfig = async (filename: string): Promise<LoadedConfig> => {
  const jiti = createJiti(process.cwd(), { interopDefault: true });
  return (await jiti.import(filename, { default: true })) as LoadedConfig;
};

const spec = {
  openapi: '3.0.3',
  info: { title: 'Imported refinements regression', version: '1.0.0' },
  paths: {
    '/pets': {
      get: {
        operationId: 'listPets',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Pet' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Pet: {
        type: 'object',
        required: ['price'],
        properties: {
          price: {
            type: 'string',
            format: 'decimal',
            'x-max-precision': 2,
          },
        },
      },
    },
  },
};

/**
 * Both configurations import a real TypeScript module. The direct case
 * intentionally demonstrates the transpilable-name mismatch; the aliased case
 * uses a lexically stable local name shared with the generated $imports entry.
 */
const configSource = (useLocalAlias: boolean): string => `
import { isDecimalWithPrecision } from './decimal-validator';

export default {
  petstore: {
    input: { target: './petstore.json' },
    output: {
      client: 'zod',
      mode: 'single',
      target: './generated.ts',
      override: {
        zod: {
          version: 4,
          variant: 'mini',
          schemaExtension: [{
            type: 'string',
            format: 'decimal',
            validatorsGenerator: (schema: { 'x-max-precision'?: number }) => {
              const maxPrecision = schema['x-max-precision'] ?? 2;
              ${useLocalAlias ? 'const validateDecimal = isDecimalWithPrecision;' : ''}
              return {
                callable: (value: string) =>
                  ${useLocalAlias ? 'validateDecimal' : 'isDecimalWithPrecision'}(value, maxPrecision),
                bindings: {
                  maxPrecision,
                  $imports: [
                    ${JSON.stringify(
                      useLocalAlias
                        ? "import { isDecimalWithPrecision as validateDecimal } from './decimal-validator';"
                        : "import { isDecimalWithPrecision } from './decimal-validator';",
                    )},
                  ],
                },
              };
            },
          }],
        },
      },
    },
  },
};
`;

const withConfigFixture = async <T>(
  run: (paths: {
    root: string;
    directConfig: string;
    aliasedConfig: string;
    generated: string;
    validator: string;
  }) => Promise<T>,
): Promise<T> => {
  // The fixture must live under the workspace for Node/TS to resolve the
  // workspace dependencies of the generated schema (notably zod/mini).
  const root = await fs.mkdtemp(
    path.join(import.meta.dirname, '.refinement-import-'),
  );
  const directConfig = path.join(root, 'direct.config.ts');
  const aliasedConfig = path.join(root, 'aliased.config.ts');
  const generated = path.join(root, 'generated.ts');
  const validator = path.join(root, 'decimal-validator.ts');
  try {
    await Promise.all([
      fs.writeFile(path.join(root, 'petstore.json'), JSON.stringify(spec)),
      fs.writeFile(
        validator,
        `export function isDecimalWithPrecision(value: string, maxPrecision: number): boolean {
          return /^\\d+(?:\\.\\d+)?$/.test(value) &&
            (value.split('.')[1]?.length ?? 0) <= maxPrecision;
        }`,
      ),
      fs.writeFile(directConfig, configSource(false)),
      fs.writeFile(aliasedConfig, configSource(true)),
    ]);
    return await run({
      root,
      directConfig,
      aliasedConfig,
      generated,
      validator,
    });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
};

describe('callable import bindings through a real Orval config', () => {
  it('detects identifiers introduced when Jiti transpiles imported helpers', async () => {
    await withConfigFixture(async ({ directConfig, aliasedConfig }) => {
      const direct = await loadConfig(directConfig);
      const aliased = await loadConfig(aliasedConfig);
      const input = { 'x-max-precision': 2 };
      const directDescriptor =
        direct.petstore.output.override.zod.schemaExtension[0].validatorsGenerator(
          input,
        );
      const aliasedDescriptor =
        aliased.petstore.output.override.zod.schemaExtension[0].validatorsGenerator(
          input,
        );

      expect(directDescriptor).not.toBeNull();
      expect(aliasedDescriptor).not.toBeNull();
      if (!directDescriptor || !aliasedDescriptor) {
        throw new Error('Expected both decimal refinements');
      }

      // Direct ESM imports can become `_decimalValidator.isDecimalWithPrecision`
      // after Jiti's compilation. Whatever identifier Jiti emits, it must be
      // accounted for by imports/bindings; otherwise the serializer rejects it.
      const directSource = directDescriptor.callable.toString();
      if (/\b[A-Za-z_$][\w$]*\.isDecimalWithPrecision\b/.test(directSource)) {
        expect(() => serializeCallableParts(directDescriptor)).toThrow(
          /unresolved external reference\(s\)/,
        );
      } else {
        // A loader retaining the original import name needs no workaround.
        expect(serializeCallableParts(directDescriptor).imports).toHaveLength(
          1,
        );
      }

      // A local alias survives module transformation and has the same lexical
      // identifier as the aliased import emitted in the generated file.
      const parts = serializeCallableParts(aliasedDescriptor);
      expect(parts.predicate).toContain('validateDecimal(value, maxPrecision)');
      expect(parts.declarations).toContain('  const maxPrecision = 2;');
      expect(parts.imports).toEqual([
        {
          name: 'isDecimalWithPrecision',
          alias: 'validateDecimal',
          importPath: './decimal-validator',
          values: true,
        },
      ]);
    });
  });

  it('generates and type-checks a standalone Zod module from a TS config with an imported validator', async () => {
    await withConfigFixture(
      async ({ root, aliasedConfig, generated, validator }) => {
        // This calls the public Orval API with a config *path*, ensuring its
        // config loader, Zod builder, and output writer all run.
        await generate(aliasedConfig, root, { throwOnError: true });

        const content = await fs.readFile(generated, 'utf8');
        expect(content).toMatch(
          /import\s*\{\s*isDecimalWithPrecision\s+as\s+validateDecimal\s*\}\s*from\s*['"]\.\/decimal-validator['"]/,
        );
        expect(content).toContain('validateDecimal(value, maxPrecision)');
        expect(content).toContain('const maxPrecision = 2;');
        expect(content).not.toMatch(/_decimalValidator\w*\./);

        await checkGeneratedTypeScript(root, [generated, validator]);
      },
    );
  });
});
