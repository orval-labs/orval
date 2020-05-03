import { ReferenceObject } from 'openapi3-ts';
import { pascal } from '../../utils/case';

/**
 * Return the output type from the $ref
 *
 * @param $ref
 */
export const getRef = ($ref: ReferenceObject['$ref']) => {
  if ($ref.startsWith('#/components/schemas')) {
    return pascal($ref.replace('#/components/schemas/', ''));
  } else if ($ref.startsWith('#/components/responses')) {
    return pascal($ref.replace('#/components/responses/', '')) + 'Response';
  } else if ($ref.startsWith('#/components/parameters')) {
    return pascal($ref.replace('#/components/parameters/', '')) + 'Parameter';
  } else if ($ref.startsWith('#/components/requestBodies')) {
    return (
      pascal($ref.replace('#/components/requestBodies/', '')) + 'RequestBody'
    );
  } else {
    throw new Error(
      'This library only resolve $ref that are include into `#/components/*` for now',
    );
  }
};
