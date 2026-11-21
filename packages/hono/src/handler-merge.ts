import {
  type ArrowFunctionExpression,
  type CallExpression,
  type Expression,
  type Function as FunctionNode,
  type ImportDeclaration,
  type ModuleExportName,
  type Node,
  parseSync,
  type Program,
} from 'oxc-parser';

/**
 * AST-based reconciliation of an existing hono handler file.
 *
 * The `smart` handler strategy regenerates only the regions orval owns — its own
 * imports (names + module specifier) and the `zValidator(...)` arguments of each
 * handler — while leaving every user-authored construct untouched: custom imports,
 * middleware passed to `factory.createHandlers(...)`, the `async (c) => { ... }`
 * body, and any top-level helpers, constants, types, or comments.
 *
 * We edit the original source text in place using node offsets from
 * oxc-parser (UTF-16 offsets into the JS string, like the TypeScript compiler
 * API's), so formatting and comments of untouched regions are preserved. On any
 * parse failure we return the source unchanged — user code is never destroyed by
 * a parser hiccup.
 */

type ValidatorTarget =
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

interface OrvalImport {
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

interface Parsed {
  program: Program;
  /** Text with every comment blanked out, at the same offsets. */
  code: string;
}

const parse = (source: string): Parsed | undefined => {
  const { program, comments, errors } = parseSync('handler.ts', source, {
    lang: 'ts',
    sourceType: 'module',
  });
  if (errors.length > 0) return undefined;
  let code = source;
  for (const { start, end } of comments) {
    code =
      code.slice(0, start) +
      source.slice(start, end).replaceAll(/[^\n]/g, ' ') +
      code.slice(end);
  }
  return { program, code };
};

/** `a?.b()` is wrapped in a `ChainExpression`; look through it. */
const unwrapChain = (node: Expression): Expression =>
  node.type === 'ChainExpression' ? node.expression : node;

const asCall = (node: Node): CallExpression | undefined => {
  const expression = unwrapChain(node as Expression);
  return expression.type === 'CallExpression' ? expression : undefined;
};

/** The text of a string literal or a substitution-free template literal. */
const stringValue = (node: Node | undefined): string | undefined => {
  if (node?.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? undefined;
  }
  return undefined;
};

/** The handler is the LAST function argument; earlier ones may be middleware. */
const findHandlerFunction = (
  call: CallExpression,
): ArrowFunctionExpression | FunctionNode | undefined =>
  call.arguments.findLast(
    (arg): arg is ArrowFunctionExpression | FunctionNode =>
      arg.type === 'ArrowFunctionExpression' ||
      arg.type === 'FunctionExpression',
  );

type AnyNode = Node & Record<string, unknown>;

const isNode = (value: unknown): value is AnyNode =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { type?: unknown }).type === 'string';

const childNodes = (node: AnyNode): AnyNode[] =>
  Object.entries(node).flatMap(([key, value]) => {
    if (key === 'type' || key === 'start' || key === 'end') return [];
    if (Array.isArray(value)) return value.filter(isNode);
    return isNode(value) ? [value] : [];
  });

/** Identifiers that a destructuring or plain binding pattern declares. */
const collectBindingNames = (pattern: unknown, into: Set<Node>): void => {
  if (!isNode(pattern)) return;
  switch (pattern.type) {
    case 'Identifier': {
      into.add(pattern);
      break;
    }
    case 'ObjectPattern': {
      for (const property of pattern.properties as AnyNode[]) {
        if (property.type === 'RestElement') {
          collectBindingNames(property.argument, into);
        } else {
          // In shorthand `{ X }` the key is the binding too.
          if (property.shorthand) collectBindingNames(property.key, into);
          collectBindingNames(property.value, into);
        }
      }
      break;
    }
    case 'ArrayPattern': {
      for (const element of pattern.elements as unknown[]) {
        collectBindingNames(element, into);
      }
      break;
    }
    case 'RestElement': {
      collectBindingNames(pattern.argument, into);
      break;
    }
    case 'AssignmentPattern': {
      collectBindingNames(pattern.left, into);
      break;
    }
    case 'TSParameterProperty': {
      collectBindingNames(pattern.parameter, into);
      break;
    }
  }
};

interface IdentifierNode {
  name: string;
  start: number;
  end: number;
  /** The value of a shorthand property, whose name is also the key. */
  shorthand: boolean;
}

const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

