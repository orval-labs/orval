import {camel} from 'case';
import {appendFileSync, writeFileSync} from 'fs';
import {InfoObject} from 'openapi3-ts';
import {join} from 'path';
import {getFilesHeader} from '../../messages/inline';
import {WriteSpecsModel} from '../../types/writeSpecs';
import {generateImports} from './generateImports';

const getModel = (
  info: InfoObject,
  {imports, model}: WriteSpecsModel
): string => {
  let file = getFilesHeader(info);
  file += generateImports(imports);
  file += model;
  return file;
};

const getPath = (path: string, name: string): string =>
  join(path, `/${name}.ts`);

export const generateModel = (
  path: string,
  info: InfoObject,
  spec: WriteSpecsModel
) => {
  const name = camel(spec.name);
  writeFileSync(getPath(path, name), getModel(info, spec));
  appendFileSync(getPath(path, 'index'), `export * from './${name}'\n`);
};

export const generateModels = (
  models: WriteSpecsModel[],
  path: string,
  info: InfoObject
) => models.forEach(model => generateModel(path, info, model));
