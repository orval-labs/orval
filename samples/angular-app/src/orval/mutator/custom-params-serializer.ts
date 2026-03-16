import type { HttpParams } from '@angular/common/http';

type AngularHttpParams =
  | HttpParams
  | Record<
      string,
      string | number | boolean | null | readonly (string | number | boolean)[]
    >
  | undefined;

export default function (
  params: Record<
    string,
    string | number | boolean | null | readonly (string | number | boolean)[]
  >,
): AngularHttpParams {
  // do your implementation to transform the params

  return params;
}
