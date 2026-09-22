import { hasNarrowedPropertyNames } from '../getters';
import { isBooleanJsonSchema } from '@scalar/openapi-types/helpers';

import { resolveRef } from '../resolvers/ref';
import type {
  ContextSpec,
  GetterBody,
  GetterResponse,
  OpenApiNonBooleanSchemaObject,
  OpenApiReferenceObject,
  OpenApiRequestBodyObject,
  OpenApiSchemaObject,
} from '../types';
import { isInlineSchema, pascal, toObjectSchema } from '../utils';

type SchemaOrRef = OpenApiSchemaObject | OpenApiReferenceObject;

interface NormalizedSchema {
  schema: OpenApiNonBooleanSchemaObject;
  /** Set when the schema was reached through a `$ref`; drives cycle detection. */
  ref?: string;
  /** True when the schema admits `null`, in either OAS 3.0 or 3.1 spelling. */
  nullable: boolean;
}

const isDateSchema = (schema: OpenApiSchemaObject): boolean =>
  !isBooleanJsonSchema(schema) &&
  (schema.format === 'date' || schema.format === 'date-time');

const isNullTypeSchema = (schemaOrRef: SchemaOrRef): boolean => {
  if (!isInlineSchema(schemaOrRef) || isBooleanJsonSchema(schemaOrRef))
    return false;
  const { type } = schemaOrRef;
  return (
    type === 'null' ||
    (Array.isArray(type) && type.length > 0 && type.every((t) => t === 'null'))
  );
};

const hasNullableType = (schema: OpenApiSchemaObject): boolean =>
  !isBooleanJsonSchema(schema) &&
  Array.isArray(schema.type) &&
  schema.type.includes('null');

/**
 * True when the schema itself names at least one property. An empty
 * `properties: {}` names none: the object getter types it — alongside a
 * schema-valued `additionalProperties` — as the same index signature as a bare
 * map, so it must not count as declaring keys or as needing an object copy.
 */
const hasOwnProperties = (schema: OpenApiSchemaObject): boolean =>
  !isBooleanJsonSchema(schema) &&
  schema.properties !== undefined &&
  Object.keys(schema.properties).length > 0;

/**
 * True when this schema, or any of its `allOf` branches (recursively,
 * through `$ref`s), declares its own `properties` — or is itself a `oneOf`/
 * `anyOf` union whose variants declare theirs. Mirrors `needsObjectCopy`'s
 * `allOf` recursion, but is asked before that function exists in the file, so
 * it stays a narrower, standalone check.
 *
 * Exists so Rule 1 (below) can mean "does this level declare any keys at
 * all" rather than "does this exact schema object have a `properties` key"
 * — an intersection built from `allOf` merges every branch's properties into
 * the same object, and a discriminated (or undiscriminated) union's variants
 * are merged into the same level's type by the getter just as surely, so
 * either is just as unsafe to combine with a map loop as a literal
 * `properties` block on the schema being asked about directly. A `oneOf`/
 * `anyOf` reaching this point is a genuine union, not a nullable wrapper:
 * `normalizeSchema` (called first, below) already unwraps the nullable
 * spellings (`anyOf: [T, null]`, `type: [T, 'null']`) to the bare
 * schema before this check ever sees them, so a nullable map or a nullable
 * map value is unaffected.
 */
const declaresProperties = (
  schemaOrRef: SchemaOrRef,
  context: ContextSpec,
  seenRefs: Set<string> = new Set(),
): boolean => {
  const { schema, ref } = normalizeSchema(schemaOrRef, context);
  if (ref) {
    if (seenRefs.has(ref)) return false;
    seenRefs.add(ref);
  }
  if (isBooleanJsonSchema(schema)) return false;
  if (hasOwnProperties(schema)) return true;
  if (schema.oneOf || schema.anyOf) return true;
  return (schema.allOf ?? []).some((branch: SchemaOrRef) =>
    declaresProperties(branch, context, seenRefs),
  );
};

/**
 * The `additionalProperties` schema when this level of the object is a map
 * of same-shaped values, or undefined when it is not.
 *
 * Several shapes contribute nothing (Rule 2): `additionalProperties: true`
 * and `additionalProperties: false` are a permissive/forbidding flag, not a
 * value schema, and an absent `additionalProperties` obviously isn't one
 * either. An array (`additionalProperties: []`, invalid JSON Schema but seen
 * in the wild) and a keyless object (`additionalProperties: {}`, the common
 * "extra keys are allowed, of any shape" idiom) are rejected too: neither
 * has a format, a `$ref`, or any nested shape this walk could ever turn into
 * a statement, so treating either as a real map value schema would only
 * make the items/map conflict check in `buildResolvedStatements` fire on a
 * purely syntactic `!= null` and silently drop an array walk that used to
 * run. Only a non-empty object (a schema, possibly a `$ref` to one) counts
 * as a map's value type.
 *
 * A schema that also declares `properties` — directly, via an `allOf`
 * branch (Rule 1), or as a `oneOf`/`anyOf` union sitting beside
 * `additionalProperties` — is never walked as a map, full stop:
 * `additionalProperties` only governs the keys `properties` doesn't name,
 * and a blind loop over every key would revisit — and, since not every
 * declared property holds a date, potentially corrupt — the composition's
 * own declared properties (or, for a union, whichever variant's properties
 * the discriminator switch just converted). The `allOf` check here only sees
 * branches nested inside *this* schema's own `allOf` array (`{ allOf: [Base],
 * additionalProperties }`); the sibling spelling, where this schema is
 * itself one of a *parent's* `allOf` branches (`allOf: [Base,
 * { additionalProperties }]`), is caught separately in
 * `buildResolvedStatements`, which has visibility into the parent's other
 * branches that this function does not. Distinguishing "the extra keys" from
 * the named ones would need the full set of sibling property names threaded
 * through the walk for no real-world payoff, so a schema declaring both is
 * left to its `properties` statements only. A `oneOf`/`anyOf` whose values
 * are the map's *value* type (`additionalProperties: { oneOf: [...] }`) is
 * unaffected — that union lives one object level down, on the schema
 * `mapValueSchema` returns, not on the schema it's asked about.
 *
 * A `propertyNames` that narrows the key type to a finite set of literals
 * (`enum`, `const`, or a `$ref` to a string enum/const) also disqualifies a
 * schema from map traversal: `getters/object.ts` (`hasNarrowedPropertyNames`)
 * types that combination as `Partial<Record<K, V>>`, not an index signature,
 * so `Object.keys()` (typed `string`) can't index it without a `TS7053`, and
 * even a correctly-typed key would read a value typed `V | undefined` that
 * this walk has no way to narrow. Emit nothing rather than code that doesn't
 * compile. Any other `propertyNames` constraint — `format`, `pattern`,
 * `minLength`, or none at all — still types as a plain index signature
 * (`[key: string]: V`), which a blind `Object.keys` loop indexes fine, so
 * those cases fall through to the traversal below.
 */
const mapValueSchema = (
  schema: OpenApiSchemaObject,
  context: ContextSpec,
): SchemaOrRef | undefined => {
  if (isBooleanJsonSchema(schema)) return undefined;
  if (declaresProperties(schema, context)) return undefined;
  if (schema.propertyNames && hasNarrowedPropertyNames(schema, context)) {
    return undefined;
  }
  const { additionalProperties } = schema;
  if (!additionalProperties || typeof additionalProperties !== 'object') {
    return undefined;
  }
  if (Array.isArray(additionalProperties)) return undefined;
  if (Object.keys(additionalProperties).length === 0) return undefined;
  return additionalProperties as SchemaOrRef;
};

/**
 * Resolves `$ref`s and unwraps the OAS 3.1 spelling of a nullable schema
 * (`anyOf: [<schema>, { type: 'null' }]`) so a nullable date is recognised
 * whichever spelling the document uses, instead of being skipped as an
 * undiscriminated union.
 */
