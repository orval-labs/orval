import { entries, isEmptyish } from 'remeda';

import { getResReqTypes } from '../getters/index.ts';
import type {
  ContextSpec,
  GeneratorSchema,
  OpenApiComponentsObject,
} from '../types.ts';
import { jsDoc, pascal, sanitize } from '../utils/index.ts';

export function generateComponentDefinition(
  responses:
    | OpenApiComponentsObject['responses']
    | OpenApiComponentsObject['requestBodies'] = {},
  context: ContextSpec,
  suffix: string,
): GeneratorSchema[] {
  if (isEmptyish(responses)) {
    return [];
  }

  const generatorSchemas: GeneratorSchema[] = [];
  for (const [name, response] of entries(responses)) {
    const allResponseTypes = getResReqTypes(
      [[suffix, response]],
      name,
      context,
      'void',
    );

    const imports = allResponseTypes.flatMap(({ imports }) => imports);
    const schemas = allResponseTypes.flatMap(({ schemas }) => schemas);

    const type = allResponseTypes.map(({ value }) => value).join(' | ');

    const modelName = sanitize(`${pascal(name)}${suffix}`, {
      underscore: '_',
      whitespace: '_',
      dash: true,
      es5keyword: true,
      es5IdentifierName: true,
    });
    const doc = jsDoc(response);
    const model = `${doc}export type ${modelName} = ${type || 'unknown'};\n`;

    generatorSchemas.push(...schemas);

    if (modelName !== type) {
      generatorSchemas.push({
        name: modelName,
        model,
        imports,
      });
    }
  }

  return generatorSchemas;
}
