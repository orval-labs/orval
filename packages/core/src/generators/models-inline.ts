import { GeneratorSchema } from '../types';

export const generateModelInline = (acc: string, model: string): string =>
  acc + `${model}\n`;

export const generateModelsInline = (
  obj: Record<string, GeneratorSchema[]>,
): string => {
  const schemas = Object.values(obj).flatMap((it) => it);

  return schemas.reduce<string>(
    (acc, { model }) => generateModelInline(acc, model),
    '',
  );
};
