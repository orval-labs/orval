import { describe, expect, it } from 'vitest';

import { extractExistingHandlerBodies } from './index';

describe('extractExistingHandlerBodies', () => {
  it('returns the body of each handler keyed by name', () => {
    const source = `
import { createFactory } from 'hono/factory';

const factory = createFactory();
export const listPetsHandlers = factory.createHandlers(
  async (c: ListPetsContext) => {
    return c.json([]);
  },
);
export const createPetsHandlers = factory.createHandlers(
  zValidator('json', CreatePetsBody),
  async (c: CreatePetsContext) => {},
);
`;

    const bodies = extractExistingHandlerBodies(source);

    expect([...bodies.keys()]).toEqual([
      'listPetsHandlers',
      'createPetsHandlers',
    ]);
    expect(bodies.get('listPetsHandlers')).toContain('return c.json([]);');
    expect(bodies.get('createPetsHandlers')).toBe('');
  });

  it('preserves nested syntax inside the handler body', () => {
    const source = `export const listPetsHandlers = factory.createHandlers(
  async (c: ListPetsContext) => {
    const limit = Number(c.req.query('limit') ?? 10);
    if (limit > 0) { return c.json({ items: pets.slice(0, limit) }); }
  },
);`;

    const body = extractExistingHandlerBodies(source).get('listPetsHandlers');
    expect(body).toContain("Number(c.req.query('limit') ?? 10)");
    expect(body).toContain('{ items: pets.slice(0, limit) }');
  });

  it('is not confused by parentheses or braces inside strings, templates, comments, and regex', () => {
    const source = `export const trickyHandlers = factory.createHandlers(
  async (c: TrickyContext) => {
    const a = ")"; // a paren in a string — must not close the call
    const b = '}';
    const c1 = \`tpl ) { } \${'} )'} end\`;
    const re = /\\)\\}\\(/g;
    /* block comment with ) and } and ( */
    // line comment with ) }
    return c.text(a + b + c1);
  },
);`;

    const body = extractExistingHandlerBodies(source).get('trickyHandlers');
    expect(body).toBeDefined();
    expect(body).toContain('return c.text(a + b + c1);');
    expect(body).toContain('/* block comment with ) and } and ( */');
  });

  it('returns an empty map when no handlers are present', () => {
    expect(extractExistingHandlerBodies('// nothing here').size).toBe(0);
  });
});
