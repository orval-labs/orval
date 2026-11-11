import type * as v from 'valibot';

import type * as schemas from '../generated/valibot/recursive-file/recursive-file';
import type { Equal } from './valibot-type-equality';

// #4486: the declared types of a recursive constant named `File` are the
// types valibot infers, with a binary field and a converted date.
export const output: Equal<
  schemas.File,
  v.InferOutput<typeof schemas.File>
> = true;
export const input: Equal<
  schemas.FileInput,
  v.InferInput<typeof schemas.File>
> = true;

// The upload keeps the global `File` type, and the date is converted.
export const content = (value: schemas.File): globalThis.File | undefined =>
  value.content;
export const createdOn = (value: schemas.File): Date | undefined =>
  value.createdOn;
