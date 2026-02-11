import {
  type ContextSpec,
  conventionName,
  type GeneratorVerbOptions,
  type NamingConvention,
  type NormalizedOutputOptions,
  type OpenApiParameterObject,
  type OpenApiReferenceObject,
  type OpenApiRequestBodyObject,
  type OpenApiSchemaObject,
  pascal,
  upath,
  type WriteSpecBuilder,
} from '@orval/core';
import {
  dereference,
  generateZodValidationSchemaDefinition,
  isZodVersionV4,
  parseZodValidationSchemaDefinition,
} from '@orval/zod';
import fs from 'fs-extra';

function generateZodSchemaFileContent(
  header: string,
  schemaName: string,
  zodContent: string,
): string {
  return `${header}import { z as zod } from 'zod';

export const ${schemaName} = ${zodContent}

export type ${schemaName} = zod.infer<typeof ${schemaName}>;
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
  builder: WriteSpecBuilder,
  schemasPath: string,
  fileExtension: string,
  header: string,
  output: NormalizedOutputOptions,
) {
  const schemasWithOpenApiDef = builder.schemas.filter((s) => s.schema);

  await Promise.all(
    schemasWithOpenApiDef.map(async (generatorSchema) => {
      const { name, schema: schemaObject } = generatorSchema;

      if (!schemaObject) {
        return;
      }

      const fileName = conventionName(name, output.namingConvention);
      const filePath = upath.join(schemasPath, `${fileName}${fileExtension}`);
      const context: ContextSpec = {
        spec: builder.spec,
        target: builder.target,
        workspace: '',
        output,
      };

      const isZodV4 =
        !!output.packageJson && isZodVersionV4(output.packageJson);
      const strict = output.override.zod.strict.body;
      const coerce = output.override.zod.coerce.body;

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

      const zodContent = parsedZodDefinition.consts
        ? `${parsedZodDefinition.consts}\n${parsedZodDefinition.zod}`
        : parsedZodDefinition.zod;

      const fileContent = generateZodSchemaFileContent(
        header,
        name,
        zodContent,
      );

      await fs.outputFile(filePath, fileContent);
    }),
  );

  if (output.indexFiles) {
    const schemaNames = schemasWithOpenApiDef.map((schema) => schema.name);
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
  verbOptions: Record<string, GeneratorVerbOptions>,
  schemasPath: string,
  fileExtension: string,
  header: string,
  output: NormalizedOutputOptions,
  context: ContextSpec,
) {
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
            schema: dereference(bodySchema, context),
          },
        ]
      : [];

    const parameters = operation.parameters as
      | (OpenApiParameterObject | OpenApiReferenceObject)[]
      | undefined;

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
                      dereference(p.schema as OpenApiSchemaObject, context),
                    ]),
                ) as Record<string, OpenApiSchemaObject>,
                required: queryParams
                  .filter((p) => p.required)
                  .map((p) => p.name),
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
                      dereference(p.schema as OpenApiSchemaObject, context),
                    ]),
                ) as Record<string, OpenApiSchemaObject>,
                required: headerParams
                  .filter((p) => p.required)
                  .map((p) => p.name),
              },
            },
          ]
        : [];

    const responseSchemas = [
      ...verbOption.response.types.success,
      ...verbOption.response.types.errors,
    ]
      .filter(
        (responseType) =>
          responseType.originalSchema &&
          !responseType.isRef &&
          isValidSchemaIdentifier(responseType.value) &&
          !isPrimitiveSchemaName(responseType.value),
      )
      .map((responseType) => ({
        name: responseType.value,
        schema: dereference(responseType.originalSchema!, context),
      }));

    return dedupeSchemasByName([
      ...bodySchemas,
      ...queryParamsSchemas,
      ...headerParamsSchemas,
      ...responseSchemas,
    ]);
  });

  const uniqueVerbsSchemas = dedupeSchemasByName(generateVerbsSchemas);

  await Promise.all(
    uniqueVerbsSchemas.map(async ({ name, schema }) => {
      const fileName = conventionName(name, output.namingConvention);
      const filePath = upath.join(schemasPath, `${fileName}${fileExtension}`);

      const zodDefinition = generateZodValidationSchemaDefinition(
        schema,
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

      const zodContent = parsedZodDefinition.consts
        ? `${parsedZodDefinition.consts}\n${parsedZodDefinition.zod}`
        : parsedZodDefinition.zod;

      const fileContent = generateZodSchemaFileContent(
        header,
        name,
        zodContent,
      );

      await fs.outputFile(filePath, fileContent);
    }),
  );

  if (output.indexFiles && uniqueVerbsSchemas.length > 0) {
    const schemaNames = [...new Set(uniqueVerbsSchemas.map((s) => s.name))];
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
