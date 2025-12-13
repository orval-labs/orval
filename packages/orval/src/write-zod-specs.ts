import {
  conventionName,
  type ContextSpec,
  type NormalizedOutputOptions,
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

export async function writeZodSchemas(
  builder: WriteSpecBuilder,
  schemasPath: string,
  fileExtension: string,
  header: string,
  output: NormalizedOutputOptions,
) {
  const schemasWithOpenApiDef = builder.schemas.filter((s) => s.schema);
  const importFileExtension = fileExtension.replace(/\.ts$/, '');

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

      const fileContent = `${header}import { z as zod } from 'zod';
${parsedZodDefinition.consts ? `\n${parsedZodDefinition.consts}\n` : ''}
export const ${name}Schema = ${parsedZodDefinition.zod};
export type ${name} = zod.infer<typeof ${name}Schema>;
`;

      await fs.outputFile(filePath, fileContent);
    }),
  );

  if (output.indexFiles) {
    const schemaFilePath = upath.join(schemasPath, `/index${fileExtension}`);

    const exports = schemasWithOpenApiDef
      .map((schema) => {
        const fileName = conventionName(schema.name, output.namingConvention);
        return `export * from './${fileName}${importFileExtension}';`;
      })
      .toSorted((a, b) => a.localeCompare(b))
      .join('\n');

    const fileContent = `${header}\n${exports}`;
    await fs.outputFile(schemaFilePath, fileContent);
  }
}