const normalizeSchema = (
  schemaOrRef: SchemaOrRef,
  context: ContextSpec,
  nullable = false,
  seenRefs: Set<string> = new Set(),
): NormalizedSchema => {
  if (isBooleanJsonSchema(schemaOrRef)) {
    return {
      schema: toObjectSchema(schemaOrRef),
      nullable: schemaOrRef,
    };
  }

  if (!isInlineSchema(schemaOrRef) && schemaOrRef.$ref) {
    const ref: string = schemaOrRef.$ref;
    // Guard against a self-referential nullable wrapper (`A: anyOf [A, null]`)
    // sending this resolution loop infinite.
    if (seenRefs.has(ref)) {
      return { schema: {}, ref, nullable };
    }
    seenRefs.add(ref);
    const { schema } = resolveRef<OpenApiSchemaObject>(schemaOrRef, context);
    return {
      ...normalizeSchema(schema, context, nullable, seenRefs),
      ref,
    };
  }

  const schema = schemaOrRef as OpenApiNonBooleanSchemaObject;
  const variants = schema.oneOf ?? schema.anyOf;

  if (
    variants &&
    !schema.discriminator &&
    !schema.properties &&
    !schema.allOf
  ) {
    const nonNullVariants = variants.filter(
      (variant: SchemaOrRef) => !isNullTypeSchema(variant),
    );
    if (
      nonNullVariants.length === 1 &&
      nonNullVariants.length < variants.length
    ) {
      return normalizeSchema(nonNullVariants[0], context, true, seenRefs);
    }
  }

  return { schema, nullable: nullable || hasNullableType(schema) };
};

const IDENTIFIER_REGEX = /^[A-Za-z_$][\w$]*$/;

const propertyAccessor = (parent: string, key: string): string =>
  IDENTIFIER_REGEX.test(key)
    ? `${parent}.${key}`
    : `${parent}[${JSON.stringify(key)}]`;

/**
 * `readOnly` schema properties are generated with a `readonly` modifier, so
 * the deserializer cannot assign to them directly. Casting the container to
 * its mutable twin keeps the assignment type-checked — the assigned value
 * must still be a `Date` — without widening anything to `any`.
 */
const mutableCast = (accessor: string): string =>
  `(${accessor} as { -readonly [K in keyof typeof ${accessor}]: (typeof ${accessor})[K] })`;

const indent = (statements: string[]): string[] =>
  statements.map((statement) => `  ${statement}`);

/**
 * A discriminator mapping value is either a `$ref` or a bare component schema
 * name (OpenAPI allows both); bare names are expanded to the component ref.
 */
const discriminatorMappingRef = (value: string): string =>
  value.startsWith('#') || value.includes('/')
    ? value
    : `#/components/schemas/${value}`;

interface BuildResult {
  statements: string[];
  /**
   * Refs whose expansion re-entered themselves. Propagated up so the schema
   * that closes a cycle can drop its statements entirely — see buildStatements.
   */
  cyclicRefs: Set<string>;
}

const emptyResult = (): BuildResult => ({
  statements: [],
  cyclicRefs: new Set(),
});

const mergeResults = (results: BuildResult[]): BuildResult => ({
  statements: results.flatMap((result) => result.statements),
  cyclicRefs: new Set(results.flatMap((result) => [...result.cyclicRefs])),
});

interface BuildParams {
  schema: SchemaOrRef;
  /** Expression the statements read from, e.g. `data.log` */
  accessor: string;
  context: ContextSpec;
  visitedRefs: Set<string>;
  depth: number;
  /** Assignment target when it differs from `accessor` (readOnly properties). */
  writeAccessor?: string;
  mode: DateTransformMode;
  /**
   * True when an ancestor's `allOf` composition already declares
   * `properties` somewhere in it, so this schema's own `additionalProperties`
   * (if it has one) must not be walked as a map even though, examined in
   * isolation, it looks like a plain map — see the sibling-`allOf` note on
   * `mapValueSchema`. Set when recursing into an `allOf` branch, and also
   * when recursing into a discriminated-union variant: unlike `items`, map
   * values and object properties (which do start a fresh object level and
   * leave this unset), a variant is resolved against the very same accessor
   * as the `switch` itself — that level is guaranteed at runtime to carry
   * the discriminator property, so a variant that is a bare map is exactly
   * as unsafe to walk with a blind `Object.keys` loop as an `allOf` branch
   * sitting beside a properties-declaring sibling is.
   */
  mapSuppressed?: boolean;
}

const buildStatements = ({
  schema: schemaOrRef,
  accessor,
  context,
  visitedRefs,
  depth,
  writeAccessor,
  mode,
  mapSuppressed,
}: BuildParams): BuildResult => {
  const { schema, ref } = normalizeSchema(schemaOrRef, context);
  if (ref) {
    if (visitedRefs.has(ref)) {
      return { statements: [], cyclicRefs: new Set([ref]) };
    }
    visitedRefs.add(ref);
  }

  // `finally` (rather than a delete on the success path) keeps the shared
  // visitedRefs set consistent even when a nested resolution throws — a
  // leaked entry would make a later, non-cyclic branch look cyclic and
  // silently drop its conversions.
  try {
    return buildResolvedStatements({
      schema,
      ref,
      accessor,
      context,
      visitedRefs,
      depth,
      writeAccessor,
      mode,
      mapSuppressed,
    });
  } finally {
    if (ref) visitedRefs.delete(ref);
  }
};

const buildResolvedStatements = ({
  schema,
  ref,
  accessor,
  context,
  visitedRefs,
  depth,
  writeAccessor,
  mode,
  mapSuppressed,
}: {
  schema: OpenApiSchemaObject;
  ref?: string;
  accessor: string;
  context: ContextSpec;
  visitedRefs: Set<string>;
  depth: number;
  writeAccessor?: string;
  mode: DateTransformMode;
  mapSuppressed?: boolean;
}): BuildResult => {
  if (isBooleanJsonSchema(schema)) return emptyResult();

  let result: BuildResult;
  // An ancestor allOf branch declaring `properties` makes a map loop unsafe
  // at every branch of the composition, including one — like this schema —
  // that has no properties/allOf of its own to show that on its own account
  // (the "idiomatic spelling" bypass: `allOf: [Base, { additionalProperties }]`,
  // where Base is a *sibling* array element, invisible to `mapValueSchema`
  // when it only looks at the schema it's given). Recomputing it here (rather
  // than only trusting the inherited flag) also makes this schema's own
  // `allOf` branches (nested one level deeper) covered without relying on
  // `mapValueSchema`'s own narrower check.
  const mapSuppressedHere =
    mapSuppressed || declaresProperties(schema, context);
  const mapValue = mapSuppressedHere
    ? undefined
    : mapValueSchema(schema, context);

  if (mode.isLeaf(schema)) {
    result = {
      statements: [mode.leafStatement(accessor, writeAccessor ?? accessor)],
      cyclicRefs: new Set(),
    };
  } else if (
    isArrayShaped(schema, context) &&
    ((mode.dropArrayObjectConflict && needsObjectCopy(schema, context)) ||
      mapValue != null)
  ) {
    // An array-shaped schema (`items`, directly or through `allOf`) that is
    // also object-shaped cannot be walked as both, so it emits nothing:
    // - with `properties`, only the request direction drops it — its copy
    //   would spread the value as an object and then reassign it via `.map()`
    //   (a runtime TypeError, or a `const` reassignment at the body root),
    //   whereas the response walk's in-place loops merely coexist;
    // - with a map-valued `additionalProperties`, both directions drop it —
    //   an index-based loop and a key-based loop over the same value cannot
    //   be combined, and the request copy would turn the array into a plain
    //   object at runtime.
    // `needsObjectCopy` is coarse on purpose (see its own docstring), so an
    // array-shaped schema carrying a sibling `oneOf`/`anyOf`/`discriminator`
    // that itself ends up emitting nothing still trips this drop in the
    // request direction — an exotic spelling, and no worse than the
    // pre-existing `schema.discriminator` arm already being just as coarse.
    result = emptyResult();
  } else {
    // allOf, items and properties are siblings in JSON Schema, not
    // mutually-exclusive branches — a schema can combine `allOf` with its
    // own `properties` (or, less commonly, `items`), and every one of them
    // must contribute its date statements.
    const allOfResults = (schema.allOf ?? []).map((branch: SchemaOrRef) =>
      buildStatements({
        schema: branch,
        accessor,
        context,
        visitedRefs,
        depth,
        writeAccessor,
        mode,
        mapSuppressed: mapSuppressedHere,
      }),
    );

    const unionResult = buildUnionStatements({
      schema,
      accessor,
      context,
      visitedRefs,
      depth,
      mode,
    });

    const itemsResult = schema.items
      ? mode.arrayStatements({
          items: schema.items,
          accessor,
          context,
          visitedRefs,
          depth,
          mode,
        })
      : emptyResult();

    const mapResult = mapValue
      ? mode.mapStatements({
          values: mapValue,
          accessor,
          context,
          visitedRefs,
          depth,
          mode,
        })
      : emptyResult();

    const propertiesResult = schema.properties
      ? buildPropertiesStatements({
          properties: schema.properties,
          required: schema.required,
          accessor,
          context,
          visitedRefs,
          depth,
          mode,
        })
      : emptyResult();

    result = mergeResults([
      ...allOfResults,
      unionResult,
      itemsResult,
      mapResult,
      propertiesResult,
    ]);
  }

  if (ref) {
    if (result.cyclicRefs.has(ref)) {
      // Recursive schema. Converting only the levels reached before the cycle
      // closes would leave deeper dates as strings while the generated types
      // claim `Date`, so emit nothing for the whole subtree instead. Sibling
      // (non-recursive) fields are unaffected.
      const cyclicRefs = new Set(result.cyclicRefs);
      cyclicRefs.delete(ref);
      result = { statements: [], cyclicRefs };
    }
  }

  return result;
};

