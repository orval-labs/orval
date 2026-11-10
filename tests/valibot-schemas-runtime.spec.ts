import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { generate } from 'orval';
import * as v from 'valibot';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import * as both from './generated/valibot-schemas/fetch-both/endpoints';
import * as dateComponent from './generated/valibot-schemas/fetch-date-component/endpoints';
import * as dates from './generated/valibot-schemas/fetch-dates/endpoints';
import * as edge from './generated/valibot-schemas/fetch-edge/endpoints';
import * as model from './generated/valibot-schemas/fetch-edge/model/index.valibot';
import * as mutator from './generated/valibot-schemas/fetch-mutator/endpoints';
import * as shared from './generated/valibot-schemas/fetch-shared/endpoints';
import * as client from './generated/valibot-schemas/fetch/endpoints';

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
  const dir = mkdtempSync(path.join(os.tmpdir(), 'orval-valibot-schemas-'));
  tempDirs.push(dir);
  return dir;
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

describe('schemas.type valibot', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true });
  });

  it('generates no zod import in any client', () => {
    const root = path.join(import.meta.dirname, 'generated/valibot-schemas');
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
            schemas: { path: path.join(dir, 'model'), type: 'valibot' },
            override: { fetch: { runtimeValidation: true }, ...levels },
          },
        },
        undefined,
        { throwOnError: true },
      ),
    ).rejects.toThrow(/standardSchema: false/);
  });

  it('leaves dates to the schema in an axios client', async () => {
    const dir = tempDir();
    await generate(
      {
        input: { target: specification('valibot-schemas') },
        output: {
          client: 'axios',
          target: path.join(dir, 'endpoints.ts'),
          schemas: { path: path.join(dir, 'model'), type: 'valibot' },
          override: { useDates: true, useDatesTransform: true },
        },
      },
      undefined,
      { throwOnError: true },
    );

    const source = readFileSync(path.join(dir, 'endpoints.ts'), 'utf8');
    expect(source).toContain('axios');
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
          schemas: { path: path.join(dir, 'model'), type: 'valibot' },
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
          schemas: { path: 'model', type: 'valibot' },
          indexFiles: true,
        },
      },
      undefined,
      { throwOnError: true },
    );

    expect(
      readFileSync(path.join(dir, 'model/index.valibot.ts'), 'utf8'),
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
          schemas: { path: 'model', type: 'valibot' },
          indexFiles: true,
        },
      },
      undefined,
      { throwOnError: true },
    );

    expect(existsSync(path.join(dir, 'model/index.valibot.ts'))).toBe(true);
    expect(readFileSync(path.join(dir, 'index.ts'), 'utf8')).toContain(
      "export * from './model/index.valibot';",
    );
  });

  it.each([
    [
      'request body validation with useDates',
      {
        client: 'angular',
        override: {
          useDates: true,
          angular: {
            runtimeValidation: { enabled: true, requestBodies: true },
          },
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
            schemas: { path: path.join(dir, 'model'), type: 'valibot' },
            ...output,
          } as never,
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
          schemas: { path: path.join(dir, 'model'), type: 'valibot' },
        },
      },
      undefined,
      { throwOnError: true },
    );

    expect(
      readFileSync(path.join(dir, 'model/index.valibot.ts'), 'utf8'),
    ).toContain('export const GetSearchParams = v.looseObject({});');
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
            schemas: { path: path.join(dir, 'model'), type: 'valibot' },
          },
        },
        undefined,
        { throwOnError: true },
      ),
    ).rejects.toThrow(/"ListPetsParams", which is also a component/);
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
      expect(v.safeParse(model.Account, { id: 1 }).success).toBe(true);
    });

    it('keeps a writeOnly property in a request body component', () => {
      expect(
        v.safeParse(model.LoginBody, { user: 'a', password: 'b' }).output,
      ).toEqual({ user: 'a', password: 'b' });
    });

    it('writes the bodies clients import', () => {
      expect(v.safeParse(model.PostBothBodyOne, { json: 'a' }).success).toBe(
        true,
      );
      expect(v.safeParse(model.PostBothBodyOne, {}).success).toBe(false);
      expect(v.safeParse(model.PostBothBodyTwo, { form: 'a' }).success).toBe(
        true,
      );
      expect(v.safeParse(model.PostXmlBody, {}).success).toBe(false);
    });

    it('types an inline array body and a nullable array response by their items', () => {
      expect(v.safeParse(model.PostRowsBodyItem, { name: 'a' }).success).toBe(
        true,
      );
      expect(v.safeParse(model.PostRowsBodyItem, {}).success).toBe(false);
      expect(v.safeParse(model.PostRows200Item, { id: 1 }).success).toBe(true);
      expect(v.safeParse(model.PostRows200Item, { id: 'a' }).success).toBe(
        false,
      );
    });

    it('reads the parameters of a referenced path item', () => {
      expect(v.safeParse(model.GetItemParams, {}).success).toBe(false);
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
});
