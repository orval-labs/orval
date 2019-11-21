import chalk from 'chalk';
import program from 'commander';
import { appendFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import inquirer from 'inquirer';
import difference from 'lodash/difference';
import { join, parse } from 'path';
import request from 'request';
import importOpenApi from '../scripts/import-open-api';
import { resolvePath } from '../utils/resolvePath';

const log = console.log; // tslint:disable-line:no-console

export interface Options {
  output?: string;
  outputFile?: string;
  types?: string;
  workDir?: string;
  file?: string;
  github?: string;
  transformer?: string;
  validation?: boolean;
}

export type AdvancedOptions = Options & {
  defaultParams?: {
    [key: string]: {
      name?: string;
      path?: string;
      default?: unknown;
      type?: string;
    };
  };
};

export interface ExternalConfigFile {
  [backend: string]: AdvancedOptions;
}

program.option('-o, --output [value]', 'output file destination');
program.option('-t, --types [value]', 'output types destination');
program.option('-d, --workDir [value]', 'directory destination');
program.option('-f, --file [value]', 'input file (yaml or json openapi specs)');
program.option('-g, --github [value]', 'github path (format: `owner:repo:branch:path`)');
program.option('-t, --transformer [value]', 'transformer function path');
program.option('--validation', 'add the validation step (provided by ibm-openapi-validator)');
program.option('--config [value]', 'override flags by a config file');
program.parse(process.argv);

const createSuccessMessage = (backend?: string) =>
  chalk.green(`${backend || ''}🎉  Your OpenAPI spec has been converted into ready to use restful-client!`);

/* const successWithoutOutputMessage = chalk.yellow('Success! No output path specified; printed to standard output.'); */

const generateImports = (imports: string[] = [], path: string = '.') => {
  return imports.sort().reduce((acc, imp) => acc + `import { ${imp} } from \'${path}/${imp}\'; \n`, '');
};

const importSpecs = async (
  options: AdvancedOptions,
): Promise<{
  base: string;
  api: { output: string; imports?: string[] };
  models: Array<{ name: string; model: string; imports?: string[] }>;
}> => {
  const transformer = options.transformer ? require(join(process.cwd(), options.transformer)) : undefined;

  if (!options.file && !options.github) {
    throw new Error('You need to provide an input specification with `--file` or `--github`');
  }

  if (options.file) {
    const data = readFileSync(join(process.cwd(), options.file), 'utf-8');
    const { ext } = parse(options.file);
    const format = ['.yaml', '.yml'].includes(ext.toLowerCase()) ? 'yaml' : 'json';

    return importOpenApi({
      data,
      format,
      transformer,
      validation: options.validation,
      defaultParams: options.defaultParams,
    });
  } else if (options.github) {
    const { github } = options;

    let accessToken: string;
    const githubTokenPath = join(__dirname, '.githubToken');
    if (existsSync(githubTokenPath)) {
      accessToken = readFileSync(githubTokenPath, 'utf-8');
    } else {
      const answers = await inquirer.prompt<{ githubToken: string; saveToken: boolean }>([
        {
          type: 'input',
          name: 'githubToken',
          message:
            'Please provide a GitHub token with `repo` rules checked (https://help.github.com/articles/creating-a-personal-access-token-for-the-command-line/)',
        },
        {
          type: 'confirm',
          name: 'saveToken',
          message: 'Would you like to store your token for the next time? (stored in your node_modules)',
        },
      ]);
      if (answers.saveToken) {
        writeFileSync(githubTokenPath, answers.githubToken);
      }
      accessToken = answers.githubToken;
    }
    const [owner, repo, branch, path] = github.split(':');

    const githubSpecReq = {
      method: 'POST',
      url: 'https://api.github.com/graphql',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'restful-client-importer',
        authorization: `bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query: `query {
          repository(name: "${repo}", owner: "${owner}") {
            object(expression: "${branch}:${path}") {
              ... on Blob {
                text
              }
            }
          }
        }`,
      }),
    };

    return new Promise((resolve, reject) => {
      request(githubSpecReq, async (error, _, rawBody) => {
        if (error) {
          return reject(error);
        }

        const body = JSON.parse(rawBody);
        if (!body.data) {
          if (body.message === 'Bad credentials') {
            const answers = await inquirer.prompt<{ removeToken: boolean }>([
              {
                type: 'confirm',
                name: 'removeToken',
                message: "Your token doesn't have the correct permissions, should we remove it?",
              },
            ]);
            if (answers.removeToken) {
              unlinkSync(githubTokenPath);
            }
          }
          return reject(body.message);
        }

        const format =
          github.toLowerCase().includes('.yaml') || github.toLowerCase().includes('.yml') ? 'yaml' : 'json';
        resolve(
          importOpenApi({
            data: body.data.repository.object.text,
            format,
            transformer,
            validation: options.validation,
            defaultParams: options.defaultParams,
          }),
        );
      });
    });
  } else {
    return Promise.reject('Please provide a file (--file) or a github (--github) input');
  }
};

if (program.config) {
  // Use config file as configuration (advanced usage)

  // tslint:disable-next-line: no-var-requires
  const config: ExternalConfigFile = require(join(process.cwd(), program.config));

  const mismatchArgs = difference(program.args, Object.keys(config));
  if (mismatchArgs.length) {
    log(
      chalk.yellow(
        `${mismatchArgs.join(', ')} ${mismatchArgs.length === 1 ? 'is' : 'are'} not defined in your configuration!`,
      ),
    );
  }

  Object.entries(config)
    .filter(([backend]) => (program.args.length === 0 ? true : program.args.includes(backend)))
    .forEach(([backend, options]) => {
      importSpecs(options)
        .then(({ base, api, models }) => {
          const { output, types, workDir = '' } = options;

          if (types) {
            const isExist = existsSync(join(process.cwd(), workDir, types));
            if (!isExist) {
              mkdirSync(join(process.cwd(), workDir, types));
            }

            models.forEach(({ name, model, imports }) => {
              let file = generateImports(imports);
              file += model;
              writeFileSync(join(process.cwd(), workDir, `${types}/${name}.ts`), file);
              appendFileSync(join(process.cwd(), workDir, `${types}/index.ts`), `export * from './${name}'\n`);
            });
          }

          if (output) {
            if (types) {
              let data = base;
              data += generateImports(
                api.imports,
                resolvePath(join(process.cwd(), workDir, output), join(process.cwd(), workDir, types)),
              );
              data += api.output;
              writeFileSync(join(process.cwd(), workDir, output), data);

              writeFileSync(join(process.cwd(), workDir, `${types}/index.ts`), '');
            } else {
              let data = base;
              data += models.reduce((acc, { model }) => acc + `${model}\n\n`, '');
              data += api.output;
              writeFileSync(join(process.cwd(), workDir, output), data);
            }
            log(createSuccessMessage(backend));
          }
        })
        .catch(err => {
          log(chalk.red(err));
          process.exit(1);
        });
    });
} else {
  // Use flags as configuration
  importSpecs((program as any) as Options)
    .then(({ base, api, models }) => {
      const { output, types, workDir = '' } = program;
      if (types) {
        const isExist = existsSync(join(process.cwd(), workDir, types));
        if (!isExist) {
          mkdirSync(join(process.cwd(), workDir, types));
        }

        models.forEach(({ name, model, imports }) => {
          let file = generateImports(imports);
          file += model;
          writeFileSync(join(process.cwd(), workDir, `${types}/${name}.ts`), file);
          appendFileSync(join(process.cwd(), workDir, `${types}/index.ts`), `export * from './${name}'\n`);
        });
      }

      if (output) {
        if (types) {
          let data = base;
          data += generateImports(
            api.imports,
            resolvePath(join(process.cwd(), workDir, output), join(process.cwd(), workDir, types)),
          );
          data += api.output;
          writeFileSync(join(process.cwd(), workDir, output), data);

          writeFileSync(join(process.cwd(), workDir, `${types}/index.ts`), '');
        } else {
          let data = base;
          data += models.reduce((acc, { model }) => acc + `${model}\n\n`, '');
          data += api.output;
          writeFileSync(join(process.cwd(), workDir, output), data);
        }
        log(createSuccessMessage());
      }

      /*  else {
        log(data);
        log(successWithoutOutputMessage);
      } */
    })
    .catch(err => {
      log(chalk.red(err));
      process.exit(1);
    });
}
