import path from 'node:path';

import {
  type ContextSpec,
  conventionName,
  DefaultTag,
  type GeneratorMutator,
  getImportExtension,
  getRefInfo,
  isComponentRef,
  kebab,
  type NamingConvention,
  type NormalizedOutputOptions,
  type OpenApiParameterObject,
  type OpenApiReferenceObject,
  type OpenApiRequestBodyObject,
  type OpenApiSchemaObject,
  pascal,
  resolveValue,
  type Tsconfig,
  upath,
  type ZodCoerceType,
  type ZodVariantOption,
  type ZodVersionOption,
} from '@orval/core';
import {
  assertZodTarget,
  dereference,
  generateFormDataZodSchema,
  generateZodValidationSchemaDefinition,
  getZodImportSource,
  getZodTypeName,
  parseZodValidationSchemaDefinition,
  resolveIsZodV4,
  type ZodValidationSchemaDefinition,
} from '@orval/zod';
import fs from 'fs-extra';

import {
  generateReusableSchemaSet,
  resolveSchemaName,
  resolveSchemaNames,
  type ReusableSchemaEntry,
  rewriteReusableSchemas,
  rewriteSentinelsToDirect,
} from './reusable-schemas';

interface ZodSchemaFileEntry {
  schemaName: string;
  consts: string;
  zodExpression: string;
  /** Pre-rendered `import { x } from './x'` lines for reusable-schema refs. */
  importStatements?: string[];
}

type ZodSchemaFileToWrite = ZodSchemaFileEntry & {
  filePath: string;
};

const getZodSchemaImportStatement = (variant: ZodVariantOption) =>
  variant === 'mini'
    ? `import * as zod from '${getZodImportSource(variant)}';`
    : `import { z as zod } from '${getZodImportSource(variant)}';`;

interface WriteZodOutputOptions {
  namingConvention: NamingConvention;
  indexFiles: boolean;
  packageJson?: NormalizedOutputOptions['packageJson'];
  tsconfig?: Tsconfig;
  override: {
    useNamedParameters?: boolean;
    zod: {
      variant: ZodVariantOption;
      version: ZodVersionOption;
      strict: {
        body: boolean;
      };
      generate: {
        param: boolean;
        query: boolean;
        header: boolean;
        body: boolean;
        response: boolean;
      };
      coerce: {
        body: boolean | ZodCoerceType[];
      };
      generateReusableSchemas?: boolean;
      generateMeta?: boolean;
    };
  };
}

interface WriteZodSchemasInput {
  spec: ContextSpec['spec'];
  target: string;
  schemas: {
    name: string;
    schema?: OpenApiSchemaObject | OpenApiReferenceObject;
  }[];
}

interface WriteZodVerbResponseType {
  value: string;
  isRef?: boolean;
  originalSchema?: OpenApiSchemaObject;
}

interface WriteZodSchemasFromVerbsEntry {
  operationName: string;
  tags?: string[];
  originalOperation: {
    requestBody?: OpenApiRequestBodyObject | OpenApiReferenceObject;
    parameters?: (OpenApiParameterObject | OpenApiReferenceObject)[];
  };
  response: {
    types: {
      success: WriteZodVerbResponseType[];
      errors: WriteZodVerbResponseType[];
    };
  };
  override?: {
    zod: {
      generate: WriteZodOutputOptions['override']['zod']['generate'];
    };
  };
}

type WriteZodSchemasFromVerbsInput = Record<
  string,
  WriteZodSchemasFromVerbsEntry
>;

interface WriteZodSchemasFromVerbsContext {
  output: {
    override: {
      useDates?: NormalizedOutputOptions['override']['useDates'];
      zod: Pick<
        NormalizedOutputOptions['override']['zod'],
        'dateTimeOptions' | 'timeOptions'
      >;
    };
  };
  spec: ContextSpec['spec'];
  target: string;
  workspace: string;
}

/**
 * Render the `import { ... } from '...'` line for a resolved
 * `GeneratorMutator`. Mirrors the format produced by
 * `generateMutatorImports` in `@orval/core` but inlined to avoid pulling in
 * its full surface area for a single statement.
 */
function buildMutatorImportStatement(mutator: GeneratorMutator): string {
  const importClause = mutator.default ? mutator.name : `{ ${mutator.name} }`;
  return `import ${importClause} from '${mutator.path}';`;
}

const ROOT_DIR = '.';

type SchemaTagMap = Map<string, string>;

type WrittenSchemaInfo = Map<string, string[]>;

function getSchemaDir(
  schemaTagMap: SchemaTagMap | undefined,
  name: string,
): string {
  return schemaTagMap?.get(name) ?? ROOT_DIR;
}

function computeCrossDirImportPath(
  schemasPath: string,
  fromDir: string,
  toDir: string,
  fileName: string,
  importExt: string,
): string {
  if (fromDir === toDir) {
    return `./${fileName}${importExt}`;
  }
  const fromPath =
    fromDir === ROOT_DIR ? schemasPath : path.join(schemasPath, fromDir);
  const toPath =
    toDir === ROOT_DIR ? schemasPath : path.join(schemasPath, toDir);
  const relDir = upath.relativeSafe(fromPath, toPath);
  return `${upath.joinSafe(relDir, fileName)}${importExt}`;
}

function adjustMutatorPathForDir(mutatorPath: string, tagDir: string): string {
  if (tagDir === ROOT_DIR) return mutatorPath;
  if (mutatorPath.startsWith('./')) {
    return `../${mutatorPath.slice(2)}`;
  }
  if (mutatorPath.startsWith('../')) {
    return `../${mutatorPath}`;
  }
  return mutatorPath;
}

/**
 * Whole-word substring check for a resolved mutator alias inside generated
 * code. Plain `String.includes` would false-positive when the user names the
 * mutator something like `min` against `.min(1)`.
 */
