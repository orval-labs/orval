/**
 * Generated by orval v7.5.0 🍺
 * Do not edit manually.
 * Swagger Petstore
 * OpenAPI spec version: 1.0.0
 */
import { z as zod } from 'zod';

/**
 * @summary List all pets
 */
export const listPetsQueryParams = zod.object({
  limit: zod.string().optional(),
});

export const listPetsResponseItem = zod
  .discriminatedUnion('breed', [
    zod.object({
      cuteness: zod.number(),
      breed: zod.enum(['Labradoodle']),
    }),
    zod.object({
      length: zod.number(),
      breed: zod.enum(['Dachshund']),
    }),
  ])
  .or(
    zod.object({
      petsRequested: zod.number().optional(),
      type: zod.enum(['cat']),
    }),
  );
export const listPetsResponse = zod.array(listPetsResponseItem);

/**
 * @summary Create a pet
 */
export const createPetsBodyItem = zod.object({
  name: zod.string(),
  tag: zod.string(),
});
export const createPetsBody = zod.array(createPetsBodyItem);

export const createPetsResponse = zod
  .discriminatedUnion('breed', [
    zod.object({
      cuteness: zod.number(),
      breed: zod.enum(['Labradoodle']),
    }),
    zod.object({
      length: zod.number(),
      breed: zod.enum(['Dachshund']),
    }),
  ])
  .or(
    zod.object({
      petsRequested: zod.number().optional(),
      type: zod.enum(['cat']),
    }),
  );

/**
 * @summary Update a pet
 */
export const updatePetsBody = zod
  .discriminatedUnion('breed', [
    zod.object({
      cuteness: zod.number(),
      breed: zod.enum(['Labradoodle']),
    }),
    zod.object({
      length: zod.number(),
      breed: zod.enum(['Dachshund']),
    }),
  ])
  .or(
    zod.object({
      petsRequested: zod.number().optional(),
      type: zod.enum(['cat']),
    }),
  );

export const updatePetsResponse = zod
  .discriminatedUnion('breed', [
    zod.object({
      cuteness: zod.number(),
      breed: zod.enum(['Labradoodle']),
    }),
    zod.object({
      length: zod.number(),
      breed: zod.enum(['Dachshund']),
    }),
  ])
  .or(
    zod.object({
      petsRequested: zod.number().optional(),
      type: zod.enum(['cat']),
    }),
  );

/**
 * @summary Info for a specific pet
 */
export const showPetByIdParams = zod.object({
  petId: zod.string(),
  testId: zod.string(),
});

export const showPetByIdResponse = zod
  .discriminatedUnion('breed', [
    zod.object({
      cuteness: zod.number(),
      breed: zod.enum(['Labradoodle']),
    }),
    zod.object({
      length: zod.number(),
      breed: zod.enum(['Dachshund']),
    }),
  ])
  .or(
    zod.object({
      petsRequested: zod.number().optional(),
      type: zod.enum(['cat']),
    }),
  );
