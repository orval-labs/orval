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
  upath,
  type ZodCoerceType,
} from '@orval/core';
import {
  dereference,
  generateZodValidationSchemaDefinition,
  isZodVersionV4,
  parseZodValidationSchemaDefinition,
} from '@orval/zod';
import fs from 'fs-extra';

type ZodSchemaFileEntry = {
  schemaName: string;
  consts: string;
  zodExpression: string;
};

type ZodSchemaFileToWrite = ZodSchemaFileEntry & {
  filePath: string;
};

type WriteZodOutputOptions = {
  namingConvention: NamingConvention;
  indexFiles: boolean;
  packageJson?: NormalizedOutputOptions['packageJson'];
  override: {
    zod: {
      strict: {
        body: boolean;
      };
      coerce: {
        body: boolean | ZodCoerceType[];
      };
    };
  };
};

type WriteZodSchemasInput = {
  spec: ContextSpec['spec'];
  target: string;
  schemas: {
    name: string;
    schema?: OpenApiSchemaObject | OpenApiReferenceObject;
  }[];
};

type WriteZodVerbResponseType = {
  value: string;
  isRef?: boolean;
  originalSchema?: OpenApiSchemaObject;
};

type WriteZodSchemasFromVerbsInput = Record<
  string,
  {
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
  }
>;

type WriteZodSchemasFromVerbsContext = {
  output: {
    override: {
      useDates?: boolean;
      zod: {
        dateTimeOptions?: Record<string, unknown>;
        timeOptions?: Record<string, unknown>;
      };
    };
  };
  spec: ContextSpec['spec'];
  target: string;
  workspace: string;
};

function generateZodSchemaFileContent(
  header: string,
  schemas: ZodSchemaFileEntry[],
): string {
  const schemaContent = schemas
    .map(({ schemaName, consts, zodExpression }) => {
      const schemaConsts = consts ? `${consts}\n` : '';

      return `${schemaConsts}export const ${schemaName} = ${zodExpression}

export type ${schemaName} = zod.infer<typeof ${schemaName}>;`;
    })
    .join('\n\n');

  return `${header}import { z as zod } from 'zod';

${schemaContent}
`;
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
    [...group].toSorted((a, b) => a.filePath.localeCompare(b.filePath)),
  );

  return sortedGroups.toSorted((a, b) =>
    a[0].filePath.localeCompare(b[0].filePath),
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
  const indexPath = upath.join(schemasPath, `index${fileExtension}`);

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

export async function writeZodSchemas(
  builder: WriteZodSchemasInput,
  schemasPath: string,
  fileExtension: string,
  header: string,
  output: WriteZodOutputOptions,
) {
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
    const filePath = upath.join(schemasPath, `${fileName}${fileExtension}`);
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

export async function writeZodSchemasFromVerbs(
  verbOptions: WriteZodSchemasFromVerbsInput,
  schemasPath: string,
  fileExtension: string,
  header: string,
  output: WriteZodOutputOptions,
  context: WriteZodSchemasFromVerbsContext,
) {
  const zodContext = context as ContextSpec;
  const verbOptionsArray = Object.values(verbOptions);

  if (verbOptionsArray.length === 0) {
    return;
  }

  const isZodV4 = !!output.packageJson && isZodVersionV4(output.packageJson);
  const strict = output.override.zod.strict.body;
  const coerce = output.override.zod.coerce.body;

  const generateVerbsSchemas = verbOptionsArray.flatMap((verbOption) => {
    const operation = verbOption.originalOperation;

    const requestBody = operation.requestBody as
      | OpenApiRequestBodyObject
      | OpenApiReferenceObject
      | undefined;
    const requestBodyContent =
      requestBody && 'content' in requestBody
        ? (requestBody as OpenApiRequestBodyObject).content
        : undefined;
    const bodySchema = requestBodyContent?.['application/json']?.schema as
      | OpenApiSchemaObject
      | undefined;

    const bodySchemas = bodySchema
      ? [
          {
            name: `${pascal(verbOption.operationName)}Body`,
            schema: dereference(bodySchema, zodContext),
          },
        ]
      : [];

    const parameters = operation.parameters;

    const queryParams = parameters?.filter(
      (p): p is OpenApiParameterObject => 'in' in p && p.in === 'query',
    );

    const queryParamsSchemas =
      queryParams && queryParams.length > 0
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
                      dereference(p.schema as OpenApiSchemaObject, zodContext),
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
      headerParams && headerParams.length > 0
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
                      dereference(p.schema as OpenApiSchemaObject, zodContext),
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

    const responseSchemas = [
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
        schema: dereference(responseType.originalSchema, zodContext),
      }));

    return dedupeSchemasByName([
      ...bodySchemas,
      ...queryParamsSchemas,
      ...headerParamsSchemas,
      ...responseSchemas,
    ]);
  });

  const uniqueVerbsSchemas = dedupeSchemasByName(generateVerbsSchemas);
  const schemasToWrite: ZodSchemaFileToWrite[] = [];

  for (const { name, schema } of uniqueVerbsSchemas) {
    const fileName = conventionName(name, output.namingConvention);
    const filePath = upath.join(schemasPath, `${fileName}${fileExtension}`);

    const zodDefinition = generateZodValidationSchemaDefinition(
      schema,
      zodContext,
      name,
      strict,
      isZodV4,
      {
        required: true,
      },
    );

    const parsedZodDefinition = parseZodValidationSchemaDefinition(
      zodDefinition,
      zodContext,
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
