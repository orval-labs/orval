/**
 * Generated by orval v7.0.1 🍺
 * Do not edit manually.
 * Swagger Petstore
 * OpenAPI spec version: 1.0.0
 */
import type { CreatePetsBody, ListPetsParams, Pet, Pets } from '../../models';

/**
 * @summary List all pets
 */
export type listPetsResponse = {
  data: Pets;
  status: number;
};

export const getListPetsUrl = (params?: ListPetsParams) => {
  const normalizedParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === null) {
      normalizedParams.append(key, 'null');
    } else if (value !== undefined) {
      normalizedParams.append(key, value.toString());
    }
  });

  return normalizedParams.size
    ? `http://localhost:8000/pets?${normalizedParams.toString()}`
    : `http://localhost:8000/pets`;
};

export const listPets = async (
  params?: ListPetsParams,
  options?: RequestInit,
): Promise<listPetsResponse> => {
  const res = await fetch(getListPetsUrl(params), {
    ...options,
    method: 'GET',
  });
  const data = await res.json();

  return { status: res.status, data };
};

/**
 * @summary Create a pet
 */
export type createPetsResponse = {
  data: Pet;
  status: number;
};

export const getCreatePetsUrl = () => {
  return `http://localhost:8000/pets`;
};

export const createPets = async (
  createPetsBody: CreatePetsBody,
  options?: RequestInit,
): Promise<createPetsResponse> => {
  const res = await fetch(getCreatePetsUrl(), {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(createPetsBody),
  });
  const data = await res.json();

  return { status: res.status, data };
};

/**
 * @summary Info for a specific pet
 */
export type showPetByIdResponse = {
  data: Pet;
  status: number;
};

export const getShowPetByIdUrl = (petId: string) => {
  return `http://localhost:8000/pets/${petId}`;
};

export const showPetById = async (
  petId: string,
  options?: RequestInit,
): Promise<showPetByIdResponse> => {
  const res = await fetch(getShowPetByIdUrl(petId), {
    ...options,
    method: 'GET',
  });
  const data = await res.json();

  return { status: res.status, data };
};
