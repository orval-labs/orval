import type * as TS from 'typescript';

/**
 * AST-based reconciliation of an existing hono handler file.
 *
 * The `smart` handler strategy regenerates only the regions orval owns — its own
 * imports (names + module specifier) and the `zValidator(...)` arguments of each
 * handler — while leaving every user-authored construct untouched: custom imports,
 * middleware passed to `factory.createHandlers(...)`, the `async (c) => { ... }`
 * body, and any top-level helpers, constants, types, or comments.
 *
 * We edit the original source text in place using node offsets from the
 * TypeScript compiler API, so formatting and comments of untouched regions are
 * preserved. On any parse failure we return the source unchanged — user code is
 * never destroyed by a parser hiccup.
 */

/**
 * `typescript` is an optional peer dependency, imported lazily. Consumers who do
 * not have it installed — and every non-hono or `skip` code path — never trigger
 * the import; `smart`/`full` fall back to `skip` when it is unavailable. Loading
 * the consumer's own typescript also avoids shipping a second copy of it.
 */
let ts!: typeof TS;
let typeScriptAvailable: boolean | undefined;

export const ensureTypeScript = async (): Promise<boolean> => {
  if (typeScriptAvailable === undefined) {
    try {
      const mod = await import('typescript');
      ts = (mod as unknown as { default?: typeof TS }).default ?? mod;
      typeScriptAvailable = true;
    } catch {
      typeScriptAvailable = false;
    }
  }
  return typeScriptAvailable;
};

export type ValidatorTarget =
  | 'header'
  | 'param'
  | 'query'
  | 'json'
  | 'form'
  | 'response';

export interface DesiredValidator {
  target: ValidatorTarget;
  /** PascalCase zod schema identifier, e.g. `VerifyAccountResponse`. */
  schema: string;
}

export interface DesiredHandler {
  /** e.g. `verifyAccountHandlers`. */
  handlerName: string;
  /** Validators required by the spec, in canonical order. */
  validators: DesiredValidator[];
  /** Full handler block, used only when the handler is missing and appended. */
  stub: string;
}

export interface OrvalImport {
  names: string[];
  /** Module specifier as orval would emit it (relative, extensionless). */
  module: string;
}

export interface DesiredImports {
  /** `createFactory` from `hono/factory`. */
  factory: OrvalImport;
  /** `zValidator` from the validator module; omitted when no validators exist. */
  validator?: OrvalImport;
  /** `<Op>Context` identifiers from the context module. */
  context: OrvalImport;
  /** zod schema identifiers from the zod module; omitted when none are needed. */
  zod?: OrvalImport;
}

const VALIDATOR_TARGETS = new Set<string>([
  'header',
  'param',
  'query',
  'json',
  'form',
  'response',
]);

interface Edit {
  start: number;
  end: number;
  text: string;
}

const parse = (source: string): TS.SourceFile | undefined => {
  const sourceFile = ts.createSourceFile(
    'handler.ts',
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );
  const diagnostics = (
    sourceFile as unknown as { parseDiagnostics?: TS.Diagnostic[] }
  ).parseDiagnostics;
  if (diagnostics && diagnostics.length > 0) return undefined;
  return sourceFile;
};

interface ParsedHandler {
  name: string;
  call: TS.CallExpression;
}

const findHandlers = (sourceFile: TS.SourceFile): ParsedHandler[] => {
  const handlers: ParsedHandler[] = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) continue;
      const name = declaration.name.text;
      if (!name.endsWith('Handlers')) continue;
      const init = declaration.initializer;
      if (
        init &&
        ts.isCallExpression(init) &&
        ts.isPropertyAccessExpression(init.expression) &&
        init.expression.name.text === 'createHandlers'
      ) {
        handlers.push({ name, call: init });
      }
    }
  }
  return handlers;
};

const importedNames = (declaration: TS.ImportDeclaration): string[] => {
  const bindings = declaration.importClause?.namedBindings;
  if (!bindings || !ts.isNamedImports(bindings)) return [];
  return bindings.elements.map((element) => element.name.text);
};

const moduleText = (declaration: TS.ImportDeclaration): string =>
  ts.isStringLiteral(declaration.moduleSpecifier)
    ? declaration.moduleSpecifier.text
    : '';

