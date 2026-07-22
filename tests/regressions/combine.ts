import type { CanonicalNullableOneOfItem } from '../generated/default/regressions-oas31/model/canonicalNullableOneOfItem';
import type { CanonicalNullableOneOfSiblingItem } from '../generated/default/regressions-oas31/model/canonicalNullableOneOfSiblingItem';
import type { InlineNullableAnyOfItem } from '../generated/default/regressions-oas31/model/inlineNullableAnyOfItem';
import type { AllEnumSiblingItem } from '../generated/default/regressions/model/allEnumSiblingItem';
import type { DirectScalarUnionItem } from '../generated/default/regressions/model/directScalarUnionItem';
import type { EnumUnionItem } from '../generated/default/regressions/model/enumUnionItem';
import type { NestedComposedUnionItem } from '../generated/default/regressions/model/nestedComposedUnionItem';
import type { NestedUnionItem } from '../generated/default/regressions/model/nestedUnionItem';
import type { NullableAllOfMemberItem } from '../generated/default/regressions/model/nullableAllOfMemberItem';
import type { NullableParentItem } from '../generated/default/regressions/model/nullableParentItem';
import type { RefMemberUnionItem } from '../generated/default/regressions/model/refMemberUnionItem';
import type { ScalarItem } from '../generated/default/regressions/model/scalarItem';
import type { SiblingEnumItem } from '../generated/default/regressions/model/siblingEnumItem';
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

const directScalarUnionItem: DirectScalarUnionItem = { id: 'id' };

// A direct non-null scalar member is intersected with the parent's properties
// and does not add a separate scalar branch to the referenced wrapper.
// @ts-expect-error - id must not silently become optional.
const directScalarUnionItemWithoutId: DirectScalarUnionItem = {};

const refMemberUnionItem: RefMemberUnionItem = { id: 'id' };

// Nullability on a referenced anyOf member stays inside its intersection with
// the parent's properties and is not propagated to the wrapper alias.
// @ts-expect-error - id must not silently become optional.
const refMemberUnionItemWithoutId: RefMemberUnionItem = {};

// All-enum compositions emit the parent's properties as a separate union
// branch, so required-key handling must stay on the compile-safe Extract path.
export type EnumUnionItemCompileCheck = EnumUnionItem;

export type SiblingEnumItemCompileCheck = SiblingEnumItem;

export type CanonicalNullableOneOfItemCompileCheck =
  CanonicalNullableOneOfItem;

const canonicalNullableOneOfSiblingItem: CanonicalNullableOneOfSiblingItem = {
  id: 'id',
  left: 'value',
};

// The nullable oneOf shortcut drops only the schema's own properties. Keys
// supplied by a sibling allOf member remain required in the intersection.
// @ts-expect-error - id must not silently become optional.
const canonicalNullableOneOfSiblingItemWithoutId: CanonicalNullableOneOfSiblingItem =
  { left: 'value' };

export type AllEnumSiblingItemCompileCheck = AllEnumSiblingItem;

const inlineNullableAnyOfItem: InlineNullableAnyOfItem = {
  id: 'id',
  left: 'value',
};

// Direct anyOf nullability stays inside an inline allOf member, where its
// intersection with the object base keeps id on every surviving branch.
// @ts-expect-error - id must not silently become optional.
const inlineNullableAnyOfItemWithoutId: InlineNullableAnyOfItem = {
  left: 'value',
};

const nullableAllOfMemberItem: NullableAllOfMemberItem = {
  id: 'id',
  marker: 'value',
};

// The object sibling removes the nullable ref member's null branch from the
// allOf intersection, so keys from its object branch remain required.
// @ts-expect-error - id must not silently become optional.
const nullableAllOfMemberItemWithoutId: NullableAllOfMemberItem = {
  marker: 'value',
};

const nullableParentItem: NullableParentItem = {
  id: 'id',
  marker: 'value',
};

// The parent's own object properties also remove the nullable allOf member's
// null branch, so keys from its object branch remain required.
// @ts-expect-error - id must not silently become optional.
const nullableParentItemWithoutId: NullableParentItem = {
  marker: 'value',
};

void unionItem;
void unionItemWithoutId;
void scalarItem;
void nestedComposedUnionItem;
void nestedComposedUnionItemWithoutId;
void directScalarUnionItem;
void directScalarUnionItemWithoutId;
void refMemberUnionItem;
void refMemberUnionItemWithoutId;
void canonicalNullableOneOfSiblingItem;
void canonicalNullableOneOfSiblingItemWithoutId;
void inlineNullableAnyOfItem;
void inlineNullableAnyOfItemWithoutId;
void nullableAllOfMemberItem;
void nullableAllOfMemberItemWithoutId;
void nullableParentItem;
void nullableParentItemWithoutId;
