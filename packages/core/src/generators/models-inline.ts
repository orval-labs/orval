import type { GeneratorSchema } from '../types';

export function generateModelInline(acc: string, model: string): string {
  return acc + `${model}\n`;
}

export function generateModelsInline(schemas: GeneratorSchema[]): string {
  return schemas.reduce<string>(
    (acc, { model }) => generateModelInline(acc, model),
    '',
  );
}
