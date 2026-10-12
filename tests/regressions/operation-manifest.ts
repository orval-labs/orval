import type {
  OperationName,
  OperationTypes,
} from '../generated/fetch/petstore-tags-operations-split/endpoints.operations';
import { operations } from '../generated/fetch/petstore-tags-operations-split/endpoints.operations';
import type { Pet } from '../generated/fetch/petstore-tags-operations-split/model';
import type { getShowPetByIdResponseMock } from '../generated/fetch/petstore-tags-operations-split/pets/show-pet-by-id.faker';

// `OperationTypes` references the generated types, so a broken import or a
// renamed type fails here.
const pet: OperationTypes['showPetById']['response'] = {} as Pet;
const petId: OperationTypes['showPetById']['pathParams']['petId'] = '1';
// @ts-expect-error showPetById takes no body
const body: OperationTypes['showPetById']['body'] = {};

// The manifest data is `as const`, so names and literals stay narrow.
const name: OperationName = 'showPetById';
const method: 'GET' = operations.showPetById.method;
const mock: 'getShowPetByIdResponseMock' = operations.showPetById.mock;
// @ts-expect-error not an operation
const unknown: OperationName = 'nope';

// The listed mock factory returns the payload type.
type MockReturn = ReturnType<typeof getShowPetByIdResponseMock>;
const mocked: OperationTypes['showPetById']['response'] = {} as MockReturn;

export { body, method, mock, mocked, name, pet, petId, unknown };
