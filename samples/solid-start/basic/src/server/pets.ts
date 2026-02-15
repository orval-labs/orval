'use server';

import type { Pet, Pets, CreatePetsBody } from '~/api/model';

// TypeScript declaration for global pet store
declare global {
  var __petStore: {
    pets: Pet[];
    nextId: number;
  };
}

// In-memory pet store that persists across HMR reloads
// Using globalThis to maintain state during development
if (!globalThis.__petStore) {
  globalThis.__petStore = {
    pets: [
      { id: 1, name: 'Fluffy', tag: 'cat' },
      { id: 2, name: 'Buddy', tag: 'dog' },
      { id: 3, name: 'Tweety', tag: 'bird' },
    ],
    nextId: 4,
  };
}

const getStore = () => globalThis.__petStore;

export async function getPets(): Promise<Pets> {
  console.log('Server: Getting all pets');

  // Add a small delay to simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 500));

  return getStore().pets;
}

export async function createPet(body: CreatePetsBody): Promise<void> {
  console.log('Server: Creating pet', body);

  // Add a 2-second delay to simulate network latency
  // This allows users to see the loading state
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const store = getStore();
  const newPet: Pet = {
    id: store.nextId++,
    name: body.name,
    tag: body.tag,
  };
  store.pets.push(newPet);
}

export async function getPetById(petId: string): Promise<Pet> {
  console.log('Server: Getting pet by id', petId);
  const pet = getStore().pets.find((p) => p.id === Number(petId));
  if (!pet) {
    throw new Error('Pet not found');
  }
  return pet;
}
