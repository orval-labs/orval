import {
  ComponentsObject,
  OperationObject,
  ParameterObject,
  PathItemObject,
  ReferenceObject,
} from 'openapi3-ts';
import { OverrideOutput, Verbs } from '../../types';
import {
  GeneratorVerbOptions,
  GeneratorVerbsOptions,
} from '../../types/generator';
import { camel } from '../../utils/case';
import { dynamicImport } from '../../utils/imports';
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
  override,
  operation,
  route,
  verbParameters = [],
  components,
}: {
  workspace: string;
  verb: string;
  override?: OverrideOutput;
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
  const overrideOperation = override?.operations?.[operation.operationId!];

  const definitionName = camel(operation.operationId!);

  const response = getResponse(responses, operationId!);

  const body = getBody(requestBody!, operationId!);

  const parameters = getParameters(
    [...verbParameters, ...(operationParameters || [])],
    components,
  );

  const queryParams = getQueryParams(parameters.query, definitionName);

  const params = getParams({
    route,
    pathParams: parameters.path,
    operation,
  });

  const props = getProps({ body, queryParams: queryParams?.schema, params });

  const mutator = generateMutator({
    workspace,
    body,
    mutator: overrideOperation?.mutator || override?.mutator,
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
    overrideOperation?.transformer || override?.transformer,
    workspace,
  );

  return transformer ? transformer(verbOption) : verbOption;
};

export const generateVerbsOptions = ({
  workspace,
  verbs,
  override,
  route,
  components,
}: {
  workspace: string;
  verbs: PathItemObject;
  override?: OverrideOutput;
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
      const options = generateVerbOptions({
        workspace,
        verb,
        override,
        verbParameters: verbs.parameters,
        route,
        components,
        operation,
      });

      return [...acc, options];
    },
    [],
  );
