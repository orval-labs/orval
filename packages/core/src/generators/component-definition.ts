import { getResReqTypes } from '../getters';
import type {
  ContextSpec,
  GeneratorSchema,
  OpenApiComponentsObject,
} from '../types';
import { getComponentBaseName, jsDoc, sanitize } from '../utils';

export function generateComponentDefinition(
  responses:
    | OpenApiComponentsObject['responses']
    | OpenApiComponentsObject['requestBodies'] = {},
  context: ContextSpec,
  suffix: string,
  prefix = '',
): GeneratorSchema[] {
  if (Object.keys(responses).length === 0) {
    return [];
  }

  const generatorSchemas: GeneratorSchema[] = [];
  for (const [name, response] of Object.entries(responses)) {
    // Inline content types are named after the component too, so they must use
    // the collision-aware name (`Error` / `error` → `Error` / `Error2`).
    const baseName = getComponentBaseName(responses, name);
    const allResponseTypes = getResReqTypes(
      // oxlint-disable-next-line typescript/no-unsafe-argument
      [[suffix, response]],
      baseName,
      context,
      'void',
    );

    const imports = allResponseTypes.flatMap(({ imports }) => imports);
    const schemas = allResponseTypes.flatMap(({ schemas }) => schemas);

    const type = allResponseTypes.map(({ value }) => value).join(' | ');

    const modelName = sanitize(`${prefix}${baseName}${suffix}`, {
      underscore: '_',
      whitespace: '_',
      dash: true,
      es5keyword: true,
      es5IdentifierName: true,
    });
    // oxlint-disable-next-line typescript/no-unsafe-argument
    const doc = jsDoc(response);
    const model = `${doc}export type ${modelName} = ${type || 'unknown'};\n`;

    generatorSchemas.push(...schemas);

    if (modelName !== type) {
      generatorSchemas.push({
        name: modelName,
        model,
        imports,
        kind: 'schema',
      });
    }
  }

  return generatorSchemas;
}
