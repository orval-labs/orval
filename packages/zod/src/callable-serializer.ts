import globals from 'globals';
import * as ts from 'typescript';

import type { BoundRefinement } from '../../core/src/types';

/**
 * Globals that exist in a generated JavaScript module. Because parsing is done
 * without a TypeScript lib, these are treated as known external names.
 * Project-specific globals must instead be supplied as explicit bindings.
 */
const JAVASCRIPT_GLOBALS = new Set(Object.keys(globals.builtin));

/**
 * An identifier is a reference unless it occupies a purely syntactic position
 * such as the name in `object.property`, `{ property: value }`, or a label.
 * Shorthand properties (`{ property }`) are references and handled separately.
 */
const isReferenceIdentifier = (node: ts.Identifier): boolean => {
  const parent = node.parent;
  if (
    (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
    (ts.isPropertyAssignment(parent) && parent.name === node) ||
    (ts.isBindingElement(parent) && parent.propertyName === node) ||
    (ts.isMethodDeclaration(parent) && parent.name === node) ||
    (ts.isPropertyDeclaration(parent) && parent.name === node) ||
    (ts.isGetAccessorDeclaration(parent) && parent.name === node) ||
    (ts.isSetAccessorDeclaration(parent) && parent.name === node) ||
    (ts.isLabeledStatement(parent) && parent.label === node) ||
    ((ts.isBreakStatement(parent) || ts.isContinueStatement(parent)) &&
      parent.label === node)
  ) {
    return false;
  }
  return true;
};

/**
 * Find true free identifiers using the TS binder's lexical resolution rather
 * than regular expressions. This handles shadowing, destructuring, nested
 * functions, `catch`, property shorthand, and computed property names.
 */
const findFreeIdentifiers = (source: string): string[] => {
  const fileName = '/__orval_serialized_callable__.ts';
  const text = `(${source});`;
  const options: ts.CompilerOptions = {
    noLib: true,
    target: ts.ScriptTarget.ES2022,
  };
  const sourceFile = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.ES2022,
    true,
  );
  const expression = (sourceFile.statements[0] as ts.ExpressionStatement)
    .expression;
  const callableNode = ts.isParenthesizedExpression(expression)
    ? expression.expression
    : expression;

  if (
    !ts.isArrowFunction(callableNode) &&
    !ts.isFunctionExpression(callableNode)
  ) {
    throw new TypeError(
      'Cannot serialize callable: expected an arrow function or function expression',
    );
  }

  // No disk reads or TypeScript standard library are needed to analyze the
  // one in-memory function expression. No user code is executed here.
  const host = ts.createCompilerHost(options);
  host.getSourceFile = (name) => (name === fileName ? sourceFile : undefined);
  host.fileExists = (name) => name === fileName;
  host.readFile = (name) => (name === fileName ? text : undefined);
  const program = ts.createProgram([fileName], options, host);
  if (program.getSyntacticDiagnostics(sourceFile).length > 0) {
    throw new SyntaxError('Cannot serialize callable: invalid function source');
  }

  const checker = program.getTypeChecker();
  const free = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (
      node.kind === ts.SyntaxKind.ThisKeyword ||
      node.kind === ts.SyntaxKind.SuperKeyword
    ) {
      throw new TypeError('Cannot serialize callable containing this or super');
    }
    if (
      ts.isMetaProperty(node) &&
      node.keywordToken === ts.SyntaxKind.NewKeyword
    ) {
      throw new TypeError('Cannot serialize callable containing new.target');
    }
    if (ts.isIdentifier(node) && isReferenceIdentifier(node)) {
      if (ts.isShorthandPropertyAssignment(node.parent)) {
        if (!checker.getShorthandAssignmentValueSymbol(node.parent)) {
          free.add(node.text);
        }
      } else if (!checker.getSymbolAtLocation(node)) {
        free.add(node.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(callableNode);
  return [...free];
};

/**
 * Serialize JSON-like capture values without evaluating accessors/toJSON or
 * silently dropping unsupported values. Supports extra JS literals that JSON
 * cannot represent (undefined, bigint, NaN, infinities, RegExp and Date).
 */
const serializeCaptureValue = (
  value: unknown,
  active = new Set<object>(),
): string => {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'boolean':
      return String(value);
    case 'undefined':
      return 'undefined';
    case 'bigint':
      return `${value}n`;
    case 'number':
      if (Number.isNaN(value)) return 'NaN';
      if (value === Infinity) return 'Infinity';
      if (value === -Infinity) return '-Infinity';
      if (Object.is(value, -0)) return '-0';
      return String(value);
    case 'symbol':
    case 'function':
      throw new TypeError(`Cannot serialize captured ${typeof value}`);
  }

  if (value instanceof RegExp) {
    if (value.lastIndex !== 0) {
      throw new TypeError(
        'Cannot serialize captured RegExp with nonzero lastIndex',
      );
    }
    return `new RegExp(${JSON.stringify(value.source)}, ${JSON.stringify(value.flags)})`;
  }
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) {
      throw new TypeError('Cannot serialize invalid captured Date');
    }
    return `new Date(${value.getTime()})`;
  }
  if (active.has(value)) {
    throw new TypeError('Cannot serialize cyclic captured value');
  }

  active.add(value);
  try {
    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw new TypeError('Cannot serialize captured symbol-keyed properties');
    }
    if (Array.isArray(value)) {
      const entries: string[] = [];
      for (let index = 0; index < value.length; index++) {
        if (!Object.hasOwn(value, index)) {
          throw new TypeError('Cannot serialize sparse captured array');
        }
        const descriptor = Object.getOwnPropertyDescriptor(
          value,
          index.toString(),
        );
        if (!descriptor || !('value' in descriptor)) {
          throw new TypeError('Cannot serialize captured accessor');
        }
        entries.push(serializeCaptureValue(descriptor.value, active));
      }
      if (Reflect.ownKeys(value).length !== value.length + 1) {
        throw new TypeError(
          'Cannot serialize captured array with extra properties',
        );
      }
      return `[${entries.join(', ')}]`;
    }
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      throw new TypeError('Cannot serialize captured non-plain object');
    }
    const entries: string[] = [];
    if (Reflect.ownKeys(value).length !== Object.keys(value).length) {
      throw new TypeError(
        'Cannot serialize captured non-enumerable properties',
      );
    }
    for (const key of Object.keys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor)) {
        throw new TypeError('Cannot serialize captured accessor');
      }
      // A bare `"__proto__": ...` object-literal key is not a data property.
      const property =
        key === '__proto__' ? `[${JSON.stringify(key)}]` : JSON.stringify(key);
      entries.push(
        `${property}: ${serializeCaptureValue(descriptor.value, active)}`,
      );
    }
    return `{ ${entries.join(', ')} }`;
  } finally {
    active.delete(value);
  }
};