/**
 * A "plain" named import — no default binding, no namespace (`* as x`), and no
 * aliases (`x as y`). Only plain named imports are safe for orval to rewrite;
 * default / namespace / aliased / mixed imports are user-authored and must be
 * left untouched.
 */
const isPlainNamedImport = (declaration: TS.ImportDeclaration): boolean => {
  const clause = declaration.importClause;
  if (!clause || clause.name) return false;
  const bindings = clause.namedBindings;
  if (!bindings || !ts.isNamedImports(bindings)) return false;
  return bindings.elements.every(
    (element) => element.propertyName === undefined,
  );
};

const setEquals = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((value) => b.includes(value));

/**
 * The local binding name an imported symbol is bound to, honouring aliases —
 * e.g. `import { zValidator as zv }` → `'zv'`. Returns undefined when the symbol
 * is not imported. Used so a handler that aliases `zValidator` is detected and
 * its new validators are inserted under the same alias (never an unimported name).
 */
const localNameFor = (
  importDeclarations: TS.ImportDeclaration[],
  importedName: string,
  module: string,
): string | undefined => {
  for (const declaration of importDeclarations) {
    if (moduleText(declaration) !== module) continue;
    const bindings = declaration.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      if ((element.propertyName?.text ?? element.name.text) === importedName) {
        return element.name.text;
      }
    }
  }
  return undefined;
};

const renderImport = ({ names, module }: OrvalImport): string =>
  names.length <= 1
    ? `import { ${names.join('')} } from '${module}';`
    : `import {\n  ${names.join(',\n  ')}\n} from '${module}';`;

const lineStart = (source: string, position: number): number =>
  source.lastIndexOf('\n', position - 1) + 1;

/** Whether only whitespace sits between the line start and `position`. */
const startsLine = (source: string, position: number): boolean =>
  /^\s*$/.test(source.slice(lineStart(source, position), position));

