import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { OutputOptions } from '@orval/core';
import { Schema as S } from 'effect';
import { generate } from 'orval';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import * as both from './generated/effect-schemas/fetch-both/endpoints';
import * as dateComponent from './generated/effect-schemas/fetch-date-component/endpoints';
import * as dates from './generated/effect-schemas/fetch-dates/endpoints';
import * as edge from './generated/effect-schemas/fetch-edge/endpoints';
import * as model from './generated/effect-schemas/fetch-edge/model/index.effect';
import * as nativeMutator from './generated/effect-schemas/fetch-mutator-native/endpoints';
import * as mutator from './generated/effect-schemas/fetch-mutator/endpoints';
import * as names from './generated/effect-schemas/fetch-names/endpoints';
import * as shared from './generated/effect-schemas/fetch-shared/endpoints';
import * as validation from './generated/effect-schemas/fetch-validation/endpoints';
import * as client from './generated/effect-schemas/fetch/endpoints';

const pet = {
  id: 1,
  name: 'Rex',
  status: 'available',
  bornAt: '2024-01-02T03:04:05.000Z',
};

const override = { fetch: { runtimeValidation: { standardSchema: false } } };

const specification = (name: string) =>
  path.join(import.meta.dirname, `specifications/${name}.yaml`);

const tempDirs: string[] = [];
const tempDir = () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'orval-effect-schemas-'));
  tempDirs.push(dir);
  return dir;
};

const accepts = (schema: S.Codec<unknown, unknown>, input: unknown) => {
  try {
    S.decodeUnknownSync(schema)(input);
    return true;
  } catch {
    return false;
  }
};

const respondWith = (body: unknown, status = 200) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
    ),
  );