/**
 * True when the subtree assigns to the accessor itself (a date, possibly
 * wrapped in `allOf` or a nullable union) rather than into its properties or
 * elements.
 *
 * Callers: the response direction's in-place array and map builders, where
 * such elements must be written back through the array or map slot (a
 * hoisted `const` would make the generated assignment reassign a const); and
 * the shared property builder (both directions), where it distinguishes a
 * required date leaf (unguarded — a response's `new Date(undefined)` degrades
 * to `Invalid Date` rather than throwing, and a request's
 * `x instanceof Date ? … : x` already tolerates `undefined`) from a required
 * container (object copy or shallow mutation, array `.map` or in-place loop,
 * map copy or key loop, or union dispatch), which must be null-guarded in
 * both directions so an omitted container isn't turned into `{}`, thrown on,
 * or dereferenced before the caller can handle it. Every use asks the same
 * question — "does this write straight to the accessor, or into something
 * reached through it?" — regardless of which formats a given direction
 * converts, so it checks `isDateSchema` directly rather than taking a `mode`
 * parameter.
 */
const writesToAccessorItself = (
  schemaOrRef: SchemaOrRef,
  context: ContextSpec,
  seenRefs: Set<string> = new Set(),
): boolean => {
  const { schema, ref } = normalizeSchema(schemaOrRef, context);
  if (ref) {
    if (seenRefs.has(ref)) return false;
    seenRefs.add(ref);
  }
  if (isDateSchema(schema)) return true;
  return (schema.allOf ?? []).some((branch: SchemaOrRef) =>
    writesToAccessorItself(branch, context, seenRefs),
  );
};

/**
 * Responses and requests walk the same schema: ref resolution, cycle guards,
 * `allOf` merging, property iteration and discriminated-union dispatch are
 * identical in both directions. They differ in which formats convert, what a
 * leaf converts to, and how containers are traversed — a response mutates the
 * payload it just parsed, a request must copy what it touches because the
 * object belongs to the caller.
 */
interface DateTransformMode {
  /** Schemas this direction converts. */
  isLeaf: (schema: OpenApiSchemaObject) => boolean;
  /** Conversion statement. `write` differs from `read` only for readOnly props. */
  leafStatement: (read: string, write: string) => string;
  /**
   * Statements emitted once per property whose subtree produced statements,
   * immediately before those statements. Never invoked for the root
   * accessor (the caller's own copy is handled outside this walk), for
   * array elements (handled by `arrayStatements`), or for discriminated-
   * union variants (covered by the parent property's own prelude).
   */
  objectPrelude: (
    accessor: string,
    schema: SchemaOrRef,
    context: ContextSpec,
  ) => string[];
  /** Traversal of an array container. */
  arrayStatements: (params: ArrayStatementsParams) => BuildResult;
  /** Traversal of an `additionalProperties` map container. */
  mapStatements: (params: MapStatementsParams) => BuildResult;
  /** Assignment target for a property when it differs from the read accessor. */
  propertyWriteAccessor: (
    accessor: string,
    key: string,
    propertySchema: OpenApiSchemaObject,
  ) => string | undefined;
  /**
   * Properties this direction must not touch. The two directions disagree on
   * purpose: a response is the server's own payload, so a `readOnly`
   * property is exactly the kind of field it must convert (through its
   * mutable cast); a request body is written by the client, and OpenAPI
   * `readOnly` means the field is server-populated and response-only, so
   * writing it into a request is semantically wrong, not merely untypeable.
   */
  skipProperty: (schema: OpenApiSchemaObject) => boolean;
  /**
   * When true, a schema that is both array-shaped (`items`) and
   * object-shaped (own `properties`, a discriminator, or an `allOf` branch
   * that is either) emits no statements at all, rather than combining an
   * array walk with an object walk. The response direction can freely
   * combine the two — `items` becomes a for-loop over the array in place and
   * `properties` becomes plain field writes, and neither touches the
   * other's code. The request direction cannot: it reassigns the container
   * itself to build the transformed array (`copy = copy.map(...)`), which
   * cannot also be the object the object branch shallow-copies and writes
   * into. Emitting both breaks compilation at the root (`copy` is declared
   * `const`) and crashes at runtime when nested under a property (an array
   * spread into `{ ...copy.x }`, then `.map` called on the result). Emitting
   * nothing instead follows the same rule already applied to recursive
   * schemas: emit nothing rather than wrong code.
   */
  dropArrayObjectConflict: boolean;
}

interface ArrayStatementsParams {
  items: SchemaOrRef;
  accessor: string;
  context: ContextSpec;
  visitedRefs: Set<string>;
  depth: number;
  mode: DateTransformMode;
}

interface MapStatementsParams {
  /** The `additionalProperties` value schema. */
  values: SchemaOrRef;
  accessor: string;
  context: ContextSpec;
  visitedRefs: Set<string>;
  depth: number;
  mode: DateTransformMode;
}

const buildInPlaceItemsStatements = ({
  items,
  accessor,
  context,
  visitedRefs,
  depth,
  mode,
}: ArrayStatementsParams): BuildResult => {
  const index = `i${depth}`;
  const { nullable } = normalizeSchema(items, context);
  const loopHeader = `for (let ${index} = 0; ${index} < ${accessor}.length; ${index}++) {`;

  if (writesToAccessorItself(items, context)) {
    const element = `${accessor}[${index}]`;
    const inner = buildStatements({
      schema: items,
      accessor: element,
      context,
      visitedRefs,
      depth: depth + 1,
      mode,
    });
    if (inner.statements.length === 0) return inner;

    const body = nullable
      ? [`if (${element} != null) {`, ...indent(inner.statements), '}']
      : inner.statements;

    return {
      statements: [loopHeader, ...indent(body), '}'],
      cyclicRefs: inner.cyclicRefs,
    };
  }

  // Object/array elements are hoisted into a const: TypeScript does not
  // carry `!= null` narrowing across statements for variable-indexed
  // accesses (`data[i0].at`), but does for a hoisted local. Mutating the
  // local's properties mutates the same object, so in-place semantics
  // are unchanged.
  const item = `item${depth}`;
  const inner = buildStatements({
    schema: items,
    accessor: item,
    context,
    visitedRefs,
    depth: depth + 1,
    mode,
  });
  if (inner.statements.length === 0) return inner;

  const body = nullable
    ? [`if (${item} != null) {`, ...indent(inner.statements), '}']
    : inner.statements;

  return {
    statements: [
      loopHeader,
      `  const ${item} = ${accessor}[${index}];`,
      ...indent(body),
      '}',
    ],
    cyclicRefs: inner.cyclicRefs,
  };
};

/**
 * The response direction's map traversal: an in-place `for...of` loop over
 * `Object.keys(accessor)`, mirroring `buildInPlaceItemsStatements` with a
 * key lookup in place of an index. A value that writes to the accessor
 * itself (a date leaf, or an `allOf`-wrapped one) is written back through
 * the key slot directly; anything else is hoisted into a `const` so
 * `!= null` narrowing survives, exactly as the array builder hoists an
 * object element.
 */
