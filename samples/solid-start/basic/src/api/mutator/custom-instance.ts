import { AxiosError, AxiosRequestConfig } from 'axios';

import type { CreatePetsBody } from '~/api/model';

import { getPets, createPet, getPetById } from '~/server/pets';

export const customInstance = async <T>(
  config: AxiosRequestConfig,
): Promise<T> => {
  console.log('🌐 Making request:', config);

  try {
    const { url, method, data } = config;

    // Route to the appropriate server function
    if (url === '/pets' && method === 'GET') {
      const result = await getPets();
      console.log('✅ Response received:', result);
      return result as T;
    }

    if (url === '/pets' && method === 'POST') {
      const result = await createPet(data as CreatePetsBody);
      console.log('✅ Response received:', result);
      return result as T;
    }

    if (url?.match(/^\/pets\/\w+$/) && method === 'GET') {
      const petId = url.split('/').pop()!;
      const result = await getPetById(petId);
      console.log('✅ Response received:', result);
      return result as T;
    }

    throw new Error(`Unhandled route: ${method} ${url}`);
  } catch (error) {
    console.error('❌ Request failed:', error);
    throw error;
  }
};

export default customInstance;

export interface ErrorType<Error> extends AxiosError<Error> {}
