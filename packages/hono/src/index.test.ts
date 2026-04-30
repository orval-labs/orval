import { describe, expect, it } from 'vitest';

import { extractExistingHandlers } from './index';

describe('extractExistingHandlers', () => {
  it('returns each generated handler block keyed by name', () => {
    const source = `
import { createFactory } from 'hono/factory';

const factory = createFactory();
export const listPetsHandlers = factory.createHandlers(
  async (c: ListPetsContext) => {},
);
export const createPetsHandlers = factory.createHandlers(
  zValidator('json', CreatePetsBody),
  async (c: CreatePetsContext) => {},
);
`;

    const handlers = extractExistingHandlers(source);

    expect([...handlers.keys()]).toEqual([
      'listPetsHandlers',
      'createPetsHandlers',
    ]);
    expect(handlers.get('listPetsHandlers')).toContain(
      'async (c: ListPetsContext) => {}',
    );
    expect(handlers.get('createPetsHandlers')).toContain(
      "zValidator('json', CreatePetsBody)",
    );
  });

  it('preserves user edits inside handler bodies, including nested parens', () => {
    const source = `export const listPetsHandlers = factory.createHandlers(
  async (c: ListPetsContext) => {
    const limit = Number(c.req.query('limit') ?? 10);
    return c.json({ items: pets.slice(0, limit) });
  },
);`;

    const handlers = extractExistingHandlers(source);
    expect(handlers.get('listPetsHandlers')).toBe(source);
  });

  it('returns an empty map when no handlers are present', () => {
    expect(extractExistingHandlers('// nothing here').size).toBe(0);
  });
});
