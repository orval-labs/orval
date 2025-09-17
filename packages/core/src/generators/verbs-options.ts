import type {
  ComponentsObject,
  OperationObject,
  ParameterObject,
  PathItemObject,
  ReferenceObject,
} from 'openapi3-ts/oas30';

import {
  getBody,
  getOperationId,
  getParameters,
  getParams,
  getProps,
  getQueryParams,
  getResponse,
} from '../getters';
import type {
  ContextSpecs,
  GeneratorVerbOptions,
  GeneratorVerbsOptions,
  NormalizedInputOptions,
  NormalizedMutator,
  NormalizedOperationOptions,
  NormalizedOutputOptions,
  Verbs,
} from '../types';
import {
  asyncReduce,
  camel,
  dynamicImport,
  isObject,
  isString,
  isVerb,
  jsDoc,
  mergeDeep,
  sanitize,
} from '../utils';
import { generateMutator } from './mutator';

const generateVerbOptions = async ({
  verb,
  output,
  operation,
  route,
  pathRoute,
  verbParameters = [],
  context,
}: {
  verb: Verbs;
  output: NormalizedOutputOptions;
  operation: OperationObject;
  route: string;
  pathRoute: string;
  verbParameters?: (ReferenceObject | ParameterObject)[];
  components?: ComponentsObject;
  context: ContextSpecs;
}): Promise<GeneratorVerbOptions> => {
  const {
    responses,
    requestBody,
    parameters: operationParameters,
    tags = [],
    deprecated,
    description,
    summary,
  } = operation;
  const operationId = getOperationId(operation, route, verb);
  const overrideOperation = output.override.operations[operation.operationId!];
  const overrideTag = Object.entries(
    output.override.tags,
  ).reduce<NormalizedOperationOptions>(
    (acc, [tag, options]) =>
      tags.includes(tag) && options ? mergeDeep(acc, options) : acc,
    {},
  );

  const override = mergeDeep(
    mergeDeep(output.override, overrideTag),
    overrideOperation,
  );

  const overrideOperationName =
    overrideOperation?.operationName ?? output.override.operationName;
  const operationName = overrideOperationName
    ? overrideOperationName(operation, route, verb)
    : sanitize(camel(operationId), { es5keyword: true });

  const response = getResponse({
    responses,
    operationName,
    context,
    contentType: override.contentType,
  });

  const body = getBody({
    requestBody: requestBody!,
    operationName,
    context,
    contentType: override.contentType,
  });

  const parameters = getParameters({
    parameters: [...verbParameters, ...(operationParameters ?? [])],
    context,
  });

  const queryParams = getQueryParams({
    queryParams: parameters.query,
    operationName,
    context,
  });

  const headers = output.headers
    ? getQueryParams({
        queryParams: parameters.header,
        operationName,
        context,
        suffix: 'headers',
      })
    : undefined;

  const params = getParams({
    route,
    pathParams: parameters.path,
    operationId: operationId!,
    context,
    output,
  });

  const props = getProps({
    body,
    queryParams,
    params,
    headers,
    operationName,
    context,
  });

  const mutator = await generateMutator({
    output: output.target,
    name: operationName,
    mutator: override.mutator,
    workspace: context.workspace,
    tsconfig: context.output.tsconfig,
  });

  const formData =
    !override.formData.disabled && body.formData
      ? await generateMutator({
          output: output.target,
          name: operationName,
          mutator: override.formData.mutator,
          workspace: context.workspace,
          tsconfig: context.output.tsconfig,
        })
      : undefined;

  const formUrlEncoded =
    isString(override.formUrlEncoded) || isObject(override.formUrlEncoded)
      ? await generateMutator({
          output: output.target,
          name: operationName,
          mutator: override.formUrlEncoded,
          workspace: context.workspace,
          tsconfig: context.output.tsconfig,
        })
      : undefined;

  const paramsSerializer =
    isString(override.paramsSerializer) || isObject(override.paramsSerializer)
      ? await generateMutator({
          output: output.target,
          name: 'paramsSerializer',
          mutator: override.paramsSerializer as NormalizedMutator,
          workspace: context.workspace,
          tsconfig: context.output.tsconfig,
        })
      : undefined;

  const fetchReviver =
    isString(override.fetch.jsonReviver) || isObject(override.fetch.jsonReviver)
      ? await generateMutator({
          output: output.target,
          name: 'fetchReviver',
          mutator: override.fetch.jsonReviver as NormalizedMutator,
          workspace: context.workspace,
          tsconfig: context.output.tsconfig,
        })
      : undefined;
  const doc = jsDoc({ description, deprecated, summary });

  const verbOption: GeneratorVerbOptions = {
    verb: verb as Verbs,
    tags,
    route,
    pathRoute,
    summary: operation.summary,
    operationId,
    operationName,
    response,
    body,
    headers,
    queryParams,
    params,
    props,
    mutator,
    formData,
    formUrlEncoded,
    paramsSerializer,
    fetchReviver,
    override,
    doc,
    deprecated,
    originalOperation: operation,
  };

  const transformer = await dynamicImport(
    override.transformer,
    context.workspace,
  );

  return transformer ? transformer(verbOption) : verbOption;
};

