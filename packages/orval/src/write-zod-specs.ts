import path from 'node:path';

import {
  type ContextSpec,
  conventionName,
  type NamingConvention,
  type NormalizedOutputOptions,
  type OpenApiParameterObject,
  type OpenApiReferenceObject,
  type OpenApiRequestBodyObject,
  type OpenApiSchemaObject,
  pascal,
  type ZodCoerceType,
} from '@orval/core';
import {
  dereference,
  generateFormDataZodSchema,
  generateZodValidationSchemaDefinition,
  isZodVersionV4,
  parseZodValidationSchemaDefinition,
  type ZodValidationSchemaDefinition,
} from '@orval/zod';
import fs from 'fs-extra';

import {
  generateReusableSchemaSet,
  resolveSchemaNames,
  rewriteReusableSchemas,
  rewriteSentinelsToDirect,
} from './reusable-schemas';

interface ZodSchemaFileEntry {
  schemaName: string;
  consts: string;
  zodExpression: string;
  /** Pre-rendered `import { x } from './x'` lines for reusable-schema refs. */
  importStatements?: string[];
}

type ZodSchemaFileToWrite = ZodSchemaFileEntry & {
  filePath: string;
};

interface WriteZodOutputOptions {
  namingConvention: NamingConvention;
  indexFiles: boolean;
  packageJson?: NormalizedOutputOptions['packageJson'];
  override: {
    zod: {
      strict: {
        body: boolean;
      };
      generate: {
        param: boolean;
        query: boolean;
        header: boolean;
        body: boolean;
        response: boolean;
      };
      coerce: {
        body: boolean | ZodCoerceType[];
      };
      generateReusableSchemas?: boolean;
    };
  };
}

interface WriteZodSchemasInput {
  spec: ContextSpec['spec'];
  target: string;
  schemas: {
    name: string;
    schema?: OpenApiSchemaObject | OpenApiReferenceObject;
  }[];
}

interface WriteZodVerbResponseType {
  value: string;
  isRef?: boolean;
  originalSchema?: OpenApiSchemaObject;
}

interface WriteZodSchemasFromVerbsEntry {
  operationName: string;
  originalOperation: {
    requestBody?: OpenApiRequestBodyObject | OpenApiReferenceObject;
    parameters?: (OpenApiParameterObject | OpenApiReferenceObject)[];
  };
  response: {
    types: {
      success: WriteZodVerbResponseType[];
      errors: WriteZodVerbResponseType[];
    };
  };
  override?: {
    zod: {
      generate: WriteZodOutputOptions['override']['zod']['generate'];
    };
  };
}

type WriteZodSchemasFromVerbsInput = Record<
  string,
  WriteZodSchemasFromVerbsEntry
>;

interface WriteZodSchemasFromVerbsContext {
  output: {
    override: {
      useDates?: NormalizedOutputOptions['override']['useDates'];
      zod: Pick<
        NormalizedOutputOptions['override']['zod'],
        'dateTimeOptions' | 'timeOptions'
      >;
    };
  };
  spec: ContextSpec['spec'];
  target: string;
  workspace: string;
}

function generateZodSchemaFileContent(
  header: string,
  schemas: ZodSchemaFileEntry[],
): string {
  // Group the zod import with any reusable-schema imports (deduped across the
  // usually-single entries written to this file), then separate that block
  // from the schema content with a single blank line.
  const refImports = [
    ...new Set(schemas.flatMap((s) => s.importStatements ?? [])),
  ].toSorted();
  const importBlock = [`import { z as zod } from 'zod';`, ...refImports].join(
    '\n',
  );

  const schemaContent = schemas
    .map(({ schemaName, consts, zodExpression }) => {
      const schemaConsts = consts ? `${consts}\n` : '';

      return `${schemaConsts}export const ${schemaName} = ${zodExpression}

export type ${schemaName} = zod.input<typeof ${schemaName}>;
export type ${schemaName}Output = zod.output<typeof ${schemaName}>;`;
    })
    .join('\n\n');

  return `${header}${importBlock}\n\n${schemaContent}\n`;
}

