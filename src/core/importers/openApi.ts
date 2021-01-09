import { OpenAPIObject } from 'openapi3-ts';
import swagger2openapi from 'swagger2openapi';
import YAML from 'yamljs';
import { ImportOpenApi } from '../../types';
import { WriteSpecsProps } from '../../types/writers';
import { dynamicImport } from '../../utils/imports';
import { generateApi } from '../generators/api';
import { generateResponsesDefinition } from '../generators/responsesDefinition';
import { generateSchemasDefinition } from '../generators/schemaDefinition';
import { resolveDiscriminator } from '../resolvers/dscriminator';
import { ibmOpenapiValidator } from '../validators/ibm-openapi-validator';

/**
 * Import and parse the openapi spec from a yaml/json
 *
 * @param data raw data of the spec
 * @param format format of the spec
 */
const importSpecs = (
  data: string | object,
  extension: 'yaml' | 'json',
): Promise<OpenAPIObject> => {
  const schema =
    typeof data === 'string'
      ? extension === 'yaml'
        ? YAML.parse(data)
        : JSON.parse(data)
      : data;

  return new Promise((resolve, reject) => {
    if (!schema.openapi || !schema.openapi.startsWith('3.0')) {
      swagger2openapi.convertObj(schema, {}, (err, { openapi }) => {
        if (err) {
          reject(err);
        } else {
          resolve(openapi);
        }
      });
    } else {
      resolve(schema);
    }
  });
};

/**
 * Main entry of the generator. Generate orval from openAPI.
 *
 * @param options.data raw data of the spec
 * @param options.format format of the spec
 * @param options.transformer custom function to transform your spec
 * @param options.validation validate the spec with ibm-openapi-validator tool
 */
export const importOpenApi = async ({
  data,
  format,
  input,
  output,
  workspace,
}: ImportOpenApi): Promise<WriteSpecsProps> => {
  let specs = await importSpecs(data, format);

  if (input?.override?.transformer) {
    const transformerFn = dynamicImport(input.override.transformer, workspace);
    specs = transformerFn(specs);
  }

  if (input?.validation) {
    await ibmOpenapiValidator(specs);
  }

  resolveDiscriminator(specs);

  const schemaDefinition = generateSchemasDefinition(
    specs.components?.schemas,
    output?.override,
  );

  const responseDefinition = generateResponsesDefinition(
    specs.components?.responses,
    output?.override,
  );

  const api = generateApi(workspace, specs, output);

  const schemas = [...schemaDefinition, ...responseDefinition, ...api.schemas];

  return { ...api, schemas, info: specs.info };
};
