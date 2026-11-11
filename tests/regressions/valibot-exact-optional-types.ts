import type * as v from 'valibot';

import type * as schemas from '../generated/valibot/model-types-exact-optional/model-types-exact-optional';
import type { Equal } from './valibot-type-equality';

// `scripts/typecheck-generated.mjs` also checks this file with
// `exactOptionalPropertyTypes`, where an optional key without `undefined` is
// a different type. The declared types are the types valibot infers.
type Comment = typeof schemas.Comment;

export const output: Equal<schemas.Comment, v.InferOutput<Comment>> = true;
export const input: Equal<schemas.CommentInput, v.InferInput<Comment>> = true;
