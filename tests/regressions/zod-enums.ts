import {
  GetApiRequiredCatResponse,
  GetApiPetTrainingResponse,
} from '../generated/zod/enums/enums';
import {
  GetApiRequiredCatResponse as GetApiRequiredCatResponseV3,
  GetApiPetTrainingResponse as GetApiPetTrainingResponseV3,
} from '../generated/zod/enums-v3/enums-v3';

// Zod 4
const componentValue = GetApiPetTrainingResponse.enum;
const expert: 4 = componentValue.Expert;

const pet = GetApiRequiredCatResponse.shape.petsRequested.unwrap().element;
const color = pet.shape.colours.element;
const inlineColor: 'BLACK' = color.enum.Black;

// Zod 3
const componentValueV3 = GetApiPetTrainingResponseV3.enum;
const expertV3: 4 = componentValueV3.Expert;

const petV3 =
  GetApiRequiredCatResponseV3.shape.petsRequested.unwrap().element;
const colorV3 = petV3.shape.colours.element;
const inlineColorV3: 'BLACK' = colorV3.enum.Black;

void expert;
void inlineColor;
void expertV3;
void inlineColorV3;