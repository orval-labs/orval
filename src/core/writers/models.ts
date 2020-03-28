import {camel} from 'case';
import {appendFileSync, writeFileSync} from 'fs';
import {InfoObject} from 'openapi3-ts';
import {join} from 'path';
import {GeneratorSchema} from '../../types/generator';
import {getFilesHeader} from '../../utils/messages/inline';
import {generateImports} from '../generators/imports';

const getModel = (
  info: InfoObject,
  {imports, model}: GeneratorSchema
): string => {
  let file = getFilesHeader(info);
  file += generateImports(imports);
  file += model;
  return file;
};

const getPath = (path: string, name: string): string =>
  join(path, `/${name}.ts`);

export const writeModelInline = (acc: string, model: string): string =>
  acc + `${model}\n\n`;

export const writeModelsInline = (array: GeneratorSchema[]): string =>
  array.reduce((acc, {model}) => writeModelInline(acc, model), '');

export const writeModel = (
  path: string,
  info: InfoObject,
  spec: GeneratorSchema
) => {
  const name = camel(spec.name);
  writeFileSync(getPath(path, name), getModel(info, spec));
  appendFileSync(getPath(path, 'index'), `export * from './${name}'\n`);
};

export const writeModels = (
  models: GeneratorSchema[],
  path: string,
  info: InfoObject
) => models.forEach(model => writeModel(path, info, model));
