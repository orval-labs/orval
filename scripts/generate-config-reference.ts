import ts from 'typescript';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const TYPES_FILE = resolve(REPO_ROOT, 'packages/core/src/types.ts');
const OUT_DIR = resolve(REPO_ROOT, 'docs/src/generated/config-reference');

const OPENAPI_SPEC_BASE =
  'https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.1.1.md';
const OPENAPI_ANCHORS: Record<string, string> = {
  Document: 'openapi-object',
  InfoObject: 'info-object',
  ContactObject: 'contact-object',
  LicenseObject: 'license-object',
  ServerObject: 'server-object',
  ServerVariableObject: 'server-variable-object',
  SchemaObject: 'schema-object',
  OperationObject: 'operation-object',
  ParameterObject: 'parameter-object',
  RequestBodyObject: 'request-body-object',
  ResponseObject: 'response-object',
  MediaTypeObject: 'media-type-object',
  EncodingObject: 'encoding-object',
  ExampleObject: 'example-object',
  ComponentsObject: 'components-object',
  PathsObject: 'paths-object',
  PathItemObject: 'path-item-object',
  ResponsesObject: 'responses-object',
  ReferenceObject: 'reference-object',
};

// Public `defineConfig` surface, keyed by the user-facing config path.
// Each entry maps a public path to the interface that describes it. The
// registry exposes both `${path}` (section table) and `${path}.${field}`
// (field detail).
interface ManifestEntry {
  path: string;
  interface: string;
}
const MANIFEST: ManifestEntry[] = [
  { path: 'options', interface: 'Options' },
  { path: 'input', interface: 'InputOptions' },
  { path: 'input.override', interface: 'OverrideInput' },
  { path: 'output', interface: 'OutputOptions' },
  { path: 'output.override', interface: 'OverrideOutput' },
  { path: 'output.override.operations', interface: 'OperationOptions' },
  { path: 'output.override.jsDoc', interface: 'JsDocOptions' },
  { path: 'output.override.mock', interface: 'OverrideMockOptions' },
  { path: 'output.override.query', interface: 'QueryOptions' },
  { path: 'output.override.swr', interface: 'SwrOptions' },
  { path: 'output.override.angular', interface: 'AngularOptions' },
  { path: 'output.override.zod', interface: 'ZodOptions' },
  { path: 'output.override.effect', interface: 'EffectOptions' },
  { path: 'output.override.hono', interface: 'HonoOptions' },
  { path: 'output.override.mcp', interface: 'McpOptions' },
  { path: 'output.override.fetch', interface: 'FetchOptions' },
  // `hooks` is intentionally not generated: HooksOptions is a mapped type
  // (Partial<Record<Hook, T>>) whose property JSDoc does not propagate, and the
  // single `afterAllFilesWrite` field is already covered by the curated page.
];

function createProgram(): ts.Program {
  return ts.createProgram({
    rootNames: [TYPES_FILE],
    options: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      strict: true,
      skipLibCheck: true,
      esModuleInterop: true,
      isolatedModules: true,
      noEmit: true,
      types: ['node'],
    },
  });
}

function findInterface(
  sf: ts.SourceFile,
  name: string,
): ts.InterfaceDeclaration | undefined {
  let found: ts.InterfaceDeclaration | undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === name) {
      found = node;
      return;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
  return found;
}

function findTypeAlias(
  sf: ts.SourceFile,
  name: string,
): ts.TypeAliasDeclaration | undefined {
  let found: ts.TypeAliasDeclaration | undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isTypeAliasDeclaration(node) && node.name.text === name) {
      found = node;
      return;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
  return found;
}

function docComment(
  checker: ts.TypeChecker,
  symbol: ts.Symbol | undefined,
): string | undefined {
  if (!symbol) return undefined;
  const text = ts.displayPartsToString(symbol.getDocumentationComment(checker));
  return text.trim() || undefined;
}

function jsDocTags(symbol: ts.Symbol | undefined) {
  const out: { default?: string; example?: string; see?: string[] } = {};
  if (!symbol) return out;
  for (const tag of symbol.getJsDocTags()) {
    const value = ts.displayPartsToString(tag.text).trim();
    if (tag.name === 'default') out.default = value || undefined;
    else if (tag.name === 'example') out.example = value || undefined;
    else if (tag.name === 'see' && value) (out.see ??= []).push(value);
  }
  return out;
}

