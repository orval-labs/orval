import isEmpty from 'lodash.isempty';
import { SchemasObject } from 'openapi3-ts';
import { getEnum, resolveDiscriminators } from '../getters';
import { resolveValue } from '../resolvers';
import { ContextSpecs, GeneratorSchema } from '../types';
import { upath, isReference, jsDoc, pascal, sanitize } from '../utils';
import { generateConsts } from './consts';
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
): GeneratorSchema[] => {
  if (isEmpty(schemas)) {
    return [];
  }

  const transformedSchemas = resolveDiscriminators(schemas, context);

  const models = Object.entries(transformedSchemas).reduce(
    (acc, [name, schema]) => {
      const schemaName = sanitize(`${pascal(name)}${suffix}`, {
        underscore: '_',
        whitespace: '_',
        dash: true,
        es5keyword: true,
        es5IdentifierName: true,
      });
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
            schemaName,
            resolvedValue.originalSchema?.['x-enumNames'],
          );
        } else if (schemaName === resolvedValue.value && resolvedValue.isRef) {
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
        } else {
          output += `export type ${schemaName} = ${resolvedValue.value};\n`;
        }

        output += generateConsts({
          context,
          schema,
          name: schemaName,
        });

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
