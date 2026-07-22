import type { NestedComposedUnionItem } from '../generated/default/regressions/model/nestedComposedUnionItem';
import type { NestedUnionItem } from '../generated/default/regressions/model/nestedUnionItem';
import type { ScalarItem } from '../generated/default/regressions/model/scalarItem';
import type { UnionItem } from '../generated/default/regressions/model/unionItem';

const unionItem: UnionItem = { id: 'id' };

// A top-level property on an anyOf/oneOf schema is intersected into every
// emitted branch and must remain required through a nested allOf reference.
// @ts-expect-error - id must not silently become optional.
const unionItemWithoutId: UnionItem = {};

// Properties attached to a scalar schema do not make its emitted type an
// object. Reaching one through allOf must not produce an invalid Pick key.
const scalarItem: ScalarItem = 'value';

// A nested nullable union member cannot guarantee the parent's property keys
// in `keyof`, so its required override must stay on the compile-safe path.
export type NestedUnionItemCompileCheck = NestedUnionItem;

const nestedComposedUnionItem: NestedComposedUnionItem = { id: 'id' };

// A nested explicit union is grouped before the parent's properties are
// intersected, so every surviving branch must still require id.
// @ts-expect-error - id must not silently become optional.
const nestedComposedUnionItemWithoutId: NestedComposedUnionItem = {};

void unionItem;
void unionItemWithoutId;
void scalarItem;
void nestedComposedUnionItem;
void nestedComposedUnionItemWithoutId;
