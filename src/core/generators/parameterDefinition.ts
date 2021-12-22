import { ComponentsObject, ParameterObject } from 'openapi3-ts';
import { ContextSpecs } from '../../types';
import { GeneratorSchema } from '../../types/generator';
import { asyncReduce } from '../../utils/async-reduce';
import { pascal } from '../../utils/case';
import { jsDoc } from '../../utils/doc';
import { resolveObject } from '../resolvers/object';
import { resolveRef } from '../resolvers/ref';

export const generateParameterDefinition = (
  parameters: ComponentsObject['parameters'] = {},
  context: ContextSpecs,
  suffix: string,
): Promise<GeneratorSchema[]> => {
  return asyncReduce(
    Object.entries(parameters),
    async (acc, [parameterName, parameter]) => {
      const modelName = `${pascal(parameterName)}${suffix}`;
      const { schema, imports } = await resolveRef<ParameterObject>(
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

      const resolvedObject = await resolveObject({
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
