import { runInNewContext } from 'node:vm';

import type {
  OpenApiComponentsObject,
  OpenApiParameterObject,
  OpenApiReferenceObject,
  OpenApiSchemaObject,
} from '@orval/core';
import * as v from 'valibot';
import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../../core/src/test-utils';
import { allocateConstName } from './const-names';
import { parseBodyAndResponse, parseParameters } from './operation';
import { renderValibot } from './render';
import { generateValibotComponents } from './reusable-schemas';

const ref = (name: string) => ({
  $ref: `#/components/schemas/${name}`,
});

interface ContextOptions {
  strict?: boolean;
  useDates?: boolean;
}

const contextOf = (
  schemas: Record<string, OpenApiSchemaObject>,
  { strict = false, useDates = false }: ContextOptions = {},
) =>
  createTestContextSpec({
    spec: { components: { schemas } },
    output: {
      override: {
        useDates,
        valibot: {
          generateReusableSchemas: true,
          strict: {
            param: strict,
            query: strict,
            header: strict,
            body: strict,
            response: strict,
          },
        },
      },
    },
  });

// Evaluates the whole module, so a constant read before its declaration throws.
// The getter's return type is dropped as the script is plain JavaScript.
const load = (schemas: Record<string, OpenApiSchemaObject>) => {
  const code = generateValibotComponents(contextOf(schemas));
  const names = Object.keys(schemas);
  const module = runInNewContext(
    `${code.replaceAll('export const ', 'const ').replaceAll('(): v.GenericSchema =>', '() =>')}\n;({ ${names.join(', ')} })`,
    { v },
  ) as Record<string, v.GenericSchema>;
  const ok = (name: string, input: unknown) =>
    v.safeParse(module[name], input).success;
  return { code, ok };
};

const bodyOf = (
  schema: OpenApiSchemaObject,
  schemas: Record<string, OpenApiSchemaObject>,
  options: { isRequest: boolean; contentType?: string; strict?: boolean },
) => {
  const node = parseBodyAndResponse({
    data: {
      content: { [options.contentType ?? 'application/json']: { schema } },
    },
    context: contextOf(schemas),
    strict: options.strict ?? false,
    generate: true,
    isRequest: options.isRequest,
  });
  return node ? renderValibot(node) : undefined;
};

