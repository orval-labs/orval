import isEmpty from 'lodash.isempty';
import type { SchemaObject, SchemasObject } from 'openapi3-ts/oas30';

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
  if (isEmpty(schemas)) {
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

            return false;
          });
          output += `export type ${schemaName} = ${resolvedValue.value};\n`;
        }

        acc.push(...resolvedValue.schemas, {
          name: schemaName,
          model: output,
          imports,
        });

        return acc;
      }
    },
    [],
  );

  return models;
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
