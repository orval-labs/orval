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

interface InlineModule {
  components: string;
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
  const { components, output, pick } = module;
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
  return `${imports ? `${imports}\n\n` : ''}${components}\n\n`;
};
