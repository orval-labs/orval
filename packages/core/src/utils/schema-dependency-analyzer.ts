import type { SchemasObject, OperationObject } from 'openapi3-ts/oas30';
import { isReference } from './index';

/**
 * Analyzes which schemas are actually used by the given operations
 * and returns only those schemas plus their dependencies
 */
export const analyzeSchemaDependencies = (
  operations: Array<{
    operation: OperationObject;
    path: string;
    method: string;
  }>,
  allSchemas: SchemasObject,
): Set<string> => {
  const requiredSchemas = new Set<string>();

  // Find schemas directly referenced by operations
  operations.forEach(({ operation }) => {
    // Check response schemas
    if (operation.responses) {
      Object.values(operation.responses).forEach((response: any) => {
        if (
          response.content &&
          response.content['application/json'] &&
          response.content['application/json'].schema
        ) {
          const responseSchema = response.content['application/json'].schema;
          if (responseSchema.$ref) {
            const schemaName = responseSchema.$ref.split('/').pop();
            if (schemaName) {
              requiredSchemas.add(schemaName);
            }
          }
        }
      });
    }

    // Check request body schemas
    if (
      operation.requestBody &&
      !isReference(operation.requestBody) &&
      operation.requestBody.content
    ) {
      Object.values(operation.requestBody.content).forEach((content: any) => {
        if (content.schema && content.schema.$ref) {
          const schemaName = content.schema.$ref.split('/').pop();
          if (schemaName) {
            requiredSchemas.add(schemaName);
          }
        }
      });
    }

    // Check parameter schemas
    if (operation.parameters) {
      operation.parameters.forEach((param: any) => {
        if (param.schema && param.schema.$ref) {
          const schemaName = param.schema.$ref.split('/').pop();
          if (schemaName) {
            requiredSchemas.add(schemaName);
          }
        }
      });
    }
  });

  // Recursively find all schema dependencies
  const addReferencedSchemas = (schema: any) => {
    if (!schema || typeof schema !== 'object') return;

    // Handle $ref
    if (schema.$ref) {
      const schemaName = schema.$ref.split('/').pop();
      if (schemaName && allSchemas[schemaName]) {
        requiredSchemas.add(schemaName);
        // Recursively add dependencies of this schema
        addReferencedSchemas(allSchemas[schemaName]);
      }
      return;
    }

    // Handle properties
    if (schema.properties) {
      Object.values(schema.properties).forEach(addReferencedSchemas);
    }

    // Handle items (arrays)
    if (schema.items) {
      addReferencedSchemas(schema.items);
    }

    // Handle additionalProperties
    if (schema.additionalProperties) {
      addReferencedSchemas(schema.additionalProperties);
    }

    // Handle composition schemas
    if (schema.allOf) {
      schema.allOf.forEach(addReferencedSchemas);
    }
    if (schema.anyOf) {
      schema.anyOf.forEach(addReferencedSchemas);
    }
    if (schema.oneOf) {
      schema.oneOf.forEach(addReferencedSchemas);
    }

    // Handle not
    if (schema.not) {
      addReferencedSchemas(schema.not);
    }

    // Handle if/then/else
    if (schema.if) {
      addReferencedSchemas(schema.if);
    }
    if (schema.then) {
      addReferencedSchemas(schema.then);
    }
    if (schema.else) {
      addReferencedSchemas(schema.else);
    }

    // Handle dependentSchemas
    if (schema.dependentSchemas) {
      Object.values(schema.dependentSchemas).forEach(addReferencedSchemas);
    }

    // Handle patternProperties
    if (schema.patternProperties) {
      Object.values(schema.patternProperties).forEach(addReferencedSchemas);
    }

    // Handle definitions (OpenAPI 2.0 compatibility)
    if (schema.definitions) {
      Object.values(schema.definitions).forEach(addReferencedSchemas);
    }
  };

  // Add dependencies for all required schemas
  requiredSchemas.forEach((schemaName) => {
    const schema = allSchemas[schemaName];
    if (schema) {
      addReferencedSchemas(schema);
    }
  });

  return requiredSchemas;
};

/**
 * Filters schemas to only include those that are actually used by the given operations
 */
export const filterSchemasByDependencies = (
  operations: Array<{
    operation: OperationObject;
    path: string;
    method: string;
  }>,
  allSchemas: SchemasObject,
): SchemasObject => {
  const requiredSchemaNames = analyzeSchemaDependencies(operations, allSchemas);

  return Object.fromEntries(
    Object.entries(allSchemas).filter(([schemaName]) =>
      requiredSchemaNames.has(schemaName),
    ),
  );
};