describe('schemas.type effect', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true });
  });

  it('generates no zod import in any client', () => {
    const root = path.join(import.meta.dirname, 'generated/effect-schemas');
    const files = readdirSync(root, { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('.ts'))
      .map((file) => readFileSync(path.join(root, file), 'utf8'));

    expect(files.length).toBeGreaterThan(0);
    for (const source of files) expect(source).not.toMatch(/\bzod\b/);
  });

  it('validates an inline array response', async () => {
    respondWith([pet]);
    await expect(client.listPets({ limit: 1 })).resolves.toMatchObject({
      data: [pet],
    });

    respondWith([{ ...pet, id: 'one' }]);
    await expect(client.listPets({ limit: 1 })).rejects.toThrow(/^0\.id: /);
  });

  it('rejects a fraction where the spec says integer', async () => {
    respondWith([{ ...pet, id: 1.5 }]);
    await expect(client.listPets({ limit: 1 })).rejects.toThrow(/^0\.id: /);
  });

  it('accepts an integer beyond the safe range', async () => {
    respondWith([{ ...pet, id: 1_234_567_890_123_456_800 }]);
    await expect(client.listPets({ limit: 1 })).resolves.toMatchObject({
      data: [{ id: 1_234_567_890_123_456_800 }],
    });
  });

  it('accepts a response without a required writeOnly property', async () => {
    respondWith(pet, 201);
    await expect(client.createPet({ name: 'Rex' })).resolves.toMatchObject({
      data: pet,
    });
  });

  it('validates an enum, a primitive and a cycle', async () => {
    respondWith('sold');
    await expect(client.getPetStatus('1')).resolves.toMatchObject({
      data: 'sold',
    });
    respondWith('lost');
    await expect(client.getPetStatus('1')).rejects.toThrow();

    respondWith('ok');
    await expect(client.getHealth()).resolves.toMatchObject({ data: 'ok' });
    respondWith(1);
    await expect(client.getHealth()).rejects.toThrow();

    const tree = { name: 'a', children: [{ name: 'b' }] };
    respondWith(tree);
    await expect(client.getTree()).resolves.toMatchObject({ data: tree });
    respondWith({ name: 'a', children: [{}] });
    await expect(client.getTree()).rejects.toThrow();
  });

  it('validates a component named Error', async () => {
    respondWith({ code: 1 });
    await expect(client.getLastError()).resolves.toMatchObject({
      data: { code: 1 },
    });
    respondWith({ code: 'one' });
    await expect(client.getLastError()).rejects.toThrow(/^code: /);
  });

  it('validates an array of components named S and Schema', async () => {
    respondWith([{ id: 1 }]);
    await expect(names.listS()).resolves.toMatchObject({ data: [{ id: 1 }] });
    respondWith([{ id: 'one' }]);
    await expect(names.listS()).rejects.toThrow(/^0\.id: /);

    respondWith([{ name: 'a' }]);
    await expect(names.listSchemas()).resolves.toMatchObject({
      data: [{ name: 'a' }],
    });
    respondWith([{}]);
    await expect(names.listSchemas()).rejects.toThrow(/^0\.name: /);
  });

  it('keeps the fields of the member of a oneOf that matches', async () => {
    const dog = { petType: 'dog', name: 'Rex', packSize: 3 };
    respondWith(dog);
    await expect(validation.getPet()).resolves.toMatchObject({ data: dog });
    const { data } = await validation.getPet();
    expect(data).toEqual(dog);

    respondWith({ petType: 'dog', packSize: 'three' });
    await expect(validation.getPet()).rejects.toThrow();
    respondWith({ petType: 'bird' });
    await expect(validation.getPet()).rejects.toThrow();
  });

  it('accepts a URI with any scheme, a Unicode pattern and a date-time with a space', async () => {
    const link = {
      url: 's3://bucket/key',
      handle: 'héllo',
      seenAt: '2026-01-02 03:04:05Z',
    };
    respondWith(link);
    await expect(validation.getLink()).resolves.toMatchObject({ data: link });

    respondWith({ ...link, url: 'not a url' });
    await expect(validation.getLink()).rejects.toThrow(/^url: /);
    respondWith({ ...link, handle: 'p{L}' });
    await expect(validation.getLink()).rejects.toThrow(/^handle: /);
  });

  it.each(['fetch-names', 'angular-names'])(
    'binds the Effect namespace of %s apart from the components it imports',
    (folder) => {
      const source = readFileSync(
        path.join(
          import.meta.dirname,
          `generated/effect-schemas/${folder}/endpoints.ts`,
        ),
        'utf8',
      );

      expect(source).toMatch(/import \{[^}]*\bS\b[^}]*\} from '\.\/model/);
      expect(source).toContain("Schema as effectSchema } from 'effect'");
      expect(source).not.toContain('Schema as S }');
    },
  );

  it('logs and rethrows with the both strategy', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    respondWith([{ ...pet, id: 'one' }]);

    await expect(both.listPets({ limit: 1 })).rejects.toThrow(/^0\.id: /);
    expect(log).toHaveBeenCalledOnce();
  });

  it('converts dates in the schema with useDatesTransform', async () => {
    respondWith(pet, 201);
    const { data } = await dates.createPet({ name: 'Rex' });

    expect(data).toMatchObject({ bornAt: new Date(pet.bornAt) });
  });

  it('validates through the shared runtime', async () => {
    respondWith(pet, 201);
    await expect(shared.createPet({ name: 'Rex' })).resolves.toMatchObject({
      data: pet,
    });

    respondWith({ ...pet, id: 'one' }, 201);
    await expect(shared.createPet({ name: 'Rex' })).rejects.toThrow(/^id: /);
  });

  it('hands the schema to a custom mutator', async () => {
    respondWith(pet, 201);
    await expect(mutator.createPet({ name: 'Rex' })).resolves.toMatchObject({
      data: pet,
    });

    respondWith({ ...pet, id: 'one' }, 201);
    await expect(mutator.createPet({ name: 'Rex' })).rejects.toThrow();

    respondWith([{ ...pet, id: 'one' }]);
    await expect(mutator.listPets({ limit: 1 })).rejects.toThrow();
  });

  it('lets a custom mutator decode with Effect', async () => {
    respondWith(pet, 201);
    const created = await nativeMutator.createPet({ name: 'Rex' });
    expect(created).toMatchObject({ data: pet, status: 201 });
    expect(created.headers.get('content-type')).toBe('application/json');

    respondWith({ ...pet, id: 'one' }, 201);
    await expect(nativeMutator.createPet({ name: 'Rex' })).rejects.toThrow();

    // An error body is not validated against the success schema.
    respondWith({ message: 'oops' }, 500);
    await expect(nativeMutator.listPets({ limit: 1 })).resolves.toMatchObject({
      data: { message: 'oops' },
      status: 500,
    });
  });

  it.each([
    ['operation', { operations: { listPets: override } }],
    ['tag', { tags: { pets: override } }],
    ['output', override],
  ])('rejects standardSchema false on the %s level', async (_, levels) => {
    const dir = tempDir();

    await expect(
      generate(
        {
          input: {
            target: specification('valibot-schemas'),
          },
          output: {
            client: 'fetch',
            target: path.join(dir, 'endpoints.ts'),
            schemas: { path: path.join(dir, 'model'), type: 'effect' },
            override: { fetch: { runtimeValidation: true }, ...levels },
          },
        },
        undefined,
        { throwOnError: true },
      ),
    ).rejects.toThrow(/standardSchema: false/);
  });

  it('leaves dates to the schema in a react-query client over axios', async () => {
    const dir = tempDir();
    await generate(
      {
        input: { target: specification('valibot-schemas') },
        output: {
          client: 'react-query',
          httpClient: 'axios',
          target: path.join(dir, 'endpoints.ts'),
          schemas: { path: path.join(dir, 'model'), type: 'effect' },
          override: { useDates: true, useDatesTransform: true },
        },
      },
      undefined,
      { throwOnError: true },
    );

    const source = readFileSync(path.join(dir, 'endpoints.ts'), 'utf8');
    expect(source).toContain("from 'axios'");
    expect(source).not.toMatch(/deserialize|new Date/);
  });

  it('sends date query parameters as the strings they are typed as', async () => {
    const dir = tempDir();
    await generate(
      {
        input: { target: specification('valibot-schemas-edge') },
        output: {
          client: 'fetch',
          target: path.join(dir, 'endpoints.ts'),
          schemas: { path: path.join(dir, 'model'), type: 'effect' },
          override: { useDates: true },
        },
      },
      undefined,
      { throwOnError: true },
    );

    const source = readFileSync(path.join(dir, 'endpoints.ts'), 'utf8');
    expect(source).toContain('GetThingParams');
    expect(source).not.toContain('instanceof Date');
  });

  it('writes an empty schemas module for the workspace barrel', async () => {
    const dir = tempDir();
    await generate(
      {
        input: { target: specification('valibot-schemas-empty') },
        output: {
          client: 'fetch',
          workspace: dir,
          target: 'endpoints.ts',
          schemas: { path: 'model', type: 'effect' },
          indexFiles: true,
        },
      },
      undefined,
      { throwOnError: true },
    );

    expect(
      readFileSync(path.join(dir, 'model/index.effect.ts'), 'utf8'),
    ).toContain('export {};');
  });

  it('points the workspace barrel at the schemas module', async () => {
    const dir = tempDir();
    await generate(
      {
        input: { target: specification('valibot-schemas') },
        output: {
          client: 'fetch',
          workspace: dir,
          target: 'endpoints.ts',
          schemas: { path: 'model', type: 'effect' },
          indexFiles: true,
        },
      },
      undefined,
      { throwOnError: true },
    );

    expect(existsSync(path.join(dir, 'model/index.effect.ts'))).toBe(true);
    expect(readFileSync(path.join(dir, 'index.ts'), 'utf8')).toContain(
      "export * from './model/index.effect';",
    );
  });

  it.each<[name: string, output: OutputOptions, message: RegExp]>([
    [
      'request body validation with useDates',
      {
        client: 'angular',
        override: {
          useDates: true,
          angular: { runtimeValidation: { requestBodies: true } },
        },
      },
      /requestBodies/,
    ],
    [
      'formatType',
      {
        client: 'fetch',
        override: { formatType: { uuid: { type: 'string' } } },
      },
      /formatType/,
    ],
    [
      'property renaming',
      {
        client: 'fetch',
        override: { namingConvention: { properties: 'camelCase' } },
      },
      /namingConvention/,
    ],
    [
      'useBigInt',
      { client: 'fetch', override: { useBigInt: true } },
      /useBigInt/,
    ],
    [
      'splitByContentType',
      { client: 'fetch', override: { splitByContentType: true } },
      /splitByContentType/,
    ],
  ])('rejects %s', async (_, output, message) => {
    const dir = tempDir();

    await expect(
      generate(
        {
          input: { target: specification('valibot-schemas') },
          output: {
            target: path.join(dir, 'endpoints.ts'),
            schemas: { path: path.join(dir, 'model'), type: 'effect' },
            ...output,
          },
        },
        undefined,
        { throwOnError: true },
      ),
    ).rejects.toThrow(message);
  });

  it('accepts any key for parameters declared with content', async () => {
    const dir = tempDir();
    const target = path.join(dir, 'spec.json');
    writeFileSync(
      target,
      JSON.stringify({
        openapi: '3.1.0',
        info: { title: 'Content parameters', version: '1.0.0' },
        paths: {
          '/search': {
            get: {
              operationId: 'getSearch',
              parameters: [
                {
                  name: 'filter',
                  in: 'query',
                  content: {
                    'application/json': { schema: { type: 'object' } },
                  },
                },
              ],
              responses: { '204': { description: 'Nothing' } },
            },
          },
        },
      }),
    );

    await generate(
      {
        input: { target },
        output: {
          client: 'axios',
          target: path.join(dir, 'endpoints.ts'),
          schemas: { path: path.join(dir, 'model'), type: 'effect' },
        },
      },
      undefined,
      { throwOnError: true },
    );

    expect(
      readFileSync(path.join(dir, 'model/index.effect.ts'), 'utf8'),
    ).toMatch(
      /export const GetSearchParams = S\.toStandardSchemaV1\(S\.StructWithRest\(S\.Struct\(\{\s*\}\), \[S\.Record\(S\.String, S\.Unknown\)\]\)\)/,
    );
  });

  it('rejects an installed Effect 3 older than 3.15', async () => {
    const dir = tempDir();
    mkdirSync(path.join(dir, 'node_modules/effect'), { recursive: true });
    writeFileSync(
      path.join(dir, 'node_modules/effect/package.json'),
      JSON.stringify({ name: 'effect', version: '3.14.0' }),
    );
    writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ dependencies: { effect: '^3.14.0' } }),
    );

    await expect(
      generate(
        {
          input: { target: specification('valibot-schemas') },
          output: {
            target: path.join(dir, 'endpoints.ts'),
            schemas: { path: path.join(dir, 'model'), type: 'effect' },
            packageJson: path.join(dir, 'package.json'),
          },
        },
        dir,
        { throwOnError: true },
      ),
    ).rejects.toThrow(/needs Effect 3\.15 or newer, but 3\.14\.0 is installed/);
  });

  it('rejects an operation schema named like a component', async () => {
    const dir = tempDir();
    const target = path.join(dir, 'spec.json');
    writeFileSync(
      target,
      JSON.stringify({
        openapi: '3.1.0',
        info: { title: 'Clash', version: '1.0.0' },
        paths: {
          '/pets': {
            get: {
              operationId: 'listPets',
              parameters: [
                { name: 'limit', in: 'query', schema: { type: 'integer' } },
              ],
              responses: { '204': { description: 'Nothing' } },
            },
          },
        },
        components: { schemas: { ListPetsParams: { type: 'string' } } },
      }),
    );

    await expect(
      generate(
        {
          input: { target },
          output: {
            client: 'fetch',
            target: path.join(dir, 'endpoints.ts'),
            schemas: { path: path.join(dir, 'model'), type: 'effect' },
          },
        },
        undefined,
        { throwOnError: true },
      ),
    ).rejects.toThrow(/"ListPetsParams", which is also a component/);
  });

  it('rejects an operation schema named like a renamed component constant', async () => {
    const dir = tempDir();
    const target = path.join(dir, 'spec.json');
    writeFileSync(
      target,
      JSON.stringify({
        openapi: '3.1.0',
        info: { title: 'Clash', version: '1.0.0' },
        paths: {
          '/dates': {
            post: {
              operationId: 'date',
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: { day: { type: 'string' } },
                    },
                  },
                },
              },
              responses: { '204': { description: 'Nothing' } },
            },
          },
        },
        components: { schemas: { Date: { type: 'string' } } },
      }),
    );

    await expect(
      generate(
        {
          input: { target },
          output: {
            client: 'fetch',
            target: path.join(dir, 'endpoints.ts'),
            schemas: { path: path.join(dir, 'model'), type: 'effect' },
            override: { components: { requestBodies: { suffix: 'Schema' } } },
          },
        },
        undefined,
        { throwOnError: true },
      ),
    ).rejects.toThrow(/"DateSchema", which is also a component/);
  });

  it('rejects an operation schema named like a constant a component hoists', async () => {
    const dir = tempDir();
    const target = path.join(dir, 'spec.json');
    writeFileSync(
      target,
      JSON.stringify({
        openapi: '3.1.0',
        info: { title: 'Clash', version: '1.0.0' },
        paths: {
          '/names': {
            get: {
              operationId: 'getNames',
              responses: { '200': { $ref: '#/components/responses/NameMin' } },
            },
          },
        },
        components: {
          schemas: { Name: { type: 'string', minLength: 2 } },
          responses: {
            NameMin: {
              description: 'ok',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { id: { type: 'string' } },
                  },
                },
              },
            },
          },
        },
      }),
    );

    await expect(
      generate(
        {
          input: { target },
          output: {
            client: 'fetch',
            target: path.join(dir, 'endpoints.ts'),
            schemas: { path: path.join(dir, 'model'), type: 'effect' },
            override: { components: { responses: { suffix: '' } } },
          },
        },
        undefined,
        { throwOnError: true },
      ),
    ).rejects.toThrow(
      /declares "NameMin" twice: as the constant generated for component Name and as operation schema NameMin/,
    );
  });

  describe('edge cases', () => {
    it('names path parameters as the client does', async () => {
      respondWith({ id: 1 });
      await expect(edge.getThing({ petId: '7' })).resolves.toMatchObject({
        data: { id: 1 },
      });
      expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/things/7');
    });

    it('validates an array next to a path parameter named v', async () => {
      respondWith([{ id: 1 }]);
      await expect(edge.listVersioned({ v: '1' })).resolves.toMatchObject({
        data: [{ id: 1 }],
      });
      respondWith([{ id: 'one' }]);
      await expect(edge.listVersioned({ v: '1' })).rejects.toThrow(/^0\.id: /);
    });

    it('accepts a response without properties referencing a writeOnly schema', () => {
      expect(accepts(model.Account, { id: 1 })).toBe(true);
    });

    it('keeps a writeOnly property in a request body component', () => {
      expect(
        S.decodeUnknownSync(model.LoginBody)({ user: 'a', password: 'b' }),
      ).toEqual({ user: 'a', password: 'b' });
    });

    it('writes the bodies clients import', () => {
      expect(accepts(model.PostBothBodyOne, { json: 'a' })).toBe(true);
      expect(accepts(model.PostBothBodyOne, {})).toBe(false);
      expect(accepts(model.PostBothBodyTwo, { form: 'a' })).toBe(true);
      expect(accepts(model.PostXmlBody, {})).toBe(false);
    });

    it('types an inline array body and a nullable array response by their items', () => {
      expect(accepts(model.PostRowsBodyItem, { name: 'a' })).toBe(true);
      expect(accepts(model.PostRowsBodyItem, {})).toBe(false);
      expect(accepts(model.PostRows200Item, { id: 1 })).toBe(true);
      expect(accepts(model.PostRows200Item, { id: 'a' })).toBe(false);
    });

    it('reads the parameters of a referenced path item', () => {
      expect(accepts(model.GetItemParams, {})).toBe(false);
    });

    it('validates a component named RegExp', async () => {
      expect(model).toHaveProperty('RegExp');

      respondWith({ source: 'abc' });
      await expect(edge.getPattern()).resolves.toMatchObject({
        data: { source: 'abc' },
      });
      respondWith({ source: 'ABC' });
      await expect(edge.getPattern()).rejects.toThrow(/source/);
    });

    it('validates a component named Date next to real dates', async () => {
      respondWith({ day: 'monday' });
      await expect(dateComponent.getDateComponent()).resolves.toMatchObject({
        data: { day: 'monday' },
      });
      respondWith({ day: 1 });
      await expect(dateComponent.getDateComponent()).rejects.toThrow(/day/);

      respondWith({ when: { day: 'monday' }, at: pet.bornAt });
      const { data } = await dateComponent.getHolder();
      expect(data.at).toEqual(new Date(pet.bornAt));
    });

    it('does not shadow globals with an inline response', async () => {
      expect(model).not.toHaveProperty('Date');
      expect(model).not.toHaveProperty('null');

      respondWith(pet.bornAt);
      const { data } = await edge.getDay();
      expect(data).toEqual(new Date(pet.bornAt));
    });

    it('keeps an unvalidated date array as typed strings', async () => {
      respondWith([pet.bornAt]);
      const { data } = await edge.listDays();
      const first: string = data[0];
      expect(first).toBe(pet.bornAt);
    });
  });

  describe('a component Effect cannot express', () => {
    // The schemas module merges the members of an allOf as structs.
    const unsupported = {
      Item: {
        type: 'object',
        properties: { id: { type: 'string' }, name: { type: 'string' } },
      },
      ItemDetail: {
        allOf: [{ $ref: '#/components/schemas/Item' }, { required: ['id'] }],
      },
    };
    const generateFrom = (responseRef: string) => {
      const dir = tempDir();
      const target = path.join(dir, 'spec.json');
      writeFileSync(
        target,
        JSON.stringify({
          openapi: '3.1.0',
          info: { title: 'Unsupported', version: '1.0.0' },
          paths: {
            '/items': {
              get: {
                operationId: 'getItem',
                responses: {
                  '200': {
                    description: 'ok',
                    content: {
                      'application/json': {
                        schema: { $ref: `#/components/schemas/${responseRef}` },
                      },
                    },
                  },
                },
              },
            },
          },
          components: { schemas: unsupported },
        }),
      );

      return {
        dir,
        result: generate(
          {
            input: { target },
            output: {
              client: 'fetch',
              target: path.join(dir, 'endpoints.ts'),
              schemas: { path: path.join(dir, 'model'), type: 'effect' },
            },
          },
          undefined,
          { throwOnError: true },
        ),
      };
    };

    it('does not stop a run that no operation reaches it in', async () => {
      const { dir, result } = generateFrom('Item');
      await result;

      const source = readFileSync(
        path.join(dir, 'model/index.effect.ts'),
        'utf8',
      );
      expect(source).toContain('export const Item =');
      expect(source).not.toContain('ItemDetail');
    });

    it('names the option the user set when an operation reaches it', async () => {
      await expect(generateFrom('ItemDetail').result).rejects.toThrow(
        /schemas\.type "effect": component ItemDetail cannot be generated/,
      );
    });
  });
});