export const reconcileHandlerFile = async (
  source: string,
  desired: { imports: DesiredImports; handlers: DesiredHandler[] },
): Promise<string> => {
  if (!(await ensureTypeScript())) return source;

  const sourceFile = parse(source);
  if (!sourceFile) return source;

  const edits: Edit[] = [];
  const importDeclarations = sourceFile.statements.filter(
    (statement): statement is TS.ImportDeclaration =>
      ts.isImportDeclaration(statement),
  );
  const handlers = findHandlers(sourceFile);
  const existingNames = new Set(handlers.map((handler) => handler.name));
  const pendingInsertions: string[] = [];

  // Locate an orval-owned import by its module specifier (authoritative).
  const byModule = (module: string): TS.ImportDeclaration | undefined =>
    module
      ? importDeclarations.find(
          (declaration) => moduleText(declaration) === module,
        )
      : undefined;

  // Fallback used only when the module specifier has moved: a PLAIN named import
  // whose names are EXACTLY `signature` (case-sensitive). This relocates an
  // orval import without the case-folding hazard of fuzzy name matching, which
  // could otherwise clobber an unrelated user import (e.g. `listPetsResponse`).
  const plainExact = (signature: string[]): TS.ImportDeclaration | undefined =>
    signature.length === 0
      ? undefined
      : importDeclarations.find(
          (declaration) =>
            isPlainNamedImport(declaration) &&
            setEquals(importedNames(declaration), signature),
        );

  const removeImportEdit = (declaration: TS.ImportDeclaration) => {
    let end = declaration.getEnd();
    if (source.slice(end, end + 2) === '\r\n') end += 2;
    else if (source[end] === '\n') end += 1;
    edits.push({ start: declaration.getStart(sourceFile), end, text: '' });
  };

  // Whether `name` is already bound as a bare identifier by some import (a named
  // import's local name, or a default import). Namespace imports do NOT bind
  // their members bare. Used to avoid duplicate imports when augmenting.
  const isImportedBare = (name: string): boolean =>
    importDeclarations.some((declaration) => {
      const clause = declaration.importClause;
      if (!clause) return false;
      if (clause.name?.text === name) return true;
      return importedNames(declaration).includes(name);
    });

  /**
   * Reconcile an orval-owned import to `names`. We only rewrite/remove a PLAIN
   * named import whose names are ALL orval-owned (per `isOrvalName`). A
   * user-authored import (aliased / namespace / default / mixed) is never
   * rewritten; instead, when `augment` is provided, we add any orval name that
   * is genuinely needed as a bare reference but isn't yet importable bare — e.g.
   * a newly appended handler's context, or a newly-inserted validator's schema.
   */
  const reconcileImport = (
    existing: TS.ImportDeclaration | undefined,
    names: string[],
    module: string,
    isOrvalName: (name: string) => boolean,
    augment?: (name: string) => boolean,
    collectRenames?: Map<string, string>,
  ) => {
    if (!existing) {
      const toInsert = augment ? names.filter((name) => augment(name)) : names;
      if (toInsert.length > 0) {
        pendingInsertions.push(renderImport({ names: toInsert, module }));
      }
      return;
    }

    const isOurs =
      isPlainNamedImport(existing) &&
      importedNames(existing).every((name) => isOrvalName(name));
    if (!isOurs) {
      if (augment) {
        const missing = names.filter(
          (name) => augment(name) && !isImportedBare(name),
        );
        if (missing.length > 0) {
          pendingInsertions.push(renderImport({ names: missing, module }));
        }
      }
      return;
    }

    if (names.length === 0) {
      removeImportEdit(existing);
      return;
    }

    if (
      setEquals(importedNames(existing), names) &&
      moduleText(existing) === module
    ) {
      return;
    }

    // Record the camelCase→PascalCase migrations this rewrite implies, so every
    // OTHER reference to the old binding (validator args, `z.infer<typeof X>` in
    // bodies, etc.) can be renamed too — not just the import itself.
    if (collectRenames) {
      for (const old of importedNames(existing)) {
        const next = names.find(
          (name) => name !== old && name.toLowerCase() === old.toLowerCase(),
        );
        if (next) collectRenames.set(old, next);
      }
    }

    edits.push({
      start: existing.getStart(sourceFile),
      end: existing.getEnd(),
      text: renderImport({ names, module }),
    });
  };

  // --- validators first, so schema names referenced by reconciled validators
  // (newly inserted, or renamed camelCase → PascalCase) are known to the import
  // step below. The local name `zValidator` is bound to in the DESIRED validator
  // module (honours `import { zValidator as zv } from '<validatorModule>'`); a
  // zValidator imported from a different module is the user's own and ignored,
  // so new validators always route through orval's validator. ---
  const validatorModule = desired.imports.validator?.module ?? '';
  const zValidatorName = validatorModule
    ? (localNameFor(importDeclarations, 'zValidator', validatorModule) ??
      'zValidator')
    : 'zValidator';

  const requiredSchemas = new Set<string>();
  const removedValidatorRanges: [number, number][] = [];
  for (const desiredHandler of desired.handlers) {
    const parsed = handlers.find(
      (handler) => handler.name === desiredHandler.handlerName,
    );
    if (parsed) {
      reconcileValidators(
        sourceFile,
        source,
        parsed.call,
        desiredHandler.validators,
        edits,
        zValidatorName,
        requiredSchemas,
        removedValidatorRanges,
      );
    }
  }

  // Schema migrations (old camelCase → new PascalCase) implied by rewriting the
  // zod import; applied file-wide below so every reference is migrated.
  const schemaRenames = new Map<string, string>();

  const toAppend = desired.handlers.filter(
    (handler) => !existingNames.has(handler.handlerName),
  );

  // --- imports ---
  // Source with import declarations blanked out, so an import's own text (e.g.
  // `import { ListPetsResponse as Resp }`) is never counted as a usage.
  let bodySource = source;
  for (const declaration of importDeclarations) {
    const start = declaration.getStart(sourceFile);
    const end = declaration.getEnd();
    bodySource =
      bodySource.slice(0, start) +
      ' '.repeat(end - start) +
      bodySource.slice(end);
  }

  // A name needs a bare import when it is referenced unqualified in the body
  // (not as `Ns.Name`), is a schema a reconciled validator now references
  // (inserted or renamed), or is used by an appended handler stub.
  const referencedBare = (name: string): boolean =>
    new RegExp(String.raw`(?<!\.)\b${name}\b`).test(bodySource);
  const inAppendedStub = (name: string): boolean =>
    toAppend.some((handler) => handler.stub.includes(name));
  const needsBareContext = (name: string): boolean =>
    referencedBare(name) || inAppendedStub(name);
  const needsBareZod = (name: string): boolean =>
    referencedBare(name) || requiredSchemas.has(name) || inAppendedStub(name);

  // Context types are orval-owned only where a handler references one bare (a
  // typed `async (c: XContext)`) or an appended stub uses it. Match by EXACT
  // orval name — never `endsWith('Context')`, which would clobber a user import
  // such as `getCommunityFilterContext`.
  const contextNames = desired.imports.context.names.filter((name) =>
    needsBareContext(name),
  );
  const zodLower = new Set(
    (desired.imports.zod?.names ?? []).map((name) => name.toLowerCase()),
  );

  const factoryModule = desired.imports.factory.module;
  reconcileImport(
    byModule(factoryModule) ?? plainExact(['createFactory']),
    desired.imports.factory.names,
    factoryModule,
    (name) => name === 'createFactory',
  );

  reconcileImport(
    byModule(validatorModule) ?? plainExact(['zValidator']),
    desired.imports.validator ? ['zValidator'] : [],
    validatorModule,
    (name) => name === 'zValidator',
  );

  reconcileImport(
    byModule(desired.imports.context.module) ?? plainExact(contextNames),
    contextNames,
    desired.imports.context.module,
    (name) => desired.imports.context.names.includes(name),
    needsBareContext,
  );

  const zodModule = desired.imports.zod?.module ?? '';
  const zodNames = desired.imports.zod?.names ?? [];
  reconcileImport(
    byModule(zodModule) ?? plainExact(zodNames),
    zodNames,
    zodModule,
    (name) => zodLower.has(name.toLowerCase()),
    needsBareZod,
    schemaRenames,
  );

  // Apply the schema migrations file-wide: rename every remaining reference to a
  // migrated schema (validator args, `z.infer<typeof X>` in bodies, helper code).
  // The import is rewritten above (its decl range is skipped here); ranges of
  // removed validators are skipped too (their args are already deleted).
  if (schemaRenames.size > 0) {
    const inSkippedRange = (pos: number): boolean =>
      importDeclarations.some(
        (declaration) =>
          pos >= declaration.getStart(sourceFile) && pos < declaration.getEnd(),
      ) ||
      removedValidatorRanges.some(([start, end]) => pos >= start && pos < end);

    const renameReferences = (node: TS.Node): void => {
      if (ts.isIdentifier(node)) {
        const replacement = schemaRenames.get(node.text);
        if (replacement) {
          const parent = node.parent;
          const isMemberName =
            ts.isPropertyAccessExpression(parent) && parent.name === node;
          const isDeclarationName =
            (ts.isVariableDeclaration(parent) && parent.name === node) ||
            (ts.isParameter(parent) && parent.name === node) ||
            (ts.isBindingElement(parent) && parent.name === node) ||
            (ts.isPropertyAssignment(parent) && parent.name === node) ||
            (ts.isPropertySignature(parent) && parent.name === node);
          const start = node.getStart(sourceFile);
          if (!isMemberName && !isDeclarationName && !inSkippedRange(start)) {
            edits.push({ start, end: node.getEnd(), text: replacement });
          }
        }
      }
      ts.forEachChild(node, renameReferences);
    };
    renameReferences(sourceFile);
  }

  if (pendingInsertions.length > 0) {
    const lastImport = importDeclarations.at(-1);
    const insertPos = lastImport
      ? source.indexOf('\n', lastImport.getEnd()) + 1
      : 0;
    edits.push({
      start: insertPos,
      end: insertPos,
      text: pendingInsertions.map((line) => `${line}\n`).join(''),
    });
  }

  if (toAppend.length > 0) {
    edits.push({
      start: source.length,
      end: source.length,
      text: toAppend.map((handler) => handler.stub).join(''),
    });
  }

  return applyEdits(source, edits);
};

