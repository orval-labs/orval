import {
  ComponentsObject,
  OperationObject,
  ParameterObject,
  PathItemObject,
  ReferenceObject,
} from 'openapi3-ts';
import { OperationOptions, OutputOptions, Verbs } from '../../types';
import {
  GeneratorVerbOptions,
  GeneratorVerbsOptions,
} from '../../types/generator';
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

const generateVerbOptions = ({
  workspace,
  verb,
  options = {},
  operation,
  route,
  verbParameters = [],
  components,
}: {
  workspace: string;
  verb: string;
  options?: OutputOptions;
  operation: OperationObject;
  route: string;
  verbParameters?: Array<ReferenceObject | ParameterObject>;
  components?: ComponentsObject;
}): GeneratorVerbOptions => {
  const {
    operationId,
    responses,
    requestBody,
    parameters: operationParameters,
    tags = [],
  } = operation;
  const { override, target } = options;
  const overrideOperation = override?.operations?.[operation.operationId!];
  const overrideTag = Object.entries(override?.tags || {}).reduce<
    OperationOptions | undefined
  >(
    (acc, [tag, options]) =>
      tags.includes(tag) ? mergeDeep(acc, options) : acc,
    undefined,
  );

  const definitionName = camel(operation.operationId!);

  const response = getResponse(responses, operationId!, override);

  const body = getBody(requestBody!, operationId!, override);

  const parameters = getParameters(
    [...verbParameters, ...(operationParameters || [])],
    components,
  );

  const queryParams = getQueryParams(
    parameters.query,
    definitionName,
    override,
  );

  const params = getParams({
    route,
    pathParams: parameters.path,
    operation,
    override,
  });

  const props = getProps({ body, queryParams: queryParams?.schema, params });

  const mutator = generateMutator({
    output: target,
    body,
    name: camel(operationId!),
    mutator:
      overrideOperation?.mutator || overrideTag?.mutator || override?.mutator,
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
    parameters,
    queryParams,
    params,
    props,
    mutator,
  };

  const transformer = dynamicImport(
    overrideOperation?.transformer ||
      overrideTag?.transformer ||
      override?.transformer,
    workspace,
  );

  return transformer ? transformer(verbOption) : verbOption;
};

export const generateVerbsOptions = ({
  workspace,
  verbs,
  options,
  route,
  components,
}: {
  workspace: string;
  verbs: PathItemObject;
  options?: OutputOptions;
  route: string;
  components?: ComponentsObject;
}): GeneratorVerbsOptions =>
  Object.entries(verbs).reduce<GeneratorVerbsOptions>(
    (acc, [verb, operation]: [string, OperationObject]) => {
      if (!Object.values(Verbs).includes(verb as Verbs)) {
        return acc;
      }

      if (!operation.operationId) {
        throw new Error(
          `Every path must have a operationId - No operationId set for ${verb} ${route}`,
        );
      }
      const verbOptions = generateVerbOptions({
        workspace,
        verb,
        options,
        verbParameters: verbs.parameters,
        route,
        components,
        operation,
      });

      return [...acc, verbOptions];
    },
    [],
  );
