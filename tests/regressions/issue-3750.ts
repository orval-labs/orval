import type { ItemDetail } from '../generated/default/issue-3750/model/itemDetail';

declare const item: ItemDetail;

const id: string = item.id;
const name: string = item.name;

// The constraint-only allOf member makes both parent properties required.
// @ts-expect-error - id must not silently become optional.
const itemWithoutId: ItemDetail = { name: 'name' };

// @ts-expect-error - name must not silently become optional.
const itemWithoutName: ItemDetail = { id: 'id' };

void id;
void name;
void itemWithoutId;
void itemWithoutName;
