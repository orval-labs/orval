import {
  getBody,
  getOperationId,
  getParameters,
  getParams,
  getProps,
  getQueryParams,
  getRequestBodyContentTypes,
  getResponse,
} from '../getters';
import type {
  ContextSpec,
  GeneratorVerbOptions,
  GeneratorVerbsOptions,
  NormalizedInputOptions,
  NormalizedMutator,
  NormalizedOperationOptions,
  NormalizedOutputOptions,
  OpenApiComponentsObject,
  OpenApiOperationObject,
  OpenApiPathItemObject,
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
  pascal,
  sanitize,
} from '../utils';
import { generateMutator } from './mutator';

export interface GenerateVerbOptionsParams {
  verb: Verbs;
  output: NormalizedOutputOptions;
  operation: OpenApiOperationObject;
  route: string;
  pathRoute: string;
  verbParameters?: OpenApiPathItemObject['parameters'];
  components?: OpenApiComponentsObject;
  context: ContextSpec;
  contentType?: string;
}

/**
 * Get a content-type specific suffix for operation names (#2812)
 */
function getContentTypeSuffix(contentType: string): string {
  const contentTypeMap: Record<string, string> = {
    'application/json': 'Json',
    'multipart/form-data': 'FormData',
    'application/x-www-form-urlencoded': 'UrlEncoded',
    'application/xml': 'Xml',
    'text/plain': 'Text',
  };

  return (
    contentTypeMap[contentType] ||
    pascal(contentType.replaceAll(/[^a-zA-Z0-9]/g, '_'))
  );
}

export async function generateVerbOptions({
  verb,
  output,
  operation,
  route,
  pathRoute,
  verbParameters = [],
  context,
  contentType,
}: GenerateVerbOptionsParams): Promise<GeneratorVerbOptions> {
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
  const overrideOperation = output.override.operations[operationId];
  const overrideTag = Object.entries(
    output.override.tags,
  ).reduce<NormalizedOperationOptions>(
    (acc, [tag, options]) =>
      tags.includes(tag) && options ? mergeDeep(acc, options) : acc,
    {},
  );

  const override = mergeDeep(
    mergeDeep(output.override, overrideTag),
    overrideOperation || {},
  );

  // Store the original user-defined contentType filter for responses
  const originalContentTypeFilter = override.contentType;

  // If a specific contentType is provided, use it for filtering request body
  const requestBodyContentTypeFilter = contentType
    ? { include: [contentType] }
    : override.contentType;

  const overrideOperationName =
    overrideOperation?.operationName ?? output.override.operationName;
  let operationName = overrideOperationName
    ? overrideOperationName(operation, route, verb)
    : sanitize(camel(operationId), { es5keyword: true });

  if (contentType) {
    operationName = operationName + 'With' + getContentTypeSuffix(contentType);
  }

  const response = getResponse({
    responses: responses!,
    operationName,
    context,
    contentType: originalContentTypeFilter,
  });

  const body = getBody({
    requestBody: requestBody!,
    operationName,
    context,
    contentType: requestBodyContentTypeFilter,
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
}

export interface GenerateVerbsOptionsParams {
  verbs: OpenApiPathItemObject;
  input: NormalizedInputOptions;
  output: NormalizedOutputOptions;
  route: string;
  pathRoute: string;
  context: ContextSpec;
}

export function generateVerbsOptions({
  verbs,
  input,
  output,
  route,
  pathRoute,
  context,
}: GenerateVerbsOptionsParams): Promise<GeneratorVerbsOptions> {
  return asyncReduce(
    _filteredVerbs(verbs, input.filters),
    async (acc, [verb, operation]: [string, OpenApiOperationObject]) => {
      if (isVerb(verb)) {
        const contentTypes = getRequestBodyContentTypes(
          operation.requestBody,
          context,
        );

        // If there are multiple content types, generate a separate operation for each
        if (contentTypes.length > 1) {
          for (const contentType of contentTypes) {
            const verbOptions = await generateVerbOptions({
              verb,
              output,
              verbParameters: verbs.parameters,
              route,
              pathRoute,
              operation,
              context,
              contentType,
            });

            acc.push(verbOptions);
          }
        } else {
          // Single or no content type - generate operation as before
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
      }

      return acc;
    },
    [] as GeneratorVerbsOptions,
  );
}

export function _filteredVerbs(
  verbs: OpenApiPathItemObject,
  filters: NormalizedInputOptions['filters'],
) {
  if (filters?.tags === undefined) {
    return Object.entries(verbs);
  }

  const filterTags = filters.tags || [];
  const filterMode = filters.mode ?? 'include';

  return Object.entries(verbs).filter(
    ([, operation]: [string, OpenApiOperationObject]) => {
      const operationTags = operation.tags ?? [];

      const isMatch = operationTags.some((tag: string) =>
        filterTags.some((filterTag) =>
          filterTag instanceof RegExp ? filterTag.test(tag) : filterTag === tag,
        ),
      );

      return filterMode === 'exclude' ? !isMatch : isMatch;
    },
  );
}
