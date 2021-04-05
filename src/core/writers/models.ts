import { appendFileSync, readFile, writeFileSync } from 'fs';
import { InfoObject } from 'openapi3-ts';
import { join } from 'path';
import { GeneratorSchema } from '../../types/generator';
import { camel } from '../../utils/case';
import { getFilesHeader } from '../../utils/messages/inline';
import { generateImports } from '../generators/imports';

const getModel = (
  info: InfoObject,
  { imports, model }: GeneratorSchema,
  refSpec: boolean,
): string => {
  let file = getFilesHeader(info);
  file += generateImports(imports, refSpec);
  file += imports.length ? '\n\n' : '\n';
  file += model;
  return file;
};

const getPath = (path: string, name: string): string =>
  join(path, `/${name}.ts`);

export const writeModelInline = (acc: string, model: string): string =>
  acc + `${model}\n`;

export const writeModelsInline = (array: GeneratorSchema[]): string =>
  array.reduce((acc, { model }) => writeModelInline(acc, model), '');

export const writeModel = (
  path: string,
  info: InfoObject,
  spec: GeneratorSchema,
  refSpec: boolean,
) => {
  const name = camel(spec.name);
  writeFileSync(getPath(path, name), getModel(info, spec, refSpec));
  const indexPath = getPath(path, 'index');

  readFile(indexPath, function (err, data) {
    if (err) throw err;
    const stringData = data.toString();
    if (
      !stringData.includes(`export * from './${name}'`) &&
      !stringData.includes(`export * from "./${name}"`)
    ) {
      appendFileSync(getPath(path, 'index'), `export * from './${name}';\n`);
    }
  });
};

export const writeModels = (
  models: GeneratorSchema[],
  path: string,
  info: InfoObject,
  refSpec: boolean,
) => models.forEach((model) => writeModel(path, info, model, refSpec));
