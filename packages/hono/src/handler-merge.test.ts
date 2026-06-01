import { describe, expect, it } from 'vitest';

import {
  type DesiredHandler,
  type DesiredImports,
  extractHandlerBodies,
  reconcileHandlerFile,
} from './handler-merge';

const factoryImport = { names: ['createFactory'], module: 'hono/factory' };

describe('reconcileHandlerFile', () => {
  it('renames the zod import and validator schema while preserving all user code', async () => {
    const source = `/* eslint-disable */
import { getDBClient } from '@altissia/database';
import { authenticate, getDecodedToken } from '@altissia/workers/middlewares/auth';
import { rateLimit } from '@altissia/workers/middlewares/ratelimit';
import { createFactory } from 'hono/factory';
import { zValidator } from '../users/users.validator';
import { VerifyAccountContext } from '../users/users.context';
import { verifyAccountResponse } from '../users/users.zod';

const logger = getLogger();
const factory = createFactory();

export const verifyAccountHandlers = factory.createHandlers(
  authenticate(),
  rateLimit(),
  zValidator('response', verifyAccountResponse),
  async (c: VerifyAccountContext) => {
    const token = getDecodedToken(c);
    return c.json({ ok: !!token });
  },
);

async function helper() {
  return getDBClient();
}
`;

    const imports: DesiredImports = {
      factory: factoryImport,
      validator: { names: ['zValidator'], module: '../users/users.validator' },
      context: {
        names: ['VerifyAccountContext'],
        module: '../users/users.context',
      },
      zod: { names: ['VerifyAccountResponse'], module: '../users/users.zod' },
    };
    const handlers: DesiredHandler[] = [
      {
        handlerName: 'verifyAccountHandlers',
        validators: [{ target: 'response', schema: 'VerifyAccountResponse' }],
        stub: '/* unused */',
      },
    ];

    const result = await reconcileHandlerFile(source, { imports, handlers });

    // orval-owned bits reconciled
    expect(result).toContain(
      "import { VerifyAccountResponse } from '../users/users.zod';",
    );
    expect(result).toContain("zValidator('response', VerifyAccountResponse)");
    expect(result).not.toContain('verifyAccountResponse');

    // user-owned code untouched
    expect(result).toContain(
      "import { getDBClient } from '@altissia/database';",
    );
    expect(result).toContain('authenticate(),');
    expect(result).toContain('rateLimit(),');
    expect(result).toContain('const logger = getLogger();');
    expect(result).toContain('const token = getDecodedToken(c);');
    expect(result).toContain('async function helper() {');
  });

  it('fixes a moved module specifier, matching the import by name', async () => {
    const source = `import { createFactory } from 'hono/factory';
import { zValidator } from '../old/users.validator';
import { ListPetsContext } from '../old/users.context';
import {
  ListPetsResponse
} from '../old/users.zod';

const factory = createFactory();

export const listPetsHandlers = factory.createHandlers(
  zValidator('response', ListPetsResponse),
  async (c: ListPetsContext) => {
    return c.json([]);
  },
);
`;

    const result = await reconcileHandlerFile(source, {
      imports: {
        factory: factoryImport,
        validator: {
          names: ['zValidator'],
          module: '../new/endpoints.validator',
        },
        context: {
          names: ['ListPetsContext'],
          module: '../new/endpoints.context',
        },
        zod: { names: ['ListPetsResponse'], module: '../new/endpoints.zod' },
      },
      handlers: [
        {
          handlerName: 'listPetsHandlers',
          validators: [{ target: 'response', schema: 'ListPetsResponse' }],
          stub: '',
        },
      ],
    });

    expect(result).toContain("from '../new/endpoints.zod'");
    expect(result).toContain("from '../new/endpoints.context'");
    expect(result).toContain("from '../new/endpoints.validator'");
    expect(result).not.toContain('../old/');
  });

  it('inserts a newly-required validator before the handler, keeping middleware', async () => {
    const source = `import { createFactory } from 'hono/factory';
import { authenticate } from './mw';
import { ListPetsContext } from './endpoints.context';

const factory = createFactory();

export const listPetsHandlers = factory.createHandlers(
  authenticate(),
  async (c: ListPetsContext) => {
    return c.json([]);
  },
);
`;

    const result = await reconcileHandlerFile(source, {
      imports: {
        factory: factoryImport,
        validator: { names: ['zValidator'], module: './endpoints.validator' },
        context: { names: ['ListPetsContext'], module: './endpoints.context' },
        zod: { names: ['ListPetsQueryParams'], module: './endpoints.zod' },
      },
      handlers: [
        {
          handlerName: 'listPetsHandlers',
          validators: [{ target: 'query', schema: 'ListPetsQueryParams' }],
          stub: '',
        },
      ],
    });

    expect(result).toContain("zValidator('query', ListPetsQueryParams),");
    expect(result).toContain('authenticate(),');
    expect(result).toContain(
      "import { zValidator } from './endpoints.validator';",
    );
    expect(result).toContain('ListPetsQueryParams');
    // validator sits after the middleware and before the handler
    const authIdx = result.indexOf('authenticate(),');
    const valIdx = result.indexOf("zValidator('query'");
    const handlerIdx = result.indexOf('async (c: ListPetsContext)');
    expect(authIdx).toBeLessThan(valIdx);
    expect(valIdx).toBeLessThan(handlerIdx);
  });

  it('removes a stale validator that the spec no longer requires', async () => {
    const source = `import { createFactory } from 'hono/factory';
import { zValidator } from './endpoints.validator';
import { CreatePetContext } from './endpoints.context';
import { CreatePetBody } from './endpoints.zod';

const factory = createFactory();

export const createPetHandlers = factory.createHandlers(
  zValidator('json', CreatePetBody),
  async (c: CreatePetContext) => {
    return c.json({});
  },
);
`;

    const result = await reconcileHandlerFile(source, {
      imports: {
        factory: factoryImport,
        context: { names: ['CreatePetContext'], module: './endpoints.context' },
      },
      handlers: [
        { handlerName: 'createPetHandlers', validators: [], stub: '' },
      ],
    });

    expect(result).not.toContain("zValidator('json'");
    expect(result).toContain('async (c: CreatePetContext)');
    // the now-unused zValidator import is removed
    expect(result).not.toContain('import { zValidator }');
  });

  it('appends a stub for an operation missing from the file', async () => {
    const source = `import { createFactory } from 'hono/factory';
import { ListPetsContext } from './endpoints.context';

const factory = createFactory();

export const listPetsHandlers = factory.createHandlers(
  async (c: ListPetsContext) => {
    return c.json([]);
  },
);
`;

    const stub = `\nexport const createPetsHandlers = factory.createHandlers(\nasync (c: CreatePetsContext) => {\n\n  },\n);`;
    const result = await reconcileHandlerFile(source, {
      imports: {
        factory: factoryImport,
        context: {
          names: ['ListPetsContext', 'CreatePetsContext'],
          module: './endpoints.context',
        },
      },
      handlers: [
        { handlerName: 'listPetsHandlers', validators: [], stub: '' },
        { handlerName: 'createPetsHandlers', validators: [], stub },
      ],
    });

    expect(result).toContain('export const createPetsHandlers');
    expect(result.match(/listPetsHandlers/g)?.length).toBe(1);
    // context import grows to include the new operation
    expect(result).toContain('CreatePetsContext');
  });

  it('returns the source unchanged when it cannot be parsed', async () => {
    const broken = 'export const x = factory.createHandlers(  // unterminated';
    const result = await reconcileHandlerFile(broken, {
      imports: { factory: factoryImport, context: { names: [], module: 'x' } },
      handlers: [],
    });
    expect(result).toBe(broken);
  });
});

