import {
  type GetterProps,
  GetterPropType,
  type GetterQueryParam,
} from '@orval/core';

export interface FlatInputResult {
  type: string;
  destructure: string;
  properties: string;
  callArgs: string;
}

export function checkFlatInputCollisions(
  operationName: string,
  props: GetterProps,
  queryParams?: GetterQueryParam,
): void {
  const pathParamNames = props
    .filter(
      (p) =>
        p.type === GetterPropType.PARAM ||
        p.type === GetterPropType.NAMED_PATH_PARAMS,
    )
    .map((p) => p.name);

  const queryFieldNames = queryParams?.fieldNames ?? [];

  const allNames = [...pathParamNames, ...queryFieldNames];
  const seen = new Set<string>();

  for (const name of allNames) {
    if (seen.has(name)) {
      throw new Error(
        `useFlatInput: duplicate parameter name "${name}" found in operation "${operationName}". ` +
          `Path params, query params, and body fields must have unique names when using useFlatInput.`,
      );
    }
    seen.add(name);
  }
}

export function buildFlatInput(
  props: GetterProps,
  queryParams?: GetterQueryParam,
  bodyDefinition?: string,
  bodyTypeName?: string,
): FlatInputResult | undefined {
  const pathParams = props.filter(
    (p) =>
      p.type === GetterPropType.PARAM ||
      p.type === GetterPropType.NAMED_PATH_PARAMS,
  );
  const queryParamProp = props.find(
    (p) => p.type === GetterPropType.QUERY_PARAM,
  );
  const bodyProp = props.find((p) => p.type === GetterPropType.BODY);
  const hasHeaders = props.some((p) => p.type === GetterPropType.HEADER);

  if (hasHeaders) {
    return undefined;
  }

  const propCount =
    pathParams.length + (queryParamProp ? 1 : 0) + (bodyProp ? 1 : 0);

  if (propCount < 2 && pathParams.length < 2) {
    return undefined;
  }

  const pathType =
    pathParams.length > 0
      ? `{ ${pathParams.map((p) => p.definition).join('; ')} }`
      : '';
  const queryType = queryParamProp ? (queryParams?.schema.name ?? '') : '';
  const bodyType = bodyProp
    ? bodyTypeName
      ? `${bodyTypeName}<${bodyDefinition}>`
      : (bodyDefinition ?? '')
    : '';

  const types = [pathType, queryType, bodyType].filter(Boolean);
  const flatType = types.join(' & ');

  if (!flatType) {
    return undefined;
  }

  const pathNames = pathParams.map((p) => p.name);
  const queryFieldNames = queryParams?.fieldNames ?? [];
  const knownNames = [...pathNames, ...queryFieldNames];

  let destructureNames: string[];
  if (bodyProp) {
    destructureNames = [...knownNames, '...data'];
  } else if (queryParamProp) {
    destructureNames = [...pathNames, '...params'];
  } else {
    destructureNames = [...pathNames];
  }

  const properties = destructureNames.join(', ');
  const destructure = `{ ${properties} }: ${flatType},`;

  const callArgs = props
    .filter((p) => p.type !== GetterPropType.HEADER)
    .map((p) => {
      if (
        p.type === GetterPropType.PARAM ||
        p.type === GetterPropType.NAMED_PATH_PARAMS
      ) {
        return p.name;
      }
      if (p.type === GetterPropType.QUERY_PARAM) {
        return queryFieldNames.length > 0
          ? `{ ${queryFieldNames.join(', ')} }`
          : p.name;
      }
      if (p.type === GetterPropType.BODY) {
        return 'data';
      }
      return p.name;
    })
    .join(', ');

  return { type: flatType, destructure, properties, callArgs };
}