const buildInPlaceMapStatements = ({
  values,
  accessor,
  context,
  visitedRefs,
  depth,
  mode,
}: MapStatementsParams): BuildResult => {
  const key = `key${depth}`;
  const { nullable } = normalizeSchema(values, context);
  const loopHeader = `for (const ${key} of Object.keys(${accessor})) {`;

  if (writesToAccessorItself(values, context)) {
    const element = `${accessor}[${key}]`;
    const inner = buildStatements({
      schema: values,
      accessor: element,
      context,
      visitedRefs,
      depth: depth + 1,
      mode,
    });
    if (inner.statements.length === 0) return inner;

    const body = nullable
      ? [`if (${element} != null) {`, ...indent(inner.statements), '}']
      : inner.statements;

    return {
      statements: [loopHeader, ...indent(body), '}'],
      cyclicRefs: inner.cyclicRefs,
    };
  }

  const item = `item${depth}`;
  const inner = buildStatements({
    schema: values,
    accessor: item,
    context,
    visitedRefs,
    depth: depth + 1,
    mode,
  });
  if (inner.statements.length === 0) return inner;

  const body = nullable
    ? [`if (${item} != null) {`, ...indent(inner.statements), '}']
    : inner.statements;

  return {
    statements: [
      loopHeader,
      `  const ${item} = ${accessor}[${key}];`,
      ...indent(body),
      '}',
    ],
    cyclicRefs: inner.cyclicRefs,
  };
};

const responseMode: DateTransformMode = {
  isLeaf: isDateSchema,
  leafStatement: (read, write) => `${write} = new Date(${read});`,
  objectPrelude: () => [],
  arrayStatements: buildInPlaceItemsStatements,
  mapStatements: buildInPlaceMapStatements,
  propertyWriteAccessor: (accessor, key, propertySchema) =>
    !isBooleanJsonSchema(propertySchema) && propertySchema.readOnly
      ? propertyAccessor(mutableCast(accessor), key)
      : undefined,
  skipProperty: () => false,
  dropArrayObjectConflict: false,
};

const buildPropertiesStatements = ({
  properties,
  required,
  accessor,
  context,
  visitedRefs,
  depth,
  mode,
  presenceGuarded,
}: {
  properties: Record<string, SchemaOrRef>;
  required: string[] | undefined;
  accessor: string;
  context: ContextSpec;
  visitedRefs: Set<string>;
  depth: number;
  mode: DateTransformMode;
  /**
   * Set when the accessor is typed as a whole undiscriminated union, so each
   * property must first narrow it with `'key' in accessor` (see the guard
   * below).
   */
  presenceGuarded?: boolean;
}): BuildResult => {
  const requiredSet = new Set(required ?? []);
  return mergeResults(
    Object.entries(properties).map(([key, property]) => {
      const target = propertyAccessor(accessor, key);
      const { schema: propertySchema, nullable } = normalizeSchema(
        property,
        context,
      );
      if (mode.skipProperty(propertySchema)) return emptyResult();

      const inner = buildStatements({
        schema: property,
        accessor: target,
        context,
        visitedRefs,
        depth,
        writeAccessor: mode.propertyWriteAccessor(
          accessor,
          key,
          propertySchema,
        ),
        mode,
      });
      if (inner.statements.length === 0) return inner;

      const statements = [
        ...mode.objectPrelude(target, property, context),
        ...inner.statements,
      ];

      // Under an undiscriminated union the accessor's type is the whole
      // union, so a property only some variants declare cannot be read
      // without narrowing first. `'key' in accessor` is what narrows it,
      // and it is needed even for a required, non-nullable leaf — required
      // in one variant says nothing about the others.
      const needsGuard =
        presenceGuarded ||
        !requiredSet.has(key) ||
        nullable ||
        !writesToAccessorItself(property, context);
      if (!needsGuard) return { ...inner, statements };

      const condition = presenceGuarded
        ? `${JSON.stringify(key)} in ${accessor} && ${target} != null`
        : `${target} != null`;

      return {
        statements: [`if (${condition}) {`, ...indent(statements), '}'],
        cyclicRefs: inner.cyclicRefs,
      };
    }),
  );
};

/**
 * Emits a `switch` on the discriminator property for a `oneOf`/`anyOf` that
 * carries an OpenAPI `discriminator` with an explicit `mapping`.
 */
const buildMappedUnionStatements = ({
  schema,
  accessor,
  context,
  visitedRefs,
  depth,
  mode,
}: {
  schema: OpenApiSchemaObject;
  accessor: string;
  context: ContextSpec;
  visitedRefs: Set<string>;
  depth: number;
  mode: DateTransformMode;
}): BuildResult => {
  if (isBooleanJsonSchema(schema)) return emptyResult();

  const variants = schema.oneOf ?? schema.anyOf;
  const discriminator = schema.discriminator as
    | { propertyName?: unknown; mapping?: Record<string, unknown> }
    | undefined;
  const propertyName = discriminator?.propertyName;
  const mapping = discriminator?.mapping;
  if (
    !variants ||
    typeof propertyName !== 'string' ||
    !mapping ||
    typeof mapping !== 'object'
  ) {
    return emptyResult();
  }

  const caseResults = Object.entries(mapping).map(
    ([value, target]): BuildResult => {
      let inner: BuildResult;
      try {
        inner = buildStatements({
          schema: {
            $ref: discriminatorMappingRef(target as string),
          } as OpenApiReferenceObject,
          accessor,
          context,
          visitedRefs,
          depth,
          mode,
          // A variant is resolved against the SAME accessor as the switch
          // itself, not a fresh one — that accessor is guaranteed at runtime
          // to carry the discriminator property, exactly like an `allOf`
          // branch shares its parent's accessor. A variant that is a bare
          // map (`additionalProperties`, no `properties` of its own) must
          // not get a blind `Object.keys` loop over that level: it would
          // revisit, and on the response side overwrite, the discriminator
          // key the switch just read.
          mapSuppressed: true,
        });
      } catch {
        // An unresolvable mapping target must not abort generation of the
        // whole spec; skip the case and leave that variant unconverted.
        return emptyResult();
      }
      if (inner.statements.length === 0) return inner;

      return {
        statements: [
          `case ${JSON.stringify(value)}: {`,
          ...indent(inner.statements),
          '  break;',
          '}',
        ],
        cyclicRefs: inner.cyclicRefs,
      };
    },
  );

  const merged = mergeResults(caseResults);
  if (merged.statements.length === 0) return merged;

  return {
    statements: [
      `switch (${propertyAccessor(accessor, propertyName)}) {`,
      ...indent(merged.statements),
      '}',
    ],
    cyclicRefs: merged.cyclicRefs,
  };
};

/**
 * A union's variant must declare its own `properties` for the structural
 * walk: it reads properties off the union accessor, which an array or
 * scalar variant has none of, and an `allOf` variant's inherited properties
 * are never merged into `.properties` by the key-collection step below. An
 * `allOf` variant admitted here would therefore be silently under-converted:
 * its inherited properties contribute no keys at all, so a plain string
 * re-declared at this level could get converted while a real nested date is
 * never reached. Requiring own `properties` disqualifies the whole union
 * instead, which is exactly today's (pre-structural-walk) behaviour for a
 * union with an `allOf` variant, so this is not a regression.
 *
 * `items` (or `type: 'array'`) is checked first and disqualifies the variant
 * outright, even when it also declares `properties`: `needsObjectCopy`
 * treats any union as needing a shallow-object copy, and a hybrid
 * array-and-object variant spread as `{ ...value }` in the request direction
 * would silently drop its array-ness at runtime.
 *
 * A `type: 'null'` variant does reach here — whenever the union has more
 * than one non-null variant, `normalizeSchema` does not collapse it (that
 * collapse only applies to the single-non-null-variant `T | null` spelling)
 * — and it's correctly rejected too, since a null schema declares no
 * properties of its own.
 */
const isObjectVariant = (schema: OpenApiSchemaObject): boolean => {
  if (schema.items || schema.type === 'array') return false;
  return hasOwnProperties(schema);
};

/**
 * How a variant was judged *before* any variant of the union was walked.
 * Only a `walkable` variant is resolvable and not already being expanded by
 * an ancestor; `objectShaped` says whether it also qualifies the union for
 * the structural walk, and a variant that fails it is still walked (for what
 * it can teach about cycles) while disqualifying the union's statements.
 */
type ClassifiedVariant =
  | {
      kind: 'walkable';
      schema: OpenApiSchemaObject;
      ref?: string;
      objectShaped: boolean;
    }
  | { kind: 'unresolvable' }
  | { kind: 'cyclic'; ref: string };

