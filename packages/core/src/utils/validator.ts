import { OpenAPIObject } from 'openapi3-ts';
import {
  ibmOpenapiValidatorErrors,
  ibmOpenapiValidatorWarnings,
} from './logger';
// @ts-ignore
import ibmOpenapiRuleset from '@ibm-cloud/openapi-ruleset';
import { Spectral } from '@stoplight/spectral-core';

/**
 * Validate the spec with ibm-openapi-validator (with a custom pretty logger).
 * More information: https://github.com/IBM/openapi-validator/#configuration
 * @param specs openAPI spec
 */
export const ibmOpenapiValidator = async (specs: OpenAPIObject) => {
  const spectral = new Spectral();
  spectral.setRuleset(ibmOpenapiRuleset);
  // @ts-ignore
  const { errors, warnings } = await spectral.run(specs);

  if (warnings.length) {
    ibmOpenapiValidatorWarnings(warnings);
  }

  if (errors.length) {
    ibmOpenapiValidatorErrors(errors);
  }
};
