import { hasNarrowedPropertyNames } from '../getters';
import { isBooleanJsonSchema } from '@scalar/openapi-types/helpers';

import { resolveRef } from '../resolvers/ref';
import type {
  ContextSpec,
  GetterBody,
  GetterResponse,
  OpenApiReferenceObject,
  OpenApiRequestBodyObject,
  OpenApiSchemaObject,
} from '../types';
import { isInlineSchema, pascal, toObjectSchema } from '../utils';

type SchemaOrRef = OpenApiSchemaObject | OpenApiReferenceObject;

interface NormalizedSchema {
  schema: Exclude<OpenApiSchemaObject, boolean>;
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

  const schema = schemaOrRef as Exclude<OpenApiSchemaObject, boolean>;
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

    const unionResult = buildDiscriminatedUnionStatements({
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
}: {
  properties: Record<string, SchemaOrRef>;
  required: string[] | undefined;
  accessor: string;
  context: ContextSpec;
  visitedRefs: Set<string>;
  depth: number;
  mode: DateTransformMode;
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

      const needsGuard =
        !requiredSet.has(key) ||
        nullable ||
        !writesToAccessorItself(property, context);
      if (!needsGuard) return { ...inner, statements };

      return {
        statements: [`if (${target} != null) {`, ...indent(statements), '}'],
        cyclicRefs: inner.cyclicRefs,
      };
    }),
  );
};

/**
 * Emits a `switch` on the discriminator property for a `oneOf`/`anyOf` that
 * carries an OpenAPI `discriminator` with an explicit `mapping`. Unions
 * without a discriminator mapping are a documented limitation and
 * contribute nothing — the variant a given payload matches can't be
 * determined statically, so there's no accessor to guard.
 */
const buildDiscriminatedUnionStatements = ({
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
  if (hasOwnProperties(schema) || schema.discriminator) return true;
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
