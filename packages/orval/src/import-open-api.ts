import {
  asyncReduce,
  ContextSpecs,
  dynamicImport,
  generateComponentDefinition,
  generateParameterDefinition,
  generateSchemasDefinition,
  GeneratorSchema,
  ibmOpenapiValidator,
  ImportOpenApi,
  InputOptions,
  isObject,
  isReference,
  isSchema,
  NormalizedOutputOptions,
  openApiConverter,
  upath,
  WriteSpecsBuilder,
} from '@orval/core';
import { JSONSchema6, JSONSchema7 } from 'json-schema';
import { OpenAPIObject, SchemasObject } from 'openapi3-ts/oas30';

import { getApiBuilder } from './api';

export const importOpenApi = async ({
  data,
  input,
  output,
  target,
  workspace,
}: ImportOpenApi): Promise<WriteSpecsBuilder> => {
  const specs = await generateInputSpecs({ specs: data, input, workspace });

  const schemas = getApiSchemas({ input, output, target, workspace, specs });

  const api = await getApiBuilder({
    input,
    output,
    context: {
      specKey: target,
      target,
      workspace,
      specs,
      output,
    },
  });

  return {
    ...api,
    schemas: {
      ...schemas,
      [target]: [...(schemas[target] ?? []), ...api.schemas],
    },
    target,
    info: specs[target].info,
  };
};

const generateInputSpecs = async ({
  specs,
  input,
  workspace,
}: {
  specs: JSONSchema6 | JSONSchema7 | Record<string, OpenAPIObject | unknown>;
  input: InputOptions;
  workspace: string;
}): Promise<Record<string, OpenAPIObject>> => {
  const transformerFn = input.override?.transformer
    ? await dynamicImport(input.override.transformer, workspace)
    : undefined;

  return asyncReduce(
    Object.entries(specs),
    async (acc, [specKey, value]) => {
      const schema = await openApiConverter(
        value,
        input.converterOptions,
        specKey,
      );

      const transfomedSchema = transformerFn ? transformerFn(schema) : schema;

      if (input.validation) {
        await ibmOpenapiValidator(transfomedSchema, input.validation);
      }

      acc[specKey] = transfomedSchema;

      return acc;
    },
    {} as Record<string, OpenAPIObject>,
  );
};

const getApiSchemas = ({
  input,
  output,
  target,
  workspace,
  specs,
}: {
  input: InputOptions;
  output: NormalizedOutputOptions;
  workspace: string;
  target: string;
  specs: Record<string, OpenAPIObject>;
}) => {
  return Object.entries(specs).reduce<Record<string, GeneratorSchema[]>>(
    (acc, [specKey, spec]) => {
      const context: ContextSpecs = {
        specKey,
        target,
        workspace,
        specs,
        output,
      };

      const parsedSchemas = spec.openapi
        ? (spec.components?.schemas as SchemasObject)
        : getAllSchemas(spec, specKey);

      const schemaDefinition = generateSchemasDefinition(
        parsedSchemas,
        context,
        output.override.components.schemas.suffix,
        input.filters,
      );

      const responseDefinition = generateComponentDefinition(
        spec.components?.responses,
        context,
        output.override.components.responses.suffix,
      );

      const bodyDefinition = generateComponentDefinition(
        spec.components?.requestBodies,
        context,
        output.override.components.requestBodies.suffix,
      );

      const parameters = generateParameterDefinition(
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

      if (schemas.length === 0) {
        return acc;
      }

      acc[specKey] = schemas;

      return acc;
    },
    {},
  );
};

const getAllSchemas = (spec: object, specKey?: string): SchemasObject => {
  const keysToOmit = new Set([
    'openapi',
    'info',
    'servers',
    'paths',
    'components',
    'security',
    'tags',
    'externalDocs',
  ]);

  const cleanedSpec = Object.fromEntries(
    Object.entries(spec).filter(([key]) => !keysToOmit.has(key)),
  );

  if (specKey && isSchema(cleanedSpec)) {
    const name = upath.getSchemaFileName(specKey);

    const additionalKeysToOmit = new Set([
      'type',
      'properties',
      'allOf',
      'oneOf',
      'anyOf',
      'items',
    ]);

    return {
      [name]: cleanedSpec as SchemasObject,
      ...getAllSchemas(
        Object.fromEntries(
          Object.entries(cleanedSpec).filter(
            ([key]) => !additionalKeysToOmit.has(key),
          ),
        ),
      ),
    };
  }

  const schemas = Object.entries(cleanedSpec).reduce<SchemasObject>(
    (acc, [key, value]) => {
      if (!isObject(value)) {
        return acc;
      }

      if (!isSchema(value) && !isReference(value)) {
        return { ...acc, ...getAllSchemas(value) };
      }

      acc[key] = value;

      return acc;
    },
    {},
  );

  return {
    ...schemas,
    ...((spec as OpenAPIObject)?.components?.schemas as SchemasObject),
  };
};
