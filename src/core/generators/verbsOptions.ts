import {camel} from 'case';
import {
  ComponentsObject,
  OperationObject,
  ParameterObject,
  PathItemObject,
  ReferenceObject
} from 'openapi3-ts';
import {OverrideOutput, Verbs} from '../../types';
import {
  GeneratorVerbOptions,
  GeneratorVerbsOptions
} from '../../types/generator';
import {getBody} from '../getters/body';
import {getParameters} from '../getters/parameters';
import {getParams} from '../getters/params';
import {getProps} from '../getters/props';
import {getQueryParams} from '../getters/queryParams';
import {getResponse} from '../getters/response';
import {generateTransformer} from './transformer';

const generateVerbOptions = ({
  verb,
  override,
  operation,
  route,
  verbParameters = [],
  components
}: {
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
    parameters: operationParameters
  } = operation;

  const overrideOperation = override?.operations?.[operation.operationId!];

  const definitionName = camel(operation.operationId!);

  const response = getResponse(responses, operationId!);

  const body = getBody(requestBody!);

  const parameters = getParameters(
    [...verbParameters, ...(operationParameters || [])],
    components
  );

  const queryParams = getQueryParams(parameters.query, definitionName);

  const params = getParams({
    route,
    pathParams: parameters.path,
    operation
  });

  const props = getProps({body, queryParams, params});

  const transformer = generateTransformer({
    body,
    overrideOperation
  });

  return {
    verb: verb as Verbs,
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
    transformer
  };
};

export const generateVerbsOptions = ({
  verbs,
  override,
  route,
  components
}: {
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
          `Every path must have a operationId - No operationId set for ${verb} ${route}`
        );
      }

      return [
        ...acc,
        generateVerbOptions({
          verb,
          override,
          verbParameters: verbs.parameters,
          route,
          components,
          operation
        })
      ];
    },
    []
  );