describe('component constants', () => {
  it('declares one constant per component, dependencies first', () => {
    const { code } = load({
      Pet: { type: 'object', properties: { owner: ref('Owner') } },
      Owner: { type: 'object', properties: { name: { type: 'string' } } },
    });
    expect(code.indexOf('const Owner')).toBeLessThan(code.indexOf('const Pet'));
    expect(code).toContain('owner: v.optional(Owner)');
  });

  it('reads a self reference through v.lazy', () => {
    const { code, ok } = load({
      Tree: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          children: { type: 'array', items: ref('Tree') },
        },
      },
    });
    expect(code).toContain('v.lazy((): v.GenericSchema => Tree)');
    expect(ok('Tree', { name: 'a', children: [{ name: 'b' }] })).toBe(true);
    expect(ok('Tree', { name: 'a', children: [{}] })).toBe(false);
  });

  it('breaks a two-node cycle with one lazy edge', () => {
    const { code, ok } = load({
      A: { type: 'object', properties: { b: ref('B') } },
      B: { type: 'object', properties: { a: ref('A') } },
    });
    expect(code.match(/v\.lazy/g)).toHaveLength(1);
    expect(ok('A', { b: { a: { b: {} } } })).toBe(true);
    expect(ok('A', { b: { a: { b: 1 } } })).toBe(false);
  });

  it('breaks a three-node cycle', () => {
    const { code, ok } = load({
      A: { type: 'object', required: ['b'], properties: { b: ref('B') } },
      B: { type: 'object', required: ['c'], properties: { c: ref('C') } },
      C: { type: 'object', properties: { a: ref('A') } },
    });
    expect(code.match(/v\.lazy/g)).toHaveLength(1);
    expect(ok('A', { b: { c: { a: { b: { c: {} } } } } })).toBe(true);
    expect(ok('A', { b: {} })).toBe(false);
  });

  it('reads a component through its alias', () => {
    const { code } = load({
      Alias: ref('Target'),
      Target: { type: 'string' },
    });
    expect(code).toContain('const Alias = Target');
  });

  it('describes a reference with a description sibling', () => {
    const { code } = load({
      Name: { type: 'string' },
      Pet: {
        type: 'object',
        properties: { name: { ...ref('Name'), description: 'The name' } },
      },
    });
    expect(code).toContain("v.pipe(Name, v.description('The name'))");
  });

  it('applies the other siblings of a reference next to it', () => {
    const { ok } = load({
      Base: { type: 'object', properties: { id: { type: 'string' } } },
      Pet: {
        ...ref('Base'),
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string' } },
      },
    });
    expect(ok('Pet', { id: 'a', name: 'n' })).toBe(true);
    expect(ok('Pet', { id: 'a' })).toBe(false);
  });

  it('merges an allOf of references', () => {
    const { code, ok } = load({
      Base: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      Pet: {
        allOf: [
          ref('Base'),
          {
            type: 'object',
            required: ['name'],
            properties: { name: { type: 'string' } },
          },
        ],
      },
    });
    expect(code).toContain('v.intersect([Base, v.object(');
    expect(ok('Pet', { id: 'a', name: 'n' })).toBe(true);
    expect(ok('Pet', { id: 'a' })).toBe(false);
  });

  it('uses a union for oneOf options that are references', () => {
    const { code } = load({
      Cat: { type: 'object', properties: { kind: { enum: ['cat'] } } },
      Dog: { type: 'object', properties: { kind: { enum: ['dog'] } } },
      Pet: {
        oneOf: [ref('Cat'), ref('Dog')],
        discriminator: { propertyName: 'kind' },
      },
    });
    expect(code).toContain('const Pet = v.union([Cat, Dog])');
  });

  it('inlines a member whose key the parent requires', () => {
    const { code, ok } = load({
      Optionals: {
        type: 'object',
        properties: { left: { type: 'string' }, right: { type: 'string' } },
      },
      Pet: { allOf: [ref('Optionals')], required: ['left'] },
    });
    expect(code).not.toMatch(/const Pet = .*Optionals/s);
    expect(ok('Pet', {})).toBe(false);
    expect(ok('Pet', { left: 'l' })).toBe(true);
  });

  it('keeps a member whose key the parent does not require', () => {
    const { code } = load({
      Optionals: { type: 'object', properties: { left: { type: 'string' } } },
      Pet: {
        allOf: [ref('Optionals')],
        required: ['other'],
        properties: { other: { type: 'string' } },
      },
    });
    expect(code).toMatch(/const Pet = v\.intersect\(\[\s*Optionals/);
  });

  it('keeps a member that already requires the key', () => {
    const { code } = load({
      Needs: {
        type: 'object',
        required: ['left'],
        properties: { left: { type: 'string' } },
      },
      Pet: { allOf: [ref('Needs')], required: ['left'] },
    });
    expect(code).toMatch(/const Pet = Needs/);
  });

  it('inlines composition members of a strict schema', () => {
    const schemas: Record<string, OpenApiSchemaObject> = {
      Base: {
        type: 'object',
        additionalProperties: false,
        properties: { id: { type: 'string' } },
      },
      Pet: {
        allOf: [
          ref('Base'),
          { type: 'object', properties: { name: { type: 'string' } } },
        ],
      },
    };
    const code = generateValibotComponents(
      contextOf(schemas, { strict: true }),
    );
    expect(code).toMatch(/const Pet = v\.intersect\(\[\s*v\.object\(/);
  });

  it('keeps a self-referencing oneOf option of a strict schema', () => {
    const code = generateValibotComponents(
      contextOf(
        {
          Tree: {
            type: 'object',
            additionalProperties: false,
            properties: {
              parent: { anyOf: [ref('Tree'), { type: 'null' }] },
            },
          },
        },
        { strict: true },
      ),
    );
    expect(code).toContain('v.union([v.lazy((): v.GenericSchema => Tree)');
    expect(code).not.toContain('v.unknown()');
  });

  it('terminates on a cycle made only of allOf members', () => {
    const { code, ok } = load({
      Loop: {
        allOf: [
          ref('Loop'),
          { type: 'object', properties: { z: { type: 'string' } } },
        ],
      },
      A: {
        allOf: [
          ref('B'),
          { type: 'object', properties: { a: { type: 'string' } } },
        ],
      },
      B: {
        allOf: [
          ref('A'),
          { type: 'object', properties: { b: { type: 'string' } } },
        ],
      },
    });
    expect(code).not.toContain('v.lazy');
    expect(ok('Loop', { z: 'x' })).toBe(true);
    expect(ok('A', { a: 'x' })).toBe(true);
    expect(ok('A', { a: 1 })).toBe(false);
  });

  it('terminates on a cycle made only of union members', () => {
    const { ok } = load({
      U: { oneOf: [{ type: 'string' }, ref('V')] },
      V: {
        allOf: [
          ref('U'),
          { type: 'object', properties: { v: { type: 'string' } } },
        ],
      },
    });
    expect(ok('U', 'text')).toBe(true);
    expect(ok('V', { v: '1' })).toBe(true);
  });

  it('cuts only the edge that closes an unguarded cycle', () => {
    const { ok } = load({
      A: { allOf: [ref('B'), ref('C')] },
      B: { oneOf: [ref('C'), { type: 'string' }] },
      C: {
        allOf: [
          ref('A'),
          {
            type: 'object',
            required: ['x'],
            properties: { x: { type: 'string' } },
          },
        ],
      },
    });
    expect(ok('A', 'hello')).toBe(false);
    expect(ok('A', { x: 'a' })).toBe(true);
    expect(ok('A', {})).toBe(false);
  });

  it('inlines a reference to an unknown component', () => {
    const { code } = load({
      Pet: { type: 'object', properties: { owner: ref('Missing') } },
    });
    expect(code).toContain('owner: v.optional(v.unknown())');
  });

  it('is empty without component schemas', () => {
    expect(generateValibotComponents(contextOf({}))).toBe('');
  });

  it('throws when two components share a name', () => {
    expect(() =>
      generateValibotComponents(
        contextOf({ Date: { type: 'string' }, DateSchema: { type: 'string' } }),
      ),
    ).toThrow(/both resolve to the export name "DateSchema"/);
  });

  it('does not let a component shadow what the output relies on', () => {
    const { code } = load({
      Date: { type: 'string' },
      Pet: { type: 'object', properties: { date: ref('Date') } },
    });
    expect(code).toContain('const DateSchema = v.string()');
    expect(code).toContain('date: v.optional(DateSchema)');
  });

  it('does not let a component shadow the RegExp a pattern calls', () => {
    const { code } = load({
      RegExp: { type: 'string', pattern: '^a+$' },
      Pet: {
        type: 'object',
        properties: { name: { type: 'string', pattern: '^b+$' } },
      },
    });
    expect(code).toContain('const RegExpSchema = ');
    expect(code).toContain('new RegExp(');
  });

  it('keeps the name of a component called Error', () => {
    const { code } = load({ Error: { type: 'string' } });
    expect(code).toContain('const Error = v.string()');
  });
});

describe('operation schemas', () => {
  const schemas: Record<string, OpenApiSchemaObject> = {
    Account: {
      type: 'object',
      required: ['id', 'name'],
      properties: {
        id: { type: 'string', readOnly: true },
        name: { type: 'string' },
      },
    },
    Secret: {
      type: 'object',
      required: ['label', 'password'],
      properties: {
        label: { type: 'string' },
        password: { type: 'string', writeOnly: true },
      },
    },
    Wrapper: { type: 'object', properties: { account: ref('Account') } },
    Plain: { type: 'object', properties: { name: { type: 'string' } } },
  };

  it('references a component in a body and a response', () => {
    expect(bodyOf(ref('Plain'), schemas, { isRequest: true })).toBe('Plain');
    expect(bodyOf(ref('Plain'), schemas, { isRequest: false })).toBe('Plain');
  });

  it('inlines a request body whose component holds a readOnly property', () => {
    const code = bodyOf(ref('Account'), schemas, { isRequest: true });
    expect(code).toContain('v.object({\n  name: v.string()\n})');
    expect(code).not.toContain('id:');
  });

  it('inlines a request body that reaches a readOnly property through a reference', () => {
    const code = bodyOf(ref('Wrapper'), schemas, { isRequest: true });
    expect(code).not.toContain('Account');
    expect(code).toContain('name: v.string()');
  });

  it('inlines a member that requires a key another member declares readOnly', () => {
    const extended: Record<string, OpenApiSchemaObject> = {
      Req: {
        type: 'object',
        required: ['id'],
        properties: { name: { type: 'string' } },
      },
      Ext: {
        allOf: [
          ref('Req'),
          {
            type: 'object',
            properties: { id: { type: 'string', readOnly: true } },
          },
        ],
      },
    };
    const code = bodyOf(ref('Ext'), extended, { isRequest: true });
    expect(code).not.toContain('Req');
    expect(code).not.toContain('id');
  });

  it('references the same component in a response', () => {
    expect(bodyOf(ref('Account'), schemas, { isRequest: false })).toBe(
      'Account',
    );
  });

  it('inlines a response whose component holds a writeOnly property', () => {
    const code = bodyOf(ref('Secret'), schemas, { isRequest: false });
    expect(code).not.toContain('password');
    expect(code).toContain('label: v.string()');
  });

  it('references a component that holds a writeOnly property in a request', () => {
    expect(bodyOf(ref('Secret'), schemas, { isRequest: true })).toBe('Secret');
  });

  it('inlines a multipart body', () => {
    const form: Record<string, OpenApiSchemaObject> = {
      Upload: {
        type: 'object',
        properties: { file: { type: 'string', format: 'binary' } },
      },
    };
    const code = bodyOf(ref('Upload'), form, {
      isRequest: true,
      contentType: 'multipart/form-data',
    });
    expect(code).toContain('file: v.optional(v.file())');
    expect(code).not.toContain('Upload');
  });

  it('inlines a url-encoded body', () => {
    const code = bodyOf(ref('Plain'), schemas, {
      isRequest: true,
      contentType: 'application/x-www-form-urlencoded',
    });
    expect(code).toContain('v.object(');
  });

  it('keeps the inline output when reusable schemas are off', () => {
    const node = parseBodyAndResponse({
      data: { content: { 'application/json': { schema: ref('Plain') } } },
      context: createTestContextSpec({
        spec: { components: { schemas } },
      }),
      strict: false,
      generate: true,
      isRequest: true,
    });
    expect(node && renderValibot(node)).toBe(
      'v.object({\n  name: v.optional(v.string())\n})',
    );
  });
});

describe('lazy references', () => {
  it('renders a lazy reference with an annotated getter', () => {
    const rendered = renderValibot(
      {
        schema: { kind: 'ref', name: 'Tree' },
        actions: [],
        nullable: false,
        optional: false,
      },
      { lazyRefs: new Set(['Tree']) },
    );
    expect(rendered).toBe('v.lazy((): v.GenericSchema => Tree)');
  });

  it('renders a reference by name otherwise', () => {
    const node = {
      schema: { kind: 'ref', name: 'Tree' } as const,
      actions: [],
      nullable: true,
      optional: false,
    };
    expect(renderValibot(node)).toBe('v.nullable(Tree)');
    expect(renderValibot(node, { lazyRefs: new Set(['Other']) })).toBe(
      'v.nullable(Tree)',
    );
  });
});

describe('allocateConstName', () => {
  it('keeps a free name', () => {
    expect(allocateConstName('ListPetsBody', new Set())).toBe('ListPetsBody');
  });

  it('suffixes a name a component already uses, and counts further', () => {
    const taken = new Set(['ListPetsResponse', 'ListPetsResponseSchema']);
    expect(allocateConstName('ListPetsResponse', taken)).toBe(
      'ListPetsResponseSchema1',
    );
    expect(allocateConstName('ListPetsResponse', taken)).toBe(
      'ListPetsResponseSchema2',
    );
  });
});

describe('parameter schemas', () => {
  const parametersOf = (
    parameters: (OpenApiParameterObject | OpenApiReferenceObject)[],
  ) => {
    const components: OpenApiComponentsObject = {
      schemas: { Status: { type: 'string', enum: ['a', 'b'] } },
      parameters: {
        Shared: { name: 'shared', in: 'query', schema: ref('Status') },
      },
    };
    const { queryParams } = parseParameters({
      data: parameters,
      context: createTestContextSpec({
        spec: { components },
        output: { override: { valibot: { generateReusableSchemas: true } } },
      }),
      strict: {
        param: false,
        query: false,
        header: false,
        body: false,
        response: false,
      },
      generate: {
        param: true,
        query: true,
        header: true,
        body: true,
        response: true,
      },
    });
    return queryParams ? renderValibot(queryParams) : undefined;
  };

  it('references the component of a parameter schema', () => {
    const code = parametersOf([
      { name: 'status', in: 'query', schema: ref('Status') },
    ]);
    expect(code).toContain('status: v.optional(Status)');
  });

  it('references the component of a referenced parameter', () => {
    const code = parametersOf([{ $ref: '#/components/parameters/Shared' }]);
    expect(code).toContain('shared: v.optional(Status)');
  });
});
