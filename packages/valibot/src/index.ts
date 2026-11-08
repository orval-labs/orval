import {
  type ClientBuilder,
  type ClientGeneratorsBuilder,
  type GeneratorDependency,
  type GeneratorOptions,
  type GeneratorVerbOptions,
  getReferencedFormatTypeImports,
  pascal,
} from '@orval/core';

import { allocateConstName } from './const-names';
import { startRun } from './logger';
import {
  getSingleResponse,
  parseBodyAndResponse,
  parseParameters,
} from './operation';
import { collectRefNames, isReusableSchemasEnabled } from './refs';
import { renderValibot } from './render';
import { getComponentNames } from './reusable-schemas';

export { dereference } from './dereference';
export { parseParameters } from './operation';
export type {
  Locations,
  ParsedParameters,
  ParseParametersOptions,
} from './operation';
export { type RenderOptions, renderValibot } from './render';
export type {
  ValibotAction,
  ValibotEntry,
  ValibotNode,
  ValibotSchema,
} from './nodes';
export { generateValibotSchemasInline } from './schemas-inline';
export {
  generateValibotValidationSchemaDefinition,
  type SchemaRules,
} from './schema';

// A namespace import lets a bundler drop every `v.*` that is unused.
const VALIBOT_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      {
        default: false,
        name: 'v',
        syntheticDefaultImport: false,
        namespaceImport: true,
        values: true,
      },
    ],
    dependency: 'valibot',
  },
];

export const getValibotDependencies = (): GeneratorDependency[] =>
  VALIBOT_DEPENDENCIES;

const generateValibotRoute = (
  { typeName, verb, override, operationName }: GeneratorVerbOptions,
  { pathRoute, context }: GeneratorOptions,
) => {
  const spec = context.spec.paths?.[pathRoute];
  if (spec == undefined) {
    throw new Error(`No such path ${pathRoute} in ${context.projectName}`);
  }

  startRun(context.spec);

  const operation = verb === 'query' ? undefined : spec[verb];
  const options = override.valibot;

  const parameters = parseParameters({
    data: [...(spec.parameters ?? []), ...(operation?.parameters ?? [])],
    context,
    strict: options.strict,
    exactOptional: options.exactOptional,
    generate: options.generate,
    operation: operationName,
  });

  const body = parseBodyAndResponse({
    data: operation?.requestBody,
    context,
    strict: options.strict.body,
    exactOptional: options.exactOptional,
    generate: options.generate.body,
    isRequest: true,
    operation: operationName,
  });

  const response = parseBodyAndResponse({
    data: getSingleResponse(operation?.responses, context),
    context,
    strict: options.strict.response,
    exactOptional: options.exactOptional,
    generate: options.generate.response,
    isRequest: false,
    operation: operationName,
  });

  const name = pascal(typeName);
  const taken = isReusableSchemasEnabled(context)
    ? new Set(getComponentNames(context).values())
    : new Set<string>();
  const nodes = [
    { baseName: `${name}Params`, node: parameters.params },
    { baseName: `${name}QueryParams`, node: parameters.queryParams },
    { baseName: `${name}Header`, node: parameters.headers },
    { baseName: `${name}Body`, node: body },
    { baseName: `${name}Response`, node: response },
  ].flatMap(({ baseName, node }) =>
    node ? [{ constName: allocateConstName(baseName, taken), node }] : [],
  );

  const implementation = nodes
    .map(
      ({ constName, node }) =>
        `export const ${constName} = ${renderValibot(node, { exactOptional: options.exactOptional })}`,
    )
    .join('\n\n');
  const usedComponents = new Set(
    nodes.flatMap(({ node }) => [...collectRefNames(node)]),
  );

  return { implementation, usedComponents, mutators: [] };
};

export const generateValibot: ClientBuilder = (verbOptions, options) => {
  const { implementation, usedComponents, mutators } = generateValibotRoute(
    verbOptions,
    options,
  );

  return {
    implementation: implementation ? `${implementation}\n\n` : '',
    imports: [
      // Component schemas are runtime values, so they are imported as values.
      ...[...usedComponents].toSorted().map((componentName) => ({
        name: componentName,
        schemaName: componentName,
        values: true,
      })),
      ...getReferencedFormatTypeImports(
        implementation,
        options.context.output.override,
        (config) => [config.decodeImport],
      ),
    ],
    mutators,
  };
};

const valibotClientBuilder: ClientGeneratorsBuilder = {
  client: generateValibot,
  dependencies: getValibotDependencies,
};

export const builder = () => () => valibotClientBuilder;

export default builder;
