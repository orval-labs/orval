import {
  asyncReduce,
  type ContextSpecs,
  dynamicImport,
  generateComponentDefinition,
  generateParameterDefinition,
  generateSchemasDefinition,
  type GeneratorSchema,
  ibmOpenapiValidator,
  type ImportOpenApi,
  type InputOptions,
  isObject,
  isReference,
  isSchema,
  type NormalizedOutputOptions,
  openApiConverter,
  upath,
  WriteSpecsBuilder,
  filterSchemasByDependencies,
  _filteredPaths,
  _filteredVerbs,
} from '@orval/core';
import { JSONSchema6, JSONSchema7 } from 'json-schema';
import {
  OpenAPIObject,
  SchemasObject,
  PathItemObject,
  OperationObject,
} from 'openapi3-ts/oas30';

import { getApiBuilder } from './api';

export const importOpenApi = async ({
  data,
  input,
  output,
  target,
  workspace,
}: ImportOpenApi): Promise<WriteSpecsBuilder> => {
  const specs = await generateInputSpecs({ specs: data, input, workspace });

  // Get filtered operations for schema dependency analysis
  const filteredOperations = input.filters?.schemaDependencyAnalysis
    ? getFilteredOperations(specs[target], input.filters)
    : undefined;

  const schemas = getApiSchemas({
    input,
    output,
    target,
    workspace,
    specs,
    filteredOperations,
  });

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
  filteredOperations,
}: {
  input: InputOptions;
  output: NormalizedOutputOptions;
  workspace: string;
  target: string;
  specs: Record<string, OpenAPIObject>;
  filteredOperations?: Array<{ operation: any; path: string; method: string }>;
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

      let parsedSchemas = spec.openapi
        ? (spec.components?.schemas as SchemasObject)
        : getAllSchemas(spec, specKey);

      // Apply schema dependency analysis if enabled and we have filtered operations
      if (input.filters?.schemaDependencyAnalysis && filteredOperations) {
        const specFilteredOperations = filteredOperations.filter(
          (op) => op.path.startsWith(specKey) || specKey === target,
        );

        if (specFilteredOperations.length > 0) {
          parsedSchemas = filterSchemasByDependencies(
            specFilteredOperations,
            parsedSchemas,
          );
        }
      }

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

const getFilteredOperations = (
  spec: OpenAPIObject,
  filters: InputOptions['filters'],
): Array<{ operation: OperationObject; path: string; method: string }> => {
  if (!filters || !spec.paths) {
    return [];
  }

  const operations: Array<{
    operation: OperationObject;
    path: string;
    method: string;
  }> = [];

  const filteredPaths = _filteredPaths(spec.paths, filters);

  filteredPaths.forEach(([pathRoute, verbs]) => {
    const filteredVerbs = _filteredVerbs(verbs, filters, pathRoute);

    filteredVerbs.forEach(([method, operation]) => {
      operations.push({
        operation,
        path: pathRoute,
        method: method.toLowerCase(),
      });
    });
  });

  return operations;
};
