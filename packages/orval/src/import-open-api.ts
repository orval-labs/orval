import {
  collectReferencedComponents,
  type ContextSpec,
  generateComponentDefinition,
  generateParameterDefinition,
  generateSchemasDefinition,
  type ImportOpenApi,
  type InputOptions,
  type NormalizedOutputOptions,
  type OpenApiComponentsObject,
  type OpenApiDocument,
  type WriteSpecBuilder,
} from '@orval/core';
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

  const allSchemas = spec.components?.schemas ?? {};

  return {
    ...spec,
    components: {
      ...spec.components,
      // `includeUnreferencedSchemas` keeps every `components.schemas` entry —
      // the section consumers are most likely to depend on — while the other
      // component sections stay pruned to what the matching operations use.
      schemas: filters.includeUnreferencedSchemas
        ? allSchemas
        : pick(allSchemas, referenced.schemas),
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
  // The transformer has already been applied (pre-validation) in `resolveSpec`.
  const filteredSpec = filterSpecComponents(spec, input);

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
