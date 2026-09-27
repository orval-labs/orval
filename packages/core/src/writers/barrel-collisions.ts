import fs from 'node:fs';
import nodePath from 'node:path';

import { logger } from '../utils';

const RE_EXPORT_STAR = /^\s*export\s+\*\s+from\s*['"](\.[^'"]*)['"]\s*;?\s*$/gm;

// Generated modules declare every export at the top level, so a line-anchored
// scan finds them without parsing. A miss only drops a warning, never output.
const RE_EXPORTED_DECLARATION =
  /^export\s+(?:declare\s+)?(?:const|let|var|function|abstract\s+class|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm;

const resolveModuleFile = (indexPath: string, specifier: string) => {
  const resolved = nodePath.resolve(nodePath.dirname(indexPath), specifier);
  const candidates = [
    `${resolved}.ts`,
    resolved.replace(/\.[cm]?js$/, '.ts'),
    resolved,
  ];
  return candidates.find(
    (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
  );
};

/**
 * Names that more than one module of a barrel exports. TypeScript cannot
 * resolve an ambiguous `export *` (TS2308), so each such name is unusable
 * through the barrel. Nested barrels (directory re-exports) are skipped.
 */
export const getAmbiguousBarrelExports = async (
  indexPath: string,
): Promise<Map<string, string[]>> => {
  if (!fs.existsSync(indexPath)) return new Map();

  const content = await fs.promises.readFile(indexPath, 'utf8');
  const modulesByName = new Map<string, string[]>();
  // Specifiers that resolve to one file (`./cat`, `./cat.js`) re-export the
  // same declarations, which TypeScript does not treat as ambiguous.
  const scannedFiles = new Set<string>();

  for (const [, specifier] of content.matchAll(RE_EXPORT_STAR)) {
    const file = resolveModuleFile(indexPath, specifier);
    if (!file || scannedFiles.has(file)) continue;
    scannedFiles.add(file);

    const source = await fs.promises.readFile(file, 'utf8');
    // A value and its companion type (`const Cat` + `type Cat`) share a name
    // within one module, which is not ambiguous.
    const names = new Set(
      [...source.matchAll(RE_EXPORTED_DECLARATION)].map(([, name]) => name),
    );
    for (const name of names) {
      const modules = modulesByName.get(name);
      if (modules) modules.push(specifier);
      else modulesByName.set(name, [specifier]);
    }
  }

  return new Map(
    [...modulesByName].filter(([, modules]) => modules.length > 1),
  );
};

/**
 * Two outputs whose `schemas` point at one directory share its `index.ts`,
 * and each merges the other's exports into it. When both generate a schema
 * of the same name (a TypeScript model and a reusable Zod schema, say), the
 * barrel re-exports it twice and consumers can import neither. Which one is
 * meant cannot be decided here, so this only reports it. See #4217.
 */
export const warnAmbiguousBarrelExports = async (indexPath: string) => {
  const ambiguous = await getAmbiguousBarrelExports(indexPath);
  if (ambiguous.size === 0) return;

  const details = [...ambiguous]
    .map(
      ([name, modules]) =>
        `'${name}' (${modules.map((m) => `'${m}'`).join(', ')})`,
    )
    .join(', ');

  logger.warn(
    `Schemas index ${indexPath} re-exports the same name from more than one ` +
      `module: ${details}. TypeScript treats these as ambiguous, so they ` +
      `cannot be imported from the index. This usually means several outputs ` +
      `share one \`schemas\` directory; give each its own.`,
  );
};