/**
 * Judges one variant without walking it.
 *
 * Asking `visitedRefs` here, before the walk, reads the same answer the walk
 * would: no variant's ref is registered during classification, and the walk
 * registers a variant's ref only for the duration of that one variant
 * (released in a `finally` before the next), so no variant can hide a
 * sibling's ref from another.
 */
const classifyUnionVariant = (
  variant: SchemaOrRef,
  context: ContextSpec,
  visitedRefs: Set<string>,
): ClassifiedVariant => {
  let variantSchema: OpenApiSchemaObject;
  let ref: string | undefined;
  try {
    ({ schema: variantSchema, ref } = normalizeSchema(variant, context));
  } catch {
    // An unresolvable $ref target: not a cycle, just a broken variant.
    return { kind: 'unresolvable' };
  }

  if (ref && visitedRefs.has(ref)) return { kind: 'cyclic', ref };

  return {
    kind: 'walkable',
    schema: variantSchema,
    ref,
    objectShaped: isObjectVariant(variantSchema),
  };
};

/**
 * Walks a variant for the sole purpose of learning which refs it sees close
 * a cycle, and throws its statements away.
 *
 * The structural walk reads a variant's `properties` and nothing else, so a
 * cycle reachable only through the parts it ignores — most concretely a
 * disqualifying variant's `items` — is invisible to it, while the
 * discriminated spelling of the same schema, which resolves every variant
 * through `buildStatements`, finds it and drops the whole subtree. Running
 * that very call (with the same `mapSuppressed: true` the mapped path
 * passes, so the two also agree about a bare-map variant, whose values
 * neither of them walks) and keeping only its `cyclicRefs` leaves "is this
 * schema recursive?" answered identically in both spellings, whatever each
 * then chooses to convert.
 *
 * ## Two callers, with different stakes
 *
 * The first caller is a union that is *already disqualified* and so emits no
 * statements of its own. There, nothing learned can change what that union
 * converts — it converts nothing either way — and the refs only travel
 * upwards, where at most they make a recursive ancestor drop its subtree,
 * which is this file's standing rule.
 *
 * The second caller is an *admitted* variant of a *qualified* union, walked
 * for the branches the per-property walk never reads (`hasUnwalkedBranches`:
 * an `allOf`, or a nested union beside the variant's own `properties`).
 * There what is learned very much does change what converts: the returned
 * refs become that variant's `branchRefs`, and `branchRefs.has(variantRef)`
 * is half of the variant's own cycle-closing check — a hit wipes every
 * statement the variant contributed. The statements this function throws
 * away are still never emitted; it is the *refs* that carry weight on that
 * path.
 *
 * A throw — an unresolvable `$ref` nested somewhere inside the variant —
 * yields an empty set, so the caller proceeds as if the walk found no cycle.
 * `buildStatements` restores `visitedRefs` through its own `finally` before
 * the throw gets here, so the caller's bookkeeping is intact either way.
 * That choice matches how the rest of the file treats a broken corner of a
 * spec — `buildMappedUnionStatements` around a mapping target,
 * `classifyUnionVariant` around a variant's own `$ref` — rather than turning
 * it into a failed generation of the whole document. It is not free on the
 * second caller: a cycle reachable only *past* the unresolvable ref goes
 * unreported, and the variant keeps converting its own properties. It is the
 * same trade the other two catches already make, over a spec that cannot be
 * resolved as written.
 */
const discoverVariantCycles = ({
  variant,
  accessor,
  context,
  visitedRefs,
  depth,
  mode,
}: {
  variant: SchemaOrRef;
  accessor: string;
  context: ContextSpec;
  visitedRefs: Set<string>;
  depth: number;
  mode: DateTransformMode;
}): Set<string> => {
  try {
    return buildStatements({
      schema: variant,
      accessor,
      context,
      visitedRefs,
      depth,
      mode,
      mapSuppressed: true,
    }).cyclicRefs;
  } catch {
    return new Set<string>();
  }
};

/**
 * True when an admitted variant carries branches the per-property walk does
 * not read, and which therefore have to be walked separately for what they
 * can say about cycles: an `allOf`, or a `oneOf`/`anyOf` sitting beside the
 * variant's own `properties`.
 *
 * Two shapes are deliberately absent. `items` never reaches here — it
 * disqualifies the variant outright, and a disqualified union already takes
 * the statement-free walk. And `additionalProperties` beside `properties` is
 * suppressed for *every* path in this file by Rule 1 (`mapValueSchema`
 * returns nothing for a properties-declaring schema), the mapped spelling
 * included: a cycle hiding under such a map is invisible to both spellings,
 * which agree by converting the variant's declared properties and leaving
 * the map's values alone, cycle or no cycle. Walking it here would make this
 * spelling alone drop the schema — a disagreement where there is currently
 * none, over a branch neither spelling ever converts.
 */
const hasUnwalkedBranches = (schema: OpenApiSchemaObject): boolean =>
  (schema.allOf ?? []).length > 0 ||
  schema.oneOf != null ||
  schema.anyOf != null;

/**
 * Walks a union that carries no usable `discriminator.mapping` by property
 * presence instead of by discriminator value.
 *
 * For each property name any variant declares, the shared property builder
 * runs once per variant declaring it, against the same accessor, and the
 * resulting statements are compared. Identical statements mean the variants
 * agree on what that property is, so one block is emitted, guarded by
 * `'key' in accessor` — which is also what lets TypeScript narrow the union
 * so the generated assignment type-checks. Statements that differ mean the
 * variants disagree (a scalar against an array, an object against a string,
 * or any nested divergence that changes what gets emitted), and that
 * property is skipped while the rest of the union still converts. Comparing
 * generated statements rather than schemas makes the check semantic: two
 * spellings of the same shape agree, and no schema comparator has to exist.
 *
 * ## Two passes, and why they cannot be one
 *
 * Every variant is classified before any variant is walked, and then every
 * classification that *can* be walked is walked — including the ones that
 * already disqualified the union. Only afterwards is it decided whether the
 * collected statements are emitted at all.
 *
 * Deciding and walking in a single interleaved pass would make the union's
 * answer depend on the order the spec happens to list its variants in: a
 * disqualifying variant (unresolvable, not object-shaped, or one an ancestor
 * is already expanding) would abandon the loop, so a cycle reachable only
 * through a *later* variant would never be discovered, and an ancestor
 * holding the cyclic ref would convert its own levels while everything under
 * the union silently stayed a string. The discriminated spelling of that same
 * schema walks every mapping target regardless, finds the cycle and drops the
 * whole subtree — so the two spellings would disagree on whether a schema is
 * safe to convert. Splitting classification from walking is what makes the
 * two passes independent of variant order.
 *
 * ## What each variant contributes
 *
 * Three classifications disqualify the union's *statements* — an
 * unresolvable `$ref` target (the whole spec's generation must not abort
 * over one bad variant, mirroring `buildMappedUnionStatements`'s own
 * try/catch around a mapping target), a variant that is not object-shaped,
 * and a variant whose ref an ancestor is already expanding. None of the
 * three excuses discarding what the *other* variants learned: every
 * `cyclicRefs` collected by any variant is merged into the union's result
 * whatever becomes of its statements, because a cycle is no less real for
 * having been found beside a variant that disqualified the union.
 *
 * A ref that is already registered when a variant is classified can only be
 * an ancestor cycle (this same union nested inside a schema one of its own
 * variants refers back to, directly or transitively) — a *sibling* variant's
 * ref (`anyOf: [Cat, Dog]` where `Cat.pal: { $ref: Dog }`) is never
 * registered while a different variant is being walked, so referring to a
 * sibling is ordinary, not cyclic. It is reported the way every other
 * recursive shape in this file reports one, `cyclicRefs: new Set([ref])`,
 * and that ref is *added* to what propagates rather than consumed here: the
 * ancestor that registered it is the one that closes the cycle and drops its
 * subtree.
 *
 * A cycle can also surface without ever hitting that check — not at a
 * variant's own ref, but deeper inside one of its properties (a variant
 * referring to a *different* schema that itself, transitively, refers back
 * to an ancestor, or back to this same variant through another path). Two
 * things make that case work, mirroring what
 * `buildStatements`/`buildResolvedStatements` already do for every non-union
 * shape:
 *
 * - Every declaring variant's `cyclicRefs` for a key are always merged into
 *   that key's result, even when the property contributes no statements or
 *   the variants disagree — dropping them there would silently swallow a
 *   cycle detected below a variant rather than at its own ref, leaving an
 *   ancestor with no way to learn its own subtree needs to close.
 * - After a variant's own properties are all walked, if its *own* ref shows
 *   back up among the `cyclicRefs` they collected, the cycle closes right
 *   here — the same `if (result.cyclicRefs.has(ref))` check
 *   `buildResolvedStatements` runs for every ref-reached schema, just run by
 *   hand here since a union manages its variants' ref bookkeeping itself
 *   rather than going through `buildStatements`. That variant's contribution
 *   is wiped (its subtree is exactly as internally inconsistent as any other
 *   recursive schema reaching this point) and its own ref is removed from
 *   what propagates further, while any other refs survive.
 */
