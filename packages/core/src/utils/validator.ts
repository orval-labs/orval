import { OpenAPIObject } from 'openapi3-ts/oas30';
import {
  ibmOpenapiValidatorErrors,
  ibmOpenapiValidatorWarnings,
} from './logger';

const ibmOpenapiRuleset = require('@ibm-cloud/openapi-ruleset');
const { Spectral } = require('@stoplight/spectral-core');

/**
 * Validate the spec with ibm-openapi-validator (with a custom pretty logger).
 * More information: https://github.com/IBM/openapi-validator/#configuration
 * @param specs openAPI spec
 */
export const ibmOpenapiValidator = async (specs: OpenAPIObject) => {
  const spectral = new Spectral();
  spectral.setRuleset(ibmOpenapiRuleset);
  const { errors, warnings } = await spectral.run(specs);

  if (warnings.length) {
    ibmOpenapiValidatorWarnings(warnings);
  }

  if (errors.length) {
    ibmOpenapiValidatorErrors(errors);
  }
};
