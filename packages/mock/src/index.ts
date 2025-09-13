import {
  GenerateMockImports,
  GeneratorOptions,
  GeneratorVerbOptions,
  GlobalMockOptions,
} from '@orval/core';

import { generateMSW, generateMSWImports } from './msw';

export const DEFAULT_MOCK_OPTIONS: GlobalMockOptions = {
  type: 'msw',
  useExamples: false,
};

export const generateMockImports: GenerateMockImports = (importOptions) => {
  switch (importOptions.options?.type) {
    default: {
      // case 'msw':
      return generateMSWImports(importOptions);
    }
  }
};

export const generateMock = (
  generatorVerbOptions: GeneratorVerbOptions,
  generatorOptions: Omit<GeneratorOptions, 'mock'> & {
    mock: GlobalMockOptions;
  },
) => {
  switch (generatorOptions.mock.type) {
    default: {
      // case 'msw':
      return generateMSW(generatorVerbOptions, generatorOptions);
    }
  }
};
