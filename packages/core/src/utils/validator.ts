import { OpenAPIObject } from 'openapi3-ts/oas30';
import {
  ibmOpenapiValidatorErrors,
  ibmOpenapiValidatorWarnings,
} from './logger';
// @ts-expect-error no types exists for this package :(
import ibmOpenapiRuleset from '@ibm-cloud/openapi-ruleset';
import { Spectral } from '@stoplight/spectral-core';

/**
 * Validate the spec with ibm-openapi-validator (with a custom pretty logger).
 * More information: https://github.com/IBM/openapi-validator/#configuration
 * @param specs openAPI spec
 */
export const ibmOpenapiValidator = async (
  specs: OpenAPIObject,
  validation: boolean | object,
) => {
  const ruleset =
    typeof validation === 'boolean' ? ibmOpenapiRuleset : validation;
  const spectral = new Spectral();
  spectral.setRuleset(ruleset);
  const results = await spectral.run(
    specs as unknown as Record<string, unknown>,
  );

  const errors: { message: string; path: string[] }[] = [];
  const warnings: { message: string; path: string[] }[] = [];

  for (const { severity, message, path } of results) {
    const entry = { message, path: path.map((x) => x.toString()) };
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