function bodyReferencesMutator(
  body: string,
  mutator: GeneratorMutator,
): boolean {
  return new RegExp(String.raw`\b${mutator.name}\b`).test(body);
}

function generateZodSchemaFileContent(
  header: string,
  schemas: ZodSchemaFileEntry[],
  zodVariant: ZodVariantOption,
  // Omit the `import { z as zod }` line when the content is concatenated into a
  // file that already imports zod (e.g. inline single-mode output, where the
  // zod client already emits `import * as zod from 'zod'`).
  includeZodImport = true,
): string {
  // Group the zod import with any reusable-schema imports (deduped across the
  // usually-single entries written to this file), then separate that block
  // from the schema content with a single blank line.
  const refImports = [
    ...new Set(schemas.flatMap((s) => s.importStatements ?? [])),
  ].toSorted();
  const importBlock = [
    ...(includeZodImport ? [getZodSchemaImportStatement(zodVariant)] : []),
    ...refImports,
  ].join('\n');

  const schemaContent = schemas
    .map(({ schemaName, consts, zodExpression }) => {
      const schemaConsts = consts ? `${consts}\n` : '';

      return `${schemaConsts}export const ${schemaName} = ${zodExpression}

export type ${schemaName} = zod.input<typeof ${schemaName}>;
export type ${schemaName}Output = zod.output<typeof ${schemaName}>;`;
    })
    .join('\n\n');

  const separator = importBlock ? `${importBlock}\n\n` : '';
  return `${header}${separator}${schemaContent}\n`;
}

/**
 * Render a single reusable-schema entry's exports (`const` + companion type
 * aliases), shared by the inline single-file and per-file reusable writers.
 *
 * Acyclic schemas keep the original form, deriving the public type from the
 * schema (`zod.input<typeof X>`). Recursive schemas can't: the `const` reads
 * its own binding inside its initializer, so TypeScript can't infer it and a
 * bare `zod.input<typeof X>` would itself be circular. We instead generate the
 * recursive TS type with orval's own model generator (`resolveValue`, the same
 * path that produces `export type X` in the model output, so names line up via
 * `getRefInfo`) and pin the schema to it: `const X: zod.ZodType<X>`. That
 * annotation breaks the self-inference cycle AND preserves full `z.infer`
 * typing through the recursion (instead of collapsing recursive positions to
 * `unknown`).
 */
/**
 * One sibling import the recursive TS type body needs. `name` is the export
 * name in the sibling file (also the basis for the filename); `alias`, when
 * set, is the local binding in this file — emitted as
 * `import { name as alias } from ...`. The aliasing path is triggered by
 * `generateInterface`'s self-name disambiguation (`<X>Bis`); recursive
 * component bodies don't exercise it today but the writer carries `alias`
 * through so any future producer Just Works.
 */
interface ExtraImport {
  name: string;
  alias?: string;
}

interface RenderedReusableSchemaEntry {
  content: string;
  /**
   * Imports this entry needs that are NOT already captured in `entry.usedRefs`.
   * Recursive entries render a TypeScript type body via the model generator;
   * names the type body references (e.g. an `AssetRelationType` used as a
   * `Record<>` key from `propertyNames`) won't appear in `usedRefs` because
   * the zod runtime collapses them (record keys become `zod.string()`). The
   * split-mode writer merges these into its per-file import list so the
   * emitted TS type compiles. Empty for acyclic entries.
   */
  extraImports: ExtraImport[];
}

function renderReusableSchemaEntry(
  entry: ReusableSchemaEntry,
  context: ContextSpec,
  zodVariant: ZodVariantOption,
): RenderedReusableSchemaEntry {
  const consts = entry.consts ? `${entry.consts}\n\n` : '';

  if (entry.isRecursive) {
    // Resolve the lookup key through `getRefInfo` (the same util every other
    // ref consumer uses) rather than slicing the prefix off `entry.ref` by
    // hand: it guards the `#/components/schemas/` prefix via `isComponentRef`
    // and decodes JSON Pointer escapes (`~1`→`/`, `~0`→`~`) before indexing
    // `components.schemas`. `originalName` is the decoded final segment, which
    // matches the raw `components.schemas` key.
    const rawName = isComponentRef(entry.ref)
      ? getRefInfo(entry.ref, context).originalName
      : undefined;
    const schema = rawName
      ? (context.spec.components?.schemas?.[rawName] as
          | OpenApiSchemaObject
          | OpenApiReferenceObject
          | undefined)
      : undefined;
    const resolved = schema
      ? resolveValue({ schema, name: entry.name, context })
      : undefined;
    const typeBody = resolved ? resolved.value : 'unknown';
    // The recursive type body is hand-written from `resolved.value`, which
    // references the implicit sub-models `resolveValue` generates for inline
    // enums and nested objects (e.g. `<Name>Type`, `<Name>Target`,
    // `<Name><NestedProp>`). Those live in `resolved.schemas` and MUST be
    // emitted here or the body references undeclared names (TS2552). The
    // acyclic branch never hits this — it derives its type via
    // `zod.input<typeof X>`, so it never names them.
    // Dedupe by name: `resolveValue` can surface the same sub-model twice
    // (e.g. an allOf/oneOf branch re-resolving a shared inline shape), and two
    // `export type X` for one name is a TS2300 duplicate-identifier error. The
    // model writer dedupes the same way (group-by-name in writers/schemas.ts).
    const seenSubModels = new Set<string>();
    const subModels = (resolved?.schemas ?? []).filter((s) => {
      if (seenSubModels.has(s.name)) return false;
      seenSubModels.add(s.name);
      return true;
    });
    const subModelBlock = subModels.length
      ? `${subModels.map((s) => s.model.trimEnd()).join('\n')}\n\n`
      : '';
    // Sub-models are declared locally above, so they're never imports.
    const localNames = new Set(subModels.map((s) => s.name));
    // Dedupe by local binding name (`alias ?? name`). When `resolveValue`
    // surfaces the same component twice — e.g. once aliased, once not —
    // collapsing on the binding key keeps both the file's import list and the
    // generated TS body internally consistent.
    const seen = new Set<string>();
    const extraImports: ExtraImport[] = [];
    for (const imp of resolved?.imports ?? []) {
      if (!imp.name || imp.name === entry.name || localNames.has(imp.name)) {
        continue;
      }
      const bindingKey = imp.alias ?? imp.name;
      if (seen.has(bindingKey)) continue;
      seen.add(bindingKey);
      extraImports.push({
        name: imp.name,
        ...(imp.alias ? { alias: imp.alias } : {}),
      });
    }

    return {
      content:
        `${consts}${subModelBlock}export type ${entry.name} = ${typeBody};\n\n` +
        `export const ${entry.name}: zod.${getZodTypeName(zodVariant)}<${entry.name}> = ${entry.zod};\n\n` +
        `export type ${entry.name}Output = zod.output<typeof ${entry.name}>;`,
      extraImports,
    };
  }

  return {
    content:
      `${consts}export const ${entry.name} = ${entry.zod};\n\n` +
      `export type ${entry.name} = zod.input<typeof ${entry.name}>;\n` +
      `export type ${entry.name}Output = zod.output<typeof ${entry.name}>;`,
    extraImports: [],
  };
}

