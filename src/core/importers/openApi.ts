import { OpenAPIObject } from 'openapi3-ts';
import { ImportOpenApi, InputOptions } from '../../types';
import { GeneratorSchema } from '../../types/generator';
import { WriteSpecsProps } from '../../types/writers';
import { asyncReduce } from '../../utils/async-reduce';
import { swaggerConverter } from '../../utils/converter';
import { dynamicImport } from '../../utils/imports';
import { generateApi } from '../generators/api';
import { generateResponsesDefinition } from '../generators/responsesDefinition';
import { generateSchemasDefinition } from '../generators/schemaDefinition';
import { ibmOpenapiValidator } from '../validators/ibm-openapi-validator';

const generateInputSpecs = async ({
  specs,
  input,
  workspace,
}: {
  specs: Record<string, OpenAPIObject>;
  input?: InputOptions;
  workspace: string;
}): Promise<Record<string, OpenAPIObject>> => {
  const transformerFn = input?.override?.transformer
    ? await dynamicImport(input.override.transformer, workspace)
    : undefined;

  return asyncReduce(
    Object.entries(specs),
    async (acc, [key, value]) => {
      const schema = await swaggerConverter(value);
      const transfomedSchema = transformerFn ? transformerFn(schema) : schema;

      if (input?.validation) {
        await ibmOpenapiValidator(transfomedSchema);
      }

      return {
        ...acc,
        [key]: transfomedSchema,
      };
    },
    {} as Record<string, OpenAPIObject>,
  );
};

export const importOpenApi = async ({
  data,
  input,
  output,
  path,
  workspace,
}: ImportOpenApi): Promise<WriteSpecsProps> => {
  const specs = await generateInputSpecs({ specs: data, input, workspace });

  const schemas = await asyncReduce(
    Object.entries(specs),
    async (acc, [specKey, spec]) => {
      const schemaDefinition = await generateSchemasDefinition(
        spec.components?.schemas,
        { specKey, workspace, specs },
      );

      const responseDefinition = await generateResponsesDefinition(
        spec.components?.responses,
        { specKey, workspace, specs },
      );

      return {
        ...acc,
        [specKey]: [...schemaDefinition, ...responseDefinition],
      };
    },
    {} as Record<string, GeneratorSchema[]>,
  );

  const api = await generateApi({
    output,
    context: { specKey: path, workspace, specs },
  });

  return {
    ...api,
    schemas: { ...schemas, [path]: [...schemas[path], ...api.schemas] },
    rootSpecKey: path,
    info: specs[path].info,
  };
};
