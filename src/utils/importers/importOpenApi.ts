import { OpenAPIObject } from 'openapi3-ts';
import swagger2openapi from 'swagger2openapi';
import YAML from 'yamljs';
import { MockOptions } from '../../types';
import { generateApi } from '../generators/generateApi';
import { generateMocks } from '../generators/generateMocks';
import { generateResponsesDefinition } from '../generators/generateResponsesDefinition';
import { generateSchemasDefinition } from '../generators/generateSchemaDefinition';
import { resolveDiscriminator } from '../resolvers/resolveDiscriminator';
import { ibmOpenapiValidator } from '../validators/ibm-openapi-validator';

/**
 * Import and parse the openapi spec from a yaml/json
 *
 * @param data raw data of the spec
 * @param format format of the spec
 */
const importSpecs = (data: string, extension: 'yaml' | 'json'): Promise<OpenAPIObject> => {
  const schema = extension === 'yaml' ? YAML.parse(data) : JSON.parse(data);

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
 * Main entry of the generator. Generate restful-client from openAPI.
 *
 * @param options.data raw data of the spec
 * @param options.format format of the spec
 * @param options.transformer custom function to transform your spec
 * @param options.validation validate the spec with ibm-openapi-validator tool
 */
export const importOpenApi = async ({
  data,
  format,
  transformer,
  validation,
  mockOptions,
}: {
  data: string;
  format: 'yaml' | 'json';
  transformer?: (specs: OpenAPIObject) => OpenAPIObject;
  validation?: boolean;
  mockOptions?: MockOptions;
}) => {
  let specs = await importSpecs(data, format);
  if (transformer) {
    specs = transformer(specs);
  }

  if (validation) {
    await ibmOpenapiValidator(specs);
  }

  resolveDiscriminator(specs);

  const schemaDefinition = generateSchemasDefinition(specs.components && specs.components.schemas);
  const responseDefinition = generateResponsesDefinition(specs.components && specs.components.responses);

  const models = [...schemaDefinition, ...responseDefinition];

  const api = generateApi(specs);

  const mocks = generateMocks(specs, mockOptions);

  return { api, mocks, models };
};