/**
 * Render a callable as an expression with its captured values re-declared.
 *
 * JavaScript cannot reflect the values held in a function's lexical closure.
 * The caller must pass those values in `bindings`; free identifiers that are
 * neither provided nor standard JS globals are rejected.
 *
 * `serializeCallable(fn, { limit: 5 })` yields a self-contained IIFE holding
 * `const limit = 5;` and returning the original function. Self-contained
 * functions keep their old `(${fn.toString()})` representation.
 */

export const serializeCallable = (descriptor: BoundRefinement): string => {
  const { callable, bindings } = descriptor;

  if (typeof callable !== 'function') {
    throw new TypeError('RefinementDescriptor.callable must be a function');
  }

  const source = callable.toString();

  if (source.includes('[native code]')) {
    throw new TypeError('Cannot serialize a native callable as a refinement');
  }

  const resolvedBindings = bindings ?? {};
  const free = findFreeIdentifiers(source);
  const declarations: string[] = [];
  const used = new Set<string>();
  const unresolved: string[] = [];
  for (const name of free) {
    if (name === 'arguments' || name === 'eval') {
      throw new TypeError(`Cannot serialize a closure over ${name}`);
    }
    if (Object.hasOwn(resolvedBindings, name)) {
      used.add(name);
      declarations.push(
        `  const ${name} = ${serializeCaptureValue(resolvedBindings[name])};`,
      );
    } else if (!JAVASCRIPT_GLOBALS.has(name)) {
      unresolved.push(name);
    }
  }
  if (unresolved.length > 0) {
    throw new ReferenceError(
      `Cannot serialize callable: unresolved external reference(s): ${unresolved.join(', ')}. Supply bindings for them.`,
    );
  }
  for (const name of Object.keys(resolvedBindings)) {
    if (!used.has(name)) {
      throw new TypeError(`Unused callable binding: ${name}`);
    }
  }

  if (declarations.length === 0) return `(${source})`;
  return `(() => {\n${declarations.join('\n')}\n  return (${source});\n})()`;
};