const isValidSchemaIdentifier = (name: string) =>
  /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);

/**
 * Build the sibling-file `import { … } from './…'` block for one reusable
 * schema file. Two sources feed in:
 *   - `usedRefs` — names from the zod runtime expression. Sourced from the
 *     sentinel parser, so always unaliased.
 *   - `extraImports` — names the recursive TS body needs that the zod runtime
 *     collapsed (`propertyNames` $refs, etc.). May carry `alias`.
 * Keyed by export name (`name`) so an aliased `extraImports` entry overrides
 * a bare `usedRefs` entry — the recursive TS body uses the local binding, so
 * the aliased form has to win for the file to compile. Self-refs and
 * non-component identifiers are filtered out.
 *
 * Exported for unit-test coverage of the alias-propagation path; no
 * `resolveValue` producer surfaces aliases here today, so the integration
 * tests can't exercise it.
 */
export function buildSiblingImports({
  usedRefs,
  extraImports,
  entryName,
  componentNames,
  namingConvention,
  importExt,
  schemaTagMap,
  currentDir,
  schemasPath,
}: {
  usedRefs: Iterable<string>;
  extraImports: readonly ExtraImport[];
  entryName: string;
  componentNames: ReadonlySet<string>;
  namingConvention: NamingConvention;
  importExt: string;
  schemaTagMap?: SchemaTagMap;
  currentDir?: string;
  schemasPath?: string;
}): string {
  const importsByName = new Map<string, ExtraImport>();
  for (const name of usedRefs) {
    if (name === entryName) continue;
    importsByName.set(name, { name });
  }
  for (const imp of extraImports) {
    if (imp.name === entryName || !componentNames.has(imp.name)) continue;
    importsByName.set(imp.name, imp);
  }
  return [...importsByName.values()]
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .map(({ name, alias }) => {
      const importedFile = conventionName(name, namingConvention);
      const spec = alias ? `${name} as ${alias}` : name;
      const importPath =
        schemaTagMap && currentDir && schemasPath
          ? computeCrossDirImportPath(
              schemasPath,
              currentDir,
              getSchemaDir(schemaTagMap, name),
              importedFile,
              importExt,
            )
          : `./${importedFile}${importExt}`;
      return `import { ${spec} } from '${importPath}';`;
    })
    .join('\n');
}

const isPrimitiveSchemaName = (name: string) =>
  ['string', 'number', 'boolean', 'void', 'unknown', 'Blob'].includes(name);

const dedupeSchemasByName = <T extends { name: string }>(schemas: T[]) => {
  const uniqueSchemas = new Map<string, T>();

  for (const schema of schemas) {
    if (!uniqueSchemas.has(schema.name)) {
      uniqueSchemas.set(schema.name, schema);
    }
  }

  return [...uniqueSchemas.values()];
};

const groupSchemasByFilePath = <T extends { filePath: string }>(
  schemas: T[],
) => {
  const grouped = new Map<string, T[]>();

  for (const schema of schemas) {
    const key = schema.filePath.toLowerCase();
    const existingGroup = grouped.get(key);

    if (existingGroup) {
      existingGroup.push(schema);
    } else {
      grouped.set(key, [schema]);
    }
  }

  const sortedGroups = [...grouped.values()].map((group) =>
    [...group].toSorted((a, b) =>
      a.filePath.localeCompare(b.filePath, 'en', { numeric: true }),
    ),
  );

  return sortedGroups.toSorted((a, b) =>
    a[0].filePath.localeCompare(b[0].filePath, 'en', { numeric: true }),
  );
};

async function writeZodSchemaIndex(
  schemasPath: string,
  fileExtension: string,
  header: string,
  schemaNames: string[],
  namingConvention: NamingConvention,
  shouldMergeExisting = false,
  tsconfig?: Tsconfig,
) {
  const importFileExtension = getImportExtension(fileExtension, tsconfig);
  const indexPath = path.join(schemasPath, `index.ts`);

  let existingExports = '';
  if (shouldMergeExisting && (await fs.pathExists(indexPath))) {
    const existingContent = await fs.readFile(indexPath, 'utf8');
    const headerMatch = /^(\/\*\*[\s\S]*?\*\/\n)?/.exec(existingContent);
    const headerPart = headerMatch ? headerMatch[0] : '';
    existingExports = existingContent.slice(headerPart.length).trim();
  }

  const newExports = schemaNames
    .map((schemaName) => {
      const fileName = conventionName(schemaName, namingConvention);
      return `export * from './${fileName}${importFileExtension}';`;
    })
    .toSorted()
    .join('\n');

  const allExports = existingExports
    ? `${existingExports}\n${newExports}`
    : newExports;

  const uniqueExports = [...new Set(allExports.split('\n'))]
    .filter((line) => line.trim())
    .toSorted()
    .join('\n');

  await fs.outputFile(indexPath, `${header}\n${uniqueExports}\n`);
}

