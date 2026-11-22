import { generateImports } from '../generators/imports';
import { getReferencedFormatTypeImports } from '../getters/scalar';
import type {
  GeneratorImport,
  NormalizedFormatTypeConfig,
  NormalizedOutputOptions,
} from '../types';
import { escapeRegExp } from '../utils/string';

/** Whether `content` has an import declaration that binds `name`. */
export const createImportCheck =
  (content: string) =>
  (name: string): boolean =>
    new RegExp(
      String.raw`^import\s[^;]*?(?<![\w$])${escapeRegExp(name)}(?![\w$])[^;]*?\sfrom\s`,
      'm',
    ).test(content);

const IMPORT_CLAUSE = /^import\s+(?:type\s+)?([^;'"]+?)\s+from\s+['"]/gm;

// A declaration at the start of a line, which is where the generators put
// every constant, type and function of a module.
const DECLARATION =
  /^(?:export\s+)?(?:declare\s+)?(?:default\s+)?(?:abstract\s+)?(?:async\s+)?(?:const\s+enum|const|let|var|type|interface|enum|function\*?|class)\s+([A-Za-z_$][\w$]*)/gm;

// The names an import clause binds, such as `A, { b as c, type D }`.
const getBoundNames = (clause: string): string[] =>
  clause
    .replaceAll(/[{}]/g, ',')
    .split(',')
    .flatMap((part) => {
      const name = part
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)
        .pop()
        ?.trim();
      return name ? [name] : [];
    });

/**
 * The names the module scope of `content` holds: the ones its imports bind and
 * the ones it declares at the start of a line. A generator reads them to keep
 * the names it adds from clashing.
 */
export const getModuleIdentifiers = (content: string): Set<string> =>
  new Set([
    ...[...content.matchAll(IMPORT_CLAUSE)].flatMap(([, clause]) =>
      getBoundNames(clause),
    ),
    ...[...content.matchAll(DECLARATION)].map(([, name]) => name),
  ]);

interface InlineModule {
  // The constants, which are scanned for the imports they need.
  components: string;
  // Written after the components, without a scan for imports.
  appendix?: string;
  output: Pick<NormalizedOutputOptions, 'override'>;
  // The part of the module written before the components.
  precedingContent: string;
  // The `formatType` imports the components may reference.
  pick: (config: NormalizedFormatTypeConfig) => (GeneratorImport | undefined)[];
  // The library's import line, empty when the module has it already.
  libraryImport: (isImported: (name: string) => boolean) => string;
}

/** The components below the imports they need that the module lacks. */
export const withInlineImports = (module: InlineModule): string => {
  const { components, output, pick, appendix } = module;
  const isImported = createImportCheck(module.precedingContent);
  const formatTypeImports = getReferencedFormatTypeImports(
    components,
    output.override,
    pick,
  ).filter(({ name }) => !isImported(name));
  const imports = [
    module.libraryImport(isImported),
    generateImports({ imports: formatTypeImports }),
  ]
    .filter(Boolean)
    .join('\n');
  return `${imports ? `${imports}\n\n` : ''}${components}\n\n${appendix ? `${appendix}\n\n` : ''}`;
};
