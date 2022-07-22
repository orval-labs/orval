import isEmpty from 'lodash/isEmpty';
import { SchemasObject, SchemaObject } from 'openapi3-ts';
import { ContextSpecs } from '../../types';
import { GeneratorSchema } from '../../types/generator';
import { pascal } from '../../utils/case';
import { jsDoc } from '../../utils/doc';
import { isReference } from '../../utils/is';
import { getSpecName } from '../../utils/path';
import { resolveDiscriminators } from '../getters/discriminators';
import { getEnum } from '../getters/enum';
import { resolveValue } from '../resolvers/value';
import { generateInterface } from './interface';
import { OpenAPIParser } from 'redoc';
import { OpenAPISpec } from 'redoc/typings/types';
import { mergeAllOf } from '../resolvers/mergeAllof';

/**
 * Extract all types from #/components/schemas
 *
 * @param schemas
 */
export const generateSchemasDefinition = (
  schemas: SchemasObject = {},
  context: ContextSpecs,
  suffix: string,
): GeneratorSchema[] => {
  if (isEmpty(schemas)) {
    return [];
  }

  const transformedSchemas = resolveDiscriminators(schemas, context);

  const parser = new OpenAPIParser(
    context.specs[context.specKey] as OpenAPISpec,
  );

  Object.keys(transformedSchemas).forEach((key) => {
    transformedSchemas[key] = mergeAllOf(
      parser,
      transformedSchemas[key],
    ) as SchemaObject;
  });

  const models = Object.entries(transformedSchemas).reduce(
    (acc, [name, schema]) => {
      const schemaName = pascal(name) + suffix;
      if (
        (!schema.type || schema.type === 'object') &&
        !schema.allOf &&
        !schema.oneOf &&
        !schema.anyOf &&
        !isReference(schema) &&
        !schema.nullable
      ) {
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
            resolvedValue.type,
            schemaName,
          );
        } else if (schemaName === resolvedValue.value && resolvedValue.isRef) {
          const imp = resolvedValue.imports.find(
            (imp) => imp.name === schemaName,
          );

          if (!imp) {
            output += `export type ${schemaName} = ${resolvedValue.value};\n`;
          } else {
            const alias = imp?.specKey
              ? `${pascal(getSpecName(imp.specKey, context.specKey))}${
                  resolvedValue.value
                }`
              : `${resolvedValue.value}Bis`;

            output += `export type ${schemaName} = ${alias};\n`;

            imports = imports.map((imp) =>
              imp.name === schemaName ? { ...imp, alias } : imp,
            );
          }
        } else {
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
    [] as GeneratorSchema[],
  );

  return models;
};