const buildUndiscriminatedUnionStatements = ({
  schema,
  accessor,
  context,
  visitedRefs,
  depth,
  mode,
}: {
  schema: OpenApiSchemaObject;
  accessor: string;
  context: ContextSpec;
  visitedRefs: Set<string>;
  depth: number;
  mode: DateTransformMode;
}): BuildResult => {
  const variants = schema.oneOf ?? schema.anyOf;
  if (!variants || variants.length === 0) return emptyResult();

  // Pass 1: judge every variant, walk none of them.
  const classified = variants.map((variant: SchemaOrRef) =>
    classifyUnionVariant(variant, context, visitedRefs),
  );

  const disqualified = classified.some(
    (variant: ClassifiedVariant) =>
      variant.kind !== 'walkable' || !variant.objectShaped,
  );

  // Pass 2: walk everything that can be walked, disqualified or not — a
  // variant that cannot contribute statements can still be the only place a
  // cycle is visible from, and that is exactly what the ancestor above needs
  // to hear about. A disqualified union walks its variants only for that:
  // it emits nothing either way, so it takes the wider, statement-free walk
  // (`discoverVariantCycles`) instead of the property-by-property one.
  const perVariant: {
    schema: OpenApiSchemaObject;
    perKey: Map<string, BuildResult>;
    /** Refs seen only in branches this walk reads for cycles, never converts. */
    branchRefs: Set<string>;
  }[] = [];
  const discoveredRefs = new Set<string>();

  for (const [index, variant] of classified.entries()) {
    if (variant.kind !== 'walkable') continue;

    if (disqualified) {
      for (const cyclicRef of discoverVariantCycles({
        variant: variants[index],
        accessor,
        context,
        visitedRefs,
        depth,
        mode,
      })) {
        discoveredRefs.add(cyclicRef);
      }
      continue;
    }

    const { schema: variantSchema, ref } = variant;

    if (ref) visitedRefs.add(ref);
    try {
      const perKey = new Map<string, BuildResult>();
      for (const key of Object.keys(variantSchema.properties ?? {})) {
        perKey.set(
          key,
          buildPropertiesStatements({
            properties: { [key]: (variantSchema.properties ?? {})[key] },
            required: variantSchema.required,
            accessor,
            context,
            visitedRefs,
            depth,
            mode,
            presenceGuarded: true,
          }),
        );
      }
      // The walk above reads `variantSchema.properties` and nothing else, so
      // a cycle reachable only through an `allOf` branch or a nested union
      // beside them is invisible to it, while the mapped spelling of the
      // same schema walks those branches, finds the cycle and drops the
      // subtree. Walk them the way the mapped path walks a mapping target
      // and keep only the refs: detect without converting. No statement
      // from those branches is emitted, so nothing new converts and the
      // ruling that an `allOf` variant's properties are not merged stands —
      // the union simply stops converting when a cycle is reachable through
      // a branch it is not allowed to convert, and keeps converting its own
      // properties when there is none.
      let branchRefs = hasUnwalkedBranches(variantSchema)
        ? discoverVariantCycles({
            variant: variantSchema,
            accessor,
            context,
            visitedRefs,
            depth,
            mode,
          })
        : new Set<string>();

      // Mirror buildResolvedStatements's own cycle-closing check
      // (`if (result.cyclicRefs.has(ref))`), by hand, per variant: if this
      // variant's own ref shows back up among the cyclicRefs its own
      // properties or its unwalked branches collected — directly, or
      // transitively through some other schema that refers back to it — the
      // cycle closes exactly here. The variant is as internally
      // inconsistent as any other recursive schema reaching this point, so
      // it contributes nothing, and its own ref is consumed rather than
      // propagated further (other refs, if any, are left untouched).
      if (ref) {
        const variantRef = ref;
        const closesHere =
          branchRefs.has(variantRef) ||
          [...perKey.values()].some((result) =>
            result.cyclicRefs.has(variantRef),
          );
        if (closesHere) {
          for (const [key, result] of perKey) {
            const cyclicRefs = new Set(result.cyclicRefs);
            cyclicRefs.delete(variantRef);
            perKey.set(key, { statements: [], cyclicRefs });
          }
          branchRefs = new Set(branchRefs);
          branchRefs.delete(variantRef);
        }
      }

      perVariant.push({ schema: variantSchema, perKey, branchRefs });
    } finally {
      // Release this variant's ref before moving on to the next one, so a
      // sibling variant's own (unrelated) reference to it is never mistaken
      // for a cycle.
      if (ref) visitedRefs.delete(ref);
    }
  }

  // Everything the two passes learned about cycles, whatever becomes of the
  // statements below: the refs an ancestor is already expanding (added to,
  // never consumed here — the ancestor that registered one is the one that
  // closes it), every ref a disqualified union's statement-free walk
  // uncovered, and, for each walked variant, every ref that survived its
  // cycle-closing check — from its properties and from the branches read
  // for cycles alone.
  const learned: BuildResult = {
    statements: [],
    cyclicRefs: new Set<string>([
      ...classified.flatMap((variant: ClassifiedVariant) =>
        variant.kind === 'cyclic' ? [variant.ref] : [],
      ),
      ...discoveredRefs,
      ...perVariant.flatMap(({ perKey, branchRefs }) => [
        ...branchRefs,
        ...[...perKey.values()].flatMap((result) => [...result.cyclicRefs]),
      ]),
    ]),
  };

  if (disqualified) return learned;

  // Property order follows the spec's own declaration order: each variant's
  // own properties, in the order the variants themselves appear in the
  // `oneOf`/`anyOf` array.
  //
  // A property named after an `Object.prototype` member (`constructor`,
  // `toString`, `valueOf`, `hasOwnProperty`, `__proto__`, …) is dropped
  // outright. The emitted guard has to be `'key' in accessor` — that is the
  // only form TypeScript narrows the union by, and `Object.hasOwn`, which
  // would answer correctly at runtime, narrows nothing — but `in` walks the
  // prototype chain, so `'constructor' in payload` is true for every object
  // alive. Emitting a block for such a key would run the conversion on a
  // payload of a variant that never declared it and overwrite the inherited
  // member with `Invalid Date`. There is no guard that both narrows and
  // tells the truth here, so the union converts nothing for that name and
  // every other property still converts.
  const keys: string[] = [];
  for (const { schema: variantSchema } of perVariant) {
    for (const key of Object.keys(variantSchema.properties ?? {})) {
      if (Object.hasOwn(Object.prototype, key)) continue;
      if (!keys.includes(key)) keys.push(key);
    }
  }

  const results = keys.map((key): BuildResult => {
    // Which variants declared this key is read from `perKey` itself, never
    // re-derived from `variantSchema.properties[key]`: that lookup walks the
    // prototype chain, so for an `Object.prototype`-named key a variant that
    // never declared it would answer as though it had, and `perKey` — keyed
    // by `Object.keys`, own keys only — would then hand back `undefined`.
    // One source of truth, and no unsound non-null assertion.
    const declaringResults = perVariant.flatMap(({ perKey }) => {
      const result = perKey.get(key);
      return result ? [result] : [];
    });

    // Every declaring variant's cyclicRefs propagate regardless of whether
    // this property ends up converting: a cycle detected below a variant's
    // own ref (rather than at it) must still reach whatever ancestor is
    // holding that ref, even when this property contributes no statements
    // or the variants disagree on it.
    const cyclicRefs = new Set(
      declaringResults.flatMap((result) => [...result.cyclicRefs]),
    );

    const [first, ...rest] = declaringResults;
    if (!first || first.statements.length === 0) {
      return { statements: [], cyclicRefs };
    }
    const agreed = rest.every(
      (result: BuildResult) =>
        result.statements.join('\n') === first.statements.join('\n'),
    );
    return { statements: agreed ? first.statements : [], cyclicRefs };
  });

  // `learned` is required on this exit, not merely symmetrical with the
  // disqualified one. `results` is built from `perKey` alone, so the refs a
  // variant's unwalked branches uncovered (`branchRefs`) reach the caller
  // through `learned` and through nothing else — as do the refs of a key
  // dropped above for being named after an `Object.prototype` member.
  // Returning `results` by itself would hide a recursive schema from the
  // ancestor holding its ref, which would then convert its own levels while
  // this subtree stayed a string: exactly the partial conversion the
  // two-pass walk exists to prevent.
  return mergeResults([learned, ...results]);
};

