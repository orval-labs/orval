import type { ItemDetail } from '../generated/default/issue-3750/model/itemDetail';
import type { NullableItemDetail } from '../generated/default/issue-3750/model/nullableItemDetail';

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

void id;
void name;
void itemWithoutId;
void itemWithoutName;
void nullableItemWithoutId;