export async function writeZodSchemaTagsSplitBarrel(
  schemasPath: string,
  fileExtension: string,
  header: string,
  componentDirs: WrittenSchemaInfo,
  verbDirs: WrittenSchemaInfo,
  namingConvention: NamingConvention,
  tsconfig?: Tsconfig,
) {
  const importExt = getImportExtension(fileExtension, tsconfig);
  const indexImportExt = getImportExtension('.ts', tsconfig);

  const allDirs = new Map<string, string[]>();
  for (const [dir, names] of componentDirs) {
    allDirs.set(dir, [...names]);
  }
  for (const [dir, names] of verbDirs) {
    if (allDirs.has(dir)) {
      allDirs.get(dir)!.push(...names);
    } else {
      allDirs.set(dir, [...names]);
    }
  }

  for (const [dir, schemaNames] of allDirs) {
    if (dir === ROOT_DIR) continue;
    const dirPath = path.join(schemasPath, dir);
    await writeZodSchemaIndex(
      dirPath,
      fileExtension,
      header,
      schemaNames,
      namingConvention,
      false,
      tsconfig,
    );
  }

  const rootSchemas = allDirs.get(ROOT_DIR) ?? [];
  const rootExports = [...new Set(rootSchemas)]
    .map((name) => {
      const fileName = conventionName(name, namingConvention);
      return `export * from './${fileName}${importExt}';`;
    })
    .toSorted();

  const tagDirs = [...allDirs.keys()]
    .filter((dir) => dir !== ROOT_DIR)
    .toSorted((a, b) => a.localeCompare(b, 'en', { numeric: true }));

  const tagExports = tagDirs.map((dir) => {
    const dirPath = indexImportExt
      ? `./${dir}/index${indexImportExt}`
      : `./${dir}`;
    return `export * from '${dirPath}';`;
  });

  const allExports = [...rootExports, ...tagExports];
  const rootIndexPath = path.join(schemasPath, 'index.ts');
  const content = `${header}\n${allExports.join('\n')}\n`;
  await fs.outputFile(rootIndexPath, content);
}

export function generateZodSchemasInline(
  builder: WriteZodSchemasInput,
  output: WriteZodOutputOptions,
  includeZodImport = true,
  paramsMutator?: GeneratorMutator,
  includeParamsImport = false,
): string {
  const useReusableSchemas =
    output.override.zod.generateReusableSchemas === true;

  if (useReusableSchemas) {
    return generateZodSchemasInlineReusable(
      builder,
      output,
      includeZodImport,
      paramsMutator,
      includeParamsImport,
    );
  }

  const schemasWithOpenApiDef = builder.schemas.filter((s) => s.schema);

  if (schemasWithOpenApiDef.length === 0) {
    return '';
  }

  const isZodV4 = resolveIsZodV4(
    output.override.zod.version,
    output.packageJson,
  );
  assertZodTarget({ variant: output.override.zod.variant, isZodV4 });
  const strict = output.override.zod.strict.body;
  const coerce = output.override.zod.coerce.body;
  const schemas: ZodSchemaFileEntry[] = [];

  for (const { name, schema: schemaObject } of schemasWithOpenApiDef) {
    if (!schemaObject) {
      continue;
    }

    const context: ContextSpec = {
      spec: builder.spec,
      target: builder.target,
      workspace: '',
      output: output as ContextSpec['output'],
    };

    const dereferencedSchema = dereference(schemaObject, context);

    const zodDefinition = generateZodValidationSchemaDefinition(
      dereferencedSchema,
      context,
      name,
      strict,
      isZodV4,
      {
        required: true,
        emitMeta: output.override.zod.generateMeta,
      },
    );

    const parsedZodDefinition = parseZodValidationSchemaDefinition(
      zodDefinition,
      context,
      coerce,
      strict,
      isZodV4,
      undefined,
      undefined,
      output.override.zod.variant,
    );

    schemas.push({
      schemaName: name,
      consts: parsedZodDefinition.consts,
      zodExpression: parsedZodDefinition.zod,
    });
  }

  if (schemas.length === 0) {
    return '';
  }

  return generateZodSchemaFileContent(
    '',
    schemas,
    output.override.zod.variant,
    includeZodImport,
  );
}

