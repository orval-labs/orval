import { camelPathParamName } from '../getters/route';
import { resolveRef } from '../resolvers/ref';
import {
  type ContextSpec,
  type GeneratorSchema,
  type GeneratorVerbOptions,
  GetterPropType,
  type NormalizedOverrideOutput,
  type NormalizedZodOptions,
  type OpenApiMediaTypeObject,
  type OpenApiParameterObject,
  type OpenApiPathItemObject,
  type OpenApiReferenceObject,
  type OpenApiRequestBodyObject,
  type OpenApiResponseObject,
  type OpenApiSchemaObject,
} from '../types';
import { getNumberWord, isInlineSchema, pascal, sanitize } from '../utils';
import type { SchemaDirection } from './ref-policy';

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

const PRIMITIVE_NAMES: ReadonlySet<string> = new Set([
  'string',
  'number',
  'boolean',
  'bigint',
  'null',
  'undefined',
  'void',
  'unknown',
  'any',
  'never',
  'object',
  'Blob',
  'Date',
]);

/** The options of a library's override that its schemas module reads. */
export interface LibraryOptions {
  strict: NormalizedZodOptions['strict'];
  generate: NormalizedZodOptions['generate'];
  exactOptional: boolean;
}

interface ParseSiteOptions {
  context: ContextSpec;
  exactOptional: boolean;
  // The operation, named in the errors of a schema too large to inline.
  operation: string;
}

interface ParseBodyOptions extends ParseSiteOptions {
  // The name clients import the schema by.
  name: string;
  media: [contentType: string, media: OpenApiMediaTypeObject];
  strict: boolean;
  generate: boolean;
}

interface ParseSchemaOptions extends ParseSiteOptions {
  name: string;
  schema: OpenApiSchemaObject;
  strict: boolean;
  label: string;
  direction: SchemaDirection;
}

interface ParseParametersOptions extends ParseSiteOptions {
  data: (OpenApiParameterObject | OpenApiReferenceObject)[];
  strict: LibraryOptions['strict'];
  generate: LibraryOptions['generate'];
}

/** What a library does for the schemas module, with the nodes it builds. */
export interface SchemaParsers<Node> {
  /** Names the library in errors. */
  library: string;
  options: (override: NormalizedOverrideOutput) => LibraryOptions;
  /** A request body of any media type. */
  parseBody: (options: ParseBodyOptions) => Node | undefined;
  /** One schema without the properties its direction must not carry. */
  parseSchema: (options: ParseSchemaOptions) => Node;
  parseParameters: (options: ParseParametersOptions) => {
    params?: Node;
    queryParams?: Node;
    headers?: Node;
  };
  /** Clients name path parameters by their generated identifiers. */
  withPathParamNames: (node: Node, rename: (name: string) => string) => Node;
  /** What core types without a schema of this library, such as `content` parameters. */
  anyKeys: Node;
  unknown: Node;
  warn: (message: string, path?: string) => void;
}

interface NamedNode<Node> {
  name: string;
  node: Node | undefined;
}

const isArraySchema = (schema: OpenApiSchemaObject): boolean => {
  if (typeof schema !== 'object') return false;
  const { type } = schema;
  return type === 'array' || (Array.isArray(type) && type.includes('array'));
};

// Peels an inline array down to its inline item schema, under the name core
// gives that item. A `$ref` item is left to its component constant.
const getInlineItem = (
  schema: OpenApiSchemaObject | OpenApiReferenceObject | undefined,
  name: string,
  context: ContextSpec,
): { name: string; schema: OpenApiSchemaObject } | undefined => {
  const { itemPrefix, itemSuffix } = context.output.override.components.schemas;
  let current = schema;
  let itemName = name;
  let depth = 0;
  while (
    typeof current === 'object' &&
    !('$ref' in current) &&
    isArraySchema(current) &&
    typeof current.items === 'object' &&
    !Array.isArray(current.items)
  ) {
    current = current.items;
    itemName = itemPrefix + itemName + itemSuffix;
    depth += 1;
  }
  return depth === 0 ||
    typeof current !== 'object' ||
    '$ref' in current ||
    isArraySchema(current)
    ? undefined
    : { name: itemName, schema: current };
};

// `Item[]` or `Item[] | null`, as core writes an inline array response.
const ARRAY_VALUE = /^(?:readonly )?([A-Za-z_$][\w$]*)(?:\[\])+(?: \| null)?$/;