const reconcileValidators = (
  sourceFile: TS.SourceFile,
  source: string,
  call: TS.CallExpression,
  desiredValidators: DesiredValidator[],
  edits: Edit[],
  zValidatorName: string,
  requiredSchemas: Set<string>,
  removedRanges: [number, number][],
) => {
  const existing: { target: string; arg: TS.CallExpression }[] = [];

  for (const arg of call.arguments) {
    if (
      ts.isCallExpression(arg) &&
      ts.isIdentifier(arg.expression) &&
      arg.expression.text === zValidatorName
    ) {
      const target = arg.arguments[0];
      if (
        arg.arguments.length > 0 &&
        ts.isStringLiteralLike(target) &&
        VALIDATOR_TARGETS.has(target.text)
      ) {
        existing.push({ target: target.text, arg });
      }
    }
  }

  const desiredByTarget = new Map(
    desiredValidators.map((validator) => [validator.target, validator]),
  );
  const existingByTarget = new Set(existing.map((item) => item.target));

  // Remove validators the spec no longer requires. (Schema RENAMES — e.g.
  // camelCase→PascalCase — are handled by the file-wide rename pass driven by the
  // zod-import rewrite, so every reference is migrated, not just the arg here.)
  for (const item of existing) {
    if (!desiredByTarget.has(item.target as ValidatorTarget)) {
      const edit = removeArgumentEdit(sourceFile, source, item.arg);
      edits.push(edit);
      removedRanges.push([edit.start, edit.end]);
    }
  }

  const missing = desiredValidators.filter(
    (validator) => !existingByTarget.has(validator.target),
  );
  if (missing.length > 0) {
    const insertPos = validatorInsertPos(sourceFile, source, call);
    const text = missing
      .map((validator) => {
        requiredSchemas.add(validator.schema);
        return `  ${zValidatorName}('${validator.target}', ${validator.schema}),\n`;
      })
      .join('');
    edits.push({ start: insertPos, end: insertPos, text });
  }
};

