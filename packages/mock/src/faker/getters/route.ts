import { camelPathParamName, toColonRoutePath } from '@orval/core';

// MSW route params are camelized to match the generated mock function args.
export const getRouteMSW = (route: string, baseUrl = '*') =>
  `${baseUrl}${toColonRoutePath(route.replaceAll(':', String.raw`\\:`), camelPathParamName)}`;
