import isEmpty from 'lodash.isempty';
import {
  ComponentsObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject,
} from 'openapi3-ts/oas30';
import { getResReqTypes } from '../getters';
import { ContextSpecs, GeneratorSchema } from '../types';
import { jsDoc, pascal, sanitize } from '../utils';

export const generateComponentDefinition = (
  responses:
    | ComponentsObject['responses']
    | ComponentsObject['requestBodies'] = {},
  context: ContextSpecs,
  suffix: string,
): GeneratorSchema[] => {
  if (isEmpty(responses)) {
    return [];
  }

  return Object.entries(responses).reduce(
    (
      acc,
      [name, response]: [
        string,
        ReferenceObject | RequestBodyObject | ResponseObject,
      ],
    ) => {
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
      const doc = jsDoc(response as ResponseObject | RequestBodyObject);
      const model = `${doc}export type ${modelName} = ${type || 'unknown'};\n`;

      acc.push(...schemas);

      if (modelName !== type) {
        acc.push({
          name: modelName,
          model,
          imports,
        });
      }

      return acc;
    },
    [] as GeneratorSchema[],
  );
};