/**
 * Emits the statements for a `oneOf`/`anyOf`. With an explicit
 * `discriminator.mapping` the variant is known from the discriminator value,
 * so a `switch` dispatches precisely; without one, the variants are walked
 * structurally by property presence. A union that carries a `discriminator`
 * but no `mapping` takes the structural path too — the mapping is what the
 * `switch` needs, not the property name.
 */
const buildUnionStatements = (params: {
  schema: OpenApiSchemaObject;
  accessor: string;
  context: ContextSpec;
  visitedRefs: Set<string>;
  depth: number;
  mode: DateTransformMode;
}): BuildResult =>
  params.schema.discriminator?.propertyName &&
  params.schema.discriminator?.mapping
    ? buildMappedUnionStatements(params)
    : buildUndiscriminatedUnionStatements(params);

export interface BuildDateTransformParams {
  schema: SchemaOrRef;
  /** Expression the statements mutate in place, e.g. `data.log` */
  accessor: string;
  context: ContextSpec;
  visitedRefs?: Set<string>;
  /** Nesting level, used for unique loop index names (i0, i1, …) */
  depth?: number;
}

export const buildDateTransformStatements = ({
  schema,
  accessor,
  context,
  visitedRefs = new Set(),
  depth = 0,
}: BuildDateTransformParams): string[] =>
  buildStatements({
    schema,
    accessor,
    context,
    visitedRefs,
    depth,
    mode: responseMode,
  }).statements;

const isDateOnlySchema = (schema: OpenApiSchemaObject): boolean =>
  !isBooleanJsonSchema(schema) && schema.format === 'date';

/**
 * OpenAPI `format: date` is a calendar day, but JavaScript has no date-only
 * type and `Date.prototype.toJSON()` always renders an instant. The value is
 * read as its UTC calendar day, matching what the mock generator emits for the
 * same format (mock/src/faker/constants.ts).
 *
 * Guarded on `instanceof Date`: the same accessor can be reached twice (an
 * `allOf` branch re-declaring a property its base already declares, or a
 * discriminated-union variant re-declaring one its parent schema's own
 * `properties` also converts), and unlike the response leaf's `new Date(...)`
 * — a clone, harmless to repeat — this conversion produces a string. Running
 * it twice without the guard would call `.toISOString()` on that string and
 * throw at runtime. The guard makes a second pass a no-op instead.
 */
const serializeLeafStatement = (read: string, write: string): string =>
  `${write} = ${read} instanceof Date ? (${read}.toISOString().slice(0, 10) as unknown as Date) : ${read};`;

/**
 * True when the subtree writes into the accessor's own properties, so the
 * accessor must be shallow-copied before those writes. A bare array (`items`
 * with no sibling `properties`/`allOf` contributing any) is excluded: `.map`
 * already produces a new array, and spreading one would turn it into an
 * object. `items`, `properties` and `allOf` are siblings in JSON Schema (see
 * buildResolvedStatements), so `items` being present must not short-circuit
 * before `allOf` is checked — a schema combining the two still needs a copy
 * for whichever branch writes properties.
 *
 * A `oneOf`/`anyOf` counts too, mapped or not: a discriminated union's own
 * `switch` writes into the accessor's properties exactly like a plain
 * `properties` block does (hence `schema.discriminator` below), and the
 * structural walk (`buildUndiscriminatedUnionStatements`) does the same
 * for an undiscriminated one — it has no `properties` of its own for
 * `hasOwnProperties` to see, so without this it would go uncopied and the
 * generated request serializer would write straight into the caller's
 * object. This is deliberately coarse, matching the existing
 * `schema.discriminator` check: it doesn't ask whether the union actually
 * ends up emitting a write, only whether it structurally could, since a
 * copy nobody ends up needing is harmless where a missing one is a
 * mutation bug.
 */
const needsObjectCopy = (
  schemaOrRef: SchemaOrRef,
  context: ContextSpec,
  seenRefs: Set<string> = new Set(),
): boolean => {
  const { schema, ref } = normalizeSchema(schemaOrRef, context);
  if (ref) {
    if (seenRefs.has(ref)) return false;
    seenRefs.add(ref);
  }
  if (isDateOnlySchema(schema)) return false;
  if (
    hasOwnProperties(schema) ||
    schema.discriminator ||
    schema.oneOf ||
    schema.anyOf
  ) {
    return true;
  }
  return (schema.allOf ?? []).some((branch: SchemaOrRef) =>
    needsObjectCopy(branch, context, seenRefs),
  );
};

/**
 * True when the schema is array-shaped — carries `items`, either directly or
 * through an `allOf` branch. Mirrors `needsObjectCopy`'s own `allOf`
 * recursion (and its `seenRefs` cycle guard) so the two predicates agree on
 * shape: `needsObjectCopy` already looks through `allOf` to find an object
 * shape, and the array/object conflict guard above must see an array shape
 * the same way, or a schema combining an array `allOf` branch with an object
 * `allOf` branch (rather than a sibling `items` and `properties`) slips past
 * the guard and emits both an array reassignment and an object-copy
 * property write, which crashes at runtime.
 */
const isArrayShaped = (
  schemaOrRef: SchemaOrRef,
  context: ContextSpec,
  seenRefs: Set<string> = new Set(),
): boolean => {
  const { schema, ref } = normalizeSchema(schemaOrRef, context);
  if (ref) {
    if (seenRefs.has(ref)) return false;
    seenRefs.add(ref);
  }
  if (schema.items) return true;
  return (schema.allOf ?? []).some((branch: SchemaOrRef) =>
    isArrayShaped(branch, context, seenRefs),
  );
};

const buildCopyingItemsStatements = ({
  items,
  accessor,
  context,
  visitedRefs,
  depth,
  mode,
}: ArrayStatementsParams): BuildResult => {
  const element = `item${depth}`;
  const value = `value${depth}`;
  const { nullable } = normalizeSchema(items, context);

  const inner = buildStatements({
    schema: items,
    accessor: value,
    context,
    visitedRefs,
    depth: depth + 1,
    mode,
  });
  if (inner.statements.length === 0) return inner;

  // A `let` alias lets the recursion reassign the element itself (a date
  // leaf, or a nested array's `.map` result) as well as write into a copy
  // of it.
  const body = [
    ...(nullable ? [`if (${element} == null) return ${element};`] : []),
    `let ${value} = ${element};`,
    ...(needsObjectCopy(items, context) ? [`${value} = { ...${value} };`] : []),
    ...inner.statements,
    `return ${value};`,
  ];

  return {
    statements: [
      `${accessor} = ${accessor}.map((${element}) => {`,
      ...indent(body),
      '});',
    ],
    cyclicRefs: inner.cyclicRefs,
  };
};

/**
 * The request direction's map traversal. Unlike the response direction, a
 * request-mode map never needs the `writesToAccessorItself` distinction:
 * every value is bound to a `let`, so a date leaf reassigns that `let`
 * exactly the way `buildCopyingItemsStatements` reassigns its own `value`
 * binding — no in-place key write is ever required.
 *
 * The map itself is shallow-copied unconditionally, up front, before the
 * loop — mirroring the array builder's copy-on-path discipline, but on the
 * container itself rather than inside a `.map()` callback, since a map has
 * no built-in traversal that already produces a fresh copy the way `.map`
 * does for arrays. Each value is then read into its own `let`, optionally
 * spread-copied when it needs its own writable copy (an object, exactly the
 * same `needsObjectCopy` check the array builder makes for its elements),
 * mutated by the recursive walk, and written back through the key.
 *
 * A nullable value is skipped with `continue` rather than wrapped in an
 * `if`: the map has already been copied, so the original (possibly null)
 * value is already sitting at that key and needs no rewrite.
 */
