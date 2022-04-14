/**
 * Generated by orval v6.7.1 🍺
 * Do not edit manually.
 * Swagger Petstore
 * OpenAPI spec version: 1.0.0
 */
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  UseQueryOptions,
  UseInfiniteQueryOptions,
  UseMutationOptions,
  QueryFunction,
  MutationFunction,
  UseQueryResult,
  UseInfiniteQueryResult,
  QueryKey
} from 'react-query'
import type {
  Pets,
  Error,
  ListPetsParams,
  Pet,
  CreatePetsBody
} from '../model'
import { customClient, ErrorType, BodyType } from '../mutator/custom-client'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AsyncReturnType<
T extends (...args: any) => Promise<any>
> = T extends (...args: any) => Promise<infer R> ? R : any;


/**
 * @summary List all pets
 */
export const listPets = (
    params?: ListPetsParams,
    version= 1,
 ) => {
      return customClient<Pets>(
      {url: `/v${version}/pets`, method: 'get',
        params,
    },
      );
    }
  

export const getListPetsQueryKey = (params?: ListPetsParams,
    version= 1,) => [`/v${version}/pets`, ...(params ? [params]: [])];

    
export type ListPetsInfiniteQueryResult = NonNullable<AsyncReturnType<typeof listPets>>
export type ListPetsInfiniteQueryError = ErrorType<Error>

export const useListPetsInfinite = <TData = AsyncReturnType<typeof listPets>, TError = ErrorType<Error>>(
 params?: ListPetsParams,
    version= 1, options?: { query?:UseInfiniteQueryOptions<AsyncReturnType<typeof listPets>, TError, TData>, }

  ):  UseInfiniteQueryResult<TData, TError> & { queryKey: QueryKey } => {

  const {query: queryOptions} = options || {}

  const queryKey = queryOptions?.queryKey ?? getListPetsQueryKey(params,version);

  

  const queryFn: QueryFunction<AsyncReturnType<typeof listPets>> = ({ pageParam }) => listPets({ limit: pageParam, ...params },version, );

  const query = useInfiniteQuery<AsyncReturnType<typeof listPets>, TError, TData>(queryKey, queryFn, {enabled: !!(version), ...queryOptions})

  return {
    queryKey,
    ...query
  }
}

export type ListPetsQueryResult = NonNullable<AsyncReturnType<typeof listPets>>
export type ListPetsQueryError = ErrorType<Error>

export const useListPets = <TData = AsyncReturnType<typeof listPets>, TError = ErrorType<Error>>(
 params?: ListPetsParams,
    version= 1, options?: { query?:UseQueryOptions<AsyncReturnType<typeof listPets>, TError, TData>, }

  ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } => {

  const {query: queryOptions} = options || {}

  const queryKey = queryOptions?.queryKey ?? getListPetsQueryKey(params,version);

  

  const queryFn: QueryFunction<AsyncReturnType<typeof listPets>> = () => listPets(params,version, );

  const query = useQuery<AsyncReturnType<typeof listPets>, TError, TData>(queryKey, queryFn, {enabled: !!(version), ...queryOptions})

  return {
    queryKey,
    ...query
  }
}


/**
 * @summary Create a pet
 */
export const createPets = (
    createPetsBody: BodyType<CreatePetsBody>,
    version= 1,
 ) => {
      return customClient<Pet>(
      {url: `/v${version}/pets`, method: 'post',
      headers: {'Content-Type': 'application/json'},
      data: createPetsBody
    },
      );
    }
  


    export type CreatePetsMutationResult = NonNullable<AsyncReturnType<typeof createPets>>
    export type CreatePetsMutationBody = BodyType<CreatePetsBody>
    export type CreatePetsMutationError = ErrorType<Error>

    export const useCreatePets = <TError = ErrorType<Error>,
    
    TContext = unknown>(options?: { mutation?:UseMutationOptions<AsyncReturnType<typeof createPets>, TError,{data: BodyType<CreatePetsBody>;version?: number}, TContext>, }
) => {
      const {mutation: mutationOptions} = options || {}

      


      const mutationFn: MutationFunction<AsyncReturnType<typeof createPets>, {data: BodyType<CreatePetsBody>;version?: number}> = (props) => {
          const {data,version} = props || {};

          return  createPets(data,version,)
        }

      return useMutation<AsyncReturnType<typeof createPets>, TError, {data: BodyType<CreatePetsBody>;version?: number}, TContext>(mutationFn, mutationOptions)
    }
    
/**
 * @summary Info for a specific pet
 */
export const showPetById = (
    petId: string,
    version= 1,
 ) => {
      return customClient<Pet>(
      {url: `/v${version}/pets/${petId}`, method: 'get'
    },
      );
    }
  

export const getShowPetByIdQueryKey = (petId: string,
    version= 1,) => [`/v${version}/pets/${petId}`];

    
export type ShowPetByIdInfiniteQueryResult = NonNullable<AsyncReturnType<typeof showPetById>>
export type ShowPetByIdInfiniteQueryError = ErrorType<Error>

export const useShowPetByIdInfinite = <TData = AsyncReturnType<typeof showPetById>, TError = ErrorType<Error>>(
 petId: string,
    version= 1, options?: { query?:UseInfiniteQueryOptions<AsyncReturnType<typeof showPetById>, TError, TData>, }

  ):  UseInfiniteQueryResult<TData, TError> & { queryKey: QueryKey } => {

  const {query: queryOptions} = options || {}

  const queryKey = queryOptions?.queryKey ?? getShowPetByIdQueryKey(petId,version);

  

  const queryFn: QueryFunction<AsyncReturnType<typeof showPetById>> = () => showPetById(petId,version, );

  const query = useInfiniteQuery<AsyncReturnType<typeof showPetById>, TError, TData>(queryKey, queryFn, {enabled: !!(version && petId), ...queryOptions})

  return {
    queryKey,
    ...query
  }
}

export type ShowPetByIdQueryResult = NonNullable<AsyncReturnType<typeof showPetById>>
export type ShowPetByIdQueryError = ErrorType<Error>

export const useShowPetById = <TData = AsyncReturnType<typeof showPetById>, TError = ErrorType<Error>>(
 petId: string,
    version= 1, options?: { query?:UseQueryOptions<AsyncReturnType<typeof showPetById>, TError, TData>, }

  ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } => {

  const {query: queryOptions} = options || {}

  const queryKey = queryOptions?.queryKey ?? getShowPetByIdQueryKey(petId,version);

  

  const queryFn: QueryFunction<AsyncReturnType<typeof showPetById>> = () => showPetById(petId,version, );

  const query = useQuery<AsyncReturnType<typeof showPetById>, TError, TData>(queryKey, queryFn, {enabled: !!(version && petId), ...queryOptions})

  return {
    queryKey,
    ...query
  }
}


