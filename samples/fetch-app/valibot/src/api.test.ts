import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { showPetById as showPetByIdMutator } from './api/mutator/endpoints';
import { showPetById } from './api/validated/endpoints';

const respondWithText = (body: string, init?: ResponseInit) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(body, init))),
  );
};

const respondWith = (body: unknown, init?: ResponseInit) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(Response.json(body, init))),
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
});

// The generated client validates the response with the Valibot schema.
describe('validated output', () => {
  it('returns a response that matches the schema', async () => {
    respondWith({ id: 1, name: 'Tom' });

    const res = await showPetById('1');

    expect(res).toMatchObject({ status: 200, data: { id: 1, name: 'Tom' } });
  });

  it('throws a StandardSchemaError for a response that does not match', async () => {
    respondWith({ id: 1, name: '' });

    await expect(showPetById('1')).rejects.toMatchObject({
      name: 'StandardSchemaError',
    });
  });

  it('returns a JSON error body without validating it against the success schema', async () => {
    respondWith({ message: 'Not found' }, { status: 404 });

    await expect(showPetById('1')).resolves.toMatchObject({
      status: 404,
      data: { message: 'Not found' },
    });
  });
});

// The mutator gets the schema and validates the response itself.
describe('mutator output', () => {
  it('returns a response that matches the schema', async () => {
    respondWith({ id: 1, name: 'Tom' });

    const res = await showPetByIdMutator('1');

    expect(res).toMatchObject({ status: 200, data: { id: 1, name: 'Tom' } });
    expect(res.headers).toBeInstanceOf(Headers);
  });

  it('throws for a response that does not match', async () => {
    respondWith({ id: 'one', name: 'Tom' });

    await expect(showPetByIdMutator('1')).rejects.toThrow('id: Invalid type');
  });

  it('returns an error body without validating it', async () => {
    respondWith({ message: 'Not found' }, { status: 404 });

    const res = await showPetByIdMutator('1');

    expect(res).toMatchObject({ status: 404, data: { message: 'Not found' } });
  });

  it('returns a body that is not JSON as text for an error status', async () => {
    respondWithText('<html>Bad Gateway</html>', { status: 502 });

    const res = await showPetByIdMutator('1');

    expect(res).toMatchObject({
      status: 502,
      data: '<html>Bad Gateway</html>',
    });
  });
});
