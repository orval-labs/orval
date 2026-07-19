import { sanitizePathParamName, toColonRoutePath } from '@orval/core';

// Hono keeps the original parameter name (no camelization): the `:name` in
// the route is the key Hono's runtime and validators expose, so it must match
// the spec's parameter name (e.g. `{scope.id}` → `:scope.id`).
export const getRoute = (route: string) =>
  toColonRoutePath(route, sanitizePathParamName);
