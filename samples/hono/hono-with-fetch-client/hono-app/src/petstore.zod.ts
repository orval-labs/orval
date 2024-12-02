/**
 * Generated by orval v7.3.0 🍺
 * Do not edit manually.
 * Swagger Petstore
 * OpenAPI spec version: 1.0.0
 */
import { z as zod } from 'zod';

export const listPetsQueryParams = zod.object({
  "limit": zod.string().optional()
})

export const listPetsResponseItem = zod.object({
  "id": zod.number(),
  "name": zod.string(),
  "tag": zod.string()
})
export const listPetsResponse = zod.array(listPetsResponseItem)


export const createPetsBodyItem = zod.object({
  "name": zod.string(),
  "tag": zod.string()
})
export const createPetsBody = zod.array(createPetsBodyItem)

export const createPetsResponse = zod.object({
  "id": zod.number(),
  "name": zod.string(),
  "tag": zod.string()
})


export const updatePetsBody = zod.object({
  "id": zod.number(),
  "name": zod.string(),
  "tag": zod.string()
})

export const updatePetsResponse = zod.object({
  "id": zod.number(),
  "name": zod.string(),
  "tag": zod.string()
})


export const showPetByIdParams = zod.object({
  "petId": zod.string(),
  "testId": zod.string()
})

export const showPetByIdResponse = zod.object({
  "id": zod.number(),
  "name": zod.string(),
  "tag": zod.string()
})

