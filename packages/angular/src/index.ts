import type { AngularOptions, ClientGeneratorsBuilder } from '@orval/core';

import {
  generateAngular,
  generateAngularFooter,
  generateAngularHeader,
  generateAngularTitle,
  getAngularDependencies,
} from './http-client';
import {
  generateHttpResourceClient,
  generateHttpResourceExtraFiles,
  generateHttpResourceFooter,
  generateHttpResourceHeader,
  getAngularHttpResourceDependencies,
} from './http-resource';

export * from './constants';
export * from './http-client';
export * from './http-resource';
export * from './types';
export * from './utils';

const httpClientBuilder: ClientGeneratorsBuilder = {
  client: generateAngular,
  header: generateAngularHeader,
  dependencies: getAngularDependencies,
  footer: generateAngularFooter,
  title: generateAngularTitle,
};

const httpResourceBuilder: ClientGeneratorsBuilder = {
  client: generateHttpResourceClient,
  header: generateHttpResourceHeader,
  dependencies: getAngularHttpResourceDependencies,
  footer: generateHttpResourceFooter,
  title: generateAngularTitle,
};

const bothClientBuilder: ClientGeneratorsBuilder = {
  ...httpClientBuilder,
  extraFiles: generateHttpResourceExtraFiles,
};

export const builder = () => (options?: AngularOptions) => {
  switch (options?.client) {
    case 'httpResource': {
      return httpResourceBuilder;
    }
    case 'both': {
      return bothClientBuilder;
    }
    default: {
      return httpClientBuilder;
    }
  }
};

export default builder;