const isValidSchemaIdentifier = (name: string) =>
  /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);

const isPrimitiveSchemaName = (name: string) =>
  ['string', 'number', 'boolean', 'void', 'unknown', 'Blob'].includes(name);

const dedupeSchemasByName = <T extends { name: string }>(schemas: T[]) => {
  const uniqueSchemas = new Map<string, T>();

  for (const schema of schemas) {
    if (!uniqueSchemas.has(schema.name)) {
      uniqueSchemas.set(schema.name, schema);
    }
  }

  return [...uniqueSchemas.values()];
};

const groupSchemasByFilePath = <T extends { filePath: string }>(
  schemas: T[],
) => {
  const grouped = new Map<string, T[]>();

  for (const schema of schemas) {
    const key = schema.filePath.toLowerCase();
    const existingGroup = grouped.get(key);

    if (existingGroup) {
      existingGroup.push(schema);
    } else {
      grouped.set(key, [schema]);
    }
  }

  const sortedGroups = [...grouped.values()].map((group) =>
    [...group].toSorted((a, b) =>
      a.filePath.localeCompare(b.filePath, 'en', { numeric: true }),
    ),
  );

  return sortedGroups.toSorted((a, b) =>
    a[0].filePath.localeCompare(b[0].filePath, 'en', { numeric: true }),
  );
};

async function writeZodSchemaIndex(
  schemasPath: string,
  fileExtension: string,
  header: string,
  schemaNames: string[],
  namingConvention: NamingConvention,
  shouldMergeExisting = false,
) {
  const importFileExtension = fileExtension.replace(/\.ts$/, '');
  const indexPath = path.join(schemasPath, `index.ts`);

  let existingExports = '';
  if (shouldMergeExisting && (await fs.pathExists(indexPath))) {
    const existingContent = await fs.readFile(indexPath, 'utf8');
    const headerMatch = /^(\/\*\*[\s\S]*?\*\/\n)?/.exec(existingContent);
    const headerPart = headerMatch ? headerMatch[0] : '';
    existingExports = existingContent.slice(headerPart.length).trim();
  }

  const newExports = schemaNames
    .map((schemaName) => {
      const fileName = conventionName(schemaName, namingConvention);
      return `export * from './${fileName}${importFileExtension}';`;
    })
    .toSorted()
    .join('\n');

  const allExports = existingExports
    ? `${existingExports}\n${newExports}`
    : newExports;

  const uniqueExports = [...new Set(allExports.split('\n'))]
    .filter((line) => line.trim())
    .toSorted()
    .join('\n');

  await fs.outputFile(indexPath, `${header}\n${uniqueExports}\n`);
}

export function generateZodSchemasInline(
  builder: WriteZodSchemasInput,
  output: WriteZodOutputOptions,
): string {
  const useReusableSchemas =
    output.override.zod.generateReusableSchemas === true;

  if (useReusableSchemas) {
    return generateZodSchemasInlineReusable(builder, output);
  }

  const schemasWithOpenApiDef = builder.schemas.filter((s) => s.schema);

  if (schemasWithOpenApiDef.length === 0) {
    return '';
  }

  const isZodV4 = !!output.packageJson && isZodVersionV4(output.packageJson);
  const strict = output.override.zod.strict.body;
  const coerce = output.override.zod.coerce.body;
  const schemas: ZodSchemaFileEntry[] = [];

  for (const { name, schema: schemaObject } of schemasWithOpenApiDef) {
    if (!schemaObject) {
      continue;
    }

    const context: ContextSpec = {
      spec: builder.spec,
      target: builder.target,
      workspace: '',
      output: output as ContextSpec['output'],
    };

    const dereferencedSchema = dereference(schemaObject, context);

    const zodDefinition = generateZodValidationSchemaDefinition(
      dereferencedSchema,
      context,
      name,
      strict,
      isZodV4,
      {
        required: true,
      },
    );

    const parsedZodDefinition = parseZodValidationSchemaDefinition(
      zodDefinition,
      context,
      coerce,
      strict,
      isZodV4,
    );

    schemas.push({
      schemaName: name,
      consts: parsedZodDefinition.consts,
      zodExpression: parsedZodDefinition.zod,
    });
  }

  if (schemas.length === 0) {
    return '';
  }

  return generateZodSchemaFileContent('', schemas);
}

