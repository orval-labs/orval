export {
  dereferenceWithPolicy,
  type PolicyDereferenceOptions,
  type SchemaWalkReporter,
} from './dereference';
export {
  allocateConstName,
  allocateDerivedNames,
  type ComponentNameOptions,
  getComponentNames,
  resolveComponentName,
} from './component-names';
export { createImportCheck, withInlineImports } from './inline-module';
export { omitDirectional, relaxWriteOnly } from './read-only';
export { createWarnOnceReporter } from './reporter';
export {
  carriesSiblings,
  type ComponentFacts,
  getComponentFacts,
  needsRequiredKeys,
  reachesDirection,
  type RefPolicy,
  type RefSite,
  requiresUndeclaredKey,
  resolveSelf,
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
export { createSharedRefPolicy } from './shared-ref-policy';
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
