import isEmpty from 'lodash/isEmpty';
import {
  ComponentsObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject,
} from 'openapi3-ts';
import { ContextSpecs } from '../../types';
import { GeneratorSchema } from '../../types/generator';
import { pascal } from '../../utils/case';
import { jsDoc } from '../../utils/doc';
import { getResReqTypes } from '../getters/resReqTypes';

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

      const modelName = `${pascal(name)}${suffix}`;
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