export const generateVerbsOptions = ({
  verbs,
  input,
  output,
  route,
  pathRoute,
  context,
}: {
  verbs: PathItemObject;
  input: NormalizedInputOptions;
  output: NormalizedOutputOptions;
  route: string;
  pathRoute: string;
  context: ContextSpecs;
}): Promise<GeneratorVerbsOptions> =>
  asyncReduce(
    _filteredVerbs(verbs, input.filters, pathRoute),
    async (acc, [verb, operation]: [string, OperationObject]) => {
      if (isVerb(verb)) {
        const verbOptions = await generateVerbOptions({
          verb,
          output,
          verbParameters: verbs.parameters,
          route,
          pathRoute,
          operation,
          context,
        });

        acc.push(verbOptions);
      }

      return acc;
    },
    [] as GeneratorVerbsOptions,
  );

export const _filteredVerbs = (
  verbs: PathItemObject,
  filters: NormalizedInputOptions['filters'],
  pathRoute?: string,
) => {
  if (
    filters === undefined ||
    (filters.tags === undefined && filters.paths === undefined)
  ) {
    return Object.entries(verbs);
  }

  const filterTags = filters.tags || [];
  const filterPaths = filters.paths || [];
  const filterMode = filters.mode ?? 'include';

  return Object.entries(verbs).filter(
    ([verb, operation]: [string, OperationObject]) => {
      // Check for method-specific path filtering
      if (filters.paths && pathRoute) {
        const isMethodSpecificFilter =
          Array.isArray(filterPaths) &&
          filterPaths.length > 0 &&
          Array.isArray(filterPaths[0]);

        if (isMethodSpecificFilter) {
          // Method-specific filtering: [path, [methods]]
          const pathMatch = filterPaths.some((filterItem) => {
            if (!Array.isArray(filterItem) || filterItem.length !== 2)
              return false;

            const [filterPath, methods] = filterItem as [
              string | RegExp,
              string[],
            ];
            const pathMatches =
              filterPath instanceof RegExp
                ? filterPath.test(pathRoute)
                : filterPath === pathRoute;

            if (!pathMatches) return false;

            // Check if this specific verb is in the allowed methods
            return methods.includes(verb.toLowerCase());
          });

          if (filterMode === 'exclude') {
            return !pathMatch;
          } else {
            return pathMatch;
          }
        }
      }

      // Regular tag filtering
      if (filters.tags) {
        const operationTags = operation.tags || [];

        const isMatch = operationTags.some((tag) =>
          filterTags.some((filterTag) =>
            filterTag instanceof RegExp
              ? filterTag.test(tag)
              : filterTag === tag,
          ),
        );

        return filterMode === 'exclude' ? !isMatch : isMatch;
      }

      // If only path filters are specified (not method-specific),
      // we need to check if the path matches the filter
      if (filters.paths && pathRoute) {
        const isMatch = filterPaths.some((filterPath) =>
          filterPath instanceof RegExp
            ? filterPath.test(pathRoute)
            : filterPath === pathRoute,
        );

        return filterMode === 'exclude' ? !isMatch : isMatch;
      }

      return true;
    },
  );
};

export const _filteredPaths = (
  paths: Record<string, PathItemObject>,
  filters: NormalizedInputOptions['filters'],
) => {
  if (filters === undefined || filters.paths === undefined) {
    return Object.entries(paths);
  }

  const filterPaths = filters.paths || [];
  const filterMode = filters.mode || 'include';

  return Object.entries(paths).filter(
    ([pathRoute, verbs]: [string, PathItemObject]) => {
      // Check if this is method-specific filtering (array of tuples)
      const isMethodSpecificFilter =
        Array.isArray(filterPaths) &&
        filterPaths.length > 0 &&
        Array.isArray(filterPaths[0]);

      if (isMethodSpecificFilter) {
        // Method-specific filtering: [path, [methods]]
        const isMatch = filterPaths.some((filterItem) => {
          if (!Array.isArray(filterItem) || filterItem.length !== 2)
            return false;

          const [filterPath, methods] = filterItem as [
            string | RegExp,
            string[],
          ];
          const pathMatches =
            filterPath instanceof RegExp
              ? filterPath.test(pathRoute)
              : filterPath === pathRoute;

          if (!pathMatches) return false;

          // Check if any of the specified methods exist in this path
          return methods.some((method: string) => {
            const lowerMethod = method.toLowerCase();
            return lowerMethod === 'get'
              ? !!verbs.get
              : lowerMethod === 'post'
                ? !!verbs.post
                : lowerMethod === 'put'
                  ? !!verbs.put
                  : lowerMethod === 'delete'
                    ? !!verbs.delete
                    : lowerMethod === 'patch'
                      ? !!verbs.patch
                      : lowerMethod === 'head'
                        ? !!verbs.head
                        : false;
          });
        });

        return filterMode === 'exclude' ? !isMatch : isMatch;
      } else {
        // Simple path filtering (backward compatibility)
        const isMatch = filterPaths.some((filterPath) =>
          filterPath instanceof RegExp
            ? filterPath.test(pathRoute)
            : filterPath === pathRoute,
        );

        return filterMode === 'exclude' ? !isMatch : isMatch;
      }
    },
  );
};
