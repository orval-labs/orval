import chalk from 'chalk';
import { PackageJson } from '../packages';
export const log = console.log; // tslint:disable-line:no-console

export const startMessage = ({ name, version, description }: PackageJson) =>
  log(
    `🍻 Start ${chalk.cyan.bold(name)} ${chalk.green(`v${version}`)}${
      description ? ` - ${description}` : ''
    }`,
  );

export const errorMessage = (err: string) => log(chalk.red(err));

export const mismatchArgsMessage = (mismatchArgs: string[]) =>
  log(
    chalk.yellow(
      `${mismatchArgs.join(', ')} ${
        mismatchArgs.length === 1 ? 'is' : 'are'
      } not defined in your configuration!`,
    ),
  );

export const createSuccessMessage = (backend?: string) =>
  log(
    `🎉 ${
      backend ? `${chalk.green(backend)} - ` : ''
    }Your OpenAPI spec has been converted into ready to use orval!`,
  );

export const ibmOpenapiValidatorWarnings = (
  warnings: {
    path: string;
    message: string;
  }[],
) => {
  log(chalk.yellow('(!) Warnings'));

  warnings.forEach((i) =>
    log(chalk.yellow(`Message : ${i.message}\nPath    : ${i.path}`)),
  );
};

export const ibmOpenapiValidatorErrors = (
  errors: {
    path: string;
    message: string;
  }[],
) => {
  log(chalk.red('(!) Errors'));

  errors.forEach((i) =>
    log(chalk.red(`Message : ${i.message}\nPath    : ${i.path}`)),
  );
};
