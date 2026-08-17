import {
  GetApiCatResponseItem,
  GetApiPetTrainingResponse,
} from '../generated/zod/enums-mini/enums-mini';

// Mini's `_enum` has no `const` type parameter, so the generated `as const`
// assertion is what keeps member literal types. Without it every member
// widens to `string`/`number` and the assignments below stop compiling
// (regression for #3852).
const expert: 4 = GetApiPetTrainingResponse.def.entries.Expert;
const firstGroup: 1 = GetApiCatResponseItem.def.entries.NUMBER_1;

void expert;
void firstGroup;