function specUrlFor(typeName: string): string | undefined {
  const openApiName = typeName.startsWith('OpenApi')
    ? typeName.slice('OpenApi'.length)
    : typeName;
  const anchor = OPENAPI_ANCHORS[openApiName];
  return anchor ? `${OPENAPI_SPEC_BASE}#${anchor}` : undefined;
}

function propertyOptional(symbol: ts.Symbol): boolean {
  return (
    symbol.declarations?.some(
      (d) => ts.isPropertySignature(d) && d.questionToken != null,
    ) ?? false
  );
}

function cleanType(s: string): string {
  return s.replace(/\s*\|\s*undefined$/, '');
}

// Only approved public OpenAPI aliases are expanded. Internal types
// (GeneratorVerbOptions, etc.) stay as type references — they are not public
// API merely because a callback references them.
function resolveShape(
  checker: ts.TypeChecker,
  typeName: string,
  type: ts.Type,
):
  | { typeName: string; source: string; specUrl?: string; fields: object[] }
  | undefined {
  if (!typeName.startsWith('OpenApi')) return undefined;
  const props = type.getProperties();
  if (!props.length) return undefined;
  const fields = props.map((p) => {
    const t = checker.getTypeOfSymbol(p);
    return {
      name: p.getName(),
      type: cleanType(checker.typeToString(t)),
      optional: propertyOptional(p),
      description: docComment(checker, p),
    };
  });
  return {
    typeName,
    source: '@scalar/openapi-types',
    specUrl: specUrlFor(typeName),
    fields,
  };
}

function extractCallback(
  checker: ts.TypeChecker,
  type: ts.Type,
): { params: object[]; returnType: string } | undefined {
  const signatures = (() => {
    const direct = type.getCallSignatures();
    if (direct.length) return direct;
    if (type.isUnion()) {
      for (const t of type.types) {
        const sigs = t.getCallSignatures();
        if (sigs.length) return sigs;
      }
    }
    return ts.emptyArray;
  })();
  if (!signatures.length) return undefined;
  const sig = signatures[0];
  const params = sig.getParameters().map((param) => {
    const paramType = checker.getTypeOfSymbol(param);
    const declaredNode = param.valueDeclaration as
      | ts.ParameterDeclaration
      | undefined;
    const declaredText =
      declaredNode?.type?.getText() ?? checker.typeToString(paramType);
    const resolved = resolveShape(checker, declaredText, paramType);
    return { name: param.getName(), type: declaredText, resolved };
  });
  return { params, returnType: checker.typeToString(sig.getReturnType()) };
}

function extractInterface(
  checker: ts.TypeChecker,
  iface: ts.InterfaceDeclaration,
): object[] {
  const fields: object[] = [];
  for (const member of iface.members) {
    if (!ts.isPropertySignature(member) || !member.name) continue;
    const name = member.name.getText();
    const symbol = checker.getSymbolAtLocation(member.name);
    const optional = member.questionToken != null;
    const type = member.type
      ? checker.getTypeFromTypeNode(member.type)
      : (checker.getAnyType?.() ?? ({} as ts.Type));
    const typeString = member.type?.getText() ?? checker.typeToString(type);
    const tags = jsDocTags(symbol);
    const callback = extractCallback(checker, type);
    fields.push({
      name,
      type: typeString,
      optional,
      description: docComment(checker, symbol),
      default: tags.default,
      example: tags.example,
      see: tags.see,
      ...(callback ? { callback } : {}),
    });
  }
  return fields;
}

// Type aliases (e.g. `OverrideMockOptions = Partial<X> & { ... }`,
// `HooksOptions = Partial<Record<Hook, T>>`) are resolved by the checker so
// that mapped/intersection types expand into their concrete members.
function extractTypeAlias(
  checker: ts.TypeChecker,
  alias: ts.TypeAliasDeclaration,
): object[] {
  const type = checker.getTypeAtLocation(alias);
  return type.getProperties().map((symbol) => {
    const t = checker.getTypeOfSymbol(symbol);
    const tags = jsDocTags(symbol);
    const callback = extractCallback(checker, t);
    return {
      name: symbol.getName(),
      type: cleanType(checker.typeToString(t)),
      optional: propertyOptional(symbol),
      description: docComment(checker, symbol),
      default: tags.default,
      example: tags.example,
      see: tags.see,
      ...(callback ? { callback } : {}),
    };
  });
}

function toIdentifier(path: string): string {
  return path
    .split('.')
    .map((part, i) => (i === 0 ? part : part[0].toUpperCase() + part.slice(1)))
    .join('');
}

function toFileName(path: string): string {
  return `${path.replace(/\./g, '-')}.ts`;
}

