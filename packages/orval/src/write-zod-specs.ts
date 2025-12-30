import {
  type ContextSpec,
  conventionName,
  type GeneratorVerbOptions,
  type NamingConvention,
  type NormalizedOutputOptions,
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
    .sort()
    .join('\n');

  const allExports = existingExports
    ? `${existingExports}\n${newExports}`
    : newExports;

  const uniqueExports = [...new Set(allExports.split('\n'))]
    .filter((line) => line.trim())
    .sort()
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
      const strict =
        typeof output.override?.zod?.strict === 'object'
          ? (output.override.zod.strict.body ?? false)
          : (output.override?.zod?.strict ?? false);
      const coerce =
        typeof output.override?.zod?.coerce === 'object'
          ? (output.override.zod.coerce.body ?? false)
          : (output.override?.zod?.coerce ?? false);

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
  const strict =
    typeof output.override?.zod?.strict === 'object'
      ? (output.override.zod.strict.body ?? false)
      : (output.override?.zod?.strict ?? false);
  const coerce =
    typeof output.override?.zod?.coerce === 'object'
      ? (output.override.zod.coerce.body ?? false)
      : (output.override?.zod?.coerce ?? false);

  const generateVerbsSchemas = verbOptionsArray.flatMap((verbOption) => {
    const operation = verbOption.originalOperation;

    const bodySchema =
      operation.requestBody && 'content' in operation.requestBody
        ? operation.requestBody.content['application/json']?.schema
        : undefined;

    const bodySchemas = bodySchema
      ? [
          {
            name: `${pascal(verbOption.operationName)}Body`,
            schema: dereference(bodySchema as OpenApiSchemaObject, context),
          },
        ]
      : [];

    const queryParams = operation.parameters?.filter(
      (p) => 'in' in p && p.in === 'query',
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
                ),
                required: queryParams
                  .filter((p) => p.required)
                  .map((p) => p.name),
              },
            },
          ]
        : [];

    const headerParams = operation.parameters?.filter(
      (p) => 'in' in p && p.in === 'header',
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
                ),
                required: headerParams
                  .filter((p) => p.required)
                  .map((p) => p.name),
              },
            },
          ]
        : [];

    return [...bodySchemas, ...queryParamsSchemas, ...headerParamsSchemas];
  });

  await Promise.all(
    generateVerbsSchemas.map(async ({ name, schema }) => {
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

  if (output.indexFiles && generateVerbsSchemas.length > 0) {
    const schemaNames = generateVerbsSchemas.map((s) => s.name);
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
