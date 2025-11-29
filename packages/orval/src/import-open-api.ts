import {
  asyncReduce,
  type ContextSpec,
  dynamicImport,
  generateComponentDefinition,
  generateParameterDefinition,
  generateSchemasDefinition,
  type GeneratorSchema,
  type ImportOpenApi,
  type InputOptions,
  isReference,
  isSchema,
  type NormalizedOutputOptions,
  openApiConverter,
  type OpenApiDocument,
  type OpenApiSchemaObject,
  type OverrideInput,
  upath,
  type WriteSpecBuilder,
} from '@orval/core';
import { validate } from '@scalar/openapi-parser';
import type { SchemasObject } from 'openapi3-ts/oas30';
import { isPlainObject, omit } from 'remeda';

import { getApiBuilder } from './api';

export async function importOpenApi({
  spec,
  input,
  output,
  target,
  workspace,
}: ImportOpenApi): Promise<WriteSpecBuilder> {
  const transformedOpenApi = await applyTransformer(
    spec,
    input.override.transformer,
    workspace,
  );

  const schemas = getApiSchemas({
    input,
    output,
    target,
    workspace,
    spec: transformedOpenApi,
  });

  const api = await getApiBuilder({
    input,
    output,
    context: {
      // specKey: target,
      target,
      workspace,
      spec: transformedOpenApi,
      output,
    },
  });

  return {
    ...api,
    schemas,
    target,
    // a valid spec will have info
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    info: transformedOpenApi.info!,
  };
}

async function applyTransformer(
  openApi: OpenApiDocument,
  transformer: OverrideInput['transformer'],
  workspace: string,
): Promise<OpenApiDocument> {
  const transformerFn = transformer
    ? await dynamicImport(transformer, workspace)
    : undefined;

  if (!transformerFn) {
    return openApi;
  }

  const transformedOpenApi = transformerFn(openApi);

  const { valid, errors } = await validate(transformedOpenApi);
  if (!valid) {
    throw new Error(`Validation failed`, { cause: errors });
  }

  return transformedOpenApi;
}

async function generateInputSpecs({
  specs,
  input,
  workspace,
}: {
  specs: Record<string, OpenApiDocument>;
  input: InputOptions;
  workspace: string;
}): Promise<Record<string, OpenApiDocument>> {
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

      const transformedSchema = transformerFn ? transformerFn(schema) : schema;

      if (input.validation) {
        const { valid, errors } = await validate(transformedSchema);
        if (!valid) {
          throw new Error(`Validation failed for specKey: ${specKey}`, {
            cause: errors,
          });
        }
      }

      acc[specKey] = transformedSchema;

      return acc;
    },
    {} as Record<string, OpenApiDocument>,
  );
}

interface GetApiSchemasOptions {
  input: InputOptions;
  output: NormalizedOutputOptions;
  workspace: string;
  target: string;
  spec: OpenApiDocument;
}

function getApiSchemas({
  input,
  output,
  target,
  workspace,
  spec,
}: GetApiSchemasOptions) {
  const context: ContextSpec = {
    target,
    workspace,
    spec,
    output,
  };

  const schemaDefinition = generateSchemasDefinition(
    spec.components?.schemas,
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

  return schemas;
}

function getAllSchemas(
  spec: OpenApiDocument,
  specKey?: string,
): OpenApiSchemaObject {
  const cleanedSpec = omit(spec, [
    'openapi',
    'info',
    'servers',
    'paths',
    'components',
    'security',
    'tags',
    'externalDocs',
  ]);

  if (specKey) {
    const name = upath.getSchemaFileName(specKey);
    return {
      [name]: cleanedSpec,
      ...getAllSchemas(
        omit(cleanedSpec, [
          'type',
          'properties',
          'allOf',
          'oneOf',
          'anyOf',
          'items',
        ]),
      ),
    };
  }

  const schemas = Object.entries(cleanedSpec).reduce<SchemasObject>(
    (acc, [key, value]) => {
      if (!isPlainObject(value)) {
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
    ...(spec as OpenApiDocument)?.components?.schemas,
  };
}
