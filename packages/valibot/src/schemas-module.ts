import {
  assertNoOutputTypeClash,
  camelPathParamName,
  type ContextSpec,
  collectOperationSchemas,
  type GeneratorSchema,
  type GeneratorVerbOptions,
  type NormalizedOutputOptions,
  type SchemaParsers,
} from '@orval/core';

import { setUnsupportedMode, startRun, warnOnce } from './logger';
import { plainNode, type ValibotNode } from './nodes';
import {
  parseBodyAndResponse,
  parseDirectionalSchema,
  parseParameters,
} from './operation';
import { renderValibot } from './render';
import {
  generateValibotComponentConsts,
  getExportNames,
} from './reusable-schemas';

const VALIBOT_IMPORT = "import * as v from 'valibot';";

const PARSERS: SchemaParsers<ValibotNode> = {
  library: 'valibot',
  options: (override) => override.valibot,
  parseBody: ({ media: [contentType, media], ...options }) =>
    parseBodyAndResponse({
      ...options,
      data: { content: { [contentType]: media } },
      isRequest: true,
      anyMediaType: true,
    }),
  parseSchema: parseDirectionalSchema,
  parseParameters,
  // Clients name path parameters by their generated identifiers.
  withPathParamNames: (node) =>
    node.schema.kind === 'object'
      ? {
          ...node,
          schema: {
            ...node.schema,
            entries: node.schema.entries.map((entry) => ({
              ...entry,
              key: camelPathParamName(entry.key),
            })),
          },
        }
      : node,
  anyKeys: plainNode({ kind: 'object', mode: 'looseObject', entries: [] }),
  unknown: plainNode({ kind: 'unknown' }),
  warn: warnOnce,
};

interface ValibotSchemasModuleInput {
  spec: ContextSpec['spec'];
  target: string;
  schemas: GeneratorSchema[];
  verbOptions: Record<string, GeneratorVerbOptions>;
}

interface SchemaEntry {
  /** The name clients import. */
  name: string;
  /** The declared constant, when it cannot be named as clients import it. */
  constName?: string;
  expression: string;
  /**
   * The input and output types of a constant on a cycle, declared because
   * they cannot be inferred from the constant.
   */
  types?: {
    inputName: string;
    input: string;
    outputName: string;
    output: string;
  };
}

const renderEntry = ({
  name,
  constName = name,
  expression,
  types,
}: SchemaEntry) =>
  [
    `export const ${constName} = ${expression};`,
    `export type ${types?.inputName ?? constName} = ${types?.input ?? `v.InferInput<typeof ${constName}>`};`,
    `export type ${types?.outputName ?? `${name}Output`} = ${types?.output ?? `v.InferOutput<typeof ${constName}>`};`,
    ...(constName === name ? [] : [`export { ${constName} as ${name} };`]),
  ].join('\n');

/**
 * The module `schemas: { type: 'valibot' }` writes: the component constants in
 * dependency order, then the operation schemas clients import. Every schema
 * also exports its `X` input and `XOutput` output types. Empty when there is
 * nothing to declare.
 */
export const generateValibotSchemasModule = (
  { spec, target, schemas, verbOptions }: ValibotSchemasModuleInput,
  output: NormalizedOutputOptions,
  workspace: string,
): string => {
  const context: ContextSpec = { spec, target, workspace, output };
  startRun(spec);
  setUnsupportedMode(output.override.valibot.unsupported);

  // A constant is declared under another name only when its own would shadow
  // what generated code relies on; clients still import it by its own name.
  const contractNames = getExportNames(context);
  // The module names each schema's input type like its constant and its
  // output type `<Name>Output`, so a recursive getter is typed the same way.
  const entries: SchemaEntry[] = generateValibotComponentConsts(
    context,
    (constName) => ({
      input: constName,
      output: `${contractNames.get(constName) ?? constName}Output`,
    }),
  ).map(({ name, expression, types }) => ({
    name: contractNames.get(name) ?? name,
    constName: name,
    expression,
    ...(types === undefined ? {} : { types }),
  }));
  // A component is reserved under the name clients import and under the name
  // its constant is declared as, which differ for names such as `Date`.
  const components = new Set(
    entries.flatMap(({ name, constName = name }) => [name, constName]),
  );
  for (const { name, node, exactOptional } of collectOperationSchemas({
    parsers: PARSERS,
    context,
    verbs: Object.values(verbOptions),
    schemas,
    components,
  })) {
    entries.push({
      name,
      expression: renderValibot(node, { exactOptional }),
    });
  }

  assertNoOutputTypeClash(
    'valibot',
    entries.map(({ name }) => name),
    new Set([...components, ...entries.map(({ name }) => name)]),
  );

  return entries.length === 0
    ? ''
    : `${VALIBOT_IMPORT}\n\n${entries.map(renderEntry).join('\n\n')}\n`;
};
