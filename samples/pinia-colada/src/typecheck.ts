import { ref } from 'vue';
import {
  getGetPetQueryOptions,
  getCreatePetMutationOptions,
  useCreatePet,
  useDeletePet,
  useGetPet,
  useListPets,
  usePing,
  useUploadPet,
} from './gen/fetch-single/client';

// Compile-only assertions; composables must be called from a component in runtime code.
export function checkGeneratedTypes() {
  const detail = useGetPet(ref(1));
  const id: number | undefined = detail.data.value?.id;
  const name: string | undefined = detail.data.value?.name;
  useGetPet(() => 2, { query: { enabled: false, staleTime: 1000 } });
  useListPets(() => ({ search: 'Milo', tags: ['cat'] }));
  const query = getGetPetQueryOptions(1);
  const create = useCreatePet();
  create.mutate({ createPetBody: { name: 'Milo' } });
  const created: Promise<{ id: number; name: string }> = create.mutateAsync({
    createPetBody: { name: 'Luna' },
  });
  useDeletePet().mutate({ petId: 1 });
  usePing().mutate();
  useUploadPet().mutate({ uploadPetBody: { file: new Blob(['pet']) } });
  const options = getCreatePetMutationOptions({
    mutation: {
      onMutate: () => ({ previous: 'Milo' }),
      onSuccess(data, variables, context) {
        const result: number = data.id;
        const input: string = variables.createPetBody.name;
        const previous: string = context.previous;
        return { result, input, previous };
      },
    },
  });
  // @ts-expect-error Path parameters retain their OpenAPI types.
  useGetPet('not-a-number');
  // @ts-expect-error Required mutation bodies cannot be omitted.
  create.mutate({});
  // @ts-expect-error Mutation body fields retain their OpenAPI types.
  create.mutate({ createPetBody: { name: 123 } });
  // @ts-expect-error Required path parameters cannot be omitted.
  useDeletePet().mutate({});
  return { id, name, created, query, options };
}