/** Nodes whose non-computed `key` is a property name, not a reference. */
const KEYED_MEMBER_TYPES = new Set([
  'Property',
  'MethodDefinition',
  'PropertyDefinition',
  'AccessorProperty',
  'TSAbstractMethodDefinition',
  'TSAbstractPropertyDefinition',
  'TSAbstractAccessorProperty',
  'TSPropertySignature',
  'TSMethodSignature',
]);

const namesOf = (pattern: unknown): string[] => {
  const nodes = new Set<Node>();
  collectBindingNames(pattern, nodes);
  return [...nodes].map((node) => (node as AnyNode & { name: string }).name);
};

/** `var` names declared in a function body, outside nested functions. */
const hoistedVarNames = (node: AnyNode, into: string[]): void => {
  for (const child of childNodes(node)) {
    if (FUNCTION_TYPES.has(child.type)) continue;
    if (child.type === 'VariableDeclaration' && child.kind === 'var') {
      for (const declarator of child.declarations as AnyNode[]) {
        into.push(...namesOf(declarator.id));
      }
    }
    hoistedVarNames(child, into);
  }
};

/** Block-scoped names declared directly in a list of statements. */
const lexicalNames = (statements: AnyNode[], into: string[]): void => {
  for (const statement of statements) {
    if (statement.type === 'VariableDeclaration' && statement.kind !== 'var') {
      for (const declarator of statement.declarations as AnyNode[]) {
        into.push(...namesOf(declarator.id));
      }
    } else if (
      statement.type === 'FunctionDeclaration' ||
      statement.type === 'ClassDeclaration' ||
      statement.type === 'TSEnumDeclaration'
    ) {
      into.push(...namesOf(statement.id));
    }
  }
};

/**
 * The names a node declares for its own scope, or `undefined` when the node
 * opens no scope. The module scope is not tracked: it holds the imports being
 * renamed.
 */
const scopeNames = (node: AnyNode): string[] | undefined => {
  const names: string[] = [];
  if (FUNCTION_TYPES.has(node.type)) {
    for (const param of node.params as unknown[]) names.push(...namesOf(param));
    if (node.type === 'FunctionExpression') names.push(...namesOf(node.id));
    if (node.body) hoistedVarNames(node.body as AnyNode, names);
    return names;
  }
  switch (node.type) {
    case 'BlockStatement':
    case 'StaticBlock': {
      lexicalNames(node.body as AnyNode[], names);
      return names;
    }
    case 'SwitchStatement': {
      for (const switchCase of node.cases as AnyNode[]) {
        lexicalNames(switchCase.consequent as AnyNode[], names);
      }
      return names;
    }
    case 'ForStatement': {
      if (node.init) lexicalNames([node.init as AnyNode], names);
      return names;
    }
    case 'ForInStatement':
    case 'ForOfStatement': {
      lexicalNames([node.left as AnyNode], names);
      return names;
    }
    case 'CatchClause': {
      names.push(...namesOf(node.param));
      return names;
    }
    case 'ClassExpression': {
      names.push(...namesOf(node.id));
      return names;
    }
  }
  return undefined;
};

/**
 * Identifiers that refer to a module-level binding by name, for the schema
 * rename. Skips names that only label something — `obj.name` members, the
 * non-computed keys of properties, methods, accessors and type members, and
 * declared names — and references a local declaration of the same name
 * shadows.
 */
const renamableIdentifiers = (
  program: Program,
  names: ReadonlySet<string>,
): IdentifierNode[] => {
  const excluded = new Set<Node>();
  const shorthandValues = new Set<Node>();
  const identifiers: IdentifierNode[] = [];
  const scopes: ReadonlySet<string>[] = [];

  const visit = (node: AnyNode): void => {
    switch (node.type) {
      case 'Identifier': {
        const { name, start, end } = node as AnyNode & IdentifierNode;
        if (
          names.has(name) &&
          !excluded.has(node) &&
          !scopes.some((scope) => scope.has(name))
        ) {
          identifiers.push({
            name,
            start,
            end,
            shorthand: shorthandValues.has(node),
          });
        }
        // A parameter's type annotation hangs off its identifier.
        break;
      }
      case 'MemberExpression': {
        if (!node.computed) excluded.add(node.property as Node);
        break;
      }
      case 'VariableDeclarator': {
        collectBindingNames(node.id, excluded);
        break;
      }
      case 'CatchClause': {
        collectBindingNames(node.param, excluded);
        break;
      }
    }
    if (KEYED_MEMBER_TYPES.has(node.type)) {
      if (node.shorthand) {
        // `{ X }` (or `{ X = d }` in a pattern) names the key and the value
        // with one token; the key is renamed with the value, by expanding the
        // shorthand.
        excluded.add(node.key as Node);
        const value = node.value as AnyNode;
        shorthandValues.add(
          value.type === 'AssignmentPattern' ? (value.left as Node) : value,
        );
      } else if (!node.computed) {
        excluded.add(node.key as Node);
      }
    }
    // Functions and function-like type signatures declare their parameters.
    if (Array.isArray(node.params)) {
      for (const param of node.params) collectBindingNames(param, excluded);
    }

    const declared = scopeNames(node)?.filter((name) => names.has(name));
    if (declared?.length) scopes.push(new Set(declared));
    for (const child of childNodes(node)) visit(child);
    if (declared?.length) scopes.pop();
  };

  visit(program as AnyNode);
  return identifiers;
};

