import type { Dayjs } from 'dayjs';
import type * as v from 'valibot';

import type * as formatType from '../generated/valibot/model-types-format-type/model-types-format-type';
import type * as models from '../generated/valibot/model-types-models/model';
import type * as schemas from '../generated/valibot/model-types/model-types';
import type { Equal } from './valibot-type-equality';

// #4486: the output of a schema and its model are assignable both ways, with
// readOnly arrays and recursive members.
type Output<T extends v.GenericSchema> = v.InferOutput<T>;

export const itemToModel = (value: Output<typeof schemas.Item>): models.Item =>
  value;
export const itemFromModel = (
  value: models.Item,
): Output<typeof schemas.Item> => value;

export const folderToModel = (
  value: Output<typeof schemas.Folder>,
): models.Folder => value;
export const folderFromModel = (
  value: models.Folder,
): Output<typeof schemas.Folder> => value;

export const entryToModel = (
  value: Output<typeof schemas.Entry>,
): models.Entry => value;
export const entryFromModel = (
  value: models.Entry,
): Output<typeof schemas.Entry> => value;

export const categoryToModel = (
  value: Output<typeof schemas.Category>,
): models.Category => value;
export const categoryFromModel = (
  value: models.Category,
): Output<typeof schemas.Category> => value;

export const metaToModel = (value: Output<typeof schemas.Meta>): models.Meta =>
  value;
export const metaFromModel = (
  value: models.Meta,
): Output<typeof schemas.Meta> => value;

export const tagsFromModel = (
  value: models.Tags,
): Output<typeof schemas.Tags> => value;

// The default fills `score` in the output, while the model keeps it optional,
// so only the output is assignable to the model.
export const commentToModel = (
  value: Output<typeof schemas.Comment>,
): models.Comment => value;

// The declared types are the types valibot infers.
export const commentOutput: Equal<
  schemas.Comment,
  Output<typeof schemas.Comment>
> = true;
export const commentInput: Equal<
  schemas.CommentInput,
  v.InferInput<typeof schemas.Comment>
> = true;
export const metaOutput: Equal<
  schemas.Meta,
  Output<typeof schemas.Meta>
> = true;

// A `formatType` decode types recursive members with the configured type.
export const replyCreatedAt = (
  value: Output<typeof formatType.Comment>,
): Dayjs | undefined => value.replies[0]?.parent?.createdAt;
export const declaredCreatedAt = (value: formatType.Comment): Dayjs =>
  value.createdAt;
