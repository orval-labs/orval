import type { ComponentsObject, ParameterObject } from 'openapi3-ts/oas30';

import { resolveObject, resolveRef } from '../resolvers';
import type { ContextSpecs, GeneratorSchema } from '../types';
import { jsDoc, pascal, sanitize } from '../utils';

export const generateParameterDefinition = (
  parameters: ComponentsObject['parameters'] = {},
  context: ContextSpecs,
  suffix: string,
): GeneratorSchema[] => {
  return Object.entries(parameters).reduce<GeneratorSchema[]>(
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

      if (schema.in !== 'query' && schema.in !== 'header') {
        return acc;
      }

      if (!schema.schema || imports.length > 0) {
        acc.push({
          name: modelName,
          imports:
            imports.length > 0
              ? [
                  {
                    name: imports[0].name,
                    specKey: imports[0].specKey,
                    schemaName: imports[0].schemaName,
                  },
                ]
              : [],
          model: `export type ${modelName} = ${
            imports.length > 0 ? imports[0].name : 'unknown'
          };\n`,
          dependencies: imports.length > 0 ? [imports[0].name] : [],
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
          dependencies: resolvedObject.dependencies,
        });
      }

      return acc;
    },
    [],
  );
};
