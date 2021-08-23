import { ComponentsObject, ParameterObject } from 'openapi3-ts';
import { ContextSpecs } from '../../types';
import { GeneratorSchema } from '../../types/generator';
import { asyncReduce } from '../../utils/async-reduce';
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
      const modelName = `${parameterName}${suffix}`;
      const { schema, imports } = await resolveRef<ParameterObject>(
        parameter,
        context,
      );

      if (schema.in !== 'query') {
        return acc;
      }

      if (!schema.schema || imports.length) {
        return [
          ...acc,
          {
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
          },
        ];
      }

      const resolvedObject = await resolveObject({
        schema: schema.schema,
        propName: modelName,
        context,
      });

      const model = `export type ${modelName} = ${
        resolvedObject.value || 'unknown'
      };\n`;

      return [
        ...acc,
        ...resolvedObject.schemas,
        ...(modelName !== resolvedObject.value
          ? [
              {
                name: modelName,
                model,
                imports: resolvedObject.imports,
              },
            ]
          : []),
      ];
    },
    [] as GeneratorSchema[],
  );
};
