import { resolveRef } from '../resolvers/ref';
import type {
  ContextSpec,
  GetterBody,
  GetterResponse,
  OpenApiReferenceObject,
  OpenApiRequestBodyObject,
  OpenApiSchemaObject,
} from '../types';
import { pascal } from '../utils';
import { isReference } from '../utils/assertion';

type SchemaOrRef = OpenApiSchemaObject | OpenApiReferenceObject;

interface NormalizedSchema {
  schema: OpenApiSchemaObject;
  /** Set when the schema was reached through a `$ref`; drives cycle detection. */
  ref?: string;
  /** True when the schema admits `null`, in either OAS 3.0 or 3.1 spelling. */
  nullable: boolean;
}

const isDateSchema = (schema: OpenApiSchemaObject): boolean =>
  schema.format === 'date' || schema.format === 'date-time';

const isNullTypeSchema = (schemaOrRef: SchemaOrRef): boolean => {
  if (isReference(schemaOrRef)) return false;
  const { type } = schemaOrRef as OpenApiSchemaObject;
  return (
    type === 'null' ||
    (Array.isArray(type) && type.length > 0 && type.every((t) => t === 'null'))
  );
};

const hasNullableType = (schema: OpenApiSchemaObject): boolean =>
  schema.nullable === true ||
  (Array.isArray(schema.type) && schema.type.includes('null'));

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
  if (isReference(schemaOrRef) && schemaOrRef.$ref) {
    const ref: string = schemaOrRef.$ref;
    // Guard against a self-referential nullable wrapper (`A: anyOf [A, null]`)
    // sending this resolution loop infinite.
    if (seenRefs.has(ref)) {
      return { schema: {} as OpenApiSchemaObject, ref, nullable };
    }
    seenRefs.add(ref);
    const { schema } = resolveRef<OpenApiSchemaObject>(schemaOrRef, context);
    return {
      ...normalizeSchema(schema, context, nullable, seenRefs),
      ref,
    };
  }

  const schema = schemaOrRef as OpenApiSchemaObject;
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
}

const buildStatements = ({
  schema: schemaOrRef,
  accessor,
  context,
  visitedRefs,
  depth,
  writeAccessor,
  mode,
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
}: {
  schema: OpenApiSchemaObject;
  ref?: string;
  accessor: string;
  context: ContextSpec;
  visitedRefs: Set<string>;
  depth: number;
  writeAccessor?: string;
  mode: DateTransformMode;
}): BuildResult => {
  let result: BuildResult;
  if (mode.isLeaf(schema)) {
    result = {
      statements: [mode.leafStatement(accessor, writeAccessor ?? accessor)],
      cyclicRefs: new Set(),
    };
  } else if (
    mode.dropArrayObjectConflict &&
    isArrayShaped(schema, context) &&
    needsObjectCopy(schema, context)
  ) {
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
 * Two callers: the response direction's in-place array builder, where such
 * elements must be written back through the array slot (a hoisted `const`
 * would make the generated assignment reassign a const); and the request
 * direction's property builder, where it distinguishes a required date leaf
 * (unguarded — `x instanceof Date ? … : x` already tolerates `undefined`)
 * from a required container (object copy, array `.map`, or union dispatch),
 * which must be null-guarded so an omitted container isn't turned into `{}`
 * or thrown on. Both uses ask the same question — "does this write straight
 * to the accessor, or into something reached through it?" — regardless of
 * which formats a given direction actually converts, so it checks
 * `isDateSchema` directly rather than taking a `mode` parameter.
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
  /**
   * When true, a required (and non-nullable) property whose statements write
   * through a container — an object copy, an array `.map` reassignment, or a
   * discriminated-union switch — is still wrapped in an `!= null` guard, the
   * same as an optional property would be. The response direction leaves a
   * required container unguarded (`false`): it mutates a payload the server
   * already sent, where a required field is expected to be present. The
   * request direction (`true`) cannot make that assumption — a required
   * container is exactly what a caller is most likely to accidentally omit —
   * and without the guard an omitted object is spread into `{}` (a key the
   * caller never sent), while an omitted array throws calling `.map` on
   * `undefined`. A required property that instead writes a date leaf
   * directly to the accessor is unaffected either way: `x instanceof Date ?
   * … : x` already tolerates `undefined`, so guarding it would only churn
   * the output for no behavioural benefit.
   */
  guardRequiredContainers: boolean;
}

interface ArrayStatementsParams {
  items: SchemaOrRef;
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

const responseMode: DateTransformMode = {
  isLeaf: isDateSchema,
  leafStatement: (read, write) => `${write} = new Date(${read});`,
  objectPrelude: () => [],
  arrayStatements: buildInPlaceItemsStatements,
  propertyWriteAccessor: (accessor, key, propertySchema) =>
    propertySchema.readOnly
      ? propertyAccessor(mutableCast(accessor), key)
      : undefined,
  skipProperty: () => false,
  dropArrayObjectConflict: false,
  guardRequiredContainers: false,
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
        (mode.guardRequiredContainers &&
          !writesToAccessorItself(property, context));
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
  const variants = schema.oneOf ?? schema.anyOf;
  const propertyName = schema.discriminator?.propertyName;
  const mapping = schema.discriminator?.mapping;
  if (!variants || !propertyName || !mapping) return emptyResult();

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
  schema.format === 'date';

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
  if (schema.properties || schema.discriminator) return true;
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

const requestMode: DateTransformMode = {
  isLeaf: isDateOnlySchema,
  leafStatement: serializeLeafStatement,
  objectPrelude: (accessor, schema, context) =>
    needsObjectCopy(schema, context)
      ? [`${accessor} = { ...${accessor} };`]
      : [],
  arrayStatements: buildCopyingItemsStatements,
  // No write accessor is needed in this direction: readOnly properties are
  // skipped outright (see skipProperty below), and every property that is
  // still walked is written into a fresh copy the caller already owns, so a
  // plain assignment through `accessor` is always writable.
  propertyWriteAccessor: () => undefined,
  skipProperty: (schema) => schema.readOnly === true,
  dropArrayObjectConflict: true,
  guardRequiredContainers: true,
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
  const requestBody = isReference(body.originalSchema)
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
