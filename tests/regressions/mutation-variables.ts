import type {
  CreatePetsMutationBody,
  CreatePetsMutationVariables,
  DeletePetByIdMutationVariables,
} from '../generated/react-query/basic/endpoints';

// #3782: the variables a mutation takes have a name of their own, so a wrapper
// can annotate them instead of inferring them back out of the hook.
const deletePetByIdVariables: DeletePetByIdMutationVariables = {
  petId: 'a-pet',
};

export const deletedPetId: string = deletePetByIdVariables.petId;

// MutationBody is not a substitute: it covers the body and not the params
// beside it, which is why the wrapper needs the variables type.
export const createPetsBody = (
  variables: CreatePetsMutationVariables,
): CreatePetsMutationBody => variables.data;

export const createPetsSort = (variables: CreatePetsMutationVariables) =>
  variables.params.sort;
