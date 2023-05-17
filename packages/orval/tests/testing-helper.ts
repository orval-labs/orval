import { importSpecs } from '../src/import-specs';
import { normalizeOptions } from '../src/utils/options';
import { generateSpec } from '../src/generate';

export const runImportSpecs = async (input: string) => {
  const options = await normalizeOptions({
    input,
    output: input.replace('.yaml', '.testing-helper-generated.ts'),
  });
  const specs = await importSpecs('test', options);
  const allType = Object.values(specs.schemas as Record<string, string>[])
    .flat()
    .map((v) => v?.model)
    .reduce((prev, current) => prev + current, '');

  return {
    specs,
    allType,
  };
};

export const runGenerateSpec = async (input: string) => {
  const options = await normalizeOptions({
    input,
    output: input.replace('.yaml', '.testing-helper-generated.ts'),
  });
  return await generateSpec(process.cwd(), options);
};

export const run = async (input: string, output = true) => {
  if (output) {
    await runGenerateSpec(input);
  }
  return await runImportSpecs(input);
};
