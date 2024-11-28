import {
  asyncReduce,
  ContextSpecs,
  generateVerbsOptions,
  GeneratorApiBuilder,
  GeneratorApiOperations,
  GeneratorSchema,
  getRoute,
  GetterPropType,
  isReference,
  NormalizedInputOptions,
  NormalizedOutputOptions,
  resolveRef,
} from '@orval/core';
import { generateMockImports } from '@orval/mock';
import { ServerObject } from 'openapi3-ts/dist/oas31';
import { PathItemObject } from 'openapi3-ts/oas30';
import {
  generateClientFooter,
  generateClientHeader,
  generateClientImports,
  generateClientTitle,
  generateExtraFiles,
  generateOperations,
} from './client';

export const getApiBuilder = async ({
  input,
  output,
  context,
}: {
  input: NormalizedInputOptions;
  output: NormalizedOutputOptions;
  context: ContextSpecs;
}): Promise<GeneratorApiBuilder> => {
  const api = await asyncReduce(
    Object.entries(context.specs[context.specKey].paths ?? {}),
    async (acc, [pathRoute, verbs]: [string, PathItemObject]) => {
      const route = getRoute(pathRoute);

      let resolvedVerbs = verbs;
      let resolvedContext = context;

      if (isReference(verbs)) {
        const { schema, imports } = resolveRef<PathItemObject>(verbs, context);

        resolvedVerbs = schema;

        resolvedContext = {
          ...context,
          ...(imports.length
            ? {
                specKey: imports[0].specKey,
              }
            : {}),
        };
      }

      let verbsOptions = await generateVerbsOptions({
        verbs: resolvedVerbs,
        input,
        output,
        route,
        pathRoute,
        context: resolvedContext,
      });

      // GitHub #564 check if we want to exclude deprecated operations
      if (output.override.useDeprecatedOperations === false) {
        verbsOptions = verbsOptions.filter((verb) => {
          return !verb.deprecated;
        });
      }

      const schemas = verbsOptions.reduce(
        (acc, { queryParams, headers, body, response, props }) => {
          if (props) {
            acc.push(
              ...props.flatMap((param) =>
                param.type === GetterPropType.NAMED_PATH_PARAMS
                  ? param.schema
                  : [],
              ),
            );
          }
          if (queryParams) {
            acc.push(queryParams.schema, ...queryParams.deps);
          }
          if (headers) {
            acc.push(headers.schema, ...headers.deps);
          }

          acc.push(...body.schemas);
          acc.push(...response.schemas);

          return acc;
        },
        [] as GeneratorSchema[],
      );

      let fullRoute = route;
      const getBaseUrl = (): string => {
        if (!output.baseUrl) return '';
        if (typeof output.baseUrl === 'string') return output.baseUrl;
        if (output.baseUrl.getBaseUrlFromSpecification) {
          const servers =
            verbs.servers ?? context.specs[context.specKey].servers;
          if (!servers) {
            throw new Error(
              "Orval is configured to use baseUrl from the specifications 'servers' field, but there exist no servers in the specification.",
            );
          }
          const server = servers.at(
            Math.min(output.baseUrl.index ?? 0, servers.length - 1),
          );
          if (!server) return '';
          if (!server.variables) return server.url;

          let url = server.url;
          const variables = output.baseUrl.variables;
          for (const variableKey of Object.keys(server.variables)) {
            const variable = server.variables[variableKey];
            if (!variables?.[variableKey]) {
              url = url.replaceAll(
                `{${variableKey}}`,
                String(variable.default),
              );
            } else {
              if (
                variable.enum &&
                !variable.enum.some((e) => e == variables[variableKey])
              ) {
                throw new Error(
                  `Invalid variable value '${variables[variableKey]}' for variable '${variableKey}' when resolving ${server.url}. Valid values are: ${variable.enum.join(', ')}.`,
                );
              }
              url = url.replaceAll(`{${variableKey}}`, variables[variableKey]);
            }
          }
          return url;
        }
        return output.baseUrl.baseUrl;
      };

      const baseUrl = getBaseUrl();
      if (baseUrl) {
        if (baseUrl.endsWith('/') && route.startsWith('/')) {
          fullRoute = route.slice(1);
        }
        fullRoute = `${baseUrl}${fullRoute}`;
      }
      const pathOperations = await generateOperations(
        output.client,
        verbsOptions,
        {
          route: fullRoute,
          pathRoute,
          override: output.override,
          context: resolvedContext,
          mock: output.mock,
          // @ts-expect-error // FIXME
          output: output.target,
        },
        output,
      );

      verbsOptions.forEach((verbOption) => {
        acc.verbOptions[verbOption.operationId] = verbOption;
      });
      acc.schemas.push(...schemas);
      acc.operations = { ...acc.operations, ...pathOperations };

      return acc;
    },
    {
      operations: {},
      verbOptions: {},
      schemas: [],
    } as GeneratorApiOperations,
  );

  const extraFiles = await generateExtraFiles(
    output.client,
    api.verbOptions,
    output,
    context,
  );

  return {
    operations: api.operations,
    schemas: api.schemas,
    verbOptions: api.verbOptions,
    title: generateClientTitle,
    header: generateClientHeader,
    footer: generateClientFooter,
    imports: generateClientImports,
    importsMock: generateMockImports,
    extraFiles,
  };
};
