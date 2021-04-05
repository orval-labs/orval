import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import https from 'https';
import inquirer from 'inquirer';
import { join } from 'path';
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

export const getGithubAcessToken = async (githubTokenPath: string) => {
  if (existsSync(githubTokenPath)) {
    return readFileSync(githubTokenPath, 'utf-8');
  } else {
    const answers = await inquirer.prompt<{
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
    if (answers.saveToken) {
      writeFileSync(githubTokenPath, answers.githubToken);
    }
    return answers.githubToken;
  }
};

export const getGithubOpenApi = async (url: string): Promise<string> => {
  const githubTokenPath = join(__dirname, '.githubToken');
  const accessToken = await getGithubAcessToken(githubTokenPath);
  const [info] = url.split('github.com/').slice(-1);

  const [owner, repo, , branch, ...paths] = info.split('/');
  const path = paths.join('/');

  try {
    const { body } = await request<{ data?: { repository: any } }>(
      ...getGithubSpecReq({ accessToken, repo, owner, branch, path }),
    );

    return body.data?.repository.object.text;
  } catch (e) {
    if (!e.body) {
      throw `Oups... 🍻. ${e}`;
    }

    if (e.body.message === 'Bad credentials') {
      const answers = await inquirer.prompt<{ removeToken: boolean }>([
        {
          type: 'confirm',
          name: 'removeToken',
          message:
            "Your token doesn't have the correct permissions, should we remove it?",
        },
      ]);
      if (answers.removeToken) {
        unlinkSync(githubTokenPath);
      }
    }
    throw e.body.message || `Oups... 🍻. ${e}`;
  }
};
