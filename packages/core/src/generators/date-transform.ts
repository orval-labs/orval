import { resolveRef } from '../resolvers/ref';
import type {
  ContextSpec,
  GetterResponse,
  OpenApiReferenceObject,
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
}

const buildStatements = ({
  schema: schemaOrRef,
  accessor,
  context,
  visitedRefs,
  depth,
  writeAccessor,
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
}: {
  schema: OpenApiSchemaObject;
  ref?: string;
  accessor: string;
  context: ContextSpec;
  visitedRefs: Set<string>;
  depth: number;
  writeAccessor?: string;
}): BuildResult => {
  let result: BuildResult;
  if (isDateSchema(schema)) {
    result = {
      statements: [`${writeAccessor ?? accessor} = new Date(${accessor});`],
      cyclicRefs: new Set(),
    };
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
      }),
    );

    const unionResult = buildDiscriminatedUnionStatements({
      schema,
      accessor,
      context,
      visitedRefs,
      depth,
    });

    const itemsResult = schema.items
      ? buildItemsStatements({
          items: schema.items,
          accessor,
          context,
          visitedRefs,
          depth,
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
 * elements. Such elements must be written back through the array slot: a
 * hoisted `const` would make the generated assignment reassign a const.
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

const buildItemsStatements = ({
  items,
  accessor,
  context,
  visitedRefs,
  depth,
}: {
  items: SchemaOrRef;
  accessor: string;
  context: ContextSpec;
  visitedRefs: Set<string>;
  depth: number;
}): BuildResult => {
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

const buildPropertiesStatements = ({
  properties,
  required,
  accessor,
  context,
  visitedRefs,
  depth,
}: {
  properties: Record<string, SchemaOrRef>;
  required: string[] | undefined;
  accessor: string;
  context: ContextSpec;
  visitedRefs: Set<string>;
  depth: number;
}): BuildResult => {
  const requiredSet = new Set(required ?? []);
  return mergeResults(
    Object.entries(properties).map(([key, property]) => {
      const target = propertyAccessor(accessor, key);
      const { schema: propertySchema, nullable } = normalizeSchema(
        property,
        context,
      );
      const inner = buildStatements({
        schema: property,
        accessor: target,
        context,
        visitedRefs,
        depth,
        writeAccessor: propertySchema.readOnly
          ? propertyAccessor(mutableCast(accessor), key)
          : undefined,
      });
      if (inner.statements.length === 0) return inner;

      const needsGuard = !requiredSet.has(key) || nullable;
      if (!needsGuard) return inner;

      return {
        statements: [
          `if (${target} != null) {`,
          ...indent(inner.statements),
          '}',
        ],
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
}: {
  schema: OpenApiSchemaObject;
  accessor: string;
  context: ContextSpec;
  visitedRefs: Set<string>;
  depth: number;
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
  buildStatements({ schema, accessor, context, visitedRefs, depth }).statements;

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
