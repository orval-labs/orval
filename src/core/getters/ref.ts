import { ReferenceObject } from 'openapi3-ts';
import { resolve } from 'path';
import url from 'url';
import { ContextSpecs } from '../../types';
import { getFileInfo } from '../../utils/file';
import { isUrl } from '../../utils/url';

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
  context: ContextSpecs,
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

  const pathname = refSplitted[0];

  const path = isUrl(context.specKey)
    ? url.resolve(context.specKey, pathname)
    : resolve(getFileInfo(context.specKey).dirname, pathname);

  return {
    name: refSplitted[1] + RefComponentSuffix[refComponent],
    specKey: path,
  };
};