// Inline bodies under the names `getResReqTypes` gives them. A `$ref` body is
// imported by the name of its component instead.
const getBodySchemas = <Node>(
  verb: GeneratorVerbOptions,
  context: ContextSpec,
  parsers: SchemaParsers<Node>,
): NamedNode<Node>[] => {
  const { requestBody } = verb.originalOperation;
  const { strict, exactOptional, generate } = parsers.options(verb.override);
  if (!requestBody) return [];
  // The response type keeps `content` optional: an unvalidated spec may omit it.
  const content = Object.entries(
    resolveRef<OpenApiRequestBodyObject | OpenApiResponseObject>(
      requestBody,
      context,
    ).schema.content ?? {},
  );
  const baseName = sanitize(
    pascal(verb.typeName) +
      pascal(context.output.override.components.requestBodies.suffix),
    {
      underscore: '_',
      whitespace: '_',
      dash: true,
      es5keyword: true,
      es5IdentifierName: true,
    },
  );
  const imported = new Set(verb.body.imports.map(({ name }) => name));
  return content.flatMap(([contentType, media], index) => {
    const name =
      content.length > 1
        ? baseName + pascal(getNumberWord(index + 1))
        : baseName;
    // A `$ref` body is imported as its component.
    if (typeof media.schema === 'object' && '$ref' in media.schema) return [];
    if (imported.has(name)) {
      return [
        {
          name,
          node: parsers.parseBody({
            name,
            media: [contentType, media],
            context,
            strict: strict.body,
            exactOptional,
            generate: generate.body,
            operation: verb.operationName,
          }),
        },
      ];
    }
    // An inline array body is typed by its item.
    const item = getInlineItem(media.schema, name, context);
    return item && generate.body && imported.has(item.name)
      ? [
          {
            name: item.name,
            node: parsers.parseSchema({
              name: item.name,
              schema: item.schema,
              context,
              strict: strict.body,
              exactOptional,
              operation: verb.operationName,
              label: `${verb.operationName} body`,
              direction: 'readOnly',
            }),
          },
        ]
      : [];
  });
};

// The parameters of the path item, which may itself be a reference.
const getPathParameters = (
  pathRoute: string,
  context: ContextSpec,
): NonNullable<OpenApiPathItemObject['parameters']> => {
  const pathItem = context.spec.paths?.[pathRoute];
  if (!pathItem) return [];
  if (isInlineSchema(pathItem)) return pathItem.parameters ?? [];
  const { schema }: { schema: OpenApiPathItemObject } = resolveRef(
    pathItem,
    context,
  );
  return schema.parameters ?? [];
};

const getVerbSchemas = <Node>(
  verb: GeneratorVerbOptions,
  context: ContextSpec,
  parsers: SchemaParsers<Node>,
): NamedNode<Node>[] => {
  const { strict, exactOptional, generate } = parsers.options(verb.override);
  const typeName = pascal(verb.typeName);
  const operation = verb.originalOperation;
  if (verb.override.splitByContentType) {
    throw new Error(
      `[orval/${parsers.library}] schemas.type "${parsers.library}" cannot be used with splitByContentType (${verb.operationName}).`,
    );
  }
  const { params, queryParams, headers } = parsers.parseParameters({
    data: [
      ...getPathParameters(verb.pathRoute, context),
      ...(operation.parameters ?? []),
    ],
    context,
    strict,
    exactOptional,
    generate,
    operation: verb.operationName,
  });
  const responses = generate.response
    ? [...verb.response.types.success, ...verb.response.types.errors].flatMap(
        ({ value, isRef, originalSchema }) => {
          const item = ARRAY_VALUE.exec(value)?.[1];
          const name = item ?? value;
          const schema =
            item === undefined
              ? originalSchema
              : getInlineItem(originalSchema, '', context)?.schema;
          return schema === undefined ||
            isRef ||
            !IDENTIFIER.test(name) ||
            PRIMITIVE_NAMES.has(name)
            ? []
            : [
                {
                  name,
                  node: parsers.parseSchema({
                    name,
                    schema,
                    context,
                    strict: strict.response,
                    exactOptional,
                    operation: verb.operationName,
                    label: `${verb.operationName} response`,
                    direction: 'writeOnly',
                  }),
                },
              ];
        },
      )
    : [];

  return [
    ...getBodySchemas(verb, context, parsers),
    ...(verb.override.useNamedParameters
      ? [
          {
            name: `${typeName}PathParameters`,
            node: params
              ? parsers.withPathParamNames(params, camelPathParamName)
              : undefined,
          },
        ]
      : []),
    // Core types parameters this package has no schema for, such as ones
    // declared with `content`, so the fallback accepts any keys.
    {
      name: `${typeName}Params`,
      node: queryParams ?? (verb.queryParams ? parsers.anyKeys : undefined),
    },
    {
      name: `${typeName}Headers`,
      node: headers ?? (verb.headers ? parsers.anyKeys : undefined),
    },
    ...responses,
  ];
};

