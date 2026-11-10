import {
  camelPathParamName,
  type ContextSpec,
  type GeneratorSchema,
  type GeneratorVerbOptions,
  getNumberWord,
  getRefInfo,
  GetterPropType,
  type NormalizedOutputOptions,
  type OpenApiParameterObject,
  type OpenApiReferenceObject,
  type OpenApiSchemaObject,
  type OpenApiRequestBodyObject,
  type OpenApiResponseObject,
  pascal,
  resolveRef,
  sanitize,
} from '@orval/core';

import { startRun, warnOnce } from './logger';
import { plainNode, type ValibotNode } from './nodes';
import {
  parseBodyAndResponse,
  parseDirectionalSchema,
  parseParameters,
} from './operation';
import { getLocalRefTarget, getRef, toComponentRef } from './refs';
import { renderValibot } from './render';
import {
  generateValibotComponentConsts,
  getComponentNames,
} from './reusable-schemas';

const VALIBOT_IMPORT = "import * as v from 'valibot';";

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

const ANY_KEYS = plainNode({
  kind: 'object',
  mode: 'looseObject',
  entries: [],
});

interface ValibotSchemasModuleInput {
  spec: ContextSpec['spec'];
  target: string;
  schemas: GeneratorSchema[];
  verbOptions: Record<string, GeneratorVerbOptions>;
}

interface SchemaEntry {
  /** The name clients import. */
  name: string;
  /** The declared constant, when it cannot be named as clients import it. */
  constName?: string;
  expression: string;
}

const renderEntry = ({ name, constName = name, expression }: SchemaEntry) =>
  [
    `export const ${constName} = ${expression};`,
    `export type ${constName} = v.InferInput<typeof ${constName}>;`,
    `export type ${name}Output = v.InferOutput<typeof ${constName}>;`,
    ...(constName === name ? [] : [`export { ${constName} as ${name} };`]),
  ].join('\n');

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
const getBodySchemas = (
  verb: GeneratorVerbOptions,
  context: ContextSpec,
): { name: string; node: ValibotNode | undefined }[] => {
  const { requestBody } = verb.originalOperation;
  const { strict, exactOptional, generate } = verb.override.valibot;
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
          node: parseBodyAndResponse({
            data: { content: { [contentType]: media } },
            context,
            strict: strict.body,
            exactOptional,
            generate: generate.body,
            isRequest: true,
            operation: verb.operationName,
            anyMediaType: true,
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
            node: parseDirectionalSchema({
              schema: item.schema,
              context,
              strict: strict.body,
              exactOptional,
              label: `${verb.operationName} body`,
              direction: 'readOnly',
            }),
          },
        ]
      : [];
  });
};

// Clients name path parameters by their generated identifiers.
const withPathParamNames = (
  node: ValibotNode | undefined,
): ValibotNode | undefined =>
  node?.schema.kind === 'object'
    ? {
        ...node,
        schema: {
          ...node.schema,
          entries: node.schema.entries.map((entry) => ({
            ...entry,
            key: camelPathParamName(entry.key),
          })),
        },
      }
    : node;

const getVerbSchemas = (
  verb: GeneratorVerbOptions,
  context: ContextSpec,
): { name: string; node: ValibotNode | undefined }[] => {
  const { strict, exactOptional, generate } = verb.override.valibot;
  const typeName = pascal(verb.typeName);
  const operation = verb.originalOperation;
  if (verb.override.splitByContentType) {
    throw new Error(
      `[orval/valibot] schemas.type "valibot" cannot be used with splitByContentType (${verb.operationName}).`,
    );
  }
  const pathItem = context.spec.paths?.[verb.pathRoute];
  const pathRef = getRef(pathItem);
  const resolvedPathItem = pathRef
    ? (getLocalRefTarget(pathRef, context) as typeof pathItem)
    : pathItem;
  const pathParameters = resolvedPathItem?.parameters as
    | (OpenApiParameterObject | OpenApiReferenceObject)[]
    | undefined;
  const { params, queryParams, headers } = parseParameters({
    data: [...(pathParameters ?? []), ...(operation.parameters ?? [])],
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
                  node: parseDirectionalSchema({
                    schema,
                    context,
                    strict: strict.response,
                    exactOptional,
                    label: `${verb.operationName} response`,
                    direction: 'writeOnly',
                  }),
                },
              ];
        },
      )
    : [];

  return [
    ...getBodySchemas(verb, context),
    ...(verb.override.useNamedParameters
      ? [
          {
            name: `${typeName}PathParameters`,
            node: withPathParamNames(params),
          },
        ]
      : []),
    // Core types parameters this package has no schema for, such as ones
    // declared with `content`, so the fallback accepts any keys.
    {
      name: `${typeName}Params`,
      node: queryParams ?? (verb.queryParams && ANY_KEYS),
    },
    { name: `${typeName}Headers`, node: headers ?? (verb.headers && ANY_KEYS) },
    ...responses,
  ];
};