function generateZodSchemasInlineReusable(
  builder: WriteZodSchemasInput,
  output: WriteZodOutputOptions,
  includeZodImport = true,
  paramsMutator?: GeneratorMutator,
  includeParamsImport = false,
): string {
  const isZodV4 = resolveIsZodV4(
    output.override.zod.version,
    output.packageJson,
  );
  assertZodTarget({ variant: output.override.zod.variant, isZodV4 });
  const strict = output.override.zod.strict.body;
  const coerce = output.override.zod.coerce.body;
  const context: ContextSpec = {
    spec: builder.spec,
    target: builder.target,
    workspace: '',
    output: output as ContextSpec['output'],
  };

  // Seed from the RAW `components.schemas` keys, NOT `builder.schemas` (whose
  // `name` is the *sanitized* model identifier, e.g. `__schema0` -> `_Schema0`).
  // Building a ref from a sanitized name yields `#/components/schemas/_Schema0`,
  // which doesn't exist in `components.schemas`, so the schema was silently
  // dropped whenever it was reachable only from operations (when referenced by
  // another component schema it survived via transitive expansion, masking the
  // bug). Mirrors `writeZodSchemasReusable`, which already seeds from raw keys.
  const componentSchemas = (builder.spec.components?.schemas ?? {}) as Record<
    string,
    unknown
  >;
  const refs = Object.keys(componentSchemas).map(
    (schemaName) => `#/components/schemas/${schemaName}`,
  );
  if (refs.length === 0) return '';

  resolveSchemaNames(refs, context);

  const entries = generateReusableSchemaSet(refs, context, {
    strict,
    isZodV4,
    coerce,
    variant: output.override.zod.variant,
    generateMeta: output.override.zod.generateMeta,
    paramsMutator,
  });

  const rewritten = rewriteReusableSchemas(entries);

  // Single-file inline mode emits every component schema in one file, so
  // recursive entries' TS-type references resolve in-file with no extra
  // imports — discard `extraImports` here.
  const body = rewritten
    .map(
      (entry) =>
        renderReusableSchemaEntry(entry, context, output.override.zod.variant)
          .content,
    )
    .join('\n\n');

  // Omit the zod import when concatenated into a file that already imports it
  // (inline single-mode output where the zod client emits `import * as zod`).
  const zodImport = includeZodImport
    ? `${getZodSchemaImportStatement(output.override.zod.variant)}\n`
    : '';
  // In split modes (`split` / `tags-split`) the inline schemas are written to
  // a separate `.schemas` file with no other imports, so the params-mutator
  // import has to be emitted here. In `single` / `tags` modes the schemas are
  // concatenated into the operation file, which already imports the same
  // mutator via its per-verb mutators array (see `generateZodRoute`) — we
  // skip emitting it again to avoid a duplicate import line.
  const paramsImport =
    paramsMutator &&
    includeParamsImport &&
    bodyReferencesMutator(body, paramsMutator)
      ? `${buildMutatorImportStatement(paramsMutator)}\n`
      : '';
  const prefix =
    zodImport || paramsImport ? `${zodImport}${paramsImport}\n` : '';
  return `${prefix}${body}\n`;
}

export async function writeZodSchemas(
  builder: WriteZodSchemasInput,
  schemasPath: string,
  fileExtension: string,
  header: string,
  output: WriteZodOutputOptions,
  paramsMutator?: GeneratorMutator,
  schemaTagMap?: SchemaTagMap,
): Promise<WrittenSchemaInfo> {
  const useReusableSchemas = output.override.zod.generateReusableSchemas;

  if (useReusableSchemas) {
    return writeZodSchemasReusable(
      builder,
      schemasPath,
      fileExtension,
      header,
      output,
      paramsMutator,
      schemaTagMap,
    );
  }

  const isSplit = !!schemaTagMap;
  const schemasWithOpenApiDef = builder.schemas.filter((s) => s.schema);
  const schemasToWrite: ZodSchemaFileToWrite[] = [];
  const isZodV4 = resolveIsZodV4(
    output.override.zod.version,
    output.packageJson,
  );
  assertZodTarget({ variant: output.override.zod.variant, isZodV4 });
  const strict = output.override.zod.strict.body;
  const coerce = output.override.zod.coerce.body;

  for (const generatorSchema of schemasWithOpenApiDef) {
    const { name, schema: schemaObject } = generatorSchema;

    if (!schemaObject) {
      continue;
    }

    const fileName = conventionName(name, output.namingConvention);
    const tagDir = getSchemaDir(schemaTagMap, name);
    const filePath = isSplit
      ? path.join(schemasPath, tagDir, `${fileName}${fileExtension}`)
      : path.join(schemasPath, `${fileName}${fileExtension}`);
    const context: ContextSpec = {
      spec: builder.spec,
      target: builder.target,
      workspace: '',
      output: output as ContextSpec['output'],
    };

    // Dereference the schema to resolve $ref
    const dereferencedSchema = dereference(schemaObject, context);

    const zodDefinition = generateZodValidationSchemaDefinition(
      dereferencedSchema,
      context,
      name,
      strict,
      isZodV4,
      {
        required: true,
        emitMeta: output.override.zod.generateMeta,
      },
    );

    const parsedZodDefinition = parseZodValidationSchemaDefinition(
      zodDefinition,
      context,
      coerce,
      strict,
      isZodV4,
      undefined,
      undefined,
      output.override.zod.variant,
    );

    schemasToWrite.push({
      schemaName: name,
      filePath,
      consts: parsedZodDefinition.consts,
      zodExpression: parsedZodDefinition.zod,
    });
  }

  const groupedSchemasToWrite = groupSchemasByFilePath(schemasToWrite);

  for (const schemaGroup of groupedSchemasToWrite) {
    const fileContent = generateZodSchemaFileContent(
      header,
      schemaGroup,
      output.override.zod.variant,
    );

    await fs.outputFile(schemaGroup[0].filePath, fileContent);
  }

  const writtenSchemaNames = groupedSchemasToWrite.map(
    (schemaGroup) => schemaGroup[0].schemaName,
  );

  if (output.indexFiles && !isSplit) {
    await writeZodSchemaIndex(
      schemasPath,
      fileExtension,
      header,
      writtenSchemaNames,
      output.namingConvention,
      false,
      output.tsconfig,
    );
  }

  if (isSplit) {
    const dirSchemas: WrittenSchemaInfo = new Map();
    for (const name of writtenSchemaNames) {
      const dir = getSchemaDir(schemaTagMap, name);
      if (!dirSchemas.has(dir)) dirSchemas.set(dir, []);
      dirSchemas.get(dir)!.push(name);
    }
    return dirSchemas;
  }

  return new Map([[ROOT_DIR, writtenSchemaNames]]);
}

