import {
  type ContextSpec,
  getRefInfo,
  isReference,
  type OpenApiSchemaObject,
} from '@orval/core';
import { prop } from 'remeda';

import type { MockSchema } from '../../types';

// Resolve a `$ref` (following `$ref`-to-`$ref` alias chains, like the model
// side's `derefComponentSchema`) to its target schema. `seen` breaks cycles;
// returns undefined for unresolvable or already-visited refs.
function derefAllOfMember(
  member: MockSchema,
  context: ContextSpec,
  seen: Set<string>,
): Partial<OpenApiSchemaObject> | undefined {
  let current: unknown = member;

  while (current && typeof current === 'object' && isReference(current)) {
    const ref = current.$ref;
    if (typeof ref !== 'string' || seen.has(ref)) {
      return undefined;
    }
    seen.add(ref);
    const { refPaths } = getRefInfo(ref, context);
    current = Array.isArray(refPaths)
      ? prop(
          context.spec,
          // @ts-expect-error: refPaths are not guaranteed to be valid keys of the spec
          ...refPaths,
        )
      : undefined;
  }

  return current && typeof current === 'object'
    ? (current as Partial<OpenApiSchemaObject>)
    : undefined;
}

// `allOf` makes `required` the union across every member, including `$ref`'d
// ones (resolved through alias chains and nested `allOf`, cycle-guarded by
// `seen`) and constraint-only members (`{ required: [...] }` alone, #3750).
//
// Boundary filter: names collected from a nested composition count only when
// that composition also declares the property. The generated types work the
// same way (core getters/combine.ts, #3663), and collecting more than the
// model requires would flip the #910 cyclic-reference guard from omission to
// `key: null` on a property the type keeps optional. Direct members are
// exempt: their `required` applies to the composition being emitted now.
//
// Returns the declared property names alongside `required` so callers one
// level up can apply the same boundary filter.
export function collectAllOfRequiredWithDeclared(
  schemas: MockSchema[],
  context: ContextSpec,
  seen: Set<string>,
): { required: string[]; declared: Set<string> } {
  const required: string[] = [];
  const declared = new Set<string>();

  for (const val of schemas) {
    const schema = derefAllOfMember(val, context, seen);
    if (!schema) {
      continue;
    }

    const properties = schema.properties as Record<string, unknown> | undefined;
    if (properties && typeof properties === 'object') {
      for (const key of Object.keys(properties)) {
        declared.add(key);
      }
    }

    if (Array.isArray(schema.required)) {
      required.push(...(schema.required as string[]));
    }

    if (Array.isArray(schema.allOf)) {
      const inner = collectAllOfRequiredWithDeclared(
        schema.allOf as MockSchema[],
        context,
        seen,
      );
      required.push(
        ...inner.required.filter(
          (name) =>
            inner.declared.has(name) || (properties && name in properties),
        ),
      );
      for (const key of inner.declared) {
        declared.add(key);
      }
    }
  }

  return { required, declared };
}

export function collectAllOfRequired(
  schemas: MockSchema[],
  context: ContextSpec,
): string[] {
  return collectAllOfRequiredWithDeclared(schemas, context, new Set()).required;
}
