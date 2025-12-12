import { entries, isEmptyish } from 'remeda';

import { resolveObject, resolveRef } from '../resolvers';
import type {
  ContextSpec,
  GeneratorSchema,
  OpenApiComponentsObject,
  OpenApiParameterObject,
} from '../types';
import { jsDoc, pascal, sanitize } from '../utils';

export function generateParameterDefinition(
  parameters: OpenApiComponentsObject['parameters'] = {},
  context: ContextSpec,
  suffix: string,
): GeneratorSchema[] {
  if (isEmptyish(parameters)) {
    return [];
  }

  const generatorSchemas: GeneratorSchema[] = [];
  for (const [parameterName, parameter] of entries(parameters)) {
    const modelName = sanitize(`${pascal(parameterName)}${suffix}`, {
      underscore: '_',
      whitespace: '_',
      dash: true,
      es5keyword: true,
      es5IdentifierName: true,
    });
    const { schema, imports } = resolveRef<OpenApiParameterObject>(
      parameter,
      context,
    );

    if (schema.in !== 'query' && schema.in !== 'header') {
      continue;
    }

    if (!schema.schema || imports.length > 0) {
      generatorSchemas.push({
        name: modelName,
        imports:
          imports.length > 0
            ? [
                {
                  name: imports[0].name,
                  schemaName: imports[0].schemaName,
                },
              ]
            : [],
        model: `export type ${modelName} = ${
          imports.length > 0 ? imports[0].name : 'unknown'
        };\n`,
        dependencies: imports.length > 0 ? [imports[0].name] : [],
      });

      continue;
    }

    const resolvedObject = resolveObject({
      schema: schema.schema,
      propName: modelName,
      context,
    });

    const doc = jsDoc(schema);

    const model = `${doc}export type ${modelName} = ${
      resolvedObject.value || 'unknown'
    };\n`;

    generatorSchemas.push(...resolvedObject.schemas);

    if (modelName !== resolvedObject.value) {
      generatorSchemas.push({
        name: modelName,
        model,
        imports: resolvedObject.imports,
        dependencies: resolvedObject.dependencies,
      });
    }
  }

  return generatorSchemas;
}