// Every schema name a client file imports for this operation.
const getImportedNames = ({
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

/**
 * The module `schemas: { type: 'valibot' }` writes: the component constants in
 * dependency order, then the operation schemas clients import. Every schema
 * also exports its `X` input and `XOutput` output types. Empty when there is
 * nothing to declare.
 */
export const generateValibotSchemasModule = (
  { spec, target, schemas, verbOptions }: ValibotSchemasModuleInput,
  output: NormalizedOutputOptions,
  workspace: string,
): string => {
  const context: ContextSpec = { spec, target, workspace, output };
  startRun(spec);

  // A constant is declared under another name only when its own would shadow
  // what generated code relies on; clients still import it by its own name.
  const contractNames = new Map(
    [...getComponentNames(context)].map(([key, constName]) => [
      constName,
      getRefInfo(toComponentRef(key), context).name,
    ]),
  );
  const entries: SchemaEntry[] = generateValibotComponentConsts(context).map(
    ({ name, expression }) => ({
      name: contractNames.get(name) ?? name,
      constName: name,
      expression,
    }),
  );
  const components = new Set(entries.map(({ name }) => name));
  const taken = new Set(components);
  const add = (
    name: string,
    node: ValibotNode,
    exactOptional = output.override.valibot.exactOptional,
  ) => {
    taken.add(name);
    entries.push({
      name,
      expression: renderValibot(node, { exactOptional }),
    });
  };

  const verbs = Object.values(verbOptions);
  for (const verb of verbs) {
    for (const { name, node } of getVerbSchemas(verb, context)) {
      if (!node) continue;
      if (components.has(name)) {
        throw new Error(
          `[orval/valibot] schemas.type "valibot" names a schema of ${verb.operationName} "${name}", which is also a component. Rename one in the OpenAPI source.`,
        );
      }
      if (!taken.has(name)) {
        add(name, node, verb.override.valibot.exactOptional);
      }
    }
  }

  // What clients import beyond the above, such as a named response or request
  // body component, or the item of an inline array body.
  const bodyNames = new Set(
    verbs.flatMap(({ body }) => body.imports.map(({ name }) => name)),
  );
  const schemasByName = new Map(schemas.map((schema) => [schema.name, schema]));
  for (const name of new Set(verbs.flatMap(getImportedNames))) {
    if (taken.has(name)) continue;
    const model = schemasByName.get(name);
    if (model?.schema === undefined) {
      warnOnce(`No schema found for "${name}", so it is validated as unknown.`);
      add(name, plainNode({ kind: 'unknown' }));
    } else {
      add(
        name,
        parseDirectionalSchema({
          schema: model.schema,
          context,
          strict:
            output.override.valibot.strict[
              bodyNames.has(name) ? 'body' : 'response'
            ],
          exactOptional: output.override.valibot.exactOptional,
          label: name,
          direction: bodyNames.has(name) ? 'readOnly' : 'writeOnly',
        }),
      );
    }
  }

  for (const { name } of entries) {
    if (taken.has(`${name}Output`)) {
      throw new Error(
        `[orval/valibot] schemas.type "valibot" exports the output type of "${name}" as "${name}Output", which is also a schema. Rename one in the OpenAPI source.`,
      );
    }
  }

  return entries.length === 0
    ? ''
    : `${VALIBOT_IMPORT}\n\n${entries.map(renderEntry).join('\n\n')}\n`;
};
