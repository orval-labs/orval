import fs from 'fs';
import { generate } from 'orval';
import prettier from 'prettier';
import yaml from 'yaml';

export default async function handler(req, res) {
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

    const file = fs.readFileSync(`/tmp/endpoints.ts`, 'utf8');

    res.status(200).json([
      {
        content: prettier.format(file, {
          parser: 'typescript',
        }),
        filename: 'endpoints.ts',
      },
    ]);
  } catch {
    res
      .status(400)
      .json({ error: 'Impossible to generate code with this config' });
  }
}
