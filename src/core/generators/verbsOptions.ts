import {
  ComponentsObject,
  OperationObject,
  ParameterObject,
  PathItemObject,
  ReferenceObject,
} from 'openapi3-ts';
import {
  ContextSpecs,
  OperationOptions,
  OutputOptions,
  Verbs,
} from '../../types';
import {
  GeneratorVerbOptions,
  GeneratorVerbsOptions,
} from '../../types/generator';
import { asyncReduce } from '../../utils/async-reduce';
import { camel } from '../../utils/case';
import { dynamicImport } from '../../utils/imports';
import { mergeDeep } from '../../utils/mergeDeep';
import { getBody } from '../getters/body';
import { getParameters } from '../getters/parameters';
import { getParams } from '../getters/params';
import { getProps } from '../getters/props';
import { getQueryParams } from '../getters/queryParams';
import { getResponse } from '../getters/response';
import { generateMutator } from './mutator';

const generateVerbOptions = async ({
  verb,
  output = {},
  operation,
  route,
  verbParameters = [],
  context,
}: {
  verb: string;
  output?: OutputOptions;
  operation: OperationObject;
  route: string;
  verbParameters?: Array<ReferenceObject | ParameterObject>;
  components?: ComponentsObject;
  context: ContextSpecs;
}): Promise<GeneratorVerbOptions> => {
  const {
    operationId,
    responses,
    requestBody,
    parameters: operationParameters,
    tags = [],
  } = operation;

  const overrideOperation =
    output.override?.operations?.[operation.operationId!];
  const overrideTag = Object.entries(
    output.override?.tags || {},
  ).reduce<OperationOptions>(
    (acc, [tag, options]) =>
      tags.includes(tag) ? mergeDeep(acc, options) : acc,
    {},
  );

  const definitionName = camel(operation.operationId!);

  const response = await getResponse(responses, operationId!, context);

  const body = await getBody(requestBody!, operationId!, context);
  const parameters = await getParameters({
    parameters: [...verbParameters, ...(operationParameters || [])],
    context,
  });

  const queryParams = await getQueryParams({
    queryParams: parameters.query,
    definitionName,
    context,
  });

  const params = await getParams({
    route,
    pathParams: parameters.path,
    operationId: operationId!,
    context,
  });

  const props = getProps({ body, queryParams: queryParams?.schema, params });

  const mutator = generateMutator({
    output: output.target,
    name: camel(operationId!),
    mutator:
      overrideOperation?.mutator ||
      overrideTag?.mutator ||
      output.override?.mutator,
  });

  const verbOption = {
    verb: verb as Verbs,
    tags,
    summary: operation.summary,
    operationId: operationId!,
    definitionName,
    overrideOperation,
    response,
    body,
    queryParams,
    params,
    props,
    mutator,
  };

  const transformer = await dynamicImport(
    overrideOperation?.transformer ||
      overrideTag?.transformer ||
      output.override?.transformer,
    context.workspace,
  );

  return transformer ? transformer(verbOption) : verbOption;
};

export const generateVerbsOptions = ({
  verbs,
  output,
  route,
  context,
}: {
  verbs: PathItemObject;
  output?: OutputOptions;
  route: string;
  context: ContextSpecs;
}): Promise<GeneratorVerbsOptions> =>
  asyncReduce(
    Object.entries(verbs),
    async (acc, [verb, operation]: [string, OperationObject]) => {
      if (!Object.values(Verbs).includes(verb as Verbs)) {
        return acc;
      }

      if (!operation.operationId) {
        throw new Error(
          `Every path must have a operationId - No operationId set for ${verb} ${route}`,
        );
      }
      const verbOptions = await generateVerbOptions({
        verb,
        output,
        verbParameters: verbs.parameters,
        route,
        operation,
        context,
      });

      return [...acc, verbOptions];
    },
    [] as GeneratorVerbsOptions,
  );
