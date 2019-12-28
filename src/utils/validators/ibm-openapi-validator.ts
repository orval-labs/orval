import chalk from 'chalk';
import openApiValidator from 'ibm-openapi-validator';
import { OpenAPIObject } from 'openapi3-ts';

/**
 * Validate the spec with ibm-openapi-validator (with a custom pretty logger).
 *
 * @param specs openAPI spec
 */
export const ibmOpenapiValidator = async (specs: OpenAPIObject) => {
  // tslint:disable:no-console
  const log = console.log;

  // Catch the internal console.log to add some information if needed
  // because openApiValidator() calls console.log internally and
  // we want to add more context if it's used
  let wasConsoleLogCalledFromBlackBox = false;
  console.log = (...props: any) => {
    wasConsoleLogCalledFromBlackBox = true;
    log(...props);
  };
  const { errors, warnings } = await openApiValidator(specs);
  console.log = log; // reset console.log because we're done with the black box

  if (wasConsoleLogCalledFromBlackBox) {
    log('More information: https://github.com/IBM/openapi-validator/#configuration');
  }
  if (warnings.length) {
    log(chalk.yellow('(!) Warnings'));
    warnings.forEach(i =>
      log(
        chalk.yellow(`
Message : ${i.message}
Path    : ${i.path}`),
      ),
    );
  }
  if (errors.length) {
    log(chalk.red('(!) Errors'));
    errors.forEach(i =>
      log(
        chalk.red(`
Message : ${i.message}
Path    : ${i.path}`),
      ),
    );
  }
  // tslint:enable:no-console
};