interface ParsedHandler {
  name: string;
  call: CallExpression;
}

const findHandlers = (program: Program): ParsedHandler[] => {
  const handlers: ParsedHandler[] = [];
  for (const statement of program.body) {
    // Handlers are emitted as `export const`; the declaration sits inside the
    // export.
    const variables =
      statement.type === 'ExportNamedDeclaration'
        ? statement.declaration
        : statement;
    if (variables?.type !== 'VariableDeclaration') continue;
    for (const declaration of variables.declarations) {
      if (declaration.id.type !== 'Identifier') continue;
      const name = declaration.id.name;
      if (!name.endsWith('Handlers')) continue;
      const call = declaration.init ? asCall(declaration.init) : undefined;
      const callee = call ? unwrapChain(call.callee) : undefined;
      if (
        call &&
        callee?.type === 'MemberExpression' &&
        !callee.computed &&
        callee.property.type === 'Identifier' &&
        callee.property.name === 'createHandlers'
      ) {
        handlers.push({ name, call });
      }
    }
  }
  return handlers;
};

const exportName = (name: ModuleExportName): string =>
  name.type === 'Literal' ? name.value : name.name;

const namedSpecifiers = (declaration: ImportDeclaration) =>
  declaration.specifiers.filter(
    (specifier) => specifier.type === 'ImportSpecifier',
  );

const importedNames = (declaration: ImportDeclaration): string[] =>
  namedSpecifiers(declaration).map((specifier) => specifier.local.name);

const moduleText = (declaration: ImportDeclaration): string =>
  declaration.source.value;

/**
 * A "plain" named import — no default binding, no namespace (`* as x`), and no
 * aliases (`x as y`). Only plain named imports are safe for orval to rewrite;
 * default / namespace / aliased / mixed imports are user-authored and must be
 * left untouched.
 */
const isPlainNamedImport = (
  code: string,
  declaration: ImportDeclaration,
): boolean => {
  const specifiers = declaration.specifiers;
  if (specifiers.some((specifier) => specifier.type !== 'ImportSpecifier')) {
    return false;
  }
  // `import {} from 'x'` and the side-effect `import 'x'` both have no
  // specifiers; only the former has a named-import clause. `code` has its
  // comments blanked, so a `{` inside a comment does not count.
  if (
    specifiers.length === 0 &&
    !code.slice(declaration.start, declaration.source.start).includes('{')
  ) {
    return false;
  }
  // `x as x` is still an alias: the imported and local names are separate
  // tokens, whereas a plain `x` is a single token both refer to.
  return namedSpecifiers(declaration).every(
    (specifier) => specifier.imported.start === specifier.local.start,
  );
};

const setEquals = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((value) => b.includes(value));

// Escape regex metacharacters so an identifier can be interpolated literally.
// JS identifiers may contain `$`, which would otherwise act as an anchor.
const escapeRegExp = (value: string): string =>
  value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

/**
 * The local binding name an imported symbol is bound to, honouring aliases —
 * e.g. `import { zValidator as zv }` → `'zv'`. Returns undefined when the symbol
 * is not imported. Used so a handler that aliases `zValidator` is detected and
 * its new validators are inserted under the same alias (never an unimported name).
 */
const localNameFor = (
  importDeclarations: ImportDeclaration[],
  importedName: string,
  module: string,
): string | undefined => {
  for (const declaration of importDeclarations) {
    if (moduleText(declaration) !== module) continue;
    for (const specifier of namedSpecifiers(declaration)) {
      if (exportName(specifier.imported) === importedName) {
        return specifier.local.name;
      }
    }
  }
  return undefined;
};

const renderImport = ({
  names,
  module,
  typeOnly,
}: OrvalImport & { typeOnly?: boolean }): string => {
  const keyword = typeOnly ? 'import type ' : 'import ';
  return names.length <= 1
    ? `${keyword}{ ${names.join('')} } from '${module}';`
    : `${keyword}{\n  ${names.join(',\n  ')}\n} from '${module}';`;
};

