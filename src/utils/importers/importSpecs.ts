import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import inquirer from 'inquirer';
import { join, parse } from 'path';
import request from 'request';
import { AdvancedOptions } from '../../types';
import { importOpenApi } from './importOpenApi';

const getGithubSpecReq = ({
  accessToken,
  repo,
  owner,
  branch,
  path,
}: {
  accessToken: string;
  repo: string;
  owner: string;
  branch: string;
  path: string;
}) => ({
  method: 'POST',
  url: 'https://api.github.com/graphql',
  headers: {
    'content-type': 'application/json',
    'user-agent': 'orval-importer',
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
});

export const importSpecs = async (
  options: AdvancedOptions,
): Promise<{
  api: { output: string; imports?: string[] };
  models: Array<{ name: string; model: string; imports?: string[] }>;
  mocks: { output: string; imports?: string[] };
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
      ...(typeof options.mock === 'object' ? { mockOptions: options.mock } : {}),
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

    return new Promise((resolve, reject) => {
      request(getGithubSpecReq({ accessToken, repo, owner, branch, path }), async (error, _, rawBody) => {
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
            ...(typeof options.mock === 'object' ? { mockOptions: options.mock } : {}),
          }),
        );
      });
    });
  } else {
    return Promise.reject('Please provide a file (--file) or a github (--github) input');
  }
};
