/**
 * Generated by orval v7.3.0 🍺
 * Do not edit manually.
 * Swagger Petstore
 * OpenAPI spec version: 1.0.0
 */
import useSwr from 'swr';
import type { Key, SWRConfiguration } from 'swr';
import useSWRMutation from 'swr/mutation';
import type { SWRMutationConfiguration } from 'swr/mutation';
import type {
  CreatePetsBodyItem,
  Error,
  ListPetsParams,
  Pet,
  Pets,
} from '../../models';

// https://stackoverflow.com/questions/49579094/typescript-conditional-types-filter-out-readonly-properties-pick-only-requir/49579497#49579497
type IfEquals<X, Y, A = X, B = never> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? A : B;

type WritableKeys<T> = {
  [P in keyof T]-?: IfEquals<
    { [Q in P]: T[P] },
    { -readonly [Q in P]: T[P] },
    P
  >;
}[keyof T];

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;
type DistributeReadOnlyOverUnions<T> = T extends any ? NonReadonly<T> : never;

type Writable<T> = Pick<T, WritableKeys<T>>;
type NonReadonly<T> = [T] extends [UnionToIntersection<T>]
  ? {
      [P in keyof Writable<T>]: T[P] extends object
        ? NonReadonly<NonNullable<T[P]>>
        : T[P];
    }
  : DistributeReadOnlyOverUnions<T>;

/**
 * @summary List all pets
 */
export type listPetsResponse = {
  data: Pets;
  status: number;
  headers: Headers;
};

export const getListPetsUrl = (params?: ListPetsParams) => {
  const normalizedParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : value.toString());
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

  const data: Pets = await res.json();

  return { status: res.status, data, headers: res.headers };
};

export const getListPetsKey = (params?: ListPetsParams) =>
  [`http://localhost:8000/pets`, ...(params ? [params] : [])] as const;

export type ListPetsQueryResult = NonNullable<
  Awaited<ReturnType<typeof listPets>>
>;
export type ListPetsQueryError = Promise<unknown>;

/**
 * @summary List all pets
 */
export const useListPets = <TError = Promise<unknown>>(
  params?: ListPetsParams,
  options?: {
    swr?: SWRConfiguration<Awaited<ReturnType<typeof listPets>>, TError> & {
      swrKey?: Key;
      enabled?: boolean;
    };
    fetch?: RequestInit;
  },
) => {
  const { swr: swrOptions, fetch: fetchOptions } = options ?? {};

  const isEnabled = swrOptions?.enabled !== false;
  const swrKey =
    swrOptions?.swrKey ?? (() => (isEnabled ? getListPetsKey(params) : null));
  const swrFn = () => listPets(params, fetchOptions);

  const query = useSwr<Awaited<ReturnType<typeof swrFn>>, TError>(
    swrKey,
    swrFn,
    swrOptions,
  );

  return {
    swrKey,
    ...query,
  };
};
/**
 * @summary Create a pet
 */
export type createPetsResponse = {
  data: Pet;
  status: number;
  headers: Headers;
};

export const getCreatePetsUrl = () => {
  return `http://localhost:8000/pets`;
};

export const createPets = async (
  createPetsBodyItem: CreatePetsBodyItem[],
  options?: RequestInit,
): Promise<createPetsResponse> => {
  const res = await fetch(getCreatePetsUrl(), {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(createPetsBodyItem),
  });

  const data: Pet = await res.json();

  return { status: res.status, data, headers: res.headers };
};

export const getCreatePetsMutationFetcher = (options?: RequestInit) => {
  return (
    _: Key,
    { arg }: { arg: CreatePetsBodyItem[] },
  ): Promise<createPetsResponse> => {
    return createPets(arg, options);
  };
};
export const getCreatePetsMutationKey = () =>
  [`http://localhost:8000/pets`] as const;

export type CreatePetsMutationResult = NonNullable<
  Awaited<ReturnType<typeof createPets>>
>;
export type CreatePetsMutationError = Promise<Error>;

/**
 * @summary Create a pet
 */
