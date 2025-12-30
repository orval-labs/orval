/* eslint-disable @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars */

export function fn0Param() {}
export function fn1Param(param1?: number) {}
export function fn2Param(param1?: number, param2?: number) {}
export function fn3Param(param1?: number, param2?: number, param3?: number) {}

export const lambda0Param = () => {};
export const lambda1Param = (param1?: number) => {};
export const lambda2Param = (param1?: number, param2?: number) => {};
export const lambda3Param = (
  param1?: number,
  param2?: number,
  param3?: number,
) => {};

export const nestedLambda0Param = () => () => {};
export const nestedLambda1Param = () => (param1?: number) => {};
export const nestedLambda2Param =
  () => (param1?: number, param2?: number) => {};
export const nestedLambda3Param =
  () => (param1?: number, param2?: number, param3?: number) => {};

export function fnCallback(
  useCallback: (param1?: number) => 0,
  param1?: number,
) {
  return useCallback(param1);
}

export function fnNestedLambda2Param() {
  return (param1?: number, param2?: number) => {};
}
