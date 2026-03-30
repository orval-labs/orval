import {
  type GetterProps,
  GetterPropType,
  type GetterQueryParam,
} from '@orval/core';

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
