import { ComponentsObject, ParameterObject } from 'openapi3-ts/oas30';
import { resolveObject, resolveRef } from '../resolvers';
import { ContextSpecs, GeneratorSchema } from '../types';
import { jsDoc, pascal, sanitize } from '../utils';

export const generateParameterDefinition = (
  parameters: ComponentsObject['parameters'] = {},
  context: ContextSpecs,
  suffix: string,
): GeneratorSchema[] => {
  return Object.entries(parameters).reduce(
    (acc, [parameterName, parameter]) => {
      const modelName = sanitize(`${pascal(parameterName)}${suffix}`, {
        underscore: '_',
        whitespace: '_',
        dash: true,
        es5keyword: true,
        es5IdentifierName: true,
      });
      const { schema, imports } = resolveRef<ParameterObject>(
        parameter,
        context,
      );

      if (schema.in !== 'query') {
        return acc;
      }

      if (!schema.schema || imports.length) {
        acc.push({
          name: modelName,
          imports: imports.length
            ? [
                {
                  name: imports[0].name,
                  specKey: imports[0].specKey,
                  schemaName: imports[0].schemaName,
                },
              ]
            : [],
          model: `export type ${modelName} = ${
            imports.length ? imports[0].name : 'unknown'
          };\n`,
        });

        return acc;
      }

      const resolvedObject = resolveObject({
        schema: schema.schema,
        propName: modelName,
        context,
      });

      const doc = jsDoc(parameter as ParameterObject);

      const model = `${doc}export type ${modelName} = ${
        resolvedObject.value || 'unknown'
      };\n`;

      acc.push(...resolvedObject.schemas);

      if (modelName !== resolvedObject.value) {
        acc.push({
          name: modelName,
          model,
          imports: resolvedObject.imports,
        });
      }

      return acc;
    },
    [] as GeneratorSchema[],
  );
};
