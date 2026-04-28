import {
  collectReferencedComponents,
  type ContextSpec,
  dynamicImport,
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
import { pick } from 'remeda';

import { getApiBuilder } from './api';

function filterSpecComponents(
  spec: OpenApiDocument,
  input: InputOptions,
): OpenApiDocument {
  const filters = input.filters;
  if (!filters?.tags || filters.schemas) return spec;

  const referenced = collectReferencedComponents(
    spec,
    filters.tags,
    filters.mode,
  );

  return {
    ...spec,
    components: {
      ...spec.components,
      schemas: pick(spec.components?.schemas ?? {}, referenced.schemas),
      responses: pick(spec.components?.responses ?? {}, referenced.responses),
      parameters: pick(
        spec.components?.parameters ?? {},
        referenced.parameters,
      ),
      requestBodies: pick(
        spec.components?.requestBodies ?? {},
        referenced.requestBodies,
      ),
    },
  };
}

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
    input.unsafeDisableValidation,
  );

  const filteredSpec = filterSpecComponents(transformedOpenApi, input);

  const schemas = getApiSchemas({
    input,
    output,
    target,
    workspace,
    spec: filteredSpec,
  });

  const api = await getApiBuilder({
    input,
    output,
    context: {
      projectName,
      target,
      workspace,
      spec: filteredSpec,
      output,
    } satisfies ContextSpec,
  });

  return {
    ...api,
    schemas: [...schemas, ...api.schemas],
    target,
    // a valid spec will have info
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    info: filteredSpec.info!,
    spec: filteredSpec,
  };
}

async function applyTransformer(
  openApi: OpenApiDocument,
  transformer: OverrideInput['transformer'],
  workspace: string,
  unsafeDisableValidation = false,
): Promise<OpenApiDocument> {
  const transformerFn = transformer
    ? await dynamicImport(transformer, workspace)
    : undefined;

  if (!transformerFn) {
    return openApi;
  }

  const transformedOpenApi = transformerFn(openApi);

  if (!unsafeDisableValidation) {
    const { valid, errors } = await validate(transformedOpenApi);
    if (!valid) {
      throw new Error(`Validation failed`, { cause: errors });
    }
  }

  return transformedOpenApi;
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

  const schemas = [
    ...schemaDefinition,
    ...responseDefinition,
    ...swaggerResponseDefinition,
    ...bodyDefinition,
    ...parameters,
  ];

  return schemas;
}