export const useCreatePets = <TError = Promise<Error>>(options?: {
  swr?: SWRMutationConfiguration<
    Awaited<ReturnType<typeof createPets>>,
    TError,
    Key,
    CreatePetsBodyItem[],
    Awaited<ReturnType<typeof createPets>>
  > & { swrKey?: string };
  fetch?: RequestInit;
}) => {
  const { swr: swrOptions, fetch: fetchOptions } = options ?? {};

  const swrKey = swrOptions?.swrKey ?? getCreatePetsMutationKey();
  const swrFn = getCreatePetsMutationFetcher(fetchOptions);

  const query = useSWRMutation(swrKey, swrFn, swrOptions);

  return {
    swrKey,
    ...query,
  };
};
/**
 * @summary Update a pet
 */
export type updatePetsResponse = {
  data: Pet;
  status: number;
  headers: Headers;
};

export const getUpdatePetsUrl = () => {
  return `http://localhost:8000/pets`;
};

export const updatePets = async (
  pet: NonReadonly<Pet>,
  options?: RequestInit,
): Promise<updatePetsResponse> => {
  const res = await fetch(getUpdatePetsUrl(), {
    ...options,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(pet),
  });

  const data: Pet = await res.json();

  return { status: res.status, data, headers: res.headers };
};

export const getUpdatePetsMutationFetcher = (options?: RequestInit) => {
  return (
    _: Key,
    { arg }: { arg: NonReadonly<Pet> },
  ): Promise<updatePetsResponse> => {
    return updatePets(arg, options);
  };
};
export const getUpdatePetsMutationKey = () =>
  [`http://localhost:8000/pets`] as const;

export type UpdatePetsMutationResult = NonNullable<
  Awaited<ReturnType<typeof updatePets>>
>;
export type UpdatePetsMutationError = Promise<Error>;

/**
 * @summary Update a pet
 */
export const useUpdatePets = <TError = Promise<Error>>(options?: {
  swr?: SWRMutationConfiguration<
    Awaited<ReturnType<typeof updatePets>>,
    TError,
    Key,
    NonReadonly<Pet>,
    Awaited<ReturnType<typeof updatePets>>
  > & { swrKey?: string };
  fetch?: RequestInit;
}) => {
  const { swr: swrOptions, fetch: fetchOptions } = options ?? {};

  const swrKey = swrOptions?.swrKey ?? getUpdatePetsMutationKey();
  const swrFn = getUpdatePetsMutationFetcher(fetchOptions);

  const query = useSWRMutation(swrKey, swrFn, swrOptions);

  return {
    swrKey,
    ...query,
  };
};
/**
 * @summary Info for a specific pet
 */
export type showPetByIdResponse = {
  data: Pet;
  status: number;
  headers: Headers;
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

  const data: Pet = await res.json();

  return { status: res.status, data, headers: res.headers };
};

export const getShowPetByIdKey = (petId: string) =>
  [`http://localhost:8000/pets/${petId}`] as const;

export type ShowPetByIdQueryResult = NonNullable<
  Awaited<ReturnType<typeof showPetById>>
>;
export type ShowPetByIdQueryError = Promise<Error>;

/**
 * @summary Info for a specific pet
 */
export const useShowPetById = <TError = Promise<Error>>(
  petId: string,
  options?: {
    swr?: SWRConfiguration<Awaited<ReturnType<typeof showPetById>>, TError> & {
      swrKey?: Key;
      enabled?: boolean;
    };
    fetch?: RequestInit;
  },
) => {
  const { swr: swrOptions, fetch: fetchOptions } = options ?? {};

  const isEnabled = swrOptions?.enabled !== false && !!petId;
  const swrKey =
    swrOptions?.swrKey ?? (() => (isEnabled ? getShowPetByIdKey(petId) : null));
  const swrFn = () => showPetById(petId, fetchOptions);

  const query = useSwr<Awaited<ReturnType<typeof swrFn>>, TError>(
    swrKey,
    swrFn,
    swrOptions,
  );

  return {
    swrKey,
    ...query,
  };
};
