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
  NormalizedOverrideOutput,
  Verbs,
} from '../types';
import {
  asyncReduce,
  camel,
  dynamicImport,
  isBoolean,
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
      tags.includes(tag) ? mergeDeep(acc, options) : acc,
    {},
  );

  const override = mergeDeep(
    mergeDeep(output.override, overrideTag),
    overrideOperation,
  );

  const overrideOperationName =
    overrideOperation?.operationName || output.override?.operationName;
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
    ? await getQueryParams({
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
    mutator: override?.mutator,
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
    isString(override?.formUrlEncoded) || isObject(override?.formUrlEncoded)
      ? await generateMutator({
          output: output.target,
          name: operationName,
          mutator: override.formUrlEncoded,
          workspace: context.workspace,
          tsconfig: context.output.tsconfig,
        })
      : undefined;

  const paramsSerializer =
    isString(override?.paramsSerializer) || isObject(override?.paramsSerializer)
      ? await generateMutator({
          output: output.target,
          name: 'paramsSerializer',
          mutator: override.paramsSerializer as NormalizedMutator,
          workspace: context.workspace,
          tsconfig: context.output.tsconfig,
        })
      : undefined;

  const fetchReviver =
    isString(override?.fetch.jsonReviver) ||
    isObject(override?.fetch.jsonReviver)
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
    operationId: operationId!,
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
    override?.transformer,
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
    _filteredVerbs(verbs, input.filters),
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
) => {
  if (filters?.tags === undefined) {
    return Object.entries(verbs);
  }

  const filterTags = filters.tags || [];
  const filterMode = filters.mode || 'include';

  return Object.entries(verbs).filter(
    ([_verb, operation]: [string, OperationObject]) => {
      const operationTags = operation.tags || [];

      const isMatch = operationTags.some((tag) =>
        filterTags.some((filterTag) =>
          filterTag instanceof RegExp ? filterTag.test(tag) : filterTag === tag,
        ),
      );

      return filterMode === 'exclude' ? !isMatch : isMatch;
    },
  );
};
