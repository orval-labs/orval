import type { GeneratorSchema } from '../types';

export function generateModelInline(acc: string, model: string): string {
  return acc + `${model}\n`;
}

export function generateModelsInline(
  obj: Record<string, GeneratorSchema[]>,
): string {
  const schemas = Object.values(obj).flat();

  return schemas.reduce<string>(
    (acc, { model }) => generateModelInline(acc, model),
    '',
  );
}