function generateZodSchemasInlineReusable(
  builder: WriteZodSchemasInput,
  output: WriteZodOutputOptions,
): string {
  const schemasWithOpenApiDef = builder.schemas.filter((s) => s.schema);
  if (schemasWithOpenApiDef.length === 0) return '';

  const isZodV4 = !!output.packageJson && isZodVersionV4(output.packageJson);
  const strict = output.override.zod.strict.body;
  const coerce = output.override.zod.coerce.body;
  const context: ContextSpec = {
    spec: builder.spec,
    target: builder.target,
    workspace: '',
    output: output as ContextSpec['output'],
  };

  const refs = schemasWithOpenApiDef.map(
    ({ name }) => `#/components/schemas/${name}`,
  );

  resolveSchemaNames(refs, output.namingConvention);

  const entries = generateReusableSchemaSet(refs, context, {
    strict,
    isZodV4,
    coerce,
  });

  const rewritten = rewriteReusableSchemas(entries);

  const body = rewritten
    .map((entry) => {
      const consts = entry.consts ? `${entry.consts}\n\n` : '';
      return (
        `${consts}export const ${entry.name} = ${entry.zod};\n\n` +
        `export type ${entry.name} = zod.input<typeof ${entry.name}>;\n` +
        `export type ${entry.name}Output = zod.output<typeof ${entry.name}>;`
      );
    })
    .join('\n\n');

  return `import { z as zod } from 'zod';\n\n${body}\n`;
}

export async function writeZodSchemas(
  builder: WriteZodSchemasInput,
  schemasPath: string,
  fileExtension: string,
  header: string,
  output: WriteZodOutputOptions,
) {
  const useReusableSchemas = output.override.zod.generateReusableSchemas;

  if (useReusableSchemas) {
    await writeZodSchemasReusable(
      builder,
      schemasPath,
      fileExtension,
      header,
      output,
    );
    return;
  }

  const schemasWithOpenApiDef = builder.schemas.filter((s) => s.schema);
  const schemasToWrite: ZodSchemaFileToWrite[] = [];
  const isZodV4 = !!output.packageJson && isZodVersionV4(output.packageJson);
  const strict = output.override.zod.strict.body;
  const coerce = output.override.zod.coerce.body;

  for (const generatorSchema of schemasWithOpenApiDef) {
    const { name, schema: schemaObject } = generatorSchema;

    if (!schemaObject) {
      continue;
    }

    const fileName = conventionName(name, output.namingConvention);
    const filePath = path.join(schemasPath, `${fileName}${fileExtension}`);
    const context: ContextSpec = {
      spec: builder.spec,
      target: builder.target,
      workspace: '',
      output: output as ContextSpec['output'],
    };

    // Dereference the schema to resolve $ref
    const dereferencedSchema = dereference(schemaObject, context);

    const zodDefinition = generateZodValidationSchemaDefinition(
      dereferencedSchema,
      context,
      name,
      strict,
      isZodV4,
      {
        required: true,
      },
    );

    const parsedZodDefinition = parseZodValidationSchemaDefinition(
      zodDefinition,
      context,
      coerce,
      strict,
      isZodV4,
    );

    schemasToWrite.push({
      schemaName: name,
      filePath,
      consts: parsedZodDefinition.consts,
      zodExpression: parsedZodDefinition.zod,
    });
  }

  const groupedSchemasToWrite = groupSchemasByFilePath(schemasToWrite);

  for (const schemaGroup of groupedSchemasToWrite) {
    const fileContent = generateZodSchemaFileContent(header, schemaGroup);

    await fs.outputFile(schemaGroup[0].filePath, fileContent);
  }

  if (output.indexFiles) {
    const schemaNames = groupedSchemasToWrite.map(
      (schemaGroup) => schemaGroup[0].schemaName,
    );
    await writeZodSchemaIndex(
      schemasPath,
      fileExtension,
      header,
      schemaNames,
      output.namingConvention,
      false,
    );
  }
}

