import type { HttpParams } from '@angular/common/http';

type AngularHttpParams =
  | HttpParams
  | Record<
      string,
      string | number | boolean | readonly (string | number | boolean)[]
    >
  | undefined;

type AngularHttpParamInput = Record<
  string,
  | string
  | number
  | boolean
  | null
  | readonly (string | number | boolean)[]
>;

export default function (params: AngularHttpParamInput): AngularHttpParams {
  const serialized: Record<
    string,
    string | number | boolean | readonly (string | number | boolean)[]
  > = {};

  for (const [key, value] of Object.entries(params)) {
    if (value === null) {
      continue;
    }
    serialized[key] = value;
  }

  return serialized;
}
