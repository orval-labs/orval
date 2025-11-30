import { isDereferenced } from '@scalar/openapi-types/helpers';
import type { SchemaObject } from 'openapi3-ts/oas30';
import { isArray, isEmptyish } from 'remeda';

import {
  getEnum,
  getEnumDescriptions,
  getEnumNames,
  resolveDiscriminators,
} from '../getters';
import { resolveRef, resolveValue } from '../resolvers';
import type {
  ContextSpec,
  GeneratorSchema,
  InputFiltersOptions,
  OpenApiSchemaObject,
  OpenApiSchemasObject,
} from '../types';
import {
  conventionName,
  isString,
  jsDoc,
  pascal,
  sanitize,
  upath,
} from '../utils';
import { generateInterface } from './interface';

/**
 * Extract all types from #/components/schemas
 *
 * @param schemas
 */
export function generateSchemasDefinition(
  schemas: OpenApiSchemasObject = {},
  context: ContextSpec,
  suffix: string,
  filters?: InputFiltersOptions,
): GeneratorSchema[] {
  if (isEmptyish(schemas)) {
    return [];
  }

  const transformedSchemas = resolveDiscriminators(schemas, context);

  let generateSchemas = Object.entries(transformedSchemas);
  if (filters?.schemas) {
    const schemasFilters = filters.schemas;
    const mode = filters.mode ?? 'include';

    generateSchemas = generateSchemas.filter(([schemaName]) => {
      const isMatch = schemasFilters.some((filter) =>
        isString(filter) ? filter === schemaName : filter.test(schemaName),
      );

      return mode === 'include' ? isMatch : !isMatch;
    });
  }

  const models = generateSchemas.flatMap(([schemaName, schema]) =>
    generateSchemaDefinitions(schemaName, schema, context, suffix),
  );

  // Deduplicate schemas by normalized name to prevent duplicate exports
  // This handles cases where different source schemas produce the same normalized name
  const seenNames = new Set<string>();
  const deduplicatedModels: GeneratorSchema[] = [];
  for (const schema of models) {
    const normalizedName = conventionName(
      schema.name,
      context.output.namingConvention,
    );
    if (!seenNames.has(normalizedName)) {
      seenNames.add(normalizedName);
      deduplicatedModels.push(schema);
    }
  }

  return deduplicatedModels;
}

function shouldCreateInterface(schema: OpenApiSchemaObject) {
  const isNullable = isArray(schema.type) && schema.type.includes('null');

  return (
    (!schema.type || schema.type === 'object') &&
    !schema.allOf &&
    !schema.oneOf &&
    !schema.anyOf &&
    isDereferenced(schema) &&
    !schema.enum &&
    !isNullable
  );
}

function generateSchemaDefinitions(
  schemaName: string,
  schema: OpenApiSchemaObject,
  context: ContextSpec,
  suffix: string,
): GeneratorSchema[] {
  const sanitizedSchemaName = sanitize(`${pascal(schemaName)}${suffix}`, {
    underscore: '_',
    whitespace: '_',
    dash: true,
    es5keyword: true,
    es5IdentifierName: true,
  });

  if (typeof schema === 'boolean') {
    return [
      {
        name: sanitizedSchemaName,
        model: `export type ${sanitizedSchemaName} = ${schema ? 'any' : 'never'};\n`,
        imports: [],
      },
    ];
  }

  if (shouldCreateInterface(schema)) {
    return generateInterface({
      name: sanitizedSchemaName,
      schema,
      context,
    });
  }

  const resolvedValue = resolveValue({
    schema,
    name: sanitizedSchemaName,
    context,
  });

  let output = '';

  let imports = resolvedValue.imports;

  output += jsDoc(schema);

  if (resolvedValue.isEnum && !resolvedValue.isRef) {
    output += getEnum(
      resolvedValue.value,
      sanitizedSchemaName,
      getEnumNames(resolvedValue.originalSchema),
      context.output.override.enumGenerationType,
      getEnumDescriptions(resolvedValue.originalSchema),
      context.output.override.namingConvention.enum,
    );
  } else if (
    sanitizedSchemaName === resolvedValue.value &&
    resolvedValue.isRef
  ) {
    // Don't add type if schema has same name and the referred schema will be an interface
    const { schema: referredSchema } = resolveRef(schema, context);
    if (!shouldCreateInterface(referredSchema as OpenApiSchemaObject)) {
      const imp = resolvedValue.imports.find(
        (imp) => imp.name === sanitizedSchemaName,
      );

      if (imp) {
        const alias = imp?.specKey
          ? `${pascal(upath.getSpecName(imp.specKey, context.specKey))}${
              resolvedValue.value
            }`
          : `${resolvedValue.value}Bis`;

        output += `export type ${sanitizedSchemaName} = ${alias};\n`;

        imports = imports.map((imp) =>
          imp.name === sanitizedSchemaName ? { ...imp, alias } : imp,
        );
      } else {
        output += `export type ${sanitizedSchemaName} = ${resolvedValue.value};\n`;
      }
    }
  } else {
    resolvedValue.schemas = resolvedValue.schemas.filter((schema) => {
      if (schema.name !== sanitizedSchemaName) {
        return true;
      }

      output += `${schema.model}\n`;
      imports = imports.concat(schema.imports);

      return false;
    });
    output += `export type ${sanitizedSchemaName} = ${resolvedValue.value};\n`;
  }

  return [
    ...resolvedValue.schemas,
    {
      name: sanitizedSchemaName,
      model: output,
      imports,
    },
  ];
}
