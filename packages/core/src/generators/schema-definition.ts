import isEmpty from 'lodash.isempty';
import { SchemaObject, SchemasObject } from 'openapi3-ts/oas30';
import { getEnum, resolveDiscriminators } from '../getters';
import { resolveRef, resolveValue } from '../resolvers';
import { ContextSpecs, GeneratorSchema, InputFiltersOption } from '../types';
import {
  upath,
  isReference,
  jsDoc,
  pascal,
  sanitize,
  isString,
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
  schemasFilters?: InputFiltersOption['schemas'],
): GeneratorSchema[] => {
  if (isEmpty(schemas)) {
    return [];
  }
  const transformedSchemas = resolveDiscriminators(schemas, context);

  let generateSchemas = Object.entries(transformedSchemas);
  if (schemasFilters) {
    generateSchemas = generateSchemas.filter(([schemaName]) => {
      return schemasFilters.some((filter) =>
        isString(filter) ? filter === schemaName : filter.test(schemaName),
      );
    });
  }

  const models = generateSchemas.reduce((acc, [name, schema]) => {
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
          resolvedValue.originalSchema?.['x-enumNames'],
          context.output.override.useNativeEnums,
        );
      } else if (schemaName === resolvedValue.value && resolvedValue.isRef) {
        // Don't add type if schema has same name and the referred schema will be an interface
        const { schema: referredSchema } = resolveRef(schema, context);
        if (!shouldCreateInterface(referredSchema as SchemaObject)) {
          const imp = resolvedValue.imports.find(
            (imp) => imp.name === schemaName,
          );

          if (!imp) {
            output += `export type ${schemaName} = ${resolvedValue.value};\n`;
          } else {
            const alias = imp?.specKey
              ? `${pascal(upath.getSpecName(imp.specKey, context.specKey))}${
                  resolvedValue.value
                }`
              : `${resolvedValue.value}Bis`;

            output += `export type ${schemaName} = ${alias};\n`;

            imports = imports.map((imp) =>
              imp.name === schemaName ? { ...imp, alias } : imp,
            );
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
  }, [] as GeneratorSchema[]);

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
