import { tmpdir } from 'node:os';
import path from 'node:path';

import fs from 'fs-extra';
import { describe, expect, it } from 'vitest';

import { writeZodSchemas, writeZodSchemasFromVerbs } from './write-zod-specs';

type MinimalVerbsContext = {
  output: {
    override: {
      useDates?: boolean;
      zod: {
        dateTimeOptions?: Record<string, unknown>;
        timeOptions?: Record<string, unknown>;
      };
    };
  };
  spec: unknown;
  target: string;
  workspace: string;
};
const createOutputOptions = (): Parameters<typeof writeZodSchemas>[4] =>
  ({
    namingConvention: 'PascalCase',
    indexFiles: true,
    override: {
      zod: {
        strict: {
          body: true,
        },
        coerce: {
          body: false,
        },
      },
    },
  }) as Parameters<typeof writeZodSchemas>[4];

describe('write-zod-specs regressions', () => {
  it('writes const constraints before schema export', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'orval-zod-'));
    const schemasPath = path.join(root, 'schemas');

    const builder = {
      spec: {},
      target: '',
      schemas: [
        {
          name: 'RangeSchema',
          schema: {
            type: 'number',
            minimum: 2,
            maximum: 10,
          },
        },
      ],
    } satisfies Parameters<typeof writeZodSchemas>[0];

    await writeZodSchemas(
      builder,
      schemasPath,
      '.ts',
      '',
      createOutputOptions(),
    );

    const filePath = path.join(schemasPath, 'RangeSchema.ts');
    const fileContent = await fs.readFile(filePath, 'utf8');

    expect(fileContent).toContain('export const RangeSchemaMin = 2;');
    expect(fileContent).toContain('export const RangeSchemaMax = 10;');
    expect(
      fileContent.indexOf('export const RangeSchemaMin = 2;'),
    ).toBeLessThan(fileContent.indexOf('export const RangeSchema ='));
    expect(fileContent).toContain(
      'export const RangeSchema = zod.number().min(RangeSchemaMin).max(RangeSchemaMax)',
    );
    expect(fileContent).not.toContain(
      'export const RangeSchema = export const',
    );

    await fs.remove(root);
  });

  it('merges case-colliding schema files and keeps canonical index export', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'orval-zod-'));
    const schemasPath = path.join(root, 'schemas');

    const context = {
      output: {
        override: {
          useDates: false,
          zod: {
            dateTimeOptions: {},
            timeOptions: {},
          },
        },
      },
      spec: {},
      target: '',
      workspace: root,
    } satisfies MinimalVerbsContext;

    const verbOptions = {
      firstVerb: {
        operationName: 'fooBar',
        originalOperation: {
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'number',
                  minimum: 2,
                },
              },
            },
          },
          parameters: [],
        },
        response: {
          types: {
            success: [],
            errors: [],
          },
        },
      },
      secondVerb: {
        operationName: 'Foobar',
        originalOperation: {
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'number',
                  minimum: 3,
                },
              },
            },
          },
          parameters: [],
        },
        response: {
          types: {
            success: [],
            errors: [],
          },
        },
      },
    } satisfies Parameters<typeof writeZodSchemasFromVerbs>[0];

    await writeZodSchemasFromVerbs(
      verbOptions,
      schemasPath,
      '.ts',
      '',
      createOutputOptions(),
      context,
    );

    const directoryFiles = await fs.readdir(schemasPath);
    const schemaFiles = directoryFiles.filter((file) =>
      file.toLowerCase().startsWith('foobarbody.'),
    );

    expect(schemaFiles).toHaveLength(1);

    const mergedFilePath = path.join(schemasPath, schemaFiles[0]);
    const mergedContent = await fs.readFile(mergedFilePath, 'utf8');

    expect(mergedContent).toContain('export const FooBarBodyMin = 2;');
    expect(mergedContent).toContain('export const FoobarBodyMin = 3;');
    expect(mergedContent).toContain(
      'export const FooBarBody = zod.number().min(FooBarBodyMin)',
    );
    expect(mergedContent).toContain(
      'export const FoobarBody = zod.number().min(FoobarBodyMin)',
    );

    const indexPath = path.join(schemasPath, 'index.ts');
    const indexContent = await fs.readFile(indexPath, 'utf8');
    const mergedSchemaExport = path.basename(schemaFiles[0], '.ts');

    expect(indexContent).toContain(`export * from './${mergedSchemaExport}';`);

    await fs.remove(root);
  });

  it('writes default const before schema export in split output (#2801)', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'orval-zod-'));
    const schemasPath = path.join(root, 'schemas');

    const builder = {
      spec: {},
      target: '',
      schemas: [
        {
          name: 'DefaultedSchema',
          schema: {
            type: 'string',
            default: 'hello',
          },
        },
      ],
    } satisfies Parameters<typeof writeZodSchemas>[0];

    await writeZodSchemas(
      builder,
      schemasPath,
      '.ts',
      '',
      createOutputOptions(),
    );

    const filePath = path.join(schemasPath, 'DefaultedSchema.ts');
    const fileContent = await fs.readFile(filePath, 'utf8');

    expect(fileContent).toContain(
      'export const DefaultedSchemaDefault = `hello`;',
    );
    expect(fileContent).toContain(
      'export const DefaultedSchema = zod.string()',
    );
    expect(
      fileContent.indexOf('export const DefaultedSchemaDefault = `hello`;'),
    ).toBeLessThan(fileContent.indexOf('export const DefaultedSchema ='));
    expect(fileContent).not.toContain(
      'export const DefaultedSchema = export const',
    );

    await fs.remove(root);
  });
});
