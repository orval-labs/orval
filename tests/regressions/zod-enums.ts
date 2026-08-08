import {
  GetApiRequiredCatResponse,
  GetApiPetTrainingResponse,
} from '../generated/zod/enums/enums';

// Component-level enum:
// - `.enum.Expert` must exist
const componentValue = GetApiPetTrainingResponse.enum;
const expert: 4 = componentValue.Expert;

// Inline enum:
// - member accessor must also work for an inline enum
const pet = GetApiRequiredCatResponse.shape.petsRequested.unwrap().element;
const color = pet.shape.colours.element;
const inlineColor: 'BLACK' = color.enum.Black;


void expert;
void inlineColor;