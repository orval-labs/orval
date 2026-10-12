import path from 'node:path';

import { generateDependencyImports } from '../generators';
import {
  getQueryParamSerialization,
  getStaticBaseUrl,
  parseRoutePath,
} from '../getters';
import {
  type ContextSpec,
  type GeneratorImport,
  type GeneratorOperation,
  type GeneratorVerbOptions,
  type NormalizedOutputOptions,
  OutputClient,
  OutputHttpClient,
  OutputMode,
  type WriteSpecBuilder,
} from '../types';
import {
  conventionName,
  getFileInfo,
  getImportExtension,
  getOperationTagKey,
  getSchemasImportPath,
  isObject,
  isString,
  logger,
  pascal,
} from '../utils';
import { writeGeneratedFile } from './file';
import { generateImportsForBuilder } from './generate-imports-for-builder';
import { resolveMockSchemasPath } from './mock-utils';

export interface OperationManifestPathParam {
  /** The name in the spec path, e.g. `pet-id` in `/pets/{pet-id}`. */
  name: string;
  /** The generated identifier the client takes, e.g. `petId`. */
  key: string;
}

export interface OperationManifestEntry {
  operationId: string;
  operationName: string;
  method: string;
  /** The spec path, e.g. `/pets/{petId}`. */
  path: string;
  /** `path` with the static base URL. Unset when the base URL is runtime-only. */
  url?: string;
  /** The tag directory the operation is written to in the tags modes. */
  tag: string;
  tags: string[];
  pathParams: OperationManifestPathParam[];
  queryParams: string[];
  serialization: {
    explode: string[];
    arrayFormat: string[];
    deepObject: string[];
    explodeOnly: boolean;
  };
  body: { contentType: string; required: boolean } | null;
  /** The `get<Op>ResponseMock` factory, when a mock generator emits one. */
  mock: string | null;
  deprecated: boolean;
}

export interface OperationManifestTypes {
  pathParams: string;
  query: string;
  body: string;
  headers: string;
  response: string;
  error: string;
  imports: GeneratorImport[];
}

const joinUrl = (base: string, route: string) =>
  base.endsWith('/') && route.startsWith('/')
    ? `${base}${route.slice(1)}`
    : `${base}${route}`;

/** The manifest entry of one operation, read from its verb options. */
export function getOperationManifestEntry(
  verbOptions: GeneratorVerbOptions,
  operation: Pick<GeneratorOperation, 'operationName' | 'mockOutputs'>,
  context: ContextSpec,
): OperationManifestEntry {
  const { output } = context;
  const pathItem = context.spec.paths?.[verbOptions.pathRoute];
  const base = getStaticBaseUrl(
    pathItem?.servers ?? context.spec.servers,
    output.baseUrl,
  );

  const serialization = getQueryParamSerialization(
    verbOptions,
    context,
    output.httpClient === OutputHttpClient.FETCH
      ? output.override.fetch.arrayFormat
      : undefined,
  );

  // `getParams` returns the path params in path order, one per placeholder.
  const specNames = parseRoutePath(verbOptions.pathRoute).flatMap((token) =>
    token.kind === 'param' ? [token.name] : [],
  );

  const mockName = `get${pascal(operation.operationName)}ResponseMock`;
  const declaresMock = new RegExp(`\\bexport const ${mockName}\\b`);
  const hasMock = operation.mockOutputs.some((m) =>
    declaresMock.test(m.implementation.function),
  );

  const hasBody = verbOptions.body.definition.trim().length > 0;

  return {
    operationId: verbOptions.operationId,
    operationName: verbOptions.operationName,
    method: verbOptions.verb.toUpperCase(),
    path: verbOptions.pathRoute,
    ...(base === undefined
      ? {}
      : {
          url: base
            ? joinUrl(base, verbOptions.pathRoute)
            : verbOptions.pathRoute,
        }),
    tag: getOperationTagKey(verbOptions),
    tags: verbOptions.tags,
    pathParams: verbOptions.params.map((param, index) => ({
      name: specNames[index] ?? param.name,
      key: param.name,
    })),
    queryParams: serialization.parameters
      .filter((parameter) => parameter.in === 'query')
      .map((parameter) => parameter.name),
    serialization: {
      explode: serialization.explode.map((parameter) => parameter.name),
      arrayFormat: serialization.arrayFormat.map((parameter) => parameter.name),
      deepObject: serialization.deepObject.map((parameter) => parameter.name),
      explodeOnly: serialization.explodeOnly,
    },
    body: hasBody
      ? {
          contentType: verbOptions.body.contentType,
          required: !verbOptions.body.isOptional,
        }
      : null,
    mock: hasMock ? mockName : null,
    deprecated: verbOptions.deprecated ?? false,
  };
}

/**
 * The request and response types of one operation, as references to the types
 * orval already generates. `response` is the payload type, not the client's
 * return type (which a mutator or `includeHttpResponseReturnType` can wrap).
 */
export function getOperationManifestTypes(
  verbOptions: GeneratorVerbOptions,
): OperationManifestTypes {
  const { params, queryParams, headers, body, response } = verbOptions;
  const typeImport = (name: string): GeneratorImport => ({ name });
  const imports = [
    ...params.flatMap((param) => param.imports),
    ...(queryParams ? [typeImport(queryParams.schema.name)] : []),
    ...(headers ? [typeImport(headers.schema.name)] : []),
    ...body.imports,
    ...response.imports,
  ]
    // Only component and operation types, which live with the schemas.
    .filter((imp) => !imp.importPath)
    .map((imp) => ({ ...imp, values: false }));

  return {
    pathParams:
      params.length > 0
        ? `{ ${params.map((param) => param.definition).join('; ')} }`
        : 'never',
    query: queryParams?.schema.name ?? 'never',
    body: body.definition.trim() || 'never',
    headers: headers?.schema.name ?? 'never',
    response: response.definition.success || 'unknown',
    error: response.definition.errors || 'unknown',
    imports,
  };
}