async function writeZodSchemasReusable(
  builder: WriteZodSchemasInput,
  schemasPath: string,
  fileExtension: string,
  header: string,
  output: WriteZodOutputOptions,
) {
  const isZodV4 = !!output.packageJson && isZodVersionV4(output.packageJson);
  const strict = output.override.zod.strict.body;
  const coerce = output.override.zod.coerce.body;
  const context: ContextSpec = {
    spec: builder.spec,
    target: builder.target,
    workspace: '',
    output: output as ContextSpec['output'],
  };

  // Roots = every component schema in the builder list. This matches today's
  // writeZodSchemas behavior of emitting all of them (the `schemas: { type: 'zod' }`
  // path passes the full schema list in via builder.schemas).
  const refs = builder.schemas
    .map(({ name }) => `#/components/schemas/${name}`)
    .filter((ref) => {
      const schemaName = ref.slice('#/components/schemas/'.length);
      const componentSchemas = (builder.spec.components?.schemas ??
        {}) as Record<string, unknown>;
      return componentSchemas[schemaName] !== undefined;
    });

  // Conflict guard.
  resolveSchemaNames(refs, output.namingConvention);

  const entries = generateReusableSchemaSet(refs, context, {
    strict,
    isZodV4,
    coerce,
  });

  const rewritten = rewriteReusableSchemas(entries);

  for (const entry of rewritten) {
    const fileName = conventionName(entry.name, output.namingConvention);
    const filePath = path.join(schemasPath, `${fileName}${fileExtension}`);
    const importExt = fileExtension.replace(/\.ts$/, '');
    const imports = [...entry.usedRefs]
      .filter((r) => r !== entry.name)
      .toSorted()
      .map((r) => {
        const importedFile = conventionName(r, output.namingConvention);
        return `import { ${r} } from './${importedFile}${importExt}';`;
      })
      .join('\n');

    const consts = entry.consts ? `${entry.consts}\n\n` : '';
    const fileContent =
      `${header}import { z as zod } from 'zod';\n` +
      (imports ? `${imports}\n\n` : '\n') +
      `${consts}export const ${entry.name} = ${entry.zod};\n\n` +
      `export type ${entry.name} = zod.input<typeof ${entry.name}>;\n` +
      `export type ${entry.name}Output = zod.output<typeof ${entry.name}>;\n`;

    await fs.outputFile(filePath, fileContent);
  }

  if (output.indexFiles && rewritten.length > 0) {
    const schemaNames = rewritten.map((e) => e.name);
    await writeZodSchemaIndex(
      schemasPath,
      fileExtension,
      header,
      schemaNames,
      output.namingConvention,
      true,
    );
  }
}

