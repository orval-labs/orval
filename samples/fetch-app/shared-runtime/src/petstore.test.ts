import { describe, expect, it } from 'vite-plus/test';
import { server } from './mocks/server';
import {
  getListPetsMockHandler,
  getPetsMock,
  getShowPetByIdMockHandler,
} from './api/petstore/pets/pets.msw';
import { createPets, listPets, showPetById } from './api/petstore/pets/pets';
import type { Pets } from './api/petstore/model';

// The petstore output calls the shared runtime directly, and is mocked with
// the handlers that orval generates for it.
describe('petstore', () => {
  it('returns the generated mock data', async () => {
    server.use(...getPetsMock());

    const res = await listPets({ limit: '10' });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.headers).toBeInstanceOf(Headers);
  });

  it('returns the data a generated handler is given', async () => {
    const pets: Pets = [{ id: 1, name: 'Tom', type: 'cat' }];
    server.use(getListPetsMockHandler(pets));

    const res = await listPets();

    expect(res).toMatchObject({ status: 200, data: pets });
  });

  it('sends the path params and the JSON body', async () => {
    server.use(
      getShowPetByIdMockHandler(({ params }) => ({
        id: Number(params.petId),
        name: 'Tom',
        type: 'cat',
      })),
      ...getPetsMock(),
    );

    const pet = await showPetById('7');
    const created = await createPets([{ name: 'Tom', tag: 'cat' }]);

    expect(pet).toMatchObject({ status: 200, data: { id: 7, name: 'Tom' } });
    expect(created.status).toBe(200);
  });
});