async function writeZodSchemasReusable(
  builder: WriteZodSchemasInput,
  schemasPath: string,
  fileExtension: string,
  header: string,
  output: WriteZodOutputOptions,
  paramsMutator?: GeneratorMutator,
  schemaTagMap?: SchemaTagMap,
): Promise<WrittenSchemaInfo> {
  const isSplit = !!schemaTagMap;
  const isZodV4 = resolveIsZodV4(
    output.override.zod.version,
    output.packageJson,
  );
  assertZodTarget({ variant: output.override.zod.variant, isZodV4 });
  const strict = output.override.zod.strict.body;
  const coerce = output.override.zod.coerce.body;
  const context: ContextSpec = {
    spec: builder.spec,
    target: builder.target,
    workspace: '',
    output: output as ContextSpec['output'],
  };

  // Roots = every component schema, keyed by its RAW OpenAPI name taken
  // straight from `spec.components.schemas`. We must NOT derive these from
  // `builder.schemas`, whose `name` is the sanitized model identifier (e.g.
  // `PaginatedResponse_Asset_` becomes `PaginatedResponseAsset`): operation
  // files reference component schemas by `resolveSchemaName(<raw $ref>)`, so
  // building roots from sanitized names and then filtering them against the
  // raw-keyed `components.schemas` silently dropped every schema whose name
  // needs sanitizing. Those schemas were never emitted, yet the operation
  // files still imported them — producing dangling imports that don't compile.
  const componentSchemas = (builder.spec.components?.schemas ?? {}) as Record<
    string,
    unknown
  >;
  const refs = Object.keys(componentSchemas).map(
    (schemaName) => `#/components/schemas/${schemaName}`,
  );

  // Conflict guard.
  resolveSchemaNames(refs, context);

  const entries = generateReusableSchemaSet(refs, context, {
    strict,
    isZodV4,
    coerce,
    variant: output.override.zod.variant,
    generateMeta: output.override.zod.generateMeta,
    paramsMutator,
  });

  const rewritten = rewriteReusableSchemas(entries);

  // Render bodies first so each entry's `extraImports` (names referenced only
  // by the recursive TS type body, e.g. an `AssetRelationType` used as a
  // `Record<>` key the zod runtime collapses to `zod.string()`) can be merged
  // into the per-file import list before assembling the file content.
  const componentNames = new Set(
    Object.keys(builder.spec.components?.schemas ?? {}).map((schemaName) =>
      resolveSchemaName(`#/components/schemas/${schemaName}`, context),
    ),
  );

  // When `override.zod.params` is set, each component schema may reference
  // the user-provided mutator (e.g. `zodParams`). In non-split mode every
  // reusable schema file lives in the same directory, so the relative path is
  // identical across files. In split mode the import path is computed per
  // entry based on its tag subdirectory.

  for (const entry of rewritten) {
    const fileName = conventionName(entry.name, output.namingConvention);
    const tagDir = getSchemaDir(schemaTagMap, entry.name);
    const filePath = isSplit
      ? path.join(schemasPath, tagDir, `${fileName}${fileExtension}`)
      : path.join(schemasPath, `${fileName}${fileExtension}`);
    const importExt = getImportExtension(fileExtension, output.tsconfig);
    const rendered = renderReusableSchemaEntry(
      entry,
      context,
      output.override.zod.variant,
    );
    const refImports = buildSiblingImports({
      usedRefs: entry.usedRefs,
      extraImports: rendered.extraImports,
      entryName: entry.name,
      componentNames,
      namingConvention: output.namingConvention,
      importExt,
      ...(isSplit ? { schemaTagMap, currentDir: tagDir, schemasPath } : {}),
    });
    // Only emit the params mutator import on files that actually reference it
    // (schemas with no leaf validators — e.g. a pure `$ref` wrapper — won't).
    const needsParamsImport =
      !!paramsMutator && bodyReferencesMutator(entry.zod, paramsMutator);
    const mutatorImportStr = needsParamsImport
      ? buildMutatorImportStatement({
          ...paramsMutator!,
          path: isSplit
            ? adjustMutatorPathForDir(paramsMutator!.path, tagDir)
            : paramsMutator!.path,
        })
      : undefined;
    const imports = [
      ...(mutatorImportStr ? [mutatorImportStr] : []),
      ...(refImports ? [refImports] : []),
    ].join('\n');

    const fileContent =
      `${header}${getZodSchemaImportStatement(output.override.zod.variant)}\n` +
      (imports ? `${imports}\n\n` : '\n') +
      `${rendered.content}\n`;

    await fs.outputFile(filePath, fileContent);
  }

  if (output.indexFiles && !isSplit && rewritten.length > 0) {
    const schemaNames = rewritten.map((e) => e.name);
    await writeZodSchemaIndex(
      schemasPath,
      fileExtension,
      header,
      schemaNames,
      output.namingConvention,
      true,
      output.tsconfig,
    );
  }

  if (isSplit) {
    const dirSchemas: WrittenSchemaInfo = new Map();
    for (const entry of rewritten) {
      const dir = getSchemaDir(schemaTagMap, entry.name);
      if (!dirSchemas.has(dir)) dirSchemas.set(dir, []);
      dirSchemas.get(dir)!.push(entry.name);
    }
    return dirSchemas;
  }

  return new Map([[ROOT_DIR, rewritten.map((e) => e.name)]]);
}

