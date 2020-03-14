import {WriteSpecsModel} from '../../types/writeSpecs';

export const generateModelInline = (acc: string, model: string): string =>
  acc + `${model}\n\n`;

export const generateModelsInline = (array: WriteSpecsModel[]): string =>
  array.reduce((acc, {model}) => generateModelInline(acc, model), '');