export async function writeZodSchemasFromVerbs(
  verbOptions: WriteZodSchemasFromVerbsInput,
  schemasPath: string,
  fileExtension: string,
  header: string,
  output: WriteZodOutputOptions,
  context: WriteZodSchemasFromVerbsContext,
) {
  const zodContext = context as unknown as ContextSpec;
  const verbOptionsArray = Object.values(verbOptions);

  if (verbOptionsArray.length === 0) {
    return;
  }

  const isZodV4 = !!output.packageJson && isZodVersionV4(output.packageJson);
  const strict = output.override.zod.strict.body;
  const coerce = output.override.zod.coerce.body;
  const useReusableSchemas =
    output.override.zod.generateReusableSchemas === true;

  const generateVerbsSchemas = verbOptionsArray.flatMap((verbOption) => {
    const operation = verbOption.originalOperation;
    const shouldGenerate = {
      ...output.override.zod.generate,
      ...verbOption.override?.zod.generate,
    };

    const requestBody = operation.requestBody;
    const requestBodyContent =
      requestBody && 'content' in requestBody
        ? (requestBody as OpenApiRequestBodyObject).content
        : undefined;
    // Pick the first available body media type. JSON wins; otherwise fall back
    // to form-data / urlencoded so we still generate a `*Body` schema for
    // operations whose only payload is multipart (e.g. file uploads). Without
    // this, endpoints that import `${OperationName}Body` from the zod schemas
    // path resolve to a missing export. (issue #3066)
    const jsonBodyMedia = requestBodyContent?.['application/json'];
    const formDataBodyMedia = requestBodyContent?.['multipart/form-data'];
    const formUrlEncodedBodyMedia =
      requestBodyContent?.['application/x-www-form-urlencoded'];
    const [bodyContentType, bodyMedia] = jsonBodyMedia
      ? (['application/json', jsonBodyMedia] as const)
      : formDataBodyMedia
        ? (['multipart/form-data', formDataBodyMedia] as const)
        : formUrlEncodedBodyMedia
          ? ([
              'application/x-www-form-urlencoded',
              formUrlEncodedBodyMedia,
            ] as const)
          : [undefined, undefined];
    const bodySchema = bodyMedia?.schema as OpenApiSchemaObject | undefined;

    const bodySchemas =
      shouldGenerate.body && bodySchema
        ? [
            {
              name: `${pascal(verbOption.operationName)}Body`,
              schema: useReusableSchemas
                ? bodySchema
                : dereference(bodySchema, zodContext),
              bodyContentType,
              encoding: bodyMedia?.encoding,
            },
          ]
        : [];

    const parameters = operation.parameters;

    const queryParams = parameters?.filter(
      (p): p is OpenApiParameterObject => 'in' in p && p.in === 'query',
    );

    const queryParamsSchemas =
      shouldGenerate.query && queryParams && queryParams.length > 0
        ? [
            {
              name: `${pascal(verbOption.operationName)}Params`,
              schema: {
                type: 'object' as const,
                properties: Object.fromEntries(
                  queryParams
                    .filter((p) => 'schema' in p && p.schema)
                    .map((p) => [
                      p.name,
                      useReusableSchemas
                        ? (p.schema as OpenApiSchemaObject)
                        : dereference(
                            p.schema as OpenApiSchemaObject,
                            zodContext,
                          ),
                    ]),
                ) as Record<string, OpenApiSchemaObject>,
                required: queryParams
                  .filter((p) => p.required)
                  .map((p) => p.name)
                  .filter((name): name is string => name !== undefined),
              },
            },
          ]
        : [];

    const headerParams = parameters?.filter(
      (p): p is OpenApiParameterObject => 'in' in p && p.in === 'header',
    );

    const headerParamsSchemas =
      shouldGenerate.header && headerParams && headerParams.length > 0
        ? [
            {
              name: `${pascal(verbOption.operationName)}Headers`,
              schema: {
                type: 'object' as const,
                properties: Object.fromEntries(
                  headerParams
                    .filter((p) => 'schema' in p && p.schema)
                    .map((p) => [
                      p.name,
                      useReusableSchemas
                        ? (p.schema as OpenApiSchemaObject)
                        : dereference(
                            p.schema as OpenApiSchemaObject,
                            zodContext,
                          ),
                    ]),
                ) as Record<string, OpenApiSchemaObject>,
                required: headerParams
                  .filter((p) => p.required)
                  .map((p) => p.name)
                  .filter((name): name is string => name !== undefined),
              },
            },
          ]
        : [];

    const responseSchemas = shouldGenerate.response
      ? [
          ...verbOption.response.types.success,
          ...verbOption.response.types.errors,
        ]
          .filter(
            (
              responseType,
            ): responseType is typeof responseType & {
              originalSchema: OpenApiSchemaObject;
            } =>
              !!responseType.originalSchema &&
              !responseType.isRef &&
              isValidSchemaIdentifier(responseType.value) &&
              !isPrimitiveSchemaName(responseType.value),
          )
          .map((responseType) => ({
            name: responseType.value,
            schema: useReusableSchemas
              ? responseType.originalSchema
              : dereference(responseType.originalSchema, zodContext),
          }))
      : [];

    return dedupeSchemasByName([
      ...bodySchemas,
      ...queryParamsSchemas,
      ...headerParamsSchemas,
      ...responseSchemas,
    ]);
  });

  const uniqueVerbsSchemas = dedupeSchemasByName(generateVerbsSchemas);
  const schemasToWrite: ZodSchemaFileToWrite[] = [];

  for (const entry of uniqueVerbsSchemas) {
    // Pure-ref wrapper skip: if the underlying schema is just `{ $ref: ... }` AND
    // the flag is on, don't emit a per-operation wrapper file. Consumers import
    // the named component schema directly.
    if (
      useReusableSchemas &&
      entry.schema &&
      typeof (entry.schema as { $ref?: unknown }).$ref === 'string' &&
      Object.keys(entry.schema).length === 1
    ) {
      continue;
    }

    const { name, schema } = entry;
    const fileName = conventionName(name, output.namingConvention);
    const filePath = path.join(schemasPath, `${fileName}${fileExtension}`);

    // multipart/form-data bodies need file-aware overrides so binary fields
    // become `z.instanceof(File)` instead of plain strings.
    const isFormDataBody =
      'bodyContentType' in entry &&
      entry.bodyContentType === 'multipart/form-data';

    const zodDefinition: ZodValidationSchemaDefinition = isFormDataBody
      ? generateFormDataZodSchema(
          schema,
          zodContext,
          name,
          strict,
          isZodV4,
          'encoding' in entry
            ? (entry.encoding as
                | Record<string, { contentType?: string }>
                | undefined)
            : undefined,
          useReusableSchemas,
        )
      : generateZodValidationSchemaDefinition(
          schema,
          zodContext,
          name,
          strict,
          isZodV4,
          {
            required: true,
            useReusableSchemas,
          },
        );

    const parsedZodDefinition = parseZodValidationSchemaDefinition(
      zodDefinition,
      zodContext,
      coerce,
      strict,
      isZodV4,
    );

    // Operation schemas sit at the top of the dependency graph, so any
    // `__REF_<name>__` sentinel resolves to a direct (non-lazy) reference.
    // Rewrite them to bare identifiers and emit the matching imports, the
    // same way `generateZod` does for the operation files (issue #3463).
    let zodExpression = parsedZodDefinition.zod;
    let importStatements: string[] | undefined;
    if (useReusableSchemas && parsedZodDefinition.usedRefs.size > 0) {
      zodExpression = rewriteSentinelsToDirect(zodExpression);
      const importExt = fileExtension.replace(/\.ts$/, '');
      importStatements = [...parsedZodDefinition.usedRefs]
        .filter((refName) => refName !== name)
        .toSorted()
        .map((refName) => {
          const importedFile = conventionName(refName, output.namingConvention);
          return `import { ${refName} } from './${importedFile}${importExt}';`;
        });
    }

    schemasToWrite.push({
      schemaName: name,
      filePath,
      consts: parsedZodDefinition.consts,
      zodExpression,
      importStatements,
    });
  }

  const groupedSchemasToWrite = groupSchemasByFilePath(schemasToWrite);

  for (const schemaGroup of groupedSchemasToWrite) {
    const fileContent = generateZodSchemaFileContent(header, schemaGroup);

    await fs.outputFile(schemaGroup[0].filePath, fileContent);
  }

  if (output.indexFiles && uniqueVerbsSchemas.length > 0) {
    const schemaNames = groupedSchemasToWrite.map(
      (schemaGroup) => schemaGroup[0].schemaName,
    );
    await writeZodSchemaIndex(
      schemasPath,
      fileExtension,
      header,
      schemaNames,
      output.namingConvention,
      true,
    );
  }
}
