import type { AngularOptions, ClientGeneratorsBuilder } from '@orval/core';

import { generateAngularBaseUrlExtraFiles } from './base-url';
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

export * from './base-url';
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
  extraFiles: generateAngularBaseUrlExtraFiles,
};

const httpResourceBuilder: ClientGeneratorsBuilder = {
  client: generateHttpResourceClient,
  header: generateHttpResourceHeader,
  dependencies: getAngularHttpResourceDependencies,
  footer: generateHttpResourceFooter,
  title: generateAngularTitle,
  extraFiles: generateAngularBaseUrlExtraFiles,
};

const bothClientBuilder: ClientGeneratorsBuilder = {
  ...httpClientBuilder,
  extraFiles: async (verbOptions, output, context) => [
    ...(await generateHttpResourceExtraFiles(verbOptions, output, context)),
    ...(await generateAngularBaseUrlExtraFiles(verbOptions, output, context)),
  ],
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