/** Every schema name a client file imports for an operation. */
export const getImportedNames = ({
  body,
  headers,
  params,
  props,
  queryParams,
  response,
}: GeneratorVerbOptions): string[] =>
  [
    ...response.imports,
    ...body.imports,
    ...params.flatMap(({ imports }) => imports),
    ...props.flatMap((prop) =>
      prop.type === GetterPropType.NAMED_PATH_PARAMS ? [prop.schema] : [],
    ),
    ...(queryParams ? [queryParams.schema] : []),
    ...(headers ? [headers.schema] : []),
  ].flatMap((schema) =>
    ('importPath' in schema && schema.importPath) ||
    PRIMITIVE_NAMES.has(schema.name) ||
    !IDENTIFIER.test(schema.name)
      ? []
      : [schema.name],
  );

export interface OperationSchema<Node> {
  name: string;
  node: Node;
  exactOptional: boolean;
}

interface OperationSchemasInput<Node> {
  parsers: SchemaParsers<Node>;
  context: ContextSpec;
  verbs: readonly GeneratorVerbOptions[];
  schemas: readonly GeneratorSchema[];
  // The names the component constants are exported and declared by.
  components: ReadonlySet<string>;
}

/**
 * The schemas a client imports besides the components: the inline bodies,
 * parameters and responses of each operation, then what else a client file
 * imports, such as a named response or request body.
 */
export const collectOperationSchemas = <Node>({
  parsers,
  context,
  verbs,
  schemas,
  components,
}: OperationSchemasInput<Node>): OperationSchema<Node>[] => {
  const taken = new Set(components);
  const found: OperationSchema<Node>[] = [];
  const add = (name: string, node: Node, exactOptional: boolean) => {
    taken.add(name);
    found.push({ name, node, exactOptional });
  };

  for (const verb of verbs) {
    for (const { name, node } of getVerbSchemas(verb, context, parsers)) {
      if (node === undefined) continue;
      if (components.has(name)) {
        throw new Error(
          `[orval/${parsers.library}] schemas.type "${parsers.library}" names a schema of ${verb.operationName} "${name}", which is also a component. Rename one in the OpenAPI source.`,
        );
      }
      if (!taken.has(name)) {
        add(name, node, parsers.options(verb.override).exactOptional);
      }
    }
  }

  const { strict, exactOptional } = parsers.options(context.output.override);
  const bodyNames = new Set(
    verbs.flatMap(({ body }) => body.imports.map(({ name }) => name)),
  );
  const schemasByName = new Map(schemas.map((schema) => [schema.name, schema]));
  for (const name of new Set(verbs.flatMap(getImportedNames))) {
    if (taken.has(name)) continue;
    const model = schemasByName.get(name);
    if (model?.schema === undefined) {
      parsers.warn(
        `No schema found for "${name}", so it is validated as unknown.`,
        name,
      );
      add(name, parsers.unknown, exactOptional);
      continue;
    }
    const isBody = bodyNames.has(name);
    add(
      name,
      parsers.parseSchema({
        name,
        schema: model.schema,
        context,
        strict: strict[isBody ? 'body' : 'response'],
        exactOptional,
        operation: name,
        label: name,
        direction: isBody ? 'readOnly' : 'writeOnly',
      }),
      exactOptional,
    );
  }
  return found;
};

/** Rejects a schema whose output type would take the name of another. */
export const assertNoOutputTypeClash = (
  library: string,
  names: Iterable<string>,
  taken: ReadonlySet<string>,
): void => {
  for (const name of names) {
    if (taken.has(`${name}Output`)) {
      throw new Error(
        `[orval/${library}] schemas.type "${library}" exports the output type of "${name}" as "${name}Output", which is also a schema. Rename one in the OpenAPI source.`,
      );
    }
  }
};
