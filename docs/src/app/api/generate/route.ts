import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import { generate } from 'orval';
import prettier from 'prettier';
import yaml from 'yaml';

export interface GenerateOutput {
  content: string;
  filename: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { schema, config } = body;

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

    return NextResponse.json([
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
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}
