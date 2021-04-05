import { ReferenceObject } from 'openapi3-ts';
import { resolve } from 'path';
import url from 'url';
import { InputTarget } from '../../types';
import { ActionType, useContext } from '../../utils/context';
import { getFileInfo } from '../../utils/file';
import { isUrl } from '../../utils/url';
import { generateResponsesDefinition } from '../generators/responsesDefinition';
import { generateSchemasDefinition } from '../generators/schemaDefinition';
import { getSpecData } from '../importers/data';
import { validateSpecs } from '../importers/openApi';
import { ibmOpenapiValidator } from '../validators/ibm-openapi-validator';

type RefComponent = 'schemas' | 'responses' | 'parameters' | 'requestBodies';

const RefComponent = {
  schemas: 'schemas' as RefComponent,
  responses: 'responses' as RefComponent,
  parameters: 'parameters' as RefComponent,
  requestBodies: 'requestBodies' as RefComponent,
};

const REF_COMPONENTS = Object.values(RefComponent);

const RefComponentSuffix = {
  [RefComponent.schemas]: '',
  [RefComponent.responses]: 'Response',
  [RefComponent.parameters]: '',
  [RefComponent.requestBodies]: '',
};

/**
 * Return the output type from the $ref
 *
 * @param $ref
 */
export const getRefInfo = async (
  $ref: ReferenceObject['$ref'],
  target: InputTarget,
): Promise<{ name: string; specKey?: string }> => {
  const refComponent = REF_COMPONENTS.find((refComponent) =>
    $ref.includes(`#/components/${refComponent}`),
  );

  if (!refComponent) {
    throw new Error('Unresolved $ref');
  }

  const refSplitted = $ref.split(`#/components/${refComponent}/`);

  if (!refSplitted[0]) {
    return {
      name: refSplitted[1] + RefComponentSuffix[refComponent],
    };
  }

  const [context, dispatch] = useContext();
  const pathname = refSplitted[0];

  const isPathUrl = isUrl(target.path);
  const path = isPathUrl
    ? url.resolve(target.path, pathname)
    : resolve(getFileInfo(target.path).dirname, pathname);

  if (!context.specs[path] && context.rootSpec !== path) {
    const { data, format } = await getSpecData(path);

    const basePath = (isUrl(path)
      ? path.replace(context.rootSpec, '')
      : path.replace(getFileInfo(context.rootSpec).dirname, '')
    ).replace(`.${format}`, '');

    let spec = await validateSpecs(data, format);

    if (context.transformer) {
      spec = context.transformer(spec);
    }

    if (context.validation) {
      await ibmOpenapiValidator(spec);
    }
    dispatch({ type: ActionType.INIT_SPEC, name: path, basePath, spec });

    const schemaDefinition = await generateSchemasDefinition(
      spec.components?.schemas,
      { ...target, path },
    );

    const responseDefinition = await generateResponsesDefinition(
      spec.components?.responses,
      { ...target, path },
    );

    dispatch({
      type: ActionType.ADD_SPEC_SCHEMAS,
      name: path,
      schemas: [...schemaDefinition, ...responseDefinition],
    });
  }

  return {
    name: refSplitted[1] + RefComponentSuffix[refComponent],
    specKey: path,
  };
};
