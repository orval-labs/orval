import {
  type BrandedTypeRegistry,
  type ContextSpec,
  createBrandedTypeRegistry,
  dynamicImport,
  generateBrandedDefinition,
  generateComponentDefinition,
  generateParameterDefinition,
  generateSchemasDefinition,
  type ImportOpenApi,
  type InputOptions,
  type NormalizedOutputOptions,
  type OpenApiComponentsObject,
  type OpenApiDocument,
  type OverrideInput,
  type WriteSpecBuilder,
} from '@orval/core';
import { validate } from '@scalar/openapi-parser';

import { getApiBuilder } from './api';

export async function importOpenApi({
  spec,
  input,
  output,
  target,
  workspace,
  projectName,
}: ImportOpenApi): Promise<WriteSpecBuilder> {
  const transformedOpenApi = await applyTransformer(
    spec,
    input.override.transformer,
    workspace,
  );

  // Create shared branded type registry and schema names set for collision detection
  const brandedTypes: BrandedTypeRegistry | undefined = output.override
    .useBrandedTypes
    ? createBrandedTypeRegistry()
    : undefined;

  const schemaNames = new Set(
    Object.keys(transformedOpenApi.components?.schemas ?? {}),
  );

  const schemas = getApiSchemas({
    input,
    output,
    target,
    workspace,
    spec: transformedOpenApi,
    brandedTypes,
    schemaNames,
  });

  const api = await getApiBuilder({
    input,
    output,
    context: {
      projectName,
      target,
      workspace,
      spec: transformedOpenApi,
      output,
      brandedTypes,
      schemaNames,
    } satisfies ContextSpec,
  });

  // Generate branded type definitions AFTER all schemas have been processed
  // (both component schemas and inline API schemas may register branded types)
  const brandedDefinition = generateBrandedDefinition(brandedTypes);

  return {
    ...api,
    schemas: [...brandedDefinition, ...schemas, ...api.schemas],
    target,
    // a valid spec will have info
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    info: transformedOpenApi.info!,
    spec: transformedOpenApi,
    brandedTypes,
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

interface GetApiSchemasOptions {
  input: InputOptions;
  output: NormalizedOutputOptions;
  workspace: string;
  target: string;
  spec: OpenApiDocument;
  brandedTypes?: BrandedTypeRegistry;
  schemaNames: Set<string>;
}

function getApiSchemas({
  input,
  output,
  target,
  workspace,
  spec,
  brandedTypes,
  schemaNames,
}: GetApiSchemasOptions) {
  const context: ContextSpec = {
    target,
    workspace,
    spec,
    output,
    brandedTypes,
    schemaNames,
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

  const swaggerResponseDefinition = generateComponentDefinition(
    'responses' in spec
      ? (spec as { responses?: OpenApiComponentsObject['responses'] }).responses
      : undefined,
    context,
    '',
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

  return [
    ...schemaDefinition,
    ...responseDefinition,
    ...swaggerResponseDefinition,
    ...bodyDefinition,
    ...parameters,
  ];
}
