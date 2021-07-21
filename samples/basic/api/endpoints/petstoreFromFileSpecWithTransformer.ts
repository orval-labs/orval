/*
 * Generated by orval v5.5.0 🍺
 * Do not edit manually.
 * Swagger Petstore
 * OpenAPI spec version: 1.0.0
 */
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import faker from 'faker';
import { rest } from 'msw';
import type { CreatePetsBody, ListPetsParams, Pet, Pets } from '../model';
import listPetsMutator from '../mutator/response-type';

export const getSwaggerPetstore = () => {
  const listPets = <TData = Pets>(params?: ListPetsParams, version = 1) => {
    return listPetsMutator<TData>({
      url: `/v${version}/pets`,
      method: 'get',
      params,
    });
  };
  const createPets = <TData = AxiosResponse<unknown>>(
    createPetsBody: CreatePetsBody,
    version = 1,
    options?: AxiosRequestConfig,
  ): Promise<TData> => {
    return axios.post(`/v${version}/pets`, createPetsBody, options);
  };
  const showPetById = <TData = AxiosResponse<Pet>>(
    petId: string,
    version = 1,
    options?: AxiosRequestConfig,
  ): Promise<TData> => {
    return axios.get(`/v${version}/pets/${petId}`, options);
  };
  return { listPets, createPets, showPetById };
};

export const getListPetsMock = () =>
  [...Array(faker.datatype.number({ min: 1, max: 10 }))].map(() => ({
    id: faker.datatype.number(),
    name: 'jon',
    tag: 'jon',
  }));

export const getShowPetByIdMock = () =>
  (() => ({
    id: faker.random.number({ min: 1, max: 99 }),
    name: faker.name.firstName(),
    tag: faker.helpers.randomize([faker.random.word(), void 0]),
  }))();

export const getSwaggerPetstoreMSW = () => [
  rest.get('*/v:version/pets', (req, res, ctx) => {
    return res(
      ctx.delay(1000),
      ctx.status(200, 'Mocked status'),
      ctx.json(getListPetsMock()),
    );
  }),
  rest.post('*/v:version/pets', (req, res, ctx) => {
    return res(ctx.delay(1000), ctx.status(200, 'Mocked status'));
  }),
  rest.get('*/v:version/pets/:petId', (req, res, ctx) => {
    return res(
      ctx.delay(1000),
      ctx.status(200, 'Mocked status'),
      ctx.json(getShowPetByIdMock()),
    );
  }),
];
