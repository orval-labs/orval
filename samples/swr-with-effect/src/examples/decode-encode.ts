// Worked example: what generated Effect schemas unlock that Zod can't.
// Used by the upstream PR to show real value beyond output parity.

import { Either, Schema as S } from 'effect';

import {
  CreatePetsBodyItem,
  ListPetsResponseItem,
} from '../gen/endpoints/pets/pets.effect';

// 1) Encoded vs decoded type duality.
//    `Schema.Type<S>` is the runtime shape; `Schema.Encoded<S>` is the wire
//    shape. They differ once a schema transforms (date strings → Date, etc.).
export type PetEncoded = S.Schema.Encoded<typeof ListPetsResponseItem>;
export type PetDecoded = S.Schema.Type<typeof ListPetsResponseItem>;

// 2) Decode + encode round-trip.
const wire: unknown = {
  id: 1,
  name: 'Buddy',
  type: 'dog',
  breed: 'Labradoodle',
  cuteness: 9,
};
const decoded: PetDecoded = S.decodeUnknownSync(ListPetsResponseItem)(wire);
const encoded: PetEncoded = S.encodeSync(ListPetsResponseItem)(decoded);

// 3) Safe decoding via Either (no try/catch, fully typed error channel).
export const parsePet = (input: unknown) =>
  Either.match(S.decodeUnknownEither(CreatePetsBodyItem)(input), {
    onLeft: (err) => ({ ok: false as const, issues: err.message }),
    onRight: (pet) => ({ ok: true as const, pet }),
  });

export const example = { decoded, encoded };
