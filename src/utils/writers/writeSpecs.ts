import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Options } from '../../types';
import { createSuccessMessage } from '../createSuccessMessage';
import { generateImports } from '../generators/generateImports';
import { resolvePath } from '../resolvers/resolvePath';

const log = console.log; // tslint:disable-line:no-console

export const writeSpecs = (options: Options, backend?: string) => ({
  base,
  api,
  models,
}: {
  base: string;
  api: {
    output: string;
    imports?: string[] | undefined;
  };
  models: {
    name: string;
    model: string;
    imports?: string[] | undefined;
  }[];
}) => {
  const { output, types, workDir = '' } = options;

  if (types) {
    const isExist = existsSync(join(process.cwd(), workDir, types));
    if (!isExist) {
      mkdirSync(join(process.cwd(), workDir, types));
    }

    writeFileSync(join(process.cwd(), workDir, `${types}/index.ts`), '');
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
        true,
      );
      data += '\n';
      data += api.output;
      writeFileSync(join(process.cwd(), workDir, output), data);
    } else {
      let data = base;
      data += models.reduce((acc, { model }) => acc + `${model}\n\n`, '');
      data += '\n';
      data += api.output;
      writeFileSync(join(process.cwd(), workDir, output), data);
    }
    log(createSuccessMessage(backend));
  }
};
