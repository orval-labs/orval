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

interface ManifestEntry {
  section: string;
  interfaceName: string;
  description?: string;
}

const MANIFEST: ManifestEntry[] = [
  { section: 'override', interfaceName: 'OverrideOutput' },
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

function sourceOf(type: ts.Type): string {
  const decls = [
    ...(type.aliasSymbol?.declarations ?? []),
    ...(type.symbol?.declarations ?? []),
  ];
  const file = decls[0]?.getSourceFile().fileName ?? '';
  if (file.includes('@scalar/openapi-types')) return '@scalar/openapi-types';
  return 'local';
}

function specUrlFor(typeName: string): string | undefined {
  const openApiName = typeName.startsWith('OpenApi')
    ? typeName.slice('OpenApi'.length)
    : typeName;
  const anchor = OPENAPI_ANCHORS[openApiName];
  return anchor ? `${OPENAPI_SPEC_BASE}#${anchor}` : undefined;
}

function propertyOptional(symbol: ts.Symbol): boolean {
  return symbol.declarations.some(
    (d) => ts.isPropertySignature(d) && d.questionToken != null,
  );
}

function cleanType(s: string): string {
  return s.replace(/\s*\|\s*undefined$/, '');
}

function resolveShape(
  checker: ts.TypeChecker,
  typeName: string,
  type: ts.Type,
):
  | { typeName: string; source: string; specUrl?: string; fields: any[] }
  | undefined {
  const isNamedRef = /^[A-Z][A-Za-z0-9_]*$/.test(typeName);
  const isPrimitiveLike =
    (type.flags &
      (ts.TypeFlags.String |
        ts.TypeFlags.Number |
        ts.TypeFlags.Boolean |
        ts.TypeFlags.Literal |
        ts.TypeFlags.Union |
        ts.TypeFlags.Enum |
        ts.TypeFlags.EnumLiteral)) !==
    0;
  if (!isNamedRef || isPrimitiveLike) return undefined;
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
  const specUrl = specUrlFor(typeName);
  return {
    typeName,
    source: specUrl ? '@scalar/openapi-types' : sourceOf(type),
    specUrl,
    fields,
  };
}

function extractCallback(
  checker: ts.TypeChecker,
  type: ts.Type,
): { params: any[]; returnType: string } | undefined {
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
): any[] {
  const fields: any[] = [];
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

function header(lines: string[]): string {
  return [
    '// AUTO-GENERATED by `bun run gen:config-reference`. Do not edit by hand.',
    '// Source: packages/core/src/types.ts',
    '// Regenerate with: bun run gen:config-reference',
    '',
    ...lines,
  ].join('\n');
}

async function emit(
  checker: ts.TypeChecker,
  sf: ts.SourceFile,
  entry: ManifestEntry,
): Promise<void> {
  const iface = findInterface(sf, entry.interfaceName);
  if (!iface) {
    throw new Error(`Interface ${entry.interfaceName} not found in types.ts`);
  }
  const fields = extractInterface(checker, iface);
  const section = {
    section: entry.section,
    interfaceName: entry.interfaceName,
    description: entry.description,
    fields,
  };
  const body = JSON.stringify(section, null, 2);
  const outPath = resolve(OUT_DIR, `${entry.section}.ts`);
  const content = header([
    "import type { ConfigSection } from './types';",
    '',
    `export const ${entry.section} = ${body} satisfies ConfigSection;`,
    '',
  ]);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, content, 'utf8');
  const documented = fields.filter((f) => f.description).length;
  console.log(
    `  ${entry.section} (${entry.interfaceName}): ${fields.length} fields, ${documented} documented -> ${outPath.slice(REPO_ROOT.length + 1)}`,
  );
}

async function main(): Promise<void> {
  const program = createProgram();
  const checker = program.getTypeChecker();
  const sf = program.getSourceFile(TYPES_FILE);
  if (!sf) throw new Error(`Could not load source: ${TYPES_FILE}`);
  console.log('Generating config reference...');
  for (const entry of MANIFEST) {
    await emit(checker, sf, entry);
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
