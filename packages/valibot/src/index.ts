import {
  type ClientBuilder,
  type ClientGeneratorsBuilder,
  type GeneratorDependency,
  type GeneratorOptions,
  type GeneratorVerbOptions,
  pascal,
} from '@orval/core';

import {
  getSingleResponse,
  parseBodyAndResponse,
  parseParameters,
} from './operation';
import { renderValibot } from './render';

export { dereference, parseParameters } from './operation';
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
  { typeName, verb, override }: GeneratorVerbOptions,
  { pathRoute, context }: GeneratorOptions,
) => {
  const spec = context.spec.paths?.[pathRoute];
  if (spec == undefined) {
    throw new Error(`No such path ${pathRoute} in ${context.projectName}`);
  }

  const operation = verb === 'query' ? undefined : spec[verb];
  const options = override.valibot;

  const parameters = parseParameters({
    data: [...(spec.parameters ?? []), ...(operation?.parameters ?? [])],
    context,
    strict: options.strict,
    generate: options.generate,
  });

  const body = parseBodyAndResponse({
    data: operation?.requestBody,
    context,
    strict: options.strict.body,
    generate: options.generate.body,
  });

  const response = parseBodyAndResponse({
    data: getSingleResponse(operation?.responses),
    context,
    strict: options.strict.response,
    generate: options.generate.response,
  });

  const name = pascal(typeName);
  const implementation = [
    { constName: `${name}Params`, node: parameters.params },
    { constName: `${name}QueryParams`, node: parameters.queryParams },
    { constName: `${name}Header`, node: parameters.headers },
    { constName: `${name}Body`, node: body },
    { constName: `${name}Response`, node: response },
  ]
    .flatMap(({ constName, node }) =>
      node
        ? [
            `export const ${constName} = ${renderValibot(node, { exactOptional: options.exactOptional })}`,
          ]
        : [],
    )
    .join('\n\n');

  return { implementation, mutators: [] };
};

export const generateValibot: ClientBuilder = (verbOptions, options) => {
  const { implementation, mutators } = generateValibotRoute(
    verbOptions,
    options,
  );

  return {
    implementation: implementation ? `${implementation}\n\n` : '',
    imports: [],
    mutators,
  };
};

const valibotClientBuilder: ClientGeneratorsBuilder = {
  client: generateValibot,
  dependencies: getValibotDependencies,
};

export const builder = () => () => valibotClientBuilder;

export default builder;
