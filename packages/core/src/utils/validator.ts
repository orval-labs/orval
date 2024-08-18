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
  const results = await spectral.run(specs);

  const errors: { message: string; path: string[] }[] = [];
  const warnings: { message: string; path: string[] }[] = [];

  for (const { severity, message, path } of results) {
    const entry = { message, path };
    // 0: error, 1: "warning", see: https://github.com/IBM/openapi-validator/blob/a93e18a156108b6b946727d0b24bbcc69095b72e/packages/validator/src/spectral/spectral-validator.js#L222
    switch (severity) {
      case 0:
        errors.push(entry);
        break;
      case 1:
        warnings.push(entry);
        break;
    }
  }

  if (warnings.length) {
    ibmOpenapiValidatorWarnings(warnings);
  }

  if (errors.length) {
    ibmOpenapiValidatorErrors(errors);
    process.exit(1);
  }
};