describe('extractHandlerBodies', () => {
  it('returns the inner body of each handler keyed by name', async () => {
    const source = `import { createFactory } from 'hono/factory';
const factory = createFactory();
export const listPetsHandlers = factory.createHandlers(
  zValidator('query', ListPetsQueryParams),
  async (c: ListPetsContext) => {
    return c.json(pets.slice(0, 10));
  },
);
export const createPetsHandlers = factory.createHandlers(
  async (c: CreatePetsContext) => {},
);
`;

    const bodies = await extractHandlerBodies(source);
    expect([...(bodies?.keys() ?? [])]).toEqual([
      'listPetsHandlers',
      'createPetsHandlers',
    ]);
    expect(bodies?.get('listPetsHandlers')).toContain(
      'return c.json(pets.slice(0, 10));',
    );
    expect(bodies?.get('createPetsHandlers')).toBe('');
  });

  it('returns undefined on parse failure (so full mode can preserve the file)', async () => {
    const bodies = await extractHandlerBodies('const x = (');
    expect(bodies).toBeUndefined();
  });
});

describe('reconcileHandlerFile — preserves non-standard and user imports', () => {
  it('does NOT delete a user import whose name ends in "Context" (regression)', async () => {
    const source = `import { getCommunityFilterContext } from '../services/community-filters';
import { createFactory } from 'hono/factory';

const factory = createFactory();

export const getCommunityHandlers = factory.createHandlers(
  async (c) => {
    return c.json(getCommunityFilterContext());
  },
);
`;
    const result = await reconcileHandlerFile(source, {
      imports: {
        factory: factoryImport,
        context: {
          names: ['GetCommunityContext'],
          module: '../endpoints.context',
        },
      },
      handlers: [
        { handlerName: 'getCommunityHandlers', validators: [], stub: '' },
      ],
    });

    expect(result).toContain(
      "import { getCommunityFilterContext } from '../services/community-filters';",
    );
    // untyped handler → no context import is added
    expect(result).not.toContain('GetCommunityContext');
  });

  it('leaves a namespace import untouched', async () => {
    const source = `import * as Ctx from '../endpoints.context';
import { createFactory } from 'hono/factory';

const factory = createFactory();

export const listPetsHandlers = factory.createHandlers(
  async (c: Ctx.ListPetsContext) => {
    return c.json([]);
  },
);
`;
    const result = await reconcileHandlerFile(source, {
      imports: {
        factory: factoryImport,
        context: { names: ['ListPetsContext'], module: '../endpoints.context' },
      },
      handlers: [{ handlerName: 'listPetsHandlers', validators: [], stub: '' }],
    });

    expect(result).toContain("import * as Ctx from '../endpoints.context';");
    expect(result).not.toContain('import { ListPetsContext }');
  });

  it('leaves a default import untouched', async () => {
    const source = `import createFactory from 'hono/factory';

const factory = createFactory();

export const listPetsHandlers = factory.createHandlers(
  async (c) => {
    return c.json([]);
  },
);
`;
    const result = await reconcileHandlerFile(source, {
      imports: {
        factory: { names: ['createFactory'], module: 'hono/factory' },
        context: { names: ['ListPetsContext'], module: '../endpoints.context' },
      },
      handlers: [{ handlerName: 'listPetsHandlers', validators: [], stub: '' }],
    });

    expect(result).toContain("import createFactory from 'hono/factory';");
    expect(result).not.toContain('import { createFactory }');
  });

  it('does not duplicate an aliased zValidator import', async () => {
    const source = `import { createFactory } from 'hono/factory';
import { zValidator as zv } from '@hono/zod-validator';
import { ListPetsContext } from '../endpoints.context';
import { ListPetsQueryParams } from '../endpoints.zod';

const factory = createFactory();

export const listPetsHandlers = factory.createHandlers(
  zv('query', ListPetsQueryParams),
  async (c: ListPetsContext) => {
    return c.json([]);
  },
);
`;
    const result = await reconcileHandlerFile(source, {
      imports: {
        factory: factoryImport,
        validator: { names: ['zValidator'], module: '@hono/zod-validator' },
        context: { names: ['ListPetsContext'], module: '../endpoints.context' },
        zod: { names: ['ListPetsQueryParams'], module: '../endpoints.zod' },
      },
      handlers: [
        {
          handlerName: 'listPetsHandlers',
          validators: [{ target: 'query', schema: 'ListPetsQueryParams' }],
          stub: '',
        },
      ],
    });

    expect(result).toContain('import { zValidator as zv }');
    expect(result.match(/from '@hono\/zod-validator'/g)?.length).toBe(1);
  });

  it('does not duplicate or rename an aliased zod schema import', async () => {
    const source = `import { createFactory } from 'hono/factory';
import { zValidator } from '../endpoints.validator';
import { ListPetsContext } from '../endpoints.context';
import { ListPetsResponse as Resp } from '../endpoints.zod';

const factory = createFactory();

export const listPetsHandlers = factory.createHandlers(
  zValidator('response', Resp),
  async (c: ListPetsContext) => {
    return c.json([]);
  },
);
`;
    const result = await reconcileHandlerFile(source, {
      imports: {
        factory: factoryImport,
        validator: { names: ['zValidator'], module: '../endpoints.validator' },
        context: { names: ['ListPetsContext'], module: '../endpoints.context' },
        zod: { names: ['ListPetsResponse'], module: '../endpoints.zod' },
      },
      handlers: [
        {
          handlerName: 'listPetsHandlers',
          validators: [{ target: 'response', schema: 'ListPetsResponse' }],
          stub: '',
        },
      ],
    });

    expect(result).toContain('import { ListPetsResponse as Resp }');
    expect(result).toContain("zValidator('response', Resp)");
    expect(result).not.toContain(
      "import { ListPetsResponse } from '../endpoints.zod';",
    );
  });

  it('preserves user names sharing an orval module import', async () => {
    const source = `import { createFactory } from 'hono/factory';
import { ListPetsContext, somethingCustom } from '../endpoints.context';

const factory = createFactory();

export const listPetsHandlers = factory.createHandlers(
  async (c: ListPetsContext) => {
    return c.json(somethingCustom);
  },
);
`;
    const result = await reconcileHandlerFile(source, {
      imports: {
        factory: factoryImport,
        context: { names: ['ListPetsContext'], module: '../endpoints.context' },
      },
      handlers: [{ handlerName: 'listPetsHandlers', validators: [], stub: '' }],
    });

    expect(result).toContain('somethingCustom');
    expect(result).toContain('ListPetsContext');
  });

  it('does NOT clobber a user import whose name only case-folds to a zod schema', async () => {
    const source = `import { createFactory } from 'hono/factory';
import { listPetsResponse } from '../helpers';
import { ListPetsContext } from '../endpoints.context';

const factory = createFactory();

export const listPetsHandlers = factory.createHandlers(
  async (c: ListPetsContext) => {
    return c.json(listPetsResponse());
  },
);
`;
    const result = await reconcileHandlerFile(source, {
      imports: {
        factory: factoryImport,
        validator: { names: ['zValidator'], module: '../endpoints.validator' },
        context: { names: ['ListPetsContext'], module: '../endpoints.context' },
        zod: { names: ['ListPetsResponse'], module: '../endpoints.zod' },
      },
      handlers: [
        {
          handlerName: 'listPetsHandlers',
          validators: [{ target: 'response', schema: 'ListPetsResponse' }],
          stub: '',
        },
      ],
    });

    // user's lowercase import is untouched; orval's PascalCase import is added
    expect(result).toContain("import { listPetsResponse } from '../helpers';");
    expect(result).toContain(
      "import { ListPetsResponse } from '../endpoints.zod';",
    );
  });

  it('only renames a validator schema on a pure case migration', async () => {
    const source = `import { createFactory } from 'hono/factory';
import { zValidator } from '../endpoints.validator';
import { ListPetsContext } from '../endpoints.context';
import { MyCustomSchema } from '../schemas';

const factory = createFactory();

export const listPetsHandlers = factory.createHandlers(
  zValidator('response', MyCustomSchema),
  async (c: ListPetsContext) => {
    return c.json([]);
  },
);
`;
    const result = await reconcileHandlerFile(source, {
      imports: {
        factory: factoryImport,
        validator: { names: ['zValidator'], module: '../endpoints.validator' },
        context: { names: ['ListPetsContext'], module: '../endpoints.context' },
        zod: { names: ['ListPetsResponse'], module: '../endpoints.zod' },
      },
      handlers: [
        {
          handlerName: 'listPetsHandlers',
          validators: [{ target: 'response', schema: 'ListPetsResponse' }],
          stub: '',
        },
      ],
    });

    // a user-chosen, non-case-equal schema identifier is left alone
    expect(result).toContain("zValidator('response', MyCustomSchema)");
    expect(result).not.toContain('ListPetsResponse)');
  });

  it('consumes CRLF line endings when removing a validator', async () => {
    const source =
      "import { createFactory } from 'hono/factory';\r\n" +
      "import { zValidator } from '../endpoints.validator';\r\n" +
      "import { ListPetsContext } from '../endpoints.context';\r\n" +
      "import { ListPetsQueryParams } from '../endpoints.zod';\r\n" +
      '\r\n' +
      'const factory = createFactory();\r\n' +
      '\r\n' +
      'export const listPetsHandlers = factory.createHandlers(\r\n' +
      "  zValidator('query', ListPetsQueryParams),\r\n" +
      '  async (c: ListPetsContext) => {\r\n' +
      '    return c.json([]);\r\n' +
      '  },\r\n' +
      ');\r\n';

    const result = await reconcileHandlerFile(source, {
      imports: {
        factory: factoryImport,
        context: { names: ['ListPetsContext'], module: '../endpoints.context' },
      },
      handlers: [{ handlerName: 'listPetsHandlers', validators: [], stub: '' }],
    });

    expect(result).not.toContain("zValidator('query'");
    // no dangling carriage return left where the validator line was
    expect(result).not.toContain('\r\n\r\n  async');
  });

  it('reconciles multiple handlers in one file independently', async () => {
    const source = `import { createFactory } from 'hono/factory';
import { zValidator } from '../endpoints.validator';
import { ListPetsContext, CreatePetsContext } from '../endpoints.context';
import { listPetsResponse, createPetsBody } from '../endpoints.zod';

const factory = createFactory();

export const listPetsHandlers = factory.createHandlers(
  zValidator('response', listPetsResponse),
  async (c: ListPetsContext) => {
    return c.json([]);
  },
);

export const createPetsHandlers = factory.createHandlers(
  zValidator('json', createPetsBody),
  async (c: CreatePetsContext) => {
    return c.json({});
  },
);
`;
    const result = await reconcileHandlerFile(source, {
      imports: {
        factory: factoryImport,
        validator: { names: ['zValidator'], module: '../endpoints.validator' },
        context: {
          names: ['ListPetsContext', 'CreatePetsContext'],
          module: '../endpoints.context',
        },
        zod: {
          names: ['ListPetsResponse', 'CreatePetsBody'],
          module: '../endpoints.zod',
        },
      },
      handlers: [
        {
          handlerName: 'listPetsHandlers',
          validators: [{ target: 'response', schema: 'ListPetsResponse' }],
          stub: '',
        },
        {
          handlerName: 'createPetsHandlers',
          validators: [{ target: 'json', schema: 'CreatePetsBody' }],
          stub: '',
        },
      ],
    });

    expect(result).toContain("zValidator('response', ListPetsResponse)");
    expect(result).toContain("zValidator('json', CreatePetsBody)");
    expect(result).not.toContain('listPetsResponse');
    expect(result).not.toContain('createPetsBody');
  });

  it('detects an aliased zValidator and inserts new validators under the alias', async () => {
    const source = `import { createFactory } from 'hono/factory';
import { zValidator as zv } from '@hono/zod-validator';
import { ListPetsContext } from '../endpoints.context';
import { ListPetsQueryParams } from '../endpoints.zod';

const factory = createFactory();

export const listPetsHandlers = factory.createHandlers(
  zv('query', ListPetsQueryParams),
  async (c: ListPetsContext) => {
    return c.json([]);
  },
);
`;
    const result = await reconcileHandlerFile(source, {
      imports: {
        factory: factoryImport,
        validator: { names: ['zValidator'], module: '@hono/zod-validator' },
        context: { names: ['ListPetsContext'], module: '../endpoints.context' },
        zod: {
          names: ['ListPetsQueryParams', 'ListPetsResponse'],
          module: '../endpoints.zod',
        },
      },
      handlers: [
        {
          handlerName: 'listPetsHandlers',
          validators: [
            { target: 'query', schema: 'ListPetsQueryParams' },
            { target: 'response', schema: 'ListPetsResponse' },
          ],
          stub: '',
        },
      ],
    });

    // existing aliased validator detected → not duplicated under the bare name
    expect(result.match(/zv\('query'/g)?.length).toBe(1);
    expect(result).not.toContain("zValidator('query'");
    // new validator inserted under the SAME alias, never an unimported name
    expect(result).toContain("zv('response', ListPetsResponse)");
    expect(result).not.toContain("zValidator('response'");
    // alias import preserved, no duplicate
    expect(result).toContain('import { zValidator as zv }');
    expect(result.match(/from '@hono\/zod-validator'/g)?.length).toBe(1);
  });

  it('augments a mixed import with a new operation context, preserving user names', async () => {
    const source = `import { createFactory } from 'hono/factory';
import { ListPetsContext, somethingCustom } from '../endpoints.context';

const factory = createFactory();

export const listPetsHandlers = factory.createHandlers(
  async (c: ListPetsContext) => {
    return c.json(somethingCustom);
  },
);
`;
    const stub = `\nexport const createPetsHandlers = factory.createHandlers(\nasync (c: CreatePetsContext) => {\n\n  },\n);`;
    const result = await reconcileHandlerFile(source, {
      imports: {
        factory: factoryImport,
        context: {
          names: ['ListPetsContext', 'CreatePetsContext'],
          module: '../endpoints.context',
        },
      },
      handlers: [
        { handlerName: 'listPetsHandlers', validators: [], stub: '' },
        { handlerName: 'createPetsHandlers', validators: [], stub },
      ],
    });

    expect(result).toContain('somethingCustom'); // user name preserved
    expect(result).toContain('export const createPetsHandlers'); // new op appended
    expect(result).toContain(
      "import { CreatePetsContext } from '../endpoints.context';",
    ); // new op's context added via a separate import
  });

  it('augments a mixed zod import with a newly-required schema', async () => {
    const source = `import { createFactory } from 'hono/factory';
import { zValidator } from '../endpoints.validator';
import { ListPetsContext } from '../endpoints.context';
import { ListPetsResponse, myZodHelper } from '../endpoints.zod';

const factory = createFactory();

export const listPetsHandlers = factory.createHandlers(
  zValidator('response', ListPetsResponse),
  async (c: ListPetsContext) => {
    return c.json(myZodHelper());
  },
);
`;
    const result = await reconcileHandlerFile(source, {
      imports: {
        factory: factoryImport,
        validator: { names: ['zValidator'], module: '../endpoints.validator' },
        context: { names: ['ListPetsContext'], module: '../endpoints.context' },
        zod: {
          names: ['ListPetsResponse', 'ListPetsQueryParams'],
          module: '../endpoints.zod',
        },
      },
      handlers: [
        {
          handlerName: 'listPetsHandlers',
          validators: [
            { target: 'response', schema: 'ListPetsResponse' },
            { target: 'query', schema: 'ListPetsQueryParams' },
          ],
          stub: '',
        },
      ],
    });

    expect(result).toContain('myZodHelper'); // user name preserved
    expect(result).toContain("zValidator('query', ListPetsQueryParams)"); // new validator
    expect(result).toContain(
      "import { ListPetsQueryParams } from '../endpoints.zod';",
    ); // new schema added via a separate import
  });

  it('inserts a validator after inline middleware, before the handler', async () => {
    const source = `import { createFactory } from 'hono/factory';
import { zValidator } from '../endpoints.validator';
import { ListPetsContext } from '../endpoints.context';
import { ListPetsQueryParams } from '../endpoints.zod';

const factory = createFactory();

export const listPetsHandlers = factory.createHandlers(
  (c, next) => next(),
  async (c: ListPetsContext) => {
    return c.json([]);
  },
);
`;
    const result = await reconcileHandlerFile(source, {
      imports: {
        factory: factoryImport,
        validator: { names: ['zValidator'], module: '../endpoints.validator' },
        context: { names: ['ListPetsContext'], module: '../endpoints.context' },
        zod: { names: ['ListPetsQueryParams'], module: '../endpoints.zod' },
      },
      handlers: [
        {
          handlerName: 'listPetsHandlers',
          validators: [{ target: 'query', schema: 'ListPetsQueryParams' }],
          stub: '',
        },
      ],
    });

    const mwIdx = result.indexOf('(c, next) => next()');
    const valIdx = result.indexOf("zValidator('query'");
    const handlerIdx = result.indexOf('async (c: ListPetsContext)');
    // the inline middleware arrow is NOT mistaken for the handler
    expect(mwIdx).toBeLessThan(valIdx);
    expect(valIdx).toBeLessThan(handlerIdx);
  });

  it('extractHandlerBodies returns the handler body, not an inline middleware body', async () => {
    const source = `import { createFactory } from 'hono/factory';
const factory = createFactory();
export const listPetsHandlers = factory.createHandlers(
  (c, next) => {
    /* MIDDLEWARE_BODY */ return next();
  },
  async (c: ListPetsContext) => {
    return c.json([]); /* HANDLER_BODY */
  },
);
`;
    const bodies = await extractHandlerBodies(source);
    const body = bodies?.get('listPetsHandlers');
    expect(body).toContain('HANDLER_BODY');
    expect(body).not.toContain('MIDDLEWARE_BODY');
  });

  it('imports a new operation context even when the existing import is a namespace', async () => {
    const source = `import * as Ctx from '../endpoints.context';
import { createFactory } from 'hono/factory';

const factory = createFactory();

export const listPetsHandlers = factory.createHandlers(
  async (c: Ctx.ListPetsContext) => {
    return c.json([]);
  },
);
`;
    const stub = `\nexport const createPetsHandlers = factory.createHandlers(\nasync (c: CreatePetsContext) => {\n\n  },\n);`;
    const result = await reconcileHandlerFile(source, {
      imports: {
        factory: factoryImport,
        context: {
          names: ['ListPetsContext', 'CreatePetsContext'],
          module: '../endpoints.context',
        },
      },
      handlers: [
        { handlerName: 'listPetsHandlers', validators: [], stub: '' },
        { handlerName: 'createPetsHandlers', validators: [], stub },
      ],
    });

    expect(result).toContain("import * as Ctx from '../endpoints.context';"); // namespace kept
    expect(result).toContain('export const createPetsHandlers'); // new op appended
    expect(result).toContain(
      "import { CreatePetsContext } from '../endpoints.context';",
    ); // new op's bare context imported
    // the namespace-qualified existing context is not duplicated bare
    expect(result).not.toContain('import { ListPetsContext }');
  });

  it('imports a newly-required schema even when the existing zod import is aliased', async () => {
    const source = `import { createFactory } from 'hono/factory';
import { zValidator } from '../endpoints.validator';
import { ListPetsContext } from '../endpoints.context';
import { ListPetsResponse as Resp } from '../endpoints.zod';

const factory = createFactory();

export const listPetsHandlers = factory.createHandlers(
  zValidator('response', Resp),
  async (c: ListPetsContext) => {
    return c.json([]);
  },
);
`;
    const result = await reconcileHandlerFile(source, {
      imports: {
        factory: factoryImport,
        validator: { names: ['zValidator'], module: '../endpoints.validator' },
        context: { names: ['ListPetsContext'], module: '../endpoints.context' },
        zod: {
          names: ['ListPetsResponse', 'ListPetsQueryParams'],
          module: '../endpoints.zod',
        },
      },
      handlers: [
        {
          handlerName: 'listPetsHandlers',
          validators: [
            { target: 'response', schema: 'ListPetsResponse' },
            { target: 'query', schema: 'ListPetsQueryParams' },
          ],
          stub: '',
        },
      ],
    });

    expect(result).toContain('import { ListPetsResponse as Resp }'); // alias kept
    expect(result).toContain("zValidator('response', Resp)"); // existing kept on alias
    expect(result).toContain("zValidator('query', ListPetsQueryParams)"); // new validator
    expect(result).toContain(
      "import { ListPetsQueryParams } from '../endpoints.zod';",
    ); // its schema imported
  });

  it('routes new validators through the desired validator module, ignoring an unrelated zValidator alias', async () => {
    const source = `import { createFactory } from 'hono/factory';
import { zValidator as zv } from '@hono/zod-validator';
import { ListPetsContext } from '../endpoints.context';
import { ListPetsQueryParams } from '../endpoints.zod';

const factory = createFactory();

export const listPetsHandlers = factory.createHandlers(
  async (c: ListPetsContext) => {
    return c.json([]);
  },
);
`;
    const result = await reconcileHandlerFile(source, {
      imports: {
        factory: factoryImport,
        validator: { names: ['zValidator'], module: '../endpoints.validator' },
        context: { names: ['ListPetsContext'], module: '../endpoints.context' },
        zod: { names: ['ListPetsQueryParams'], module: '../endpoints.zod' },
      },
      handlers: [
        {
          handlerName: 'listPetsHandlers',
          validators: [{ target: 'query', schema: 'ListPetsQueryParams' }],
          stub: '',
        },
      ],
    });

    // the unrelated alias (from @hono/zod-validator) is NOT used for new validators
    expect(result).toContain("zValidator('query', ListPetsQueryParams)");
    expect(result).not.toContain("zv('query'");
    // orval's validator comes from the DESIRED module
    expect(result).toContain(
      "import { zValidator } from '../endpoints.validator';",
    );
  });

  it('migrates ALL references to a renamed schema, including z.infer in the body', async () => {
    // Regression: a schema migration must update the import binding, the
    // validator arg, AND any other reference (e.g. `z.infer<typeof schema>` in
    // the handler body) — otherwise the body keeps a dangling old identifier.
    const source = `import { z } from 'zod';
import { createFactory } from 'hono/factory';
import { zValidator } from '../endpoints.validator';
import { GetStatsContext } from '../endpoints.context';
import { getStatsResponse } from '../endpoints.zod';

const factory = createFactory();

export const getStatsHandlers = factory.createHandlers(
  zValidator('response', getStatsResponse),
  async (c: GetStatsContext) => {
    const stats: z.infer<typeof getStatsResponse> = await load();
    return c.json(stats);
  },
);
`;
    const result = await reconcileHandlerFile(source, {
      imports: {
        factory: factoryImport,
        validator: { names: ['zValidator'], module: '../endpoints.validator' },
        context: { names: ['GetStatsContext'], module: '../endpoints.context' },
        zod: { names: ['GetStatsResponse'], module: '../endpoints.zod' },
      },
      handlers: [
        {
          handlerName: 'getStatsHandlers',
          validators: [{ target: 'response', schema: 'GetStatsResponse' }],
          stub: '',
        },
      ],
    });

    expect(result).toContain(
      "import { GetStatsResponse } from '../endpoints.zod';",
    );
    expect(result).toContain("zValidator('response', GetStatsResponse)");
    expect(result).toContain('z.infer<typeof GetStatsResponse>'); // body migrated
    expect(result).not.toContain('getStatsResponse'); // no dangling old name
  });

  it('inserts a validator into a single-line createHandlers without breaking it', async () => {
    const source = `import { createFactory } from 'hono/factory';
import { zValidator } from '../endpoints.validator';
import { ListPetsContext } from '../endpoints.context';
import { ListPetsQueryParams } from '../endpoints.zod';

const factory = createFactory();

export const listPetsHandlers = factory.createHandlers(async (c: ListPetsContext) => c.json([]));
`;
    const result = await reconcileHandlerFile(source, {
      imports: {
        factory: factoryImport,
        validator: { names: ['zValidator'], module: '../endpoints.validator' },
        context: { names: ['ListPetsContext'], module: '../endpoints.context' },
        zod: { names: ['ListPetsQueryParams'], module: '../endpoints.zod' },
      },
      handlers: [
        {
          handlerName: 'listPetsHandlers',
          validators: [{ target: 'query', schema: 'ListPetsQueryParams' }],
          stub: '',
        },
      ],
    });

    expect(result).toContain("zValidator('query', ListPetsQueryParams)");
    // the validator is inserted INSIDE the call, not prepended before the export
    expect(result.indexOf('export const listPetsHandlers')).toBeLessThan(
      result.indexOf("zValidator('query'"),
    );
  });

  it('does not insert a duplicate binding when the name is already imported elsewhere', async () => {
    const source = `import GetStatsResponse from '../legacy';
import { createFactory } from 'hono/factory';
import { GetStatsContext } from '../endpoints.context';

const factory = createFactory();

export const getStatsHandlers = factory.createHandlers(
  async (c: GetStatsContext) => {
    return c.json(GetStatsResponse);
  },
);
`;
    const result = await reconcileHandlerFile(source, {
      imports: {
        factory: factoryImport,
        validator: { names: ['zValidator'], module: '../endpoints.validator' },
        context: { names: ['GetStatsContext'], module: '../endpoints.context' },
        zod: { names: ['GetStatsResponse'], module: '../endpoints.zod' },
      },
      handlers: [
        {
          handlerName: 'getStatsHandlers',
          validators: [{ target: 'response', schema: 'GetStatsResponse' }],
          stub: '',
        },
      ],
    });

    // the existing default import is kept; no duplicate named import is added
    expect(result).toContain("import GetStatsResponse from '../legacy';");
    expect(result).not.toContain(
      "import { GetStatsResponse } from '../endpoints.zod';",
    );
  });
});
