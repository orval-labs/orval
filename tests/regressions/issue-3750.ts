import type { ItemDetail } from '../generated/default/issue-3750/model/itemDetail';
import type { NestedNullableItemDetail } from '../generated/default/issue-3750/model/nestedNullableItemDetail';
import type { NullableItemDetail } from '../generated/default/issue-3750/model/nullableItemDetail';
import type { RefNullableItemDetail } from '../generated/default/issue-3750/model/refNullableItemDetail';

declare const item: ItemDetail;

const id: string = item.id;
const name: string = item.name;

// The constraint-only allOf member makes both parent properties required.
// @ts-expect-error - id must not silently become optional.
const itemWithoutId: ItemDetail = { name: 'name' };

// @ts-expect-error - name must not silently become optional.
const itemWithoutName: ItemDetail = { id: 'id' };

declare const nullableItem: NullableItemDetail;

if (nullableItem !== null) {
  const nullableItemId: string = nullableItem.id;
  void nullableItemId;
}

// The non-null object allOf member removes the parent's null branch and still
// requires id on the surviving object type.
// @ts-expect-error - id must not silently become optional.
const nullableItemWithoutId: NullableItemDetail = {};

declare const nestedNullableItem: NestedNullableItemDetail;

if (nestedNullableItem !== null) {
  const nestedNullableItemId: string = nestedNullableItem.id;
  void nestedNullableItemId;
}

// A non-null object constraint nested behind a component ref removes the
// parent's null branch before the required overlay is applied.
// @ts-expect-error - id must not silently become optional.
const nestedNullableItemWithoutId: NestedNullableItemDetail = {};

// The referenced wrapper propagates null outside its own allOf intersection.
// This declaration also guards against generating a Pick key constrained by
// `never`, which makes the generated model fail TypeScript compilation.
const refNullableItem: RefNullableItemDetail = null;

void id;
void name;
void itemWithoutId;
void itemWithoutName;
void nullableItemWithoutId;
void nestedNullableItemWithoutId;
void refNullableItem;