const lineStart = (source: string, position: number): number =>
  source.lastIndexOf('\n', position - 1) + 1;

/** Whether only whitespace sits between the line start and `position`. */
const startsLine = (source: string, position: number): boolean =>
  /^\s*$/.test(source.slice(lineStart(source, position), position));

export const reconcileHandlerFile = async (
  source: string,
  desired: { imports: DesiredImports; handlers: DesiredHandler[] },
): Promise<string> => {
  const parsed = parse(source);
  if (!parsed) return source;
  const { program, code } = parsed;

  const edits: Edit[] = [];
  const importDeclarations = program.body.filter(
    (statement): statement is ImportDeclaration =>
      statement.type === 'ImportDeclaration',
  );
  const handlers = findHandlers(program);
  const existingNames = new Set(handlers.map((handler) => handler.name));
  const pendingInsertions: string[] = [];

  // Locate an orval-owned import by its module specifier (authoritative).
  const byModule = (module: string): ImportDeclaration | undefined =>
    module
      ? importDeclarations.find(
          (declaration) => moduleText(declaration) === module,
        )
      : undefined;

  // Fallback used only when the module specifier has moved: a PLAIN named import
  // whose names are EXACTLY `signature` (case-sensitive). This relocates an
  // orval import without the case-folding hazard of fuzzy name matching, which
  // could otherwise clobber an unrelated user import (e.g. `listPetsResponse`).
  const plainExact = (signature: string[]): ImportDeclaration | undefined =>
    signature.length === 0
      ? undefined
      : importDeclarations.find(
          (declaration) =>
            isPlainNamedImport(code, declaration) &&
            setEquals(importedNames(declaration), signature),
        );

  const removeImportEdit = (declaration: ImportDeclaration) => {
    let end = declaration.end;
    if (source.slice(end, end + 2) === '\r\n') end += 2;
    else if (source[end] === '\n') end += 1;
    edits.push({ start: declaration.start, end, text: '' });
  };

  // Whether `name` is already bound as a bare identifier by some import (a named
  // import's local name, or a default import). Namespace imports do NOT bind
  // their members bare. Used to avoid duplicate imports when augmenting.
  const isImportedBare = (name: string): boolean =>
    importDeclarations.some((declaration) =>
      declaration.specifiers.some(
        (specifier) =>
          specifier.type !== 'ImportNamespaceSpecifier' &&
          specifier.local.name === name,
      ),
    );

  /**
   * Reconcile an orval-owned import to `names`. We only rewrite/remove a PLAIN
   * named import whose names are ALL orval-owned (per `isOrvalName`). A
   * user-authored import (aliased / namespace / default / mixed) is never
   * rewritten; instead, when `augment` is provided, we add any orval name that
   * is genuinely needed as a bare reference but isn't yet importable bare — e.g.
   * a newly appended handler's context, or a newly-inserted validator's schema.
   */
  const reconcileImport = (
    existing: ImportDeclaration | undefined,
    names: string[],
    module: string,
    isOrvalName: (name: string) => boolean,
    augment?: (name: string) => boolean,
    collectRenames?: Map<string, string>,
    typeOnly?: boolean,
  ) => {
    if (!existing) {
      // Never insert a name that is already bound bare elsewhere (e.g. a default
      // or namespace import from another module) — that would create a duplicate
      // binding.
      const toInsert = (
        augment ? names.filter((name) => augment(name)) : names
      ).filter((name) => !isImportedBare(name));
      if (toInsert.length > 0) {
        pendingInsertions.push(
          renderImport({ names: toInsert, module, typeOnly }),
        );
      }
      return;
    }

    const isOurs =
      isPlainNamedImport(code, existing) &&
      importedNames(existing).every((name) => isOrvalName(name));
    if (!isOurs) {
      if (augment) {
        const missing = names.filter(
          (name) => augment(name) && !isImportedBare(name),
        );
        if (missing.length > 0) {
          pendingInsertions.push(
            renderImport({ names: missing, module, typeOnly }),
          );
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
      moduleText(existing) === module &&
      (existing.importKind === 'type') === Boolean(typeOnly)
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
      start: existing.start,
      end: existing.end,
      text: renderImport({ names, module, typeOnly }),
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
  for (const { start, end } of importDeclarations) {
    bodySource =
      bodySource.slice(0, start) +
      ' '.repeat(end - start) +
      bodySource.slice(end);
  }

  // A name needs a bare import when it is referenced unqualified in the body
  // (not as `Ns.Name`), is a schema a reconciled validator now references
  // (inserted or renamed), or is used by an appended handler stub.
  const referencedBare = (name: string): boolean =>
    new RegExp(String.raw`(?<!\.)\b${escapeRegExp(name)}\b`).test(bodySource);
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
    undefined,
    // Context identifiers only appear in type positions (the typed
    // `async (c: XContext) => {}` handler callback), so the import is
    // emitted type-only.
    true,
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
        (declaration) => pos >= declaration.start && pos < declaration.end,
      ) ||
      removedValidatorRanges.some(([start, end]) => pos >= start && pos < end);

    const renamed = new Set<number>();
    for (const identifier of renamableIdentifiers(
      program,
      new Set(schemaRenames.keys()),
    )) {
      const replacement = schemaRenames.get(identifier.name);
      // A shorthand `{ X }` yields its key and value as two identifiers over
      // the same range; rename that range once.
      if (
        replacement &&
        !inSkippedRange(identifier.start) &&
        !renamed.has(identifier.start)
      ) {
        renamed.add(identifier.start);
        edits.push({
          start: identifier.start,
          end: identifier.end,
          // Keep a shorthand property's key: `{ old }` → `{ old: New }`.
          text: identifier.shorthand
            ? `${identifier.name}: ${replacement}`
            : replacement,
        });
      }
    }
  }

  if (pendingInsertions.length > 0) {
    const lastImport = importDeclarations.at(-1);
    let insertPos = 0;
    if (lastImport) {
      // Guard the EOF case: when the last import has no trailing newline,
      // indexOf returns -1 and `+ 1` would prepend to the top of the file.
      const newline = source.indexOf('\n', lastImport.end);
      insertPos = newline === -1 ? source.length : newline + 1;
    }
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
  source: string,
  call: CallExpression,
  desiredValidators: DesiredValidator[],
  edits: Edit[],
  zValidatorName: string,
  requiredSchemas: Set<string>,
  removedRanges: [number, number][],
) => {
  const existing: { target: string; arg: Node }[] = [];

  for (const arg of call.arguments) {
    const validator = asCall(arg);
    if (
      validator?.callee.type === 'Identifier' &&
      validator.callee.name === zValidatorName
    ) {
      const target = stringValue(validator.arguments[0]);
      if (target !== undefined && VALIDATOR_TARGETS.has(target)) {
        existing.push({ target, arg });
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
      const edit = removeArgumentEdit(source, item.arg);
      edits.push(edit);
      removedRanges.push([edit.start, edit.end]);
    }
  }

  const missing = desiredValidators.filter(
    (validator) => !existingByTarget.has(validator.target),
  );
  if (missing.length > 0) {
    const insertPos = validatorInsertPos(source, call);
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
const validatorInsertPos = (source: string, call: CallExpression): number => {
  // The handler is the LAST function argument; earlier function args may be
  // inline middleware, so search from the end.
  const handler = findHandlerFunction(call);
  if (handler) {
    // Insert at the handler's line start when it's on its own line; otherwise
    // (single-line `createHandlers(async (c) => {})`) insert right before it so
    // the validator isn't pushed to the start of the statement.
    const start = handler.start;
    return startsLine(source, start) ? lineStart(source, start) : start;
  }
  // No trailing handler found — insert just before the closing paren.
  return call.end - 1;
};

const removeArgumentEdit = (source: string, arg: Node): Edit => {
  const argStart = arg.start;
  const start = startsLine(source, argStart)
    ? lineStart(source, argStart)
    : argStart;

  const commaIdx = source.indexOf(',', arg.end);
  let end = commaIdx === -1 ? arg.end : commaIdx + 1;
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
 * freshly-regenerated wrapper. Returns `undefined` when the source can't be
 * parsed — distinct from an empty map (parsed, no handlers) — so callers can
 * preserve the file instead of dropping its bodies.
 */
export const extractHandlerBodies = async (
  source: string,
): Promise<Map<string, string> | undefined> => {
  const program = parse(source)?.program;
  if (!program) return undefined;

  const bodies = new Map<string, string>();
  for (const { name, call } of findHandlers(program)) {
    // The handler is the LAST function argument (earlier ones may be inline
    // middleware), so its body — not a middleware's — is what `full` splices.
    const handler = findHandlerFunction(call);
    if (handler?.body?.type === 'BlockStatement') {
      bodies.set(
        name,
        source.slice(handler.body.start + 1, handler.body.end - 1),
      );
    }
  }

  return bodies;
};
