import type { GeneratorSchema } from '../types';

export function generateModelInline(acc: string, model: string): string {
  return acc + `${model}\n`;
}

export function generateModelsInline(
  obj: Record<string, GeneratorSchema[]> | GeneratorSchema[],
  deduplicateModels = false,
): string {
  const schemas = Array.isArray(obj) ? obj : Object.values(obj).flat();
  const canonicalNames = new Map<string, string>();

  let result = '';
  for (const schema of schemas) {
    let { model } = schema;
    if (deduplicateModels) {
      // Match the generator's non-generic object alias template, keeping its
      // leading documentation separate. Interfaces retain declaration merging;
      // enums, factories and other runtime declarations must not be aliased.
      const match =
        /^((?:\s|\/\*[\s\S]*?\*\/|\/\/[^\n]*\n)*)export type (\S+) = (\{[\s\S]*\});\s*$/.exec(
          model,
        );
      if (
        schema.kind !== 'enum' &&
        match &&
        match[2] === schema.name &&
        !match[3].includes('\nexport ') &&
        // Each unique-symbol property has its own nominal identity, even
        // when its declaration text is identical to another model's.
        !/\bunique\b/.test(match[3])
      ) {
        // Identical spelling is insufficient if an imported identifier has a
        // different binding. Keep property documentation and modifiers in the
        // key too; only the declaration's own JSDoc may differ.
        const key = JSON.stringify([
          match[3],
          schema.imports.map((imp) => JSON.stringify(imp)).toSorted(),
        ]);
        const canonicalName = canonicalNames.get(key);
        if (
          canonicalName &&
          canonicalName !== schema.name &&
          canonicalName.length < match[3].length
        ) {
          model = `${match[1]}export type ${schema.name} = ${canonicalName};\n`;
        } else if (!canonicalName) {
          canonicalNames.set(key, schema.name);
        }
      }
    }
    result = generateModelInline(result, model);
  }
  return result;
}
