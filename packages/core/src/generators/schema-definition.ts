import type { SchemaObject, SchemasObject } from 'openapi3-ts/oas30';
import { isEmptyish } from 'remeda';

import {
  getEnum,
  getEnumDescriptions,
  getEnumNames,
  resolveDiscriminators,
} from '../getters';
import { resolveRef, resolveValue } from '../resolvers';
import type {
  ContextSpecs,
  GeneratorSchema,
  InputFiltersOption,
} from '../types';
import {
  conventionName,
  isReference,
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
export const generateSchemasDefinition = (
  schemas: SchemasObject = {},
  context: ContextSpecs,
  suffix: string,
  filters?: InputFiltersOption,
): GeneratorSchema[] => {
  if (isEmptyish(schemas)) {
    return [];
  }

  const transformedSchemas = resolveDiscriminators(schemas, context);

  let generateSchemas = Object.entries(transformedSchemas);
  if (filters?.schemas) {
    const schemasFilters = filters.schemas;
    const mode = filters.mode || 'include';

    generateSchemas = generateSchemas.filter(([schemaName]) => {
      const isMatch = schemasFilters.some((filter) =>
        isString(filter) ? filter === schemaName : filter.test(schemaName),
      );

      return mode === 'include' ? isMatch : !isMatch;
    });
  }

  const models = generateSchemas.reduce<GeneratorSchema[]>(
    (acc, [name, schema]) => {
      const schemaName = sanitize(`${pascal(name)}${suffix}`, {
        underscore: '_',
        whitespace: '_',
        dash: true,
        es5keyword: true,
        es5IdentifierName: true,
      });
      if (shouldCreateInterface(schema)) {
        acc.push(
          ...generateInterface({
            name: schemaName,
            schema,
            context,
            suffix,
          }),
        );

        return acc;
      } else {
        const resolvedValue = resolveValue({
          schema,
          name: schemaName,
          context,
        });

        let output = '';

        let imports = resolvedValue.imports;

        output += jsDoc(schema);

        if (resolvedValue.isEnum && !resolvedValue.isRef) {
          output += getEnum(
            resolvedValue.value,
            schemaName,
            getEnumNames(resolvedValue.originalSchema),
            context.output.override.enumGenerationType,
            getEnumDescriptions(resolvedValue.originalSchema),
            context.output.override.namingConvention?.enum,
          );
        } else if (schemaName === resolvedValue.value && resolvedValue.isRef) {
          // Don't add type if schema has same name and the referred schema will be an interface
          const { schema: referredSchema } = resolveRef(schema, context);
          if (!shouldCreateInterface(referredSchema as SchemaObject)) {
            const imp = resolvedValue.imports.find(
              (imp) => imp.name === schemaName,
            );

            if (imp) {
              const alias = imp?.specKey
                ? `${pascal(upath.getSpecName(imp.specKey, context.specKey))}${
                    resolvedValue.value
                  }`
                : `${resolvedValue.value}Bis`;

              output += `export type ${schemaName} = ${alias};\n`;

              imports = imports.map((imp) =>
                imp.name === schemaName ? { ...imp, alias } : imp,
              );
              resolvedValue.dependencies = [imp.name];
            } else {
              output += `export type ${schemaName} = ${resolvedValue.value};\n`;
            }
          }
        } else {
          resolvedValue.schemas = resolvedValue.schemas.filter((schema) => {
            if (schema.name !== schemaName) {
              return true;
            }

            output += `${schema.model}\n`;
            imports = imports.concat(schema.imports);
            resolvedValue.dependencies.push(...(schema.dependencies ?? []));

            return false;
          });
          output += `export type ${schemaName} = ${resolvedValue.value};\n`;
        }

        acc.push(...resolvedValue.schemas, {
          name: schemaName,
          model: output,
          imports,
          dependencies: resolvedValue.dependencies,
        });

        return acc;
      }
    },
    [],
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

  return sortSchemasByDependencies(deduplicatedModels);
};

const sortSchemasByDependencies = (
  schemas: GeneratorSchema[],
): GeneratorSchema[] => {
  if (schemas.length === 0) {
    return schemas;
  }

  const schemaNames = new Set(schemas.map((schema) => schema.name));
  const dependencyMap = new Map<string, Set<string>>();

  schemas.forEach((schema) => {
    const dependencies = new Set<string>();

    schema.dependencies?.forEach((dependencyName) => {
      if (dependencyName && schemaNames.has(dependencyName)) {
        dependencies.add(dependencyName);
      }
    });

    schema.imports.forEach((imp) => {
      const dependencyName = imp.alias || imp.name;
      if (dependencyName && schemaNames.has(dependencyName)) {
        dependencies.add(dependencyName);
      }
    });

    dependencyMap.set(schema.name, dependencies);
  });

  const sorted: GeneratorSchema[] = [];
  const temporary = new Set<string>();
  const permanent = new Set<string>();
  const schemaMap = new Map(schemas.map((schema) => [schema.name, schema]));

  const visit = (name: string) => {
    if (permanent.has(name)) {
      return;
    }

    if (temporary.has(name)) {
      // Circular dependency detected; retain current DFS order for this cycle
      return;
    }

    temporary.add(name);

    const dependencies = dependencyMap.get(name);
    dependencies?.forEach((dep) => {
      if (dep !== name) {
        visit(dep);
      }
    });

    temporary.delete(name);
    permanent.add(name);

    const schema = schemaMap.get(name);
    if (schema) {
      sorted.push(schema);
    }
  };

  schemas.forEach((schema) => visit(schema.name));

  return sorted;
};

function shouldCreateInterface(schema: SchemaObject) {
  return (
    (!schema.type || schema.type === 'object') &&
    !schema.allOf &&
    !schema.oneOf &&
    !schema.anyOf &&
    !isReference(schema) &&
    !schema.nullable &&
    !schema.enum
  );
}