function generatedHeader(): string[] {
  return [
    '// AUTO-GENERATED by `bun run gen:config-reference`. Do not edit by hand.',
    '// Source: packages/core/src/types.ts',
    '// Regenerate with: bun run gen:config-reference',
  ];
}

function coverageFor(fields: object[]): { total: number; documented: number } {
  const total = fields.length;
  const documented = fields.filter(
    (f) => (f as { description?: string }).description,
  ).length;
  return { total, documented };
}

async function emitSection(
  checker: ts.TypeChecker,
  sf: ts.SourceFile,
  entry: ManifestEntry,
): Promise<{
  entry: ManifestEntry;
  cov: { total: number; documented: number };
}> {
  const iface = findInterface(sf, entry.interface);
  const alias = iface ? undefined : findTypeAlias(sf, entry.interface);
  if (!iface && !alias) {
    throw new Error(
      `Interface or type ${entry.interface} not found in types.ts`,
    );
  }
  const fields = iface
    ? extractInterface(checker, iface)
    : extractTypeAlias(checker, alias!);
  const cov = coverageFor(fields);
  const section = {
    section: entry.path,
    interfaceName: entry.interface,
    fields,
  };
  const identifier = toIdentifier(entry.path);
  const body = JSON.stringify(section, null, 2);
  const outPath = resolve(OUT_DIR, toFileName(entry.path));
  const content = [
    ...generatedHeader(),
    '',
    "import type { ConfigSection } from './types';",
    '',
    `export const ${identifier} = ${body} satisfies ConfigSection;`,
    '',
  ].join('\n');
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, content, 'utf8');
  console.log(
    `  ${entry.path} (${entry.interface}): ${cov.documented}/${cov.total} documented -> ${outPath.slice(REPO_ROOT.length + 1)}`,
  );
  return { entry, cov };
}

async function emitIndex(emitted: { entry: ManifestEntry }[]): Promise<void> {
  const imports = emitted
    .map(
      ({ entry }) =>
        `import { ${toIdentifier(entry.path)} } from './${entry.path.replace(/\./g, '-')}';`,
    )
    .join('\n');
  const entries = emitted
    .map(
      ({ entry }) =>
        `{ path: '${entry.path}', data: ${toIdentifier(entry.path)} }`,
    )
    .join(',\n  ');
  const content = [
    ...generatedHeader(),
    '',
    "import type { ConfigField, ConfigSection, RegistryEntry } from './types';",
    '',
    imports,
    '',
    'const raw: Array<{ path: string; data: ConfigSection }> = [',
    `  ${entries},`,
    '];',
    '',
    'export const registry: Record<string, RegistryEntry> = {};',
    'for (const { path, data } of raw) {',
    '  registry[path] = { kind: "section", ...data };',
    '  for (const field of data.fields) {',
    '    registry[`${path}.${field.name}`] = { kind: "field", ...field };',
    '  }',
    '}',
    '',
    'export function getEntry(path: string): RegistryEntry | undefined {',
    '  return registry[path];',
    '}',
    '',
    'export type { ConfigField, ConfigSection, RegistryEntry } from "./types";',
    '',
  ].join('\n');
  const outPath = resolve(OUT_DIR, 'index.ts');
  await writeFile(outPath, content, 'utf8');
}

async function main(): Promise<void> {
  const enforceCoverage = process.argv.includes('--check');
  const program = createProgram();
  const checker = program.getTypeChecker();
  const sf = program.getSourceFile(TYPES_FILE);
  if (!sf) throw new Error(`Could not load source: ${TYPES_FILE}`);
  console.log('Generating config reference...');
  const emitted: {
    entry: ManifestEntry;
    cov: { total: number; documented: number };
  }[] = [];
  for (const entry of MANIFEST) {
    emitted.push(await emitSection(checker, sf, entry));
  }
  await emitIndex(emitted);
  const totals = emitted.reduce(
    (acc, e) => {
      acc.total += e.cov.total;
      acc.documented += e.cov.documented;
      return acc;
    },
    { total: 0, documented: 0 },
  );
  console.log(
    `Done. ${totals.documented}/${totals.total} public fields documented.`,
  );
  if (enforceCoverage && totals.documented !== totals.total) {
    const missing = emitted
      .filter((e) => e.cov.documented !== e.cov.total)
      .map((e) => `${e.entry.path} (${e.cov.documented}/${e.cov.total})`)
      .join(', ');
    console.error(`\nCoverage check failed — undocumented fields: ${missing}`);
    console.error('Add JSDoc to the listed public config fields.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