const renderEntries = (entries: Record<string, OperationManifestEntry>) =>
  `export const operations = ${JSON.stringify(entries, undefined, 2)} as const;\n`;

const renderTypes = (types: Record<string, OperationManifestTypes>) => {
  const lines = Object.entries(types).map(
    ([name, t]) =>
      `  ${JSON.stringify(name)}: {\n` +
      `    pathParams: ${t.pathParams};\n` +
      `    query: ${t.query};\n` +
      `    body: ${t.body};\n` +
      `    headers: ${t.headers};\n` +
      `    response: ${t.response};\n` +
      `    error: ${t.error};\n` +
      `  };`,
  );
  return `/** The request and response types of every operation. \`response\` is the payload type. */
export type OperationTypes = {
${lines.join('\n')}
};
`;
};

/** Clients whose verb options describe zod schemas rather than TypeScript types. */
const UNTYPED_CLIENTS = new Set<string>([
  OutputClient.ZOD,
  OutputClient.EFFECT,
]);

/**
 * Builds the manifest file's content.
 *
 * @param importPath Where the manifest imports schema types from.
 */
export function buildOperationManifest(
  builder: Pick<
    WriteSpecBuilder,
    | 'operations'
    | 'verbOptions'
    | 'operationVerbOptions'
    | 'spec'
    | 'target'
    | 'schemaTagMap'
    | 'schemaOutputPlan'
  >,
  output: NormalizedOutputOptions,
  {
    header,
    filePath,
    relativeSchemasPath,
  }: { header: string; filePath: string; relativeSchemasPath: string },
): string {
  const context: ContextSpec = {
    spec: builder.spec,
    target: builder.target,
    workspace: '',
    output,
  };

  const operationsByName = new Map<string, GeneratorOperation>();
  for (const operation of Object.values(builder.operations)) {
    if (!operationsByName.has(operation.operationName)) {
      operationsByName.set(operation.operationName, operation);
    }
  }

  const entries: Record<string, OperationManifestEntry> = {};
  const types: Record<string, OperationManifestTypes> = {};
  const verbOptionsList =
    builder.operationVerbOptions ?? Object.values(builder.verbOptions);
  const sorted = verbOptionsList.toSorted((a, b) =>
    a.operationName.localeCompare(b.operationName),
  );
  for (const verbOptions of sorted) {
    // A client can skip an operation, it then has no generated function.
    const operation = operationsByName.get(verbOptions.operationName);
    if (!operation) continue;
    if (Object.hasOwn(entries, verbOptions.operationName)) {
      logger.warn(
        `Operation manifest: two operations are named "${verbOptions.operationName}", keeping the first one (${entries[verbOptions.operationName].operationId}).`,
      );
      continue;
    }
    entries[verbOptions.operationName] = getOperationManifestEntry(
      verbOptions,
      operation,
      context,
    );
    types[verbOptions.operationName] = getOperationManifestTypes(verbOptions);
  }

  const isZodSchemas =
    isObject(output.schemas) && output.schemas.type === 'zod';
  const withTypes =
    output.operationManifest?.types !== false &&
    !isZodSchemas &&
    !(isString(output.client) && UNTYPED_CLIENTS.has(output.client));

  let implementation = renderEntries(entries);
  implementation += '\nexport type OperationName = keyof typeof operations;\n';
  if (withTypes) {
    implementation += `\n${renderTypes(types)}`;
  }

  const imports = withTypes
    ? generateDependencyImports(
        implementation,
        generateImportsForBuilder(
          output,
          Object.values(types).flatMap((t) => t.imports),
          relativeSchemasPath,
          builder.schemaTagMap,
          builder.schemaOutputPlan,
          filePath,
        ),
        undefined,
        !!output.schemas,
        false,
      )
    : '';

  return `${header}${imports ? `${imports}\n\n` : ''}${implementation}`;
}

/**
 * Writes the `output.operationManifest` file.
 *
 * @returns The path written, or `undefined` when the option is off.
 */
export async function writeOperationManifest(
  builder: WriteSpecBuilder,
  output: NormalizedOutputOptions,
  header: string,
): Promise<string | undefined> {
  if (!output.operationManifest) return undefined;

  const { filename, dirname, extension } = getFileInfo(output.target, {
    backupFilename: conventionName(
      // oxlint-disable-next-line typescript/no-unnecessary-condition
      builder.info.title ?? 'filename',
      output.namingConvention,
    ),
    extension: output.fileExtension,
  });
  const filePath =
    output.operationManifest.path ??
    path.join(dirname, `${filename}.operations${extension}`);

  // Where the schema types are, as in the mode writers: the schemas directory,
  // the target file itself in `single` mode, else `<target>.schemas`.
  const schemasDir = output.schemas
    ? isString(output.schemas)
      ? output.schemas
      : output.schemas.path
    : undefined;
  const schemasTarget =
    schemasDir ??
    (output.mode === OutputMode.SINGLE
      ? path.join(dirname, filename + extension)
      : path.join(
          dirname,
          filename +
            '.schemas' +
            getImportExtension(output.schemaFileExtension, output.tsconfig),
        ));
  const relativeSchemasPath =
    getSchemasImportPath(output.schemas) ??
    resolveMockSchemasPath(filePath, schemasTarget);

  await writeGeneratedFile(
    filePath,
    buildOperationManifest(builder, output, {
      header,
      filePath,
      relativeSchemasPath,
    }),
  );
  return filePath;
}
