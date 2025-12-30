import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'node:fs/promises';
import { generate } from 'orval';
import prettier from 'prettier';
import yaml from 'yaml';

export interface GenerateOutput {
  content: string;
  filename: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GenerateOutput[] | { error: string }>,
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { schema, config } = req.body;

  try {
    const parsedConfig = JSON.parse(config);
    const parsedYaml = yaml.parse(schema);

    const fullConfig = {
      output: {
        ...parsedConfig.output,
        target: `/tmp/endpoints.ts`,
        mode: 'single',
        schema: undefined,
      },
      input: {
        target: parsedYaml,
      },
    };

    await generate(fullConfig);

    const file = await fs.readFile(`/tmp/endpoints.ts`, 'utf8');

    res.status(200).json([
      {
        content: await prettier.format(file, {
          parser: 'typescript',
        }),
        filename: 'endpoints.ts',
      },
    ]);
  } catch (err) {
    let errorMessage = 'Impossible to generate code with this config';
    const inDevEnvironment = process.env.NODE_ENV === 'development';
    if (inDevEnvironment) {
      if (err instanceof Error) {
        errorMessage = err.toString();
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
    }
    res.status(400).json({ error: errorMessage });
  }
}