const buildCopyingMapStatements = ({
  values,
  accessor,
  context,
  visitedRefs,
  depth,
  mode,
}: MapStatementsParams): BuildResult => {
  const key = `key${depth}`;
  const value = `value${depth}`;
  const { nullable } = normalizeSchema(values, context);

  const inner = buildStatements({
    schema: values,
    accessor: value,
    context,
    visitedRefs,
    depth: depth + 1,
    mode,
  });
  if (inner.statements.length === 0) return inner;

  const body = [
    `let ${value} = ${accessor}[${key}];`,
    ...(nullable ? [`if (${value} == null) continue;`] : []),
    ...(needsObjectCopy(values, context)
      ? [`${value} = { ...${value} };`]
      : []),
    ...inner.statements,
    `${accessor}[${key}] = ${value};`,
  ];

  return {
    statements: [
      `${accessor} = { ...${accessor} };`,
      `for (const ${key} of Object.keys(${accessor})) {`,
      ...indent(body),
      '}',
    ],
    cyclicRefs: inner.cyclicRefs,
  };
};

const requestMode: DateTransformMode = {
  isLeaf: isDateOnlySchema,
  leafStatement: serializeLeafStatement,
  objectPrelude: (accessor, schema, context) =>
    needsObjectCopy(schema, context)
      ? [`${accessor} = { ...${accessor} };`]
      : [],
  arrayStatements: buildCopyingItemsStatements,
  mapStatements: buildCopyingMapStatements,
  // No write accessor is needed in this direction: readOnly properties are
  // skipped outright (see skipProperty below), and every property that is
  // still walked is written into a fresh copy the caller already owns, so a
  // plain assignment through `accessor` is always writable.
  propertyWriteAccessor: () => undefined,
  skipProperty: (schema) =>
    !isBooleanJsonSchema(schema) && schema.readOnly === true,
  dropArrayObjectConflict: true,
};

export interface BuildRequestDateSerializeParams {
  schema: SchemaOrRef;
  /** Expression the statements mutate; must already be a copy the caller owns. */
  accessor: string;
  context: ContextSpec;
  visitedRefs?: Set<string>;
  depth?: number;
}

export const buildRequestDateSerializeStatements = ({
  schema,
  accessor,
  context,
  visitedRefs = new Set(),
  depth = 0,
}: BuildRequestDateSerializeParams): string[] =>
  buildStatements({
    schema,
    accessor,
    context,
    visitedRefs,
    depth,
    mode: requestMode,
  }).statements;

/**
 * Resolves a request body down to its single JSON content schema. Returns
 * undefined for non-JSON bodies and for bodies offering several JSON media
 * types, where there is no one schema to walk.
 */
const resolveJsonBodySchema = (
  body: GetterBody,
  context: ContextSpec,
): OpenApiSchemaObject | undefined => {
  const requestBody = !isInlineSchema(body.originalSchema)
    ? resolveRef<OpenApiRequestBodyObject>(body.originalSchema, context).schema
    : (body.originalSchema as OpenApiRequestBodyObject);

  const content = requestBody.content;
  if (!content) return undefined;

  const jsonEntries = Object.entries(content).filter(([mediaType]) =>
    mediaType.toLowerCase().includes('json'),
  );
  if (jsonEntries.length !== 1) return undefined;

  return jsonEntries[0][1].schema as OpenApiSchemaObject | undefined;
};

export interface GeneratedDateSerializer {
  name: string;
  implementation: string;
}

/**
 * Builds a `serialize{Op}Request` function rendering schema-declared
 * `format: date` fields of a JSON request body as `YYYY-MM-DD`. `format:
 * date-time` is left alone — `Date.prototype.toJSON()` already produces the
 * right thing for an instant. Returns undefined when there is nothing to
 * serialize, so callers emit no code.
 *
 * The returned value is still typed as the model type (`Date` fields and
 * all), but at runtime those `format: date` fields hold `YYYY-MM-DD`
 * strings, not `Date` instances — a wire-level lie that is harmless when the
 * result is passed straight to `data:`, but a caller that reads the result
 * back (rather than only forwarding it) must know the type does not match
 * the value.
 */
export const generateRequestDateSerializer = ({
  operationName,
  body,
  context,
}: {
  operationName: string;
  body: GetterBody;
  context: ContextSpec;
}): GeneratedDateSerializer | undefined => {
  if (body.isBlob || !body.definition || !body.implementation) return undefined;

  // A body offering several media types (e.g. `application/json` alongside
  // `multipart/form-data`) is typed against the union of every surviving
  // type's TS value — `GetterBody.contentType` is only populated when
  // exactly one body type survived, and is `''` otherwise. A JSON-shaped
  // walk cannot be typed against that union, so bail out symmetrically with
  // `generateResponseDateDeserializer`'s single-success-type guard below.
  if (!body.contentType?.toLowerCase().includes('json')) return undefined;

  const schema = resolveJsonBodySchema(body, context);
  if (!schema) return undefined;

  const statements = buildRequestDateSerializeStatements({
    schema,
    accessor: 'copy',
    context,
  });
  if (statements.length === 0) return undefined;

  const dataType = body.definition;

  // A body type carrying any readOnly property is emitted as `NonReadonly<T>`,
  // whose mapped type recurses through `T[P] extends object` — which `Date`
  // satisfies — replacing every Date with a structural twin whose methods are
  // typed `{}`, so `.toISOString()` and `.map()` stop compiling. Casting the
  // copy back to the model type once keeps the conversions type-checked.
  // readOnly properties are skipped by the walk, so nothing writes to a key
  // `NonReadonly` dropped.
  const modelType = /^NonReadonly<(.+)>$/s.exec(dataType)?.[1];
  const workingType = modelType ? ` as unknown as ${modelType}` : '';
  const returnValue = modelType ? `copy as unknown as ${dataType}` : 'copy';

  // The root is reassigned rather than spread when the body is an array or a
  // bare date: `.map` builds the new array itself, and spreading either would
  // be wrong.
  const declaration = needsObjectCopy(schema, context)
    ? `const copy = { ...data }${workingType};`
    : `let copy = data${workingType};`;

  const name = `serialize${pascal(operationName)}Request`;

  // An operation prop generated from a `requestBody` that isn't `required: true`
  // (the OpenAPI default) is typed `T | undefined` at the call site
  // (`getProps` in `getters/props.ts`). Mirroring that in the serializer's own
  // signature keeps the emitted call `serializeXRequest(<possibly undefined
  // body>)` type-checking, while `if (data == null) return data;` above already
  // makes this correct at runtime and gives TypeScript the narrowing it needs
  // for the rest of the body.
  const optionalSuffix = body.isOptional ? ' | undefined' : '';

  const implementation = `const ${name} = (data: ${dataType}${optionalSuffix}): ${dataType}${optionalSuffix} => {
  if (data == null) return data;
  ${declaration}
${indent(statements).join('\n')}
  return ${returnValue};
};
`;

  return { name, implementation };
};

export interface GeneratedDateDeserializer {
  name: string;
  implementation: string;
}

/**
 * Builds a `deserialize{Op}Response` function converting schema-declared
 * date fields of the (single) JSON success response in place. Returns
 * undefined when there is nothing to transform, so callers emit no code.
 */
export const generateResponseDateDeserializer = ({
  operationName,
  response,
  context,
}: {
  operationName: string;
  response: GetterResponse;
  context: ContextSpec;
}): GeneratedDateDeserializer | undefined => {
  if (response.isBlob) return undefined;

  // MVP: a single success shape only — mixed 2xx types would need
  // status-aware dispatch, and the deserializer's parameter type would not
  // match the operation's return type union.
  if (response.types.success.length !== 1) return undefined;

  const [successType] = response.types.success;
  if (
    !successType.originalSchema ||
    !successType.contentType.toLowerCase().includes('json')
  ) {
    return undefined;
  }

  const statements = buildDateTransformStatements({
    schema: successType.originalSchema,
    accessor: 'data',
    context,
  });
  if (statements.length === 0) return undefined;

  const dataType = response.definition.success || 'unknown';
  const name = `deserialize${pascal(operationName)}Response`;
  const implementation = `const ${name} = (data: ${dataType}): ${dataType} => {
  if (data == null) return data;
${indent(statements).join('\n')}
  return data;
};
`;

  return { name, implementation };
};
