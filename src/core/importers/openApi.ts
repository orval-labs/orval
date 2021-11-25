import { OpenAPIObject } from 'openapi3-ts';
import { ImportOpenApi, InputOptions } from '../../types';
import { GeneratorSchema } from '../../types/generator';
import { WriteSpecsProps } from '../../types/writers';
import { asyncReduce } from '../../utils/async-reduce';
import { swaggerConverter } from '../../utils/converter';
import { dynamicImport } from '../../utils/imports';
import { generateApi } from '../generators/api';
import { generateComponentDefinition } from '../generators/componentDefinition';
import { generateParameterDefinition } from '../generators/parameterDefinition';
import { generateSchemasDefinition } from '../generators/schemaDefinition';
import { ibmOpenapiValidator } from '../validators/ibm-openapi-validator';

const generateInputSpecs = async ({
  specs,
  input,
  workspace,
}: {
  specs: Record<string, OpenAPIObject>;
  input: InputOptions;
  workspace: string;
}): Promise<Record<string, OpenAPIObject>> => {
  const transformerFn = input.override?.transformer
    ? await dynamicImport(input.override.transformer, workspace)
    : undefined;

  return asyncReduce(
    Object.entries(specs),
    async (acc, [specKey, value]) => {
      const schema = await swaggerConverter(
        value,
        input.converterOptions,
        specKey,
      );
      const transfomedSchema = transformerFn ? transformerFn(schema) : schema;

      if (input.validation) {
        await ibmOpenapiValidator(transfomedSchema);
      }

      return {
        ...acc,
        [specKey]: transfomedSchema,
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
      const context = {
        specKey,
        workspace,
        specs,
        override: output.override,
        tslint: output.tslint,
      };
      const schemaDefinition = await generateSchemasDefinition(
        spec.components?.schemas,
        context,
        output.override.components.schemas.suffix,
      );

      const responseDefinition = await generateComponentDefinition(
        spec.components?.responses,
        context,
        output.override.components.responses.suffix,
      );

      const bodyDefinition = await generateComponentDefinition(
        spec.components?.requestBodies,
        context,
        output.override.components.requestBodies.suffix,
      );

      const parameters = await generateParameterDefinition(
        spec.components?.parameters,
        context,
        output.override.components.parameters.suffix,
      );

      const schemas = [
        ...schemaDefinition,
        ...responseDefinition,
        ...bodyDefinition,
        ...parameters,
      ];

      if (!schemas.length) {
        return acc;
      }

      return {
        ...acc,
        [specKey]: schemas,
      };
    },
    {} as Record<string, GeneratorSchema[]>,
  );

  const api = await generateApi({
    output,
    context: {
      specKey: path,
      workspace,
      specs,
      override: output.override,
      tslint: output.tslint,
    },
  });

  return {
    ...api,
    schemas: { ...schemas, [path]: [...schemas[path], ...api.schemas] },
    rootSpecKey: path,
    info: specs[path].info,
  };
};
