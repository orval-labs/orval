import {OpenAPIObject} from 'openapi3-ts';
import swagger2openapi from 'swagger2openapi';
import YAML from 'yamljs';
import {MockOptions, OverrideOptions} from '../../types';
import {WriteSpecsProps} from '../../types/writers';
import {generateApi} from '../generators/generateApi';
import {generateResponsesDefinition} from '../generators/generateResponsesDefinition';
import {generateSchemasDefinition} from '../generators/generateSchemaDefinition';
import {resolveDiscriminator} from '../resolvers/resolveDiscriminator';
import {ibmOpenapiValidator} from '../validators/ibm-openapi-validator';

/**
 * Import and parse the openapi spec from a yaml/json
 *
 * @param data raw data of the spec
 * @param format format of the spec
 */
const importSpecs = (
  data: string,
  extension: 'yaml' | 'json'
): Promise<OpenAPIObject> => {
  const schema = extension === 'yaml' ? YAML.parse(data) : JSON.parse(data);

  return new Promise((resolve, reject) => {
    if (!schema.openapi || !schema.openapi.startsWith('3.0')) {
      swagger2openapi.convertObj(schema, {}, (err, {openapi}) => {
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
  transformer,
  validation,
  override,
  mockOptions
}: {
  data: string;
  format: 'yaml' | 'json';
  transformer?: (specs: OpenAPIObject) => OpenAPIObject;
  validation?: boolean;
  override?: OverrideOptions;
  mockOptions?: MockOptions;
}): Promise<WriteSpecsProps> => {
  let specs = await importSpecs(data, format);
  if (transformer) {
    specs = transformer(specs);
  }

  if (validation) {
    await ibmOpenapiValidator(specs);
  }

  resolveDiscriminator(specs);

  const schemaDefinition = generateSchemasDefinition(specs.components?.schemas);
  const responseDefinition = generateResponsesDefinition(
    specs.components?.responses
  );

  const api = generateApi(specs, override, mockOptions);
  const schemas = [...schemaDefinition, ...responseDefinition, ...api.schemas];

  //const mocks = generateMocks(specs, mockOptions);

  return {...api, schemas, info: specs.info};
};
