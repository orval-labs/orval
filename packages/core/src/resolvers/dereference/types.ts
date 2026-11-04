import type { OpenApiNonBooleanSchemaObject } from '../../types';

/**
 * Per-consumer behavior of `dereference`. Pass one module-level constant per
 * consumer: the object identity keys the shared expansion cache. The callbacks
 * run when an expansion is computed, not again when it is reused.
 */
export interface DereferenceOptions {
  /** Resolve `$dynamicRef` through the dynamic scope. */
  dynamicRefs?: boolean;
  /** Keep boolean values under `properties` instead of turning them into object schemas. */
  keepBooleanProperties?: boolean;
  /** Keep siblings of a `$ref` whose target is a boolean schema. */
  keepSiblingsOfBooleanTarget?: boolean;
  /** Define a `__proto__` key as an own property instead of dropping it. */
  keepProtoKey?: boolean;
  /** Pass a node with an empty `$ref` through as an inline schema. */
  ignoreEmptyRef?: boolean;
  /** Spread an array target into the node instead of treating it as unresolved. */
  mergeArrayTargets?: boolean;
  /** Treat a `$ref` to the boolean schema `false` as unresolved. */
  falseTargetIsUnresolved?: boolean;
  /** Keys whose values are copied without being dereferenced. */
  isVerbatimKey?: (key: string) => boolean;
  /** Called when a `$ref` is cut because it is already being expanded. */
  onCircularRef?: (ref: string) => void;
  /** Called when a `$ref` target is missing or is not a schema. */
  onUnresolvedRef?: (ref: string) => void;
  /** Called with a diagnostic message when resolving a `$ref` throws. */
  onResolveError?: (message: string) => void;
}

/**
 * An expanded value plus every `$ref` met while expanding it; `reusable` is
 * false when a dynamic scope took part or `refs` is incomplete, so the value
 * must not be reused.
 */
export interface Expansion<TValue = OpenApiNonBooleanSchemaObject> {
  value: TValue;
  refs: ReadonlySet<string>;
  reusable: boolean;
}
