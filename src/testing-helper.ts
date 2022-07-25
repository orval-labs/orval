import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { OpenAPIObject } from 'openapi3-ts';
import { normalizeOptions } from './utils/options';
import { importOpenApi } from './core/importers/openApi';

const dirToPath = (dir: string) => path.resolve(process.cwd(), `.${dir}`);
const read = (filePath: string) => {
  const testFilePath = dirToPath(filePath);
  const data = fs.readFileSync(testFilePath, 'utf-8');
  if (!data) {
    throw new Error('missing test case file');
  }
  return yaml.load(data) as OpenAPIObject;
};

export const run = async (filePath: string) => {
  const inputYaml = read(filePath);
  const options = await normalizeOptions({ input: 'test', output: 'test' });
  return await importOpenApi({
    data: { test: inputYaml },
    input: { target: 'test' },
    output: options.output,
    target: 'test',
    workspace: 'test',
  });
};
