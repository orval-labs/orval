import type { GeneratorVerbOptions, OpenApiSchemaObject } from '@orval/core';
import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../../core/src/test-utils';
import { generateValibotSchemasModule } from './schemas-module';
import { gen } from './test-helpers';

const moduleOf = (schemas: Record<string, OpenApiSchemaObject>) => {
  const { spec, target, output } = createTestContextSpec({
    spec: { components: { schemas } },
    output: {
      schemas: { path: './model', type: 'valibot', splitByTags: false },
    },
  });
  return generateValibotSchemasModule(
    {
      spec,
      target,
      schemas: [],
      verbOptions: {} as Record<string, GeneratorVerbOptions>,
    },
    output,
    '',
  );
};

describe('generateValibotSchemasModule', () => {
  it('types the getters of a cycle with the exported input and output types', () => {
    const source = moduleOf({
      Node: {
        type: 'object',
        required: ['next'],
        properties: { next: { $ref: '#/components/schemas/Edge' } },
      },
      Edge: {
        type: 'object',
        properties: { to: { $ref: '#/components/schemas/Node' } },
      },
    });

    expect(source).toContain(
      'v.lazy((): v.GenericSchema<Node, NodeOutput> => Node)',
    );
    expect(source).toContain(
      'export type Edge = {\n  to?: Node | undefined;\n};',
    );
    expect(source).toContain(
      'export type EdgeOutput = {\n  to?: NodeOutput | undefined;\n};',
    );
    expect(source).not.toContain('v.InferInput<typeof Edge>');
  });

  it('names the types of a renamed recursive constant like its exports', () => {
    const source = moduleOf({
      Date: {
        type: 'object',
        properties: { parent: { $ref: '#/components/schemas/Date' } },
      },
    });

    expect(source).toContain(
      'v.lazy((): v.GenericSchema<DateSchema, DateOutput> => DateSchema)',
    );
    expect(source).toContain('export type DateSchema = {');
    expect(source).toContain('export type DateOutput = {');
    expect(source).toContain('export { DateSchema as Date };');
  });

  it('is empty when there is nothing to declare', () => {
    expect(moduleOf({})).toBe('');
  });

  it('exports the input and output types of a component', () => {
    const source = moduleOf({ Pet: { type: 'string' } });

    expect(source).toContain("import * as v from 'valibot';");
    expect(source).toContain('export const Pet = v.string();');
    expect(source).toContain('export type Pet = v.InferInput<typeof Pet>;');
    expect(source).toContain(
      'export type PetOutput = v.InferOutput<typeof Pet>;',
    );
  });

  it('keeps a component named Error under its own name', () => {
    const source = moduleOf({ Error: { type: 'string' } });

    expect(source).toContain('export const Error = v.string();');
    expect(source).toContain(
      'export type ErrorOutput = v.InferOutput<typeof Error>;',
    );
    expect(source).not.toContain('ErrorSchema');
  });

  it.each(['Date', 'RegExp'])(
    'exports a component named %s under the name clients import',
    (name) => {
      const source = moduleOf({ [name]: { type: 'string' } });

      expect(source).toContain(`export const ${name}Schema = v.string();`);
      expect(source).toContain(`export { ${name}Schema as ${name} };`);
      expect(source).toContain(
        `export type ${name}Output = v.InferOutput<typeof ${name}Schema>;`,
      );
    },
  );

  it('makes a required writeOnly property optional', () => {
    const source = moduleOf({
      Account: {
        type: 'object',
        required: ['id', 'password'],
        properties: {
          id: { type: 'string', readOnly: true },
          password: { type: 'string', writeOnly: true },
        },
      },
    });

    expect(source).toContain('id: v.string()');
    expect(source).toContain('password: v.optional(v.string())');
  });

  it('rejects a component named like the output type of another', () => {
    expect(() =>
      moduleOf({ Pet: { type: 'string' }, PetOutput: { type: 'string' } }),
    ).toThrow(/"PetOutput", which is also a schema/);
  });

  it('keeps v.file for format binary in JSON, a documented limit', () => {
    const { ok } = gen({ type: 'string', format: 'binary' });

    expect(ok('aGVsbG8=')).toBe(false);
  });
});
