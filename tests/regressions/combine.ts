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

void unionItem;
void unionItemWithoutId;
void scalarItem;