/** Position to insert new validators: the line start of the trailing handler. */
const validatorInsertPos = (
  sourceFile: TS.SourceFile,
  source: string,
  call: TS.CallExpression,
): number => {
  // The handler is the LAST function argument; earlier function args may be
  // inline middleware, so search from the end.
  const handler = call.arguments.findLast(
    (arg) => ts.isArrowFunction(arg) || ts.isFunctionExpression(arg),
  );
  if (handler) return lineStart(source, handler.getStart(sourceFile));
  // No trailing handler found — insert just before the closing paren.
  return call.getEnd() - 1;
};

const removeArgumentEdit = (
  sourceFile: TS.SourceFile,
  source: string,
  arg: TS.Node,
): Edit => {
  const argStart = arg.getStart(sourceFile);
  const start = startsLine(source, argStart)
    ? lineStart(source, argStart)
    : argStart;

  const commaIdx = source.indexOf(',', arg.getEnd());
  let end = commaIdx === -1 ? arg.getEnd() : commaIdx + 1;
  while (source[end] === ' ' || source[end] === '\t') end += 1;
  if (source.slice(end, end + 2) === '\r\n') end += 2;
  else if (source[end] === '\n') end += 1;

  return { start, end, text: '' };
};

const applyEdits = (source: string, edits: Edit[]): string => {
  let result = source;
  for (const edit of edits.toSorted((a, b) => b.start - a.start)) {
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  }
  return result;
};

/**
 * Extracts the inner body of each handler's `async (c) => { ... }` block, keyed
 * by handler name. Used by the `full` strategy to splice user bodies back into a
 * freshly-regenerated wrapper. Returns an empty map on parse failure or when
 * typescript is unavailable.
 */
export const extractHandlerBodies = async (
  source: string,
): Promise<Map<string, string>> => {
  const bodies = new Map<string, string>();
  if (!(await ensureTypeScript())) return bodies;

  const sourceFile = parse(source);
  if (!sourceFile) return bodies;

  for (const { name, call } of findHandlers(sourceFile)) {
    // The handler is the LAST function argument (earlier ones may be inline
    // middleware), so its body — not a middleware's — is what `full` splices.
    const handler = call.arguments.findLast(
      (arg) => ts.isArrowFunction(arg) || ts.isFunctionExpression(arg),
    );
    if (handler?.body && ts.isBlock(handler.body)) {
      const bodyStart = handler.body.getStart(sourceFile) + 1;
      const bodyEnd = handler.body.getEnd() - 1;
      bodies.set(name, source.slice(bodyStart, bodyEnd));
    }
  }

  return bodies;
};
