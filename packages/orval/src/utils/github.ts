import SwaggerParser from '@apidevtools/swagger-parser';
import { upath } from '@orval/core';
import { prompt } from 'enquirer';
import fs from 'fs-extra';
import https from 'https';
import { request } from './request';

export const getGithubSpecReq = ({
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
}): [https.RequestOptions, string] => {
  const payload = JSON.stringify({
    query: `query {
      repository(name: "${repo}", owner: "${owner}") {
        object(expression: "${branch}:${path}") {
          ... on Blob {
            text
          }
        }
      }
    }`,
  });

  return [
    {
      method: 'POST',
      hostname: 'api.github.com',
      path: '/graphql',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'orval-importer',
        authorization: `bearer ${accessToken}`,
        'Content-Length': payload.length,
      },
    },
    payload,
  ];
};

let githubToken: string | null = null;

export const getGithubAcessToken = async (githubTokenPath: string) => {
  if (githubToken) {
    return githubToken;
  }

  if (await fs.pathExists(githubTokenPath)) {
    return fs.readFile(githubTokenPath, 'utf-8');
  } else {
    const answers = await prompt<{
      githubToken: string;
      saveToken: boolean;
    }>([
      {
        type: 'input',
        name: 'githubToken',
        message:
          'Please provide a GitHub token with `repo` rules checked (https://help.github.com/articles/creating-a-personal-access-token-for-the-command-line/)',
      },
      {
        type: 'confirm',
        name: 'saveToken',
        message:
          'Would you like to store your token for the next time? (stored in your node_modules)',
      },
    ]);

    githubToken = answers.githubToken;

    if (answers.saveToken) {
      await fs.outputFile(githubTokenPath, answers.githubToken);
    }
    return answers.githubToken;
  }
};

export const getGithubOpenApi = async (url: string): Promise<string> => {
  const githubTokenPath = upath.join(__dirname, '.githubToken');
  const accessToken = await getGithubAcessToken(githubTokenPath);
  const [info] = url.split('github.com/').slice(-1);

  const [owner, repo, , branch, ...paths] = info.split('/');
  const path = paths.join('/');

  try {
    const { body } = await request<{
      data?: { repository: any };
      errors?: { type: string }[];
    }>(...getGithubSpecReq({ accessToken, repo, owner, branch, path }));
    if (body.errors?.length) {
      const isErrorRemoveLink = body.errors?.some(
        (error) => error?.type === 'NOT_FOUND',
      );

      if (isErrorRemoveLink) {
        const answers = await prompt<{ removeToken: boolean }>([
          {
            type: 'confirm',
            name: 'removeToken',
            message:
              "Your token doesn't have the correct permissions, should we remove it?",
          },
        ]);
        if (answers.removeToken) {
          await fs.unlink(githubTokenPath);
        }
      }
    }

    return body.data?.repository?.object.text;
  } catch (e: any) {
    if (!e.body) {
      throw `Oups... 🍻. ${e}`;
    }

    if (e.body.message === 'Bad credentials') {
      const answers = await prompt<{ removeToken: boolean }>([
        {
          type: 'confirm',
          name: 'removeToken',
          message:
            "Your token doesn't have the correct permissions, should we remove it?",
        },
      ]);
      if (answers.removeToken) {
        await fs.unlink(githubTokenPath);
      }
    }
    throw e.body.message || `Oups... 🍻. ${e}`;
  }
};

export const githubResolver = {
  order: 199,
  canRead(file: SwaggerParser.FileInfo) {
    return file.url.includes('github.com');
  },

  read(file: SwaggerParser.FileInfo) {
    return getGithubOpenApi(file.url);
  },
};
