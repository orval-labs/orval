import openApiValidator from 'ibm-openapi-validator';
import {OpenAPIObject} from 'openapi3-ts';
import {
  ibmOpenapiValidatorErrors,
  ibmOpenapiValidatorWarnings
} from '../../utils/messages/logs';

/**
 * Validate the spec with ibm-openapi-validator (with a custom pretty logger).
 * More information: https://github.com/IBM/openapi-validator/#configuration
 * @param specs openAPI spec
 */
export const ibmOpenapiValidator = async (specs: OpenAPIObject) => {
  const {errors, warnings} = await openApiValidator(specs);

  if (warnings.length) {
    ibmOpenapiValidatorWarnings(warnings);
  }

  if (errors.length) {
    ibmOpenapiValidatorErrors(errors);
  }
};
