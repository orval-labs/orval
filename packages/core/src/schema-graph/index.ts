export {
  dereferenceWithPolicy,
  type PolicyDereferenceOptions,
  type SchemaWalkReporter,
} from './dereference';
export { omitDirectional, relaxWriteOnly } from './read-only';
export {
  carriesSiblings,
  type ComponentFacts,
  getComponentFacts,
  needsRequiredKeys,
  reachesDirection,
  type RefPolicy,
  type RefSite,
  requiresUndeclaredKey,
  type SchemaDirection,
} from './ref-policy';
export {
  getComponentKey,
  getComponentSchema,
  getLocalRefTarget,
  getRef,
  toComponentRef,
} from './refs';
export { type CompositionKey } from './schema-keys';
export {
  getCompositionKeys,
  getMultiTypes,
  hasProperties,
  isNonBoolean,
  type ResolvedType,
  resolveType,
  toCanonicalNullable,
  withoutOuterAnnotations,
} from './schema-type';
export { getUnguardedCycleKeys } from './unguarded-cycles';
