/**
 * Generated by orval v6.4.0 🍺
 * Do not edit manually.
 * Swagger Petstore
 * OpenAPI spec version: 1.0.0
 */
import * as axios from 'axios'
import type {
  AxiosRequestConfig,
  AxiosResponse
} from 'axios'
import type {
  Pets,
  ListPetsParams,
  CreatePetsBody,
  Pet
} from '../model'
import {
  rest
} from 'msw'
import * as faker from 'faker'
import listPetsMutator from '../mutator/response-type'



  /**
 * @summary List all pets
 */
export const listPets = <TData = Pets>(
    params?: ListPetsParams,
    version= 1,
 ) => {
      return listPetsMutator<TData>(
      {url: `/v${version}/pets`, method: 'get',
        params,
    },
      );
    }
  
/**
 * @summary Create a pet
 */
export const createPets = <TData = AxiosResponse<void>>(
    createPetsBody: CreatePetsBody,
    version= 1, options?: AxiosRequestConfig
 ): Promise<TData> => {
    return axios.default.post(
      `/v${version}/pets`,
      createPetsBody,options
    );
  }

/**
 * @summary Info for a specific pet
 */
export const showPetById = <TData = AxiosResponse<Pet>>(
    petId: string,
    version= 1, options?: AxiosRequestConfig
 ): Promise<TData> => {
    return axios.default.get(
      `/v${version}/pets/${petId}`,options
    );
  }



export const getListPetsMock = () => ([...Array(faker.datatype.number({min: 1, max: 10}))].map(() => ({id: faker.datatype.number(), name: 'jon', tag: 'jon'})))

export const getShowPetByIdMock = () => ((()=>({id:faker.random.number({min:1,max:99}),name:faker.name.firstName(),tag:faker.helpers.randomize([faker.random.word(),void 0])}))())

export const getSwaggerPetstoreMSW = () => [
rest.get('*/v:version/pets', (req, res, ctx) => {
        return res(
          ctx.delay(1000),
          ctx.status(200, 'Mocked status'),
ctx.json(getListPetsMock()),
        )
      }),rest.post('*/v:version/pets', (req, res, ctx) => {
        return res(
          ctx.delay(1000),
          ctx.status(200, 'Mocked status'),
        )
      }),rest.get('*/v:version/pets/:petId', (req, res, ctx) => {
        return res(
          ctx.delay(1000),
          ctx.status(200, 'Mocked status'),
ctx.json(getShowPetByIdMock()),
        )
      }),]
