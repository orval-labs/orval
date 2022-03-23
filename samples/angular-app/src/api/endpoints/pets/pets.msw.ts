/**
 * Generated by orval v6.6.4 🍺
 * Do not edit manually.
 * Swagger Petstore
 * OpenAPI spec version: 1.0.0
 */
import {
  rest
} from 'msw'
import {
  faker
} from '@faker-js/faker'

export const getListPetsMock = () => ([...Array(faker.datatype.number({min: 1, max: 10}))].map(() => ({id: faker.datatype.number(), name: (()=>import_faker.faker.name.lastName())(), tag: (()=>import_faker.faker.name.lastName())()})))

export const getShowPetByIdMock = () => ((()=>({id:import_faker.faker.datatype.number({min:1,max:99}),name:import_faker.faker.name.firstName(),tag:import_faker.faker.helpers.randomize([import_faker.faker.random.word(),void 0])}))())

export const getPetsMSW = () => [
rest.get('*/v:version/pets', (_req, res, ctx) => {
        return res(
          ctx.delay(1000),
          ctx.status(200, 'Mocked status'),
ctx.json(getListPetsMock()),
        )
      }),rest.post('*/v:version/pets', (_req, res, ctx) => {
        return res(
          ctx.delay(1000),
          ctx.status(200, 'Mocked status'),
        )
      }),rest.get('*/v:version/pets/:petId', (_req, res, ctx) => {
        return res(
          ctx.delay(1000),
          ctx.status(200, 'Mocked status'),
ctx.json(getShowPetByIdMock()),
        )
      }),]
