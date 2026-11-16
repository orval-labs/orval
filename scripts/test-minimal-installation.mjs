import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = mkdtempSync(path.join(tmpdir(), 'orval-packed-consumer-'));
const archives = path.join(temp, 'archives');
const bun = process.execPath;
const node = 'node';
const rootPackage = /** @type {{ catalog: Record<string, string> }} */ (
  JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
);
/** @type {Record<string, string>} */
const tarballs = {};
let success = false;

/**
 * @param {string} command
 * @param {string[]} args
 * @param {string} cwd
 * @param {{ failure?: boolean, timeout?: number }} options
 */
function run(command, args, cwd, { failure = false, timeout = 120_000 } = {}) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout });
  const output = `${result.stdout}\n${result.stderr}`;
  if (
    result.error ||
    (failure ? result.status === 0 : result.status !== 0) ||
    result.status === null
  ) {
    throw new Error(
      `${command} ${args.join(' ')} failed (status ${result.status}):\n${result.error ?? ''}\n${output}`,
    );
  }
  return output;
}

/** @param {string} dir @param {string} name @param {string} value */
function write(dir, name, value) {
  writeFileSync(path.join(dir, name), value);
}

/** @param {string} filename */
function fileDependency(filename) {
  return `file:${filename.replaceAll('\\', '/')}`;
}

