import { parse } from 'acorn';
import { describe, expect, it } from 'vite-plus/test';

import { getArray } from '../getters/array';
import { createTestContextSpec } from '../test-utils/context';
import type { OpenApiDocument, OpenApiSchemaObject } from '../types';

function createContext(spec?: OpenApiDocument) {
  return createTestContextSpec({
    target: 'core-test',
    workspace: '/tmp',
    spec: spec ?? { openapi: '3.1.0' },
    override: {},
  });
}

function aliasModelFor(schema: OpenApiSchemaObject, name: string) {
  const result = getArray({ schema, name, context: createContext() });
  return result.schemas.at(-1)?.model ?? '';
}

/**
 * Strips the `as const` assertion so the emitted declaration can be parsed as
 * plain JS, then walks it for any node that would do something at load time.
 * A constant that is a literal cannot execute; anything else (a call, an await,
 * an identifier reference) means document text escaped its quotes.
 */
function initIsInert(model: string): boolean {
  const program = parse(model.replace(' as const;', ';'), {
    ecmaVersion: 'latest',
    sourceType: 'module',
  });

  const [statement, ...rest] = program.body;
  if (rest.length > 0 || statement?.type !== 'ExportNamedDeclaration') {
    return false;
  }

  const declaration = statement.declaration;
  if (declaration?.type !== 'VariableDeclaration') {
    return false;
  }

  const init = declaration.declarations[0]?.init;
  return (
    init?.type === 'Literal' ||
    init?.type === 'ObjectExpression' ||
    init?.type === 'ArrayExpression'
  );
}

describe('createTypeAliasIfNeeded const emission', () => {
  // Regression for GHSA-x4fj-j9hr-ccr6: an array component whose `items` is an
  // inline object carrying a `const` reaches the alias writer, which used to
  // decide quoting from the declared `type`. `object` is not `string`, so the
  // constant was spliced in raw and a string payload became a live expression
  // in `export const X = ... as const;` — arbitrary code at import time.
  it('renders a string const under an object-typed schema as an inert literal', () => {
    const model = aliasModelFor(
      {
        type: 'array',
        items: {
          type: 'object',
          properties: { x: { type: 'string' } },
          const: "(await import('node:child_process')).execSync('touch pwned')",
        },
      } as OpenApiSchemaObject,
      'EvilList',
    );

    expect(model).toBe(
      String.raw`export const EvilList = '(await import(\'node:child_process\')).execSync(\'touch pwned\')' as const;` +
        '\n',
    );
    expect(initIsInert(model)).toBe(true);
  });

  it('escapes a const that tries to close its own string literal', () => {
    const model = aliasModelFor(
      {
        type: 'array',
        items: {
          type: ['object', 'string'],
          properties: { x: { type: 'string' } },
          const: "'; console.log('pwned'); const y = '",
        },
      } as OpenApiSchemaObject,
      'Mixed',
    );

    expect(initIsInert(model)).toBe(true);
  });

  it('serializes an object const instead of coercing it to [object Object]', () => {
    const model = aliasModelFor(
      {
        type: 'array',
        items: {
          type: 'object',
          properties: { x: { type: 'string' } },
          const: { x: 'a' },
        },
      } as OpenApiSchemaObject,
      'ObjConst',
    );

    expect(model).toBe('export const ObjConst = {"x":"a"} as const;\n');
    expect(initIsInert(model)).toBe(true);
  });

  it('keeps a numeric const numeric', () => {
    const model = aliasModelFor(
      {
        type: 'array',
        items: {
          type: 'object',
          properties: { x: { type: 'string' } },
          const: 42,
        },
      } as OpenApiSchemaObject,
      'NumConst',
    );

    expect(model).toBe('export const NumConst = 42 as const;\n');
  });

  it('still quotes a string const under a string-typed schema', () => {
    const model = aliasModelFor(
      {
        type: 'array',
        items: {
          type: ['object', 'string'],
          properties: { x: { type: 'string' } },
          const: 'plain',
        },
      } as OpenApiSchemaObject,
      'StrConst',
    );

    expect(model).toContain(`export const StrConst = 'plain' as const;`);
  });
});
