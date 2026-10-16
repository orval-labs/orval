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
    // Zod schema output skips schemas without an OpenAPI definition, so give
    // the component one built from its content types.
    const contentSchemas = allResponseTypes.flatMap(({ originalSchema }) =>
      originalSchema === undefined ? [] : [originalSchema],
    );
    const schema =
      contentSchemas.length > 1 ? { anyOf: contentSchemas } : contentSchemas[0];

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

    // An inline object content type already produced a schema named after the component.
    generatorSchemas.push(
      ...schemas.map((generated) =>
        generated.name === modelName && generated.schema === undefined
          ? { ...generated, schema }
          : generated,
      ),
    );

    if (modelName !== type) {
      generatorSchemas.push({
        name: modelName,
        model,
        imports,
        schema,
        kind: 'schema',
      });
    }
  }

  return generatorSchemas;
}