/** @param {string} modules */
function packageCount(modules) {
  if (!existsSync(modules)) return 0;
  let count = 0;
  for (const entry of readdirSync(modules, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const location = path.join(modules, entry.name);
    if (entry.name.startsWith('@')) {
      count += readdirSync(location).length;
      for (const name of readdirSync(location)) {
        count += packageCount(path.join(location, name, 'node_modules'));
      }
    } else {
      count++;
      count += packageCount(path.join(location, 'node_modules'));
    }
  }
  return count;
}

try {
  mkdirSync(archives);
  for (const entry of readdirSync(path.join(root, 'packages'), {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(root, 'packages', entry.name);
    const manifest = path.join(dir, 'package.json');
    if (!existsSync(manifest)) continue;
    const { name } = /** @type {{ name: string }} */ (
      JSON.parse(readFileSync(manifest, 'utf8'))
    );
    const filename = `${entry.name}.tgz`;
    run(
      bun,
      [
        'pm',
        'pack',
        '--ignore-scripts',
        '--filename',
        path.join(archives, filename),
      ],
      dir,
    );
    tarballs[name] = fileDependency(path.join(archives, filename));
  }
  const overrides = Object.fromEntries(
    Object.entries(tarballs).filter(([name]) => name.startsWith('@orval/')),
  );
  const spec = {
    openapi: '3.0.0',
    info: { title: 'Pets', version: '1.0.0' },
    paths: {
      '/pets': {
        get: {
          operationId: 'listPets',
          responses: {
            200: {
              description: 'Pets',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Pet' },
                  },
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
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
      },
    },
  };
  const config = `export default { pets: { input: './openapi.json', output: { target: './src/api.ts', schemas: './src/models', client: 'fetch', tsconfig: './tsconfig.json' } } };\n`;

  for (const [fixture, packageName] of [
    ['minimal', '@orval/cli'],
    ['full', 'orval'],
  ]) {
    const dir = path.join(temp, fixture);
    mkdirSync(dir);
    /** @type {Record<string, string>} */
    const devDependencies = {
      [packageName]: tarballs[packageName],
      '@types/node': rootPackage.catalog['@types/node'],
    };
    if (fixture === 'minimal')
      devDependencies['@orval/fetch'] = tarballs['@orval/fetch'];
    write(
      dir,
      'package.json',
      JSON.stringify(
        { private: true, type: 'module', devDependencies, overrides },
        null,
        2,
      ),
    );
    write(dir, 'openapi.json', JSON.stringify(spec));
    write(
      dir,
      'orval.config.ts',
      `import { defineConfig } from '${packageName}';\n${config.replace('export default {', 'export default defineConfig({').replace(' };\n', ' });\n')}`,
    );
    write(
      dir,
      'tsconfig.json',
      JSON.stringify({
        compilerOptions: {
          strict: true,
          skipLibCheck: false,
          module: 'ESNext',
          moduleResolution: 'Bundler',
          target: 'ES2022',
          noEmit: true,
        },
        include: ['orval.config.ts', 'usage.ts', 'src/**/*.ts'],
      }),
    );
    write(
      dir,
      'tsconfig.node.json',
      JSON.stringify({
        extends: './tsconfig.json',
        compilerOptions: { module: 'NodeNext', moduleResolution: 'NodeNext' },
        include: ['orval.config.ts', 'usage.ts'],
      }),
    );
    write(
      dir,
      'usage.ts',
      `import generate, { generate as named, defineConfig, defineTransformer, type Options${fixture === 'full' ? ', type ZodParamsContext' : ''} } from '${packageName}';\nvoid [generate, named, defineConfig, defineTransformer];\ntype PublicOptions = Options;\n${fixture === 'full' ? 'type PublicZodContext = ZodParamsContext;\n' : ''}`,
    );
    run(bun, ['install', '--ignore-scripts'], dir, { timeout: 300_000 });
    console.log(
      `${fixture} installed package entries: ${packageCount(path.join(dir, 'node_modules'))}`,
    );
    if (fixture === 'minimal') {
      assert.deepEqual(
        readdirSync(path.join(dir, 'node_modules/@orval')).sort(),
        ['cli', 'core', 'fetch'],
      );
      for (const absent of [
        '@faker-js/faker',
        '@modelcontextprotocol/server',
      ]) {
        assert.equal(
          existsSync(path.join(dir, 'node_modules', absent)),
          false,
          `${absent} unexpectedly installed`,
        );
      }
    }
    assert.match(
      run(bun, ['run', 'orval', '--config', 'orval.config.ts'], dir),
      /A swagger client generator for typescript/,
    );
    run(
      node,
      [
        path.join(root, 'node_modules/typescript/bin/tsc'),
        '-p',
        'tsconfig.json',
      ],
      dir,
    );
    run(
      node,
      [
        path.join(root, 'node_modules/typescript/bin/tsc'),
        '-p',
        'tsconfig.node.json',
      ],
      dir,
    );
    write(
      dir,
      'api-check.mjs',
      `import assert from 'node:assert/strict';\nimport generate, { generate as named, defineConfig, defineTransformer } from '${packageName}';\nassert.equal(generate, named);\nassert.equal(typeof defineConfig, 'function');\nassert.equal(typeof defineTransformer, 'function');\nconst options = { input: './openapi.json', output: { target: './src/api.ts', schemas: './src/models', client: 'fetch', tsconfig: './tsconfig.json' } };\nawait generate(options, process.cwd(), process.argv[2] === 'check' ? { outdated: true } : undefined);\n`,
    );
    const target = path.join(dir, 'src/api.ts');
    const cliOutput = readFileSync(target, 'utf8');
    run(node, ['api-check.mjs'], dir);
    const original = readFileSync(target, 'utf8');
    assert.equal(
      original,
      cliOutput,
      'programmatic output differs from CLI output',
    );
    run(node, ['api-check.mjs', 'check'], dir);
    writeFileSync(target, `${original}\n// changed\n`);
    const output = run(node, ['api-check.mjs', 'check'], dir, {
      failure: true,
    });
    assert.match(output, /outdated/i);
    assert.equal(readFileSync(target, 'utf8'), `${original}\n// changed\n`);
    writeFileSync(target, original);
    if (fixture === 'minimal') {
      write(
        dir,
        'missing.config.ts',
        "export default { pets: { input: './openapi.json', output: './src/missing.ts' } };\n",
      );
      assert.match(
        run(bun, ['run', 'orval', '--config', 'missing.config.ts'], dir, {
          failure: true,
        }),
        /Generator package "@orval\/axios" is not installed\. Install @orval\/axios@\S+ alongside @orval\/cli\./,
      );
      write(
        dir,
        'missing-mock.config.ts',
        "export default { pets: { input: './openapi.json', output: { target: './src/missing.ts', client: 'fetch', mock: true } } };\n",
      );
      assert.match(
        run(bun, ['run', 'orval', '--config', 'missing-mock.config.ts'], dir, {
          failure: true,
        }),
        /Generator package "@orval\/mock" is not installed\. Install @orval\/mock@\S+ alongside @orval\/cli\./,
      );
    }
  }
  for (const name of [
    'src/api.ts',
    'src/models/pet.ts',
    'src/models/index.ts',
  ]) {
    assert.equal(
      readFileSync(path.join(temp, 'minimal', name), 'utf8'),
      readFileSync(path.join(temp, 'full', name), 'utf8'),
      `${name} differs between packages`,
    );
  }
  success = true;
  console.log('Packed minimal and full consumer checks passed.');
} finally {
  if (success) rmSync(temp, { recursive: true, force: true });
  else
    console.error(`Packed consumer artifacts retained for inspection: ${temp}`);
}
