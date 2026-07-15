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

interface ResolvedSchema {
  schema: OpenApiSchemaObject;
  ref?: string;
}

const resolveSchema = (
  schema: SchemaOrRef,
  context: ContextSpec,
): ResolvedSchema => {
  if (!isReference(schema)) {
    return { schema: schema as OpenApiSchemaObject };
  }
  const { schema: resolved } = resolveRef<OpenApiSchemaObject>(schema, context);
  return { schema: resolved, ref: schema.$ref };
};

const isDateSchema = (schema: OpenApiSchemaObject): boolean =>
  schema.format === 'date' || schema.format === 'date-time';

const isNullable = (schema: OpenApiSchemaObject): boolean =>
  schema.nullable === true ||
  (Array.isArray(schema.type) && schema.type.includes('null'));

const IDENTIFIER_REGEX = /^[A-Za-z_$][\w$]*$/;

const propertyAccessor = (parent: string, key: string): string =>
  IDENTIFIER_REGEX.test(key)
    ? `${parent}.${key}`
    : `${parent}[${JSON.stringify(key)}]`;

const indent = (statements: string[]): string[] =>
  statements.map((statement) => `  ${statement}`);

// A discriminator mapping key is emitted as a single-quoted string literal
// unless it contains a quote or backslash, in which case JSON.stringify
// (double quotes) is used instead — still valid, unambiguous JS.
const SAFE_CASE_LABEL_REGEX = /^[^'\\]*$/;

const caseLabel = (key: string): string =>
  SAFE_CASE_LABEL_REGEX.test(key) ? `'${key}'` : JSON.stringify(key);

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
  schema: schemaOrRef,
  accessor,
  context,
  visitedRefs = new Set(),
  depth = 0,
}: BuildDateTransformParams): string[] => {
  const { schema, ref } = resolveSchema(schemaOrRef, context);
  if (ref) {
    if (visitedRefs.has(ref)) return [];
    visitedRefs.add(ref);
  }

  let result: string[] = [];
  if (isDateSchema(schema)) {
    result = [`${accessor} = new Date(${accessor});`];
  } else {
    // allOf, items and properties are siblings in JSON Schema, not
    // mutually-exclusive branches — a schema can combine `allOf` with its
    // own `properties` (or, less commonly, `items`), and every one of them
    // must contribute its date statements.
    const allOfStatements = schema.allOf
      ? schema.allOf.flatMap((branch: SchemaOrRef) =>
          buildDateTransformStatements({
            schema: branch,
            accessor,
            context,
            visitedRefs,
            depth,
          }),
        )
      : [];

    const unionStatements = buildDiscriminatedUnionStatements({
      schema,
      accessor,
      context,
      visitedRefs,
      depth,
    });

    const itemsStatements = schema.items
      ? buildItemsStatements({
          items: schema.items,
          accessor,
          context,
          visitedRefs,
          depth,
        })
      : [];

    const propertiesStatements = schema.properties
      ? buildPropertiesStatements({
          properties: schema.properties,
          required: schema.required,
          accessor,
          context,
          visitedRefs,
          depth,
        })
      : [];

    result = [
      ...allOfStatements,
      ...unionStatements,
      ...itemsStatements,
      ...propertiesStatements,
    ];
  }

  if (ref) {
    visitedRefs.delete(ref);
  }
  return result;
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
}): string[] => {
  const index = `i${depth}`;

  // Date-string elements need the indexed form so the `new Date(...)`
  // result can be written back into the array slot; bare elements are
  // never optional, so no narrowing is required.
  const { schema: resolvedItems } = resolveSchema(items, context);
  if (isDateSchema(resolvedItems)) {
    const element = `${accessor}[${index}]`;
    const assignment = `${element} = new Date(${element});`;
    const body = isNullable(resolvedItems)
      ? [`if (${element} != null) {`, `  ${assignment}`, '}']
      : [assignment];
    return [
      `for (let ${index} = 0; ${index} < ${accessor}.length; ${index}++) {`,
      ...indent(body),
      '}',
    ];
  }

  // Object/array elements are hoisted into a const: TypeScript does not
  // carry `!= null` narrowing across statements for variable-indexed
  // accesses (`data[i0].at`), but does for a hoisted local. Mutating the
  // local's properties mutates the same object, so in-place semantics
  // are unchanged.
  const item = `item${depth}`;
  const statements = buildDateTransformStatements({
    schema: items,
    accessor: item,
    context,
    visitedRefs,
    depth: depth + 1,
  });
  if (statements.length === 0) return [];

  const body = isNullable(resolvedItems)
    ? [`if (${item} != null) {`, ...indent(statements), '}']
    : statements;

  return [
    `for (let ${index} = 0; ${index} < ${accessor}.length; ${index}++) {`,
    `  const ${item} = ${accessor}[${index}];`,
    ...indent(body),
    '}',
  ];
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
}): string[] => {
  const requiredSet = new Set(required ?? []);
  return Object.entries(properties).flatMap(([key, property]) => {
    const target = propertyAccessor(accessor, key);
    const statements = buildDateTransformStatements({
      schema: property,
      accessor: target,
      context,
      visitedRefs,
      depth,
    });
    if (statements.length === 0) return [];

    const { schema: propertySchema } = resolveSchema(property, context);
    const needsGuard = !requiredSet.has(key) || isNullable(propertySchema);
    if (!needsGuard) return statements;

    return [`if (${target} != null) {`, ...indent(statements), '}'];
  });
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
}): string[] => {
  const variants = schema.oneOf ?? schema.anyOf;
  const propertyName = schema.discriminator?.propertyName;
  const mapping = schema.discriminator?.mapping;
  if (!variants || !propertyName || !mapping) return [];

  const cases = Object.entries(mapping).flatMap(([value, refPath]) => {
    const statements = buildDateTransformStatements({
      schema: { $ref: refPath } as OpenApiReferenceObject,
      accessor,
      context,
      visitedRefs,
      depth,
    });
    if (statements.length === 0) return [];

    return [
      `case ${caseLabel(value)}: {`,
      ...indent(statements),
      '  break;',
      '}',
    ];
  });

  if (cases.length === 0) return [];

  return [
    `switch (${propertyAccessor(accessor, propertyName)}) {`,
    ...indent(cases),
    '}',
  ];
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