export async function writeZodSchemasFromVerbs(
  verbOptions: WriteZodSchemasFromVerbsInput,
  schemasPath: string,
  fileExtension: string,
  header: string,
  output: WriteZodOutputOptions,
  context: WriteZodSchemasFromVerbsContext,
  schemaTagMap?: SchemaTagMap,
): Promise<WrittenSchemaInfo> {
  const isSplit = !!schemaTagMap;
  const zodContext = context as unknown as ContextSpec;
  const verbOptionsArray = Object.values(verbOptions);

  if (verbOptionsArray.length === 0) {
    return new Map();
  }

  const isZodV4 = resolveIsZodV4(
    output.override.zod.version,
    output.packageJson,
  );
  assertZodTarget({ variant: output.override.zod.variant, isZodV4 });
  const strict = output.override.zod.strict.body;
  const coerce = output.override.zod.coerce.body;
  const useReusableSchemas =
    output.override.zod.generateReusableSchemas === true;
  const useNamedParameters = output.override.useNamedParameters ?? false;

  const generateVerbsSchemas = verbOptionsArray.flatMap((verbOption) => {
    const operation = verbOption.originalOperation;
    const shouldGenerate = {
      ...output.override.zod.generate,
      ...verbOption.override?.zod.generate,
    };

    const requestBody = operation.requestBody;
    const requestBodyContent =
      requestBody && 'content' in requestBody
        ? (requestBody as OpenApiRequestBodyObject).content
        : undefined;
    // Pick the first available body media type. JSON wins; otherwise fall back
    // to form-data / urlencoded so we still generate a `*Body` schema for
    // operations whose only payload is multipart (e.g. file uploads). Without
    // this, endpoints that import `${OperationName}Body` from the zod schemas
    // path resolve to a missing export. (issue #3066)
    const jsonBodyMedia = requestBodyContent?.['application/json'];
    const formDataBodyMedia = requestBodyContent?.['multipart/form-data'];
    const formUrlEncodedBodyMedia =
      requestBodyContent?.['application/x-www-form-urlencoded'];
    const [bodyContentType, bodyMedia] = jsonBodyMedia
      ? (['application/json', jsonBodyMedia] as const)
      : formDataBodyMedia
        ? (['multipart/form-data', formDataBodyMedia] as const)
        : formUrlEncodedBodyMedia
          ? ([
              'application/x-www-form-urlencoded',
              formUrlEncodedBodyMedia,
            ] as const)
          : [undefined, undefined];
    const bodySchema = bodyMedia?.schema as OpenApiSchemaObject | undefined;

    const bodySchemas =
      shouldGenerate.body && bodySchema
        ? [
            {
              name: `${pascal(verbOption.operationName)}Body`,
              schema: useReusableSchemas
                ? bodySchema
                : dereference(bodySchema, zodContext),
              bodyContentType,
              encoding: bodyMedia?.encoding,
            },
          ]
        : [];

    const parameters = operation.parameters;

    const pathParams = parameters?.filter(
      (p): p is OpenApiParameterObject => 'in' in p && p.in === 'path',
    );

    // Only emit a path-parameters schema when the client actually references a
    // named `${Op}PathParameters` type (`useNamedParameters`). Otherwise the
    // client inlines path params and the extra schema would be dead output.
    const pathParamsSchemas =
      useNamedParameters &&
      shouldGenerate.param &&
      pathParams &&
      pathParams.length > 0
        ? [
            {
              name: `${pascal(verbOption.operationName)}PathParameters`,
              schema: {
                type: 'object' as const,
                properties: Object.fromEntries(
                  pathParams
                    .filter((p) => 'schema' in p && p.schema)
                    .map((p) => [
                      p.name,
                      useReusableSchemas
                        ? (p.schema as OpenApiSchemaObject)
                        : dereference(
                            p.schema as OpenApiSchemaObject,
                            zodContext,
                          ),
                    ]),
                ) as Record<string, OpenApiSchemaObject>,
                required: pathParams
                  .filter((p) => p.required)
                  .map((p) => p.name)
                  .filter((name): name is string => name !== undefined),
              },
            },
          ]
        : [];

    const queryParams = parameters?.filter(
      (p): p is OpenApiParameterObject => 'in' in p && p.in === 'query',
    );

    const queryParamsSchemas =
      shouldGenerate.query && queryParams && queryParams.length > 0
        ? [
            {
              name: `${pascal(verbOption.operationName)}Params`,
              schema: {
                type: 'object' as const,
                properties: Object.fromEntries(
                  queryParams
                    .filter((p) => 'schema' in p && p.schema)
                    .map((p) => [
                      p.name,
                      useReusableSchemas
                        ? (p.schema as OpenApiSchemaObject)
                        : dereference(
                            p.schema as OpenApiSchemaObject,
                            zodContext,
                          ),
                    ]),
                ) as Record<string, OpenApiSchemaObject>,
                required: queryParams
                  .filter((p) => p.required)
                  .map((p) => p.name)
                  .filter((name): name is string => name !== undefined),
              },
            },
          ]
        : [];

    const headerParams = parameters?.filter(
      (p): p is OpenApiParameterObject => 'in' in p && p.in === 'header',
    );

    const headerParamsSchemas =
      shouldGenerate.header && headerParams && headerParams.length > 0
        ? [
            {
              name: `${pascal(verbOption.operationName)}Headers`,
              schema: {
                type: 'object' as const,
                properties: Object.fromEntries(
                  headerParams
                    .filter((p) => 'schema' in p && p.schema)
                    .map((p) => [
                      p.name,
                      useReusableSchemas
                        ? (p.schema as OpenApiSchemaObject)
                        : dereference(
                            p.schema as OpenApiSchemaObject,
                            zodContext,
                          ),
                    ]),
                ) as Record<string, OpenApiSchemaObject>,
                required: headerParams
                  .filter((p) => p.required)
                  .map((p) => p.name)
                  .filter((name): name is string => name !== undefined),
              },
            },
          ]
        : [];

    const responseSchemas = shouldGenerate.response
      ? [
          ...verbOption.response.types.success,
          ...verbOption.response.types.errors,
        ]
          .filter(
            (
              responseType,
            ): responseType is typeof responseType & {
              originalSchema: OpenApiSchemaObject;
            } =>
              !!responseType.originalSchema &&
              !responseType.isRef &&
              isValidSchemaIdentifier(responseType.value) &&
              !isPrimitiveSchemaName(responseType.value),
          )
          .map((responseType) => ({
            name: responseType.value,
            schema: useReusableSchemas
              ? responseType.originalSchema
              : dereference(responseType.originalSchema, zodContext),
          }))
      : [];

    return dedupeSchemasByName([
      ...bodySchemas,
      ...pathParamsSchemas,
      ...queryParamsSchemas,
      ...headerParamsSchemas,
      ...responseSchemas,
    ]).map((s) => ({
      ...s,
      verbTagDir: isSplit
        ? kebab(verbOption.tags?.[0] ?? DefaultTag)
        : ROOT_DIR,
    }));
  });

  const uniqueVerbsSchemas = dedupeSchemasByName(generateVerbsSchemas);
  const schemasToWrite: ZodSchemaFileToWrite[] = [];

  for (const entry of uniqueVerbsSchemas) {
    // Pure-ref wrapper skip: if the underlying schema is just `{ $ref: ... }` AND
    // the flag is on, don't emit a per-operation wrapper file. Consumers import
    // the named component schema directly.
    if (
      useReusableSchemas &&
      entry.schema &&
      typeof (entry.schema as { $ref?: unknown }).$ref === 'string' &&
      Object.keys(entry.schema).length === 1
    ) {
      continue;
    }

    const { name, schema } = entry;
    const fileName = conventionName(name, output.namingConvention);
    const tagDir = entry.verbTagDir ?? ROOT_DIR;
    const filePath = isSplit
      ? path.join(schemasPath, tagDir, `${fileName}${fileExtension}`)
      : path.join(schemasPath, `${fileName}${fileExtension}`);

    // multipart/form-data bodies need file-aware overrides so binary fields
    // become `z.instanceof(File)` instead of plain strings.
    const isFormDataBody =
      'bodyContentType' in entry &&
      entry.bodyContentType === 'multipart/form-data';

    const zodDefinition: ZodValidationSchemaDefinition = isFormDataBody
      ? generateFormDataZodSchema(
          schema,
          zodContext,
          name,
          strict,
          isZodV4,
          'encoding' in entry
            ? (entry.encoding as
                | Record<string, { contentType?: string }>
                | undefined)
            : undefined,
          useReusableSchemas,
        )
      : generateZodValidationSchemaDefinition(
          schema,
          zodContext,
          name,
          strict,
          isZodV4,
          {
            required: true,
            useReusableSchemas,
          },
        );

    const parsedZodDefinition = parseZodValidationSchemaDefinition(
      zodDefinition,
      zodContext,
      coerce,
      strict,
      isZodV4,
      undefined,
      undefined,
      output.override.zod.variant,
    );

    // Operation schemas sit at the top of the dependency graph, so any
    // `__REF_<name>__` sentinel resolves to a direct (non-lazy) reference.
    // Rewrite them to bare identifiers and emit the matching imports, the
    // same way `generateZod` does for the operation files (issue #3463).
    let zodExpression = parsedZodDefinition.zod;
    let importStatements: string[] | undefined;
    if (useReusableSchemas && parsedZodDefinition.usedRefs.size > 0) {
      zodExpression = rewriteSentinelsToDirect(zodExpression);
      const importExt = getImportExtension(fileExtension, output.tsconfig);
      importStatements = [...parsedZodDefinition.usedRefs]
        .filter((refName) => refName !== name)
        .toSorted()
        .map((refName) => {
          const importedFile = conventionName(refName, output.namingConvention);
          const importPath = isSplit
            ? computeCrossDirImportPath(
                schemasPath,
                tagDir,
                getSchemaDir(schemaTagMap, refName),
                importedFile,
                importExt,
              )
            : `./${importedFile}${importExt}`;
          return `import { ${refName} } from '${importPath}';`;
        });
    }

    schemasToWrite.push({
      schemaName: name,
      filePath,
      consts: parsedZodDefinition.consts,
      zodExpression,
      importStatements,
    });
  }

  const groupedSchemasToWrite = groupSchemasByFilePath(schemasToWrite);

  for (const schemaGroup of groupedSchemasToWrite) {
    const fileContent = generateZodSchemaFileContent(
      header,
      schemaGroup,
      output.override.zod.variant,
    );

    await fs.outputFile(schemaGroup[0].filePath, fileContent);
  }

  const writtenSchemaNames = groupedSchemasToWrite.map(
    (schemaGroup) => schemaGroup[0].schemaName,
  );

  if (output.indexFiles && !isSplit && uniqueVerbsSchemas.length > 0) {
    await writeZodSchemaIndex(
      schemasPath,
      fileExtension,
      header,
      writtenSchemaNames,
      output.namingConvention,
      true,
      output.tsconfig,
    );
  }

  if (isSplit) {
    const dirSchemas: WrittenSchemaInfo = new Map();
    for (const entry of uniqueVerbsSchemas) {
      // Skip pure-$ref wrappers that were not written as files. The writing
      // loop above applies the same condition via `continue`; without it
      // here, the tag barrel would re-export non-existent files.
      if (
        useReusableSchemas &&
        entry.schema &&
        typeof (entry.schema as { $ref?: unknown }).$ref === 'string' &&
        Object.keys(entry.schema).length === 1
      ) {
        continue;
      }
      const dir = entry.verbTagDir ?? ROOT_DIR;
      if (!dirSchemas.has(dir)) dirSchemas.set(dir, []);
      dirSchemas.get(dir)!.push(entry.name);
    }
    return dirSchemas;
  }

  return new Map([[ROOT_DIR, writtenSchemaNames]]);
}
